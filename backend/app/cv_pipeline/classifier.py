"""Currency / denomination classifier.

Priority chain:
  1. BankNote-Net (96.8% currency / 92.4% denomination) — 17 currencies
  2. MobileNetV2-INR  — 78.6% accuracy, INR denominations only
  3. MobileNetV2-EUR  — 90.9% accuracy, EUR classes from org_data
  4. Heuristic Lab fingerprints (colorspace.classify) — always available

All tuple formats match colorspace.py:
  top_currencies    : [(currency_code, confidence), ...]
  top_denominations : [(currency_code, denomination, confidence), ...]
"""
from __future__ import annotations

import json
import os
from typing import Iterable

import numpy as np

from . import colorspace

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
IMG_SIZE  = 224

INR_H5_PATH = os.path.join(MODEL_DIR, "inr_mobilenet.h5")
INR_LM_PATH = os.path.join(MODEL_DIR, "inr_label_map.json")
USD_H5_PATH = os.path.join(MODEL_DIR, "usd_mobilenet.h5")
USD_LM_PATH = os.path.join(MODEL_DIR, "usd_label_map.json")
EUR_H5_PATH = os.path.join(MODEL_DIR, "eur_mobilenet.h5")
EUR_LM_PATH = os.path.join(MODEL_DIR, "eur_label_map.json")

BN_ENCODER_PATH = os.path.join(MODEL_DIR, "banknote_net_rebuilt.keras")
BN_CUR_CLF_PATH = os.path.join(MODEL_DIR, "bn_currency_clf.joblib")
BN_DEN_CLF_PATH = os.path.join(MODEL_DIR, "bn_denomination_clf.joblib")
BN_SUMMARY_PATH = os.path.join(MODEL_DIR, "bn_summary.json")

_inr_model  = None
_inr_labels: dict | None = None
_usd_model  = None
_usd_labels: dict | None = None
_eur_model  = None
_eur_labels: dict | None = None
_bn_encoder = None
_bn_cur_clf = None
_bn_den_clf = None
_bn_currencies: list[str] = []


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

        cur_probs = _bn_cur_clf.predict_proba([emb])[0]
        cur_classes = list(_bn_cur_clf.classes_)
        top_cur_idx = int(np.argmax(cur_probs))
        currency    = cur_classes[top_cur_idx]
        cur_conf    = float(cur_probs[top_cur_idx])

        # Filter by enabled currencies if specified
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

        den_probs  = _bn_den_clf.predict_proba([emb])[0]
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


def _load_inr() -> bool:
    global _inr_model, _inr_labels
    if _inr_model is not None:
        return True
    if not (os.path.exists(INR_H5_PATH) and os.path.exists(INR_LM_PATH)):
        return False
    try:
        import tensorflow as tf
        _inr_model = tf.keras.models.load_model(INR_H5_PATH)
        with open(INR_LM_PATH) as f:
            _inr_labels = json.load(f)
        return True
    except Exception:
        return False


def _load_usd() -> bool:
    global _usd_model, _usd_labels
    if _usd_model is not None:
        return True
    if not (os.path.exists(USD_H5_PATH) and os.path.exists(USD_LM_PATH)):
        return False
    try:
        import tensorflow as tf
        _usd_model = tf.keras.models.load_model(USD_H5_PATH)
        with open(USD_LM_PATH) as f:
            _usd_labels = json.load(f)
        return True
    except Exception:
        return False


def _load_eur() -> bool:
    global _eur_model, _eur_labels
    if _eur_model is not None:
        return True
    if not (os.path.exists(EUR_H5_PATH) and os.path.exists(EUR_LM_PATH)):
        return False
    try:
        import tensorflow as tf
        from tensorflow.keras import layers as _kl

        # EUR model was saved with an older TF version that serialised extra
        # kwargs (renorm, quantization_config, etc.) that newer TF no longer
        # accepts.  Patch every affected layer class to silently drop unknown
        # kwargs so the model can be loaded without retraining.
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
            for cls in [
                _kl.BatchNormalization, _kl.Dense, _kl.Conv2D,
                _kl.DepthwiseConv2D, _kl.ReLU, _kl.Activation,
            ]
        }

        _eur_model = tf.keras.models.load_model(
            EUR_H5_PATH,
            custom_objects=custom_objs,
            compile=False,
        )
        with open(EUR_LM_PATH) as f:
            _eur_labels = json.load(f)
        return True
    except Exception as e:
        print(f"[classifier] EUR model load failed: {e}")
        return False


def _mobilenet_predict(img_bgr: np.ndarray, model, labels: dict, currency: str):
    """Run a loaded MobileNetV2 on img_bgr. Returns (denomination, confidence, top_denoms)."""
    import cv2
    # Use img_size stored in label map (USD=96, INR/EUR=224) — don't assume 224
    sz = int(labels.get("img_size", IMG_SIZE))
    rgb     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (sz, sz)).astype("float32") / 255.0
    probs   = model.predict(np.expand_dims(resized, 0), verbose=0)[0]
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
    parts = ["Lab heuristic"]
    if os.path.exists(INR_H5_PATH):
        parts.insert(0, "MobileNetV2-INR")
    if os.path.exists(USD_H5_PATH):
        parts.insert(0, "MobileNetV2-USD")
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
    top_curs     = r["top_currencies"]    # [(currency, conf), ...]
    top_dens     = r["top_denominations"] # [(currency, denom, conf), ...]

    # ── MobileNetV2 denomination overrides ───────────────────────────────────
    # EUR label map fixed: class IDs 0-11 now mapped to real denominations
    # (€5,€10,€20,€50) via OCR+color analysis on org_data crops.
    # EUR covers only €5-€50 (dataset limitation) — €100+ still OCR-only.
    # BankNote-Net disabled: rebuilt encoder gives wrong embeddings.
    try:
        if currency == "INR" and _load_inr():
            denom, conf, tops = _mobilenet_predict(img_bgr, _inr_model, _inr_labels, "INR")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass

    try:
        if currency == "USD" and _load_usd():
            denom, conf, tops = _mobilenet_predict(img_bgr, _usd_model, _usd_labels, "USD")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass

    try:
        if currency == "EUR" and _load_eur():
            denom, conf, tops = _mobilenet_predict(img_bgr, _eur_model, _eur_labels, "EUR")
            denomination = denom
            den_conf     = conf
            top_dens     = tops
    except Exception:
        pass  # keep heuristic values

    return {
        "currency":            currency,
        "denomination":        denomination,
        "currency_confidence": cur_conf,
        "denom_confidence":    den_conf,
        "ml_confidence":       float(0.6 * den_conf + 0.4 * cur_conf),
        "top_currencies":      top_curs,
        "top_denominations":   top_dens,
        "lab":                 r["lab"],
        "model":               MODEL_NAME,
    }
