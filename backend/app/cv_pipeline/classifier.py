"""Currency / denomination classifier.

Active priority chain (what predict() actually runs):
  1. Lab colour fingerprints (colorspace.classify) — always runs, provides currency
  2. TFLite MobileNetV2-USD — 97.8% accuracy, 6 USD denominations (1,2,5,10,50,100)
     NOTE: USD $20 is NOT in this model's training set; OCR cross-validation handles $20.
  3. TFLite MobileNetV2-EUR — EUR 5/10/20/50 only (100/200/500 fall back to Lab)
  4. TFLite MobileNetV2-INR — INR denominations
  5. TFLite probe: corrects Lab mis-IDs for same-colour currencies (USD/EUR vs SGD/CAD etc.)

BankNote-Net encoder (_bn_predict) is loaded from disk but intentionally NOT called
in predict() — it requires full TensorFlow (~600 MB) and adds latency without
significantly improving accuracy over the TFLite + Lab combination.

TFLite models (.tflite) are preferred over .h5 — they use a tiny runtime
(ai-edge-litert ~30 MB vs tensorflow-cpu ~600 MB) and run 2-3× faster.
"""
from __future__ import annotations

import json
import os
from typing import Iterable

import numpy as np

from . import colorspace

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
IMG_SIZE  = 224   # default; overridden per-model by label map img_size

# ── Model paths ───────────────────────────────────────────────────────────────
INR_TFLITE  = os.path.join(MODEL_DIR, "inr_mobilenet.tflite")
INR_LM_PATH = os.path.join(MODEL_DIR, "inr_label_map.json")
INR_H5_PATH = os.path.join(MODEL_DIR, "inr_mobilenet.h5")

USD_TFLITE  = os.path.join(MODEL_DIR, "usd_mobilenet.tflite")
USD_LM_PATH = os.path.join(MODEL_DIR, "usd_label_map.json")
USD_H5_PATH = os.path.join(MODEL_DIR, "usd_mobilenet.h5")

EUR_TFLITE  = os.path.join(MODEL_DIR, "eur_mobilenet.tflite")
EUR_LM_PATH = os.path.join(MODEL_DIR, "eur_label_map.json")
EUR_H5_PATH = os.path.join(MODEL_DIR, "eur_mobilenet.h5")

BN_ENCODER_PATH = os.path.join(MODEL_DIR, "banknote_net_rebuilt.keras")
BN_CUR_CLF_PATH = os.path.join(MODEL_DIR, "bn_currency_clf.joblib")
BN_DEN_CLF_PATH = os.path.join(MODEL_DIR, "bn_denomination_clf.joblib")
BN_SUMMARY_PATH = os.path.join(MODEL_DIR, "bn_summary.json")

# ── Cached model state ────────────────────────────────────────────────────────
_inr_interp  = None   # TFLite interpreter
_inr_labels: dict | None = None
_usd_interp  = None
_usd_labels: dict | None = None
_eur_interp  = None
_eur_labels: dict | None = None
_bn_encoder = None
_bn_cur_clf = None
_bn_den_clf = None
_bn_currencies: list[str] = []


# ── TFLite runtime loader (tries ai_edge_litert, tflite_runtime, then full TF) ─
def _get_tflite_interpreter():
    """Return the TFLite Interpreter class, or None if no runtime is available."""
    try:
        from ai_edge_litert.interpreter import Interpreter
        return Interpreter
    except ImportError:
        pass
    try:
        from tflite_runtime.interpreter import Interpreter
        return Interpreter
    except ImportError:
        pass
    try:
        import tensorflow as tf
        return tf.lite.Interpreter
    except ImportError:
        pass
    return None


def _load_tflite(tflite_path: str, h5_path: str, lm_path: str):
    """Load a TFLite model + label map.  Returns (interpreter, labels) or (None, None)."""
    if not os.path.exists(lm_path):
        return None, None

    with open(lm_path) as f:
        labels = json.load(f)

    # ── Try TFLite first ───────────────────────────────────────────────────────
    Interp = _get_tflite_interpreter()
    if Interp and os.path.exists(tflite_path):
        try:
            interp = Interp(model_path=tflite_path)
            interp.allocate_tensors()
            return interp, labels
        except Exception as e:
            print(f"[classifier] TFLite load failed ({tflite_path}): {e}")

    # ── Fall back to .h5 via full TensorFlow ──────────────────────────────────
    if os.path.exists(h5_path):
        try:
            import tensorflow as tf
            model = tf.keras.models.load_model(h5_path)
            return model, labels        # full Keras model — handled below
        except Exception as e:
            print(f"[classifier] H5 load failed ({h5_path}): {e}")

    return None, None


def _load_eur_tflite():
    """EUR model needs a compat patch if loading .h5 (old TF kwargs)."""
    if not os.path.exists(EUR_LM_PATH):
        return None, None

    with open(EUR_LM_PATH) as f:
        labels = json.load(f)

    Interp = _get_tflite_interpreter()
    if Interp and os.path.exists(EUR_TFLITE):
        try:
            interp = Interp(model_path=EUR_TFLITE)
            interp.allocate_tensors()
            return interp, labels
        except Exception as e:
            print(f"[classifier] EUR TFLite load failed: {e}")

    # Fall back to .h5 with compat patch
    if os.path.exists(EUR_H5_PATH):
        try:
            import tensorflow as tf
            from tensorflow.keras import layers as _kl
            _STRIP = {"renorm", "renorm_clipping", "renorm_momentum",
                      "quantization_config"}

            def _make_compat(base_cls):
                class _Compat(base_cls):
                    def __init__(self, **kwargs):
                        for k in _STRIP:
                            kwargs.pop(k, None)
                        super().__init__(**kwargs)
                _Compat.__name__ = base_cls.__name__
                return _Compat

            custom_objs = {
                cls.__name__: _make_compat(cls)
                for cls in [_kl.BatchNormalization, _kl.Dense, _kl.Conv2D,
                            _kl.DepthwiseConv2D, _kl.ReLU, _kl.Activation]
            }
            model = tf.keras.models.load_model(
                EUR_H5_PATH, custom_objects=custom_objs, compile=False)
            return model, labels
        except Exception as e:
            print(f"[classifier] EUR H5 load failed: {e}")

    return None, None


def _load_inr() -> bool:
    global _inr_interp, _inr_labels
    if _inr_interp is not None:
        return True
    _inr_interp, _inr_labels = _load_tflite(INR_TFLITE, INR_H5_PATH, INR_LM_PATH)
    return _inr_interp is not None


def _load_usd() -> bool:
    global _usd_interp, _usd_labels
    if _usd_interp is not None:
        return True
    _usd_interp, _usd_labels = _load_tflite(USD_TFLITE, USD_H5_PATH, USD_LM_PATH)
    return _usd_interp is not None


def _load_eur() -> bool:
    global _eur_interp, _eur_labels
    if _eur_interp is not None:
        return True
    _eur_interp, _eur_labels = _load_eur_tflite()
    return _eur_interp is not None


def _load_bn() -> bool:
    global _bn_encoder, _bn_cur_clf, _bn_den_clf, _bn_currencies
    if _bn_encoder is not None:
        return True
    paths = [BN_ENCODER_PATH, BN_CUR_CLF_PATH, BN_DEN_CLF_PATH]
    if not all(os.path.exists(p) for p in paths):
        return False
    try:
        import joblib
        import tensorflow as tf
        _bn_encoder = tf.keras.models.load_model(BN_ENCODER_PATH)
        _bn_cur_clf = joblib.load(BN_CUR_CLF_PATH)
        _bn_den_clf = joblib.load(BN_DEN_CLF_PATH)
        if os.path.exists(BN_SUMMARY_PATH):
            with open(BN_SUMMARY_PATH) as f:
                _bn_currencies = json.load(f).get("currencies", [])
        return True
    except Exception:
        return False


def _bn_predict(img_bgr: np.ndarray, enabled_currencies: list[str] | None) -> dict | None:
    """Run BankNote-Net encoder + sklearn classifiers. Returns dict or None on failure."""
    try:
        import cv2
        rgb     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE)).astype("float32") / 255.0
        emb     = _bn_encoder.predict(np.expand_dims(resized, 0), verbose=0)[0]

        cur_probs   = _bn_cur_clf.predict_proba([emb])[0]
        cur_classes = list(_bn_cur_clf.classes_)
        top_cur_idx = int(np.argmax(cur_probs))
        currency    = cur_classes[top_cur_idx]
        cur_conf    = float(cur_probs[top_cur_idx])

        if enabled_currencies:
            allowed = set(enabled_currencies)
            valid = [(c, float(cur_probs[i])) for i, c in enumerate(cur_classes) if c in allowed]
            if valid:
                currency, cur_conf = max(valid, key=lambda x: x[1])
                top_cur_idx = cur_classes.index(currency)

        top_curs = sorted(
            [(c, float(cur_probs[i])) for i, c in enumerate(cur_classes)],
            key=lambda x: -x[1],
        )[:5]

        den_probs   = _bn_den_clf.predict_proba([emb])[0]
        den_classes = list(_bn_den_clf.classes_)
        top_den_idx = int(np.argmax(den_probs))
        denomination = str(den_classes[top_den_idx])
        den_conf     = float(den_probs[top_den_idx])
        top_dens = sorted(
            [(currency, str(den_classes[i]), float(den_probs[i])) for i in range(len(den_probs))],
            key=lambda x: -x[2],
        )[:5]

        return {
            "currency": currency, "denomination": denomination,
            "currency_confidence": cur_conf, "denom_confidence": den_conf,
            "top_currencies": top_curs, "top_denominations": top_dens,
        }
    except Exception:
        return None


def _mobilenet_predict(
    img_bgr: np.ndarray,
    model_or_interp,
    labels: dict,
    currency: str,
):
    """Run a MobileNetV2 (TFLite interpreter or Keras model) on img_bgr.

    Returns (denomination, confidence, top_denoms).
    """
    import cv2
    sz  = int(labels.get("img_size", IMG_SIZE))
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    arr = cv2.resize(rgb, (sz, sz)).astype("float32") / 255.0
    inp = np.expand_dims(arr, 0)

    # ── TFLite interpreter path ────────────────────────────────────────────────
    if hasattr(model_or_interp, "get_input_details"):
        interp = model_or_interp
        in_det  = interp.get_input_details()
        out_det = interp.get_output_details()
        interp.set_tensor(in_det[0]["index"], inp)
        interp.invoke()
        probs = interp.get_tensor(out_det[0]["index"])[0]
    else:
        # Full Keras model (.h5 fallback)
        probs = model_or_interp.predict(inp, verbose=0)[0]

    classes: dict = labels["classes"]
    top_idx = int(np.argmax(probs))
    denom   = classes.get(str(top_idx), "Unknown")
    conf    = float(probs[top_idx])
    top_dens = sorted(
        [(currency, classes.get(str(i), str(i)), float(probs[i]))
         for i in range(len(probs))],
        key=lambda x: -x[2],
    )[:5]
    return denom, conf, top_dens


def _model_name() -> str:
    parts = []
    if os.path.exists(USD_TFLITE) or os.path.exists(USD_H5_PATH):
        parts.append("TFLite-USD")
    if os.path.exists(EUR_TFLITE) or os.path.exists(EUR_H5_PATH):
        parts.append("TFLite-EUR")
    if os.path.exists(INR_TFLITE) or os.path.exists(INR_H5_PATH):
        parts.append("TFLite-INR")
    parts.append("Lab heuristic")
    return " + ".join(parts)


MODEL_NAME = _model_name()


def predict(
    img_bgr: np.ndarray,
    enabled_currencies: Iterable[str] | None = None,
    currency_hint: str | None = None,
) -> dict:
    enabled_list = list(enabled_currencies) if enabled_currencies else None

    # ── Heuristic baseline (always runs, provides currency detection) ─────────
    r = colorspace.classify(
        img_bgr,
        enabled_currencies=enabled_list,
        currency_hint=currency_hint,
    )

    currency     = r["currency"]
    denomination = r["denomination"]
    cur_conf     = r["currency_confidence"]
    den_conf     = r["denom_confidence"]
    top_curs     = r["top_currencies"]
    top_dens     = r["top_denominations"]

    # ── TFLite MobileNetV2 denomination overrides ─────────────────────────────
    try:
        if currency == "USD" and _load_usd():
            denom, conf, tops = _mobilenet_predict(img_bgr, _usd_interp, _usd_labels, "USD")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass

    try:
        if currency == "EUR" and _load_eur():
            denom, conf, tops = _mobilenet_predict(img_bgr, _eur_interp, _eur_labels, "EUR")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass

    try:
        if currency == "INR" and _load_inr():
            denom, conf, tops = _mobilenet_predict(img_bgr, _inr_interp, _inr_labels, "INR")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass

    # ── TFLite probe: correct Lab mis-IDs for same-colour currencies ───────────
    # USD/EUR/GBP notes all have a grey-green/pastel base — Lab colour analysis
    # can mistake them for SGD, CAD, HKD, AUD, CHF, etc. when printed elements
    # (portrait, security strip) dominate the colour sample.
    # Fix: when no currency_hint is given and Lab chose a same-colour currency
    # that has no dedicated TFLite model, probe the USD and EUR models.
    # Genuine USD/EUR images score >70%; unrelated images score ~15–25%.
    _SAME_COLOUR_NO_TFLITE = {
        "GBP", "JPY", "AUD", "CAD", "CHF", "SGD",
        "HKD", "KRW", "CNY", "THB", "MYR",
    }
    if currency_hint is None and currency in _SAME_COLOUR_NO_TFLITE:
        try:
            probe_best_cur  = None
            probe_best_conf = 0.0
            probe_best_den  = ""
            probe_best_tops: list = []

            for probe_cur, load_fn, get_interp, get_labels in [
                ("USD", _load_usd, lambda: _usd_interp, lambda: _usd_labels),
                ("EUR", _load_eur, lambda: _eur_interp, lambda: _eur_labels),
            ]:
                if load_fn():
                    d, c, tops = _mobilenet_predict(
                        img_bgr, get_interp(), get_labels(), probe_cur
                    )
                    if c > probe_best_conf:
                        probe_best_conf = c
                        probe_best_cur  = probe_cur
                        probe_best_den  = d
                        probe_best_tops = tops

            if probe_best_conf >= 0.65 and probe_best_cur:
                currency    = probe_best_cur
                denomination = probe_best_den
                den_conf    = probe_best_conf
                top_dens    = probe_best_tops
        except Exception:
            pass

    # ml_confidence: blend denomination and currency signals.
    # When a TFLite model ran, den_conf comes from a trained visual
    # classifier — more trustworthy than the Lab heuristic for currency.
    # Weight denomination confidence more heavily in that case.
    has_tflite = any([
        currency == "USD" and _usd_interp is not None,
        currency == "EUR" and _eur_interp is not None,
        currency == "INR" and _inr_interp is not None,
    ])
    if has_tflite:
        # TFLite ran → denomination confidence is high-quality
        blended_conf = 0.70 * den_conf + 0.30 * cur_conf
    else:
        # Lab only → both signals are heuristic quality
        blended_conf = 0.50 * den_conf + 0.50 * cur_conf

    return {
        "currency":            currency,
        "denomination":        denomination,
        "currency_confidence": cur_conf,
        "denom_confidence":    den_conf,
        "ml_confidence":       float(blended_conf),
        "top_currencies":      top_curs,
        "top_denominations":   top_dens,
        "lab":                 r["lab"],
        "model":               MODEL_NAME,
    }
