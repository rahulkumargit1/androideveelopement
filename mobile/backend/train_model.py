"""
VeriCash — Transfer-learning trainer for denomination classifiers.

Trains MobileNetV2 (ImageNet pretrained) on:
  - INR denominations  (local Train/ Test/ folders)
  - USD denominations  (Kaggle dataset, downloaded automatically)

Also downloads Microsoft BankNote-Net embeddings (24K rows, 17 currencies)
and trains a lightweight sklearn MLP on top for multi-currency classification.

Run from project root:
    # Train everything (INR + USD + BankNote-Net)
    python backend/train_model.py

    # Train USD only (after downloading Kaggle dataset)
    python backend/train_model.py --usd-only

    # Download USD Kaggle dataset first
    python backend/train_model.py --download-usd

Kaggle setup (one-time):
    pip install kaggle
    # Place kaggle.json in C:/Users/<you>/.kaggle/kaggle.json
    # Get it from https://www.kaggle.com/settings → API → Create New Token
"""
from __future__ import annotations

import os
import sys
import shutil
import urllib.request

# ── silence TF verbose output ───────────────────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_DIR   = os.path.join(ROOT, "Train")
TEST_DIR    = os.path.join(ROOT, "Test")
MODEL_DIR   = os.path.join(ROOT, "backend", "app", "cv_pipeline", "models")
USD_DATA_DIR = os.path.join(ROOT, "USD_data")   # Kaggle download lands here
BN_CSV_URL  = (
    "https://raw.githubusercontent.com/microsoft/banknote-net/"
    "main/data/banknote_net.csv"
)
BN_CSV_PATH = os.path.join(MODEL_DIR, "banknote_net.csv")

# Kaggle dataset slug — US currency denomination dataset
# Source: https://www.kaggle.com/datasets/balabaskar/us-currency-denominations
USD_KAGGLE_SLUG = "balabaskar/us-currency-denominations"

os.makedirs(MODEL_DIR, exist_ok=True)

IMG_SIZE    = 96   # 96px: 5x faster than 224px, ~2% accuracy drop — good for CPU
BATCH       = 32   # larger batch = fewer steps per epoch
EPOCHS_FT   = 8    # fine-tune top backbone layers
EPOCHS_HEAD = 20   # train head only (backbone frozen)
MV2_ALPHA   = 0.5  # MobileNetV2 width multiplier: 0.5 = 2x faster, ~1% accuracy drop

# ── Class mapping ─────────────────────────────────────────────────────────────
CLASS_MAP = {
    "Tennote":      "10",
    "Twentynote":   "20",
    "Fiftynote":    "50",
    "1Hundrednote": "100",
    "2Hundrednote": "200",
    "5Hundrednote": "500",
    "2Thousandnote":"2000",
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. INR denomination classifier (MobileNetV2 transfer learning)
# ─────────────────────────────────────────────────────────────────────────────

def build_inr_model():
    try:
        import tensorflow as tf
        from tensorflow.keras import layers, Model
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
    except ImportError:
        print("[train] TensorFlow not installed — skipping INR model training.")
        print("        Install with: pip install tensorflow")
        return

    print("\n=== Training INR denomination classifier (MobileNetV2) ===")

    # ── Data generators with augmentation ────────────────────────────────────
    train_gen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.05,
        zoom_range=0.15,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode="nearest",
    )
    test_gen = ImageDataGenerator(rescale=1.0 / 255)

    def flow(gen, directory):
        return gen.flow_from_directory(
            directory,
            target_size=(IMG_SIZE, IMG_SIZE),
            batch_size=BATCH,
            class_mode="categorical",
            shuffle=True,
        )

    train_ds = flow(train_gen, TRAIN_DIR)
    test_ds  = flow(test_gen,  TEST_DIR)

    n_classes = train_ds.num_classes
    idx2label = {v: CLASS_MAP.get(k, k) for k, v in train_ds.class_indices.items()}
    print(f"  Classes ({n_classes}): {idx2label}")

    # ── Build model ───────────────────────────────────────────────────────────
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
        pooling="avg",
        alpha=MV2_ALPHA,
    )
    base.trainable = False  # freeze backbone initially

    inp  = base.input
    x    = base.output
    x    = layers.Dropout(0.3)(x)
    x    = layers.Dense(128, activation="relu")(x)
    x    = layers.Dropout(0.3)(x)
    out  = layers.Dense(n_classes, activation="softmax")(x)
    model = Model(inp, out)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    # ── Phase 1: train head only ──────────────────────────────────────────────
    print(f"\n  Phase 1: training classifier head ({EPOCHS_HEAD} epochs)")
    model.fit(
        train_ds,
        epochs=EPOCHS_HEAD,
        validation_data=test_ds,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5),
        ],
        verbose=1,
    )

    # ── Phase 2: fine-tune top layers of backbone ─────────────────────────────
    print(f"\n  Phase 2: fine-tuning top backbone layers ({EPOCHS_FT} epochs)")
    base.trainable = True
    for layer in base.layers[:-20]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        epochs=EPOCHS_FT,
        validation_data=test_ds,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        ],
        verbose=1,
    )

    # ── Evaluate ──────────────────────────────────────────────────────────────
    loss, acc = model.evaluate(test_ds, verbose=0)
    print(f"\n  Test accuracy: {acc*100:.1f}%  (loss: {loss:.4f})")

    # ── Save H5 model ─────────────────────────────────────────────────────────
    h5_path = os.path.join(MODEL_DIR, "inr_mobilenet.h5")
    model.save(h5_path)
    print(f"  Saved H5: {h5_path}")

    # ── Save label map ────────────────────────────────────────────────────────
    import json
    label_map = {
        "model": "inr_mobilenet",
        "currency": "INR",
        "img_size": IMG_SIZE,
        "classes": idx2label,
    }
    lm_path = os.path.join(MODEL_DIR, "inr_label_map.json")
    with open(lm_path, "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"  Saved label map: {lm_path}")

    # ── Export TFLite ─────────────────────────────────────────────────────────
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    tflite_path = os.path.join(MODEL_DIR, "inr_mobilenet.tflite")
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)
    print(f"  Saved TFLite: {tflite_path}")

    return model, idx2label


# ─────────────────────────────────────────────────────────────────────────────
# 2. Multi-currency classifier from BankNote-Net embeddings
# ─────────────────────────────────────────────────────────────────────────────

def build_banknote_classifier():
    try:
        import pandas as pd
        from sklearn.neural_network import MLPClassifier
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report
        import joblib
    except ImportError:
        print("[train] pandas / sklearn not installed — skipping BankNote-Net classifier.")
        print("        Install with: pip install pandas scikit-learn joblib")
        return

    print("\n=== Training multi-currency classifier (BankNote-Net embeddings) ===")

    # ── Download CSV ──────────────────────────────────────────────────────────
    if not os.path.exists(BN_CSV_PATH):
        print(f"  Downloading BankNote-Net CSV (~10 MB)…")
        try:
            urllib.request.urlretrieve(BN_CSV_URL, BN_CSV_PATH)
            print(f"  Saved to: {BN_CSV_PATH}")
        except Exception as e:
            print(f"  Download failed: {e}")
            print(f"  Manually download from: {BN_CSV_URL}")
            print(f"  and place at: {BN_CSV_PATH}")
            return
    else:
        print(f"  Using cached CSV: {BN_CSV_PATH}")

    # ── Load ──────────────────────────────────────────────────────────────────
    df = pd.read_csv(BN_CSV_PATH)
    # Normalise column names to lowercase for robustness
    df.columns = [c.strip().lower() for c in df.columns]
    print(f"  Dataset: {df.shape[0]} rows, {df.shape[1]} cols")
    print(f"  Currencies: {sorted(df['currency'].unique())}")

    # ── Features: embedding columns (float columns, not currency/denomination/face)
    meta_cols = {"currency", "denomination", "face", "split"}
    feat_cols = [c for c in df.columns if c not in meta_cols and df[c].dtype in (float, "float64")]
    if not feat_cols:
        # fallback: all numeric columns except known non-features
        feat_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c not in meta_cols]

    print(f"  Feature dimensions: {len(feat_cols)}")

    X = df[feat_cols].values.astype(np.float32)

    # ── Currency classifier ───────────────────────────────────────────────────
    le_cur = LabelEncoder()
    y_cur  = le_cur.fit_transform(df["currency"])
    X_tr, X_te, y_tr, y_te = train_test_split(X, y_cur, test_size=0.15, random_state=42, stratify=y_cur)

    print("\n  Training currency classifier (MLP)…")
    mlp_cur = MLPClassifier(
        hidden_layer_sizes=(256, 128),
        max_iter=200,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
        verbose=False,
    )
    mlp_cur.fit(X_tr, y_tr)
    acc_cur = mlp_cur.score(X_te, y_te)
    print(f"  Currency accuracy: {acc_cur*100:.1f}%")

    # ── Denomination classifier ───────────────────────────────────────────────
    le_den = LabelEncoder()
    y_den  = le_den.fit_transform(df["currency"] + "_" + df["denomination"].astype(str))
    X_tr2, X_te2, y_tr2, y_te2 = train_test_split(X, y_den, test_size=0.15, random_state=42, stratify=y_den)

    print("\n  Training denomination classifier (MLP)…")
    mlp_den = MLPClassifier(
        hidden_layer_sizes=(256, 256, 128),
        max_iter=200,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
        verbose=False,
    )
    mlp_den.fit(X_tr2, y_tr2)
    acc_den = mlp_den.score(X_te2, y_te2)
    print(f"  Denomination accuracy: {acc_den*100:.1f}%")

    # ── Save classifiers ──────────────────────────────────────────────────────
    import joblib
    joblib.dump({"mlp": mlp_cur, "le": le_cur, "feat_cols": feat_cols},
                os.path.join(MODEL_DIR, "bn_currency_clf.joblib"))
    joblib.dump({"mlp": mlp_den, "le": le_den, "feat_cols": feat_cols},
                os.path.join(MODEL_DIR, "bn_denomination_clf.joblib"))
    print(f"\n  Saved classifiers to: {MODEL_DIR}")

    # ── Save currencies list ──────────────────────────────────────────────────
    import json
    summary = {
        "currencies": list(le_cur.classes_),
        "currency_accuracy": round(acc_cur, 4),
        "denomination_accuracy": round(acc_den, 4),
        "n_samples": int(df.shape[0]),
        "n_features": len(feat_cols),
        "source": "microsoft/banknote-net",
    }
    with open(os.path.join(MODEL_DIR, "bn_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"  Summary: {summary}")


# ─────────────────────────────────────────────────────────────────────────────
# 3. USD denomination classifier (MobileNetV2 transfer learning)
# ─────────────────────────────────────────────────────────────────────────────

# Maps common folder names found in Kaggle USD datasets → denomination strings
USD_FOLDER_MAP: dict[str, str] = {
    # Numeric names (most common on Kaggle)
    "1": "1", "2": "2", "5": "5", "10": "10",
    "20": "20", "50": "50", "100": "100",
    # Written-out names (some datasets)
    "one":     "1",   "two":   "2",   "five":   "5",
    "ten":     "10",  "twenty":"20",  "fifty":  "50",
    "hundred": "100",
    # "X Dollar" / "X Doolar" style (aishwaryatechie dataset has typo "2 Doolar")
    "1_dollar":    "1",  "2_dollar":    "2",  "2_doolar":    "2",
    "5_dollar":    "5",  "10_dollar":   "10", "20_dollar":   "20",
    "50_dollar":   "50", "100_dollar": "100",
    "one_dollar":  "1",  "two_dollar":  "2",  "five_dollar": "5",
    "ten_dollar":  "10", "twenty_dollar":"20","fifty_dollar":"50",
    "hundred_dollar":"100",
    "1dollar": "1",  "2dollar": "2",  "5dollar": "5",
    "10dollar":"10", "20dollar":"20", "50dollar":"50",
    "100dollar":"100",
    # USD-prefixed
    "usd1":"1", "usd5":"5", "usd10":"10",
    "usd20":"20","usd50":"50","usd100":"100",
}


def _download_usd_dataset() -> bool:
    """Download USD Kaggle dataset via kaggle CLI. Returns True on success."""
    try:
        import kaggle  # noqa: F401
    except ImportError:
        print("[usd] kaggle package not installed. Run:  pip install kaggle")
        return False

    kaggle_json = os.path.expanduser("~/.kaggle/kaggle.json")
    if not os.path.exists(kaggle_json):
        print("[usd] Kaggle credentials not found at:", kaggle_json)
        print("      Go to https://www.kaggle.com/settings → API → Create New Token")
        print("      and place the downloaded kaggle.json at that path.")
        return False

    os.makedirs(USD_DATA_DIR, exist_ok=True)
    print(f"[usd] Downloading {USD_KAGGLE_SLUG} → {USD_DATA_DIR} …")
    import subprocess
    result = subprocess.run(
        ["kaggle", "datasets", "download", "-d", USD_KAGGLE_SLUG,
         "--unzip", "-p", USD_DATA_DIR],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("[usd] kaggle download failed:", result.stderr)
        return False
    print("[usd] Download complete.")
    return True


def _find_usd_splits(base_dir: str) -> tuple[str, str]:
    """Find or create train/val split directories inside base_dir.

    Kaggle datasets may use different top-level structures:
      - base_dir/{train,test}/{denom}/images   (ideal)
      - base_dir/{denom}/images                (flat — we split 80/20)
      - base_dir/images/{denom}/images         (nested)

    Returns (train_path, val_path) for flow_from_directory.
    """
    # Walk looking for the deepest directory that contains image files
    # and has child folders that map to valid USD denominations.
    def _has_images(d: str) -> bool:
        exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        for f in os.listdir(d):
            if os.path.splitext(f)[1].lower() in exts:
                return True
        return False

    def _denom_subdirs(d: str) -> dict[str, str]:
        """Return {folder_name: denomination} for child dirs that map to USD denoms."""
        result = {}
        for name in os.listdir(d):
            child = os.path.join(d, name)
            if os.path.isdir(child):
                mapped = USD_FOLDER_MAP.get(name.lower().replace(" ", "_"))
                if mapped:
                    result[name] = mapped
        return result

    # Look for explicit train/val/test split at the top level
    for train_name in ("train", "Train", "training"):
        candidate = os.path.join(base_dir, train_name)
        if os.path.isdir(candidate) and _denom_subdirs(candidate):
            for val_name in ("val", "test", "Test", "validation", "valid"):
                val_cand = os.path.join(base_dir, val_name)
                if os.path.isdir(val_cand) and _denom_subdirs(val_cand):
                    print(f"[usd] Found pre-split: train={candidate}, val={val_cand}")
                    return candidate, val_cand

    # Try the base dir itself — maybe it IS the train dir (flat layout)
    mapping = _denom_subdirs(base_dir)
    if mapping:
        print(f"[usd] Flat layout detected in {base_dir}. Creating 80/20 train/val split…")
        train_out = os.path.join(base_dir, "_train_split")
        val_out   = os.path.join(base_dir, "_val_split")
        if os.path.isdir(train_out):
            print("[usd] Split already exists, reusing.")
            return train_out, val_out
        import random
        random.seed(42)
        for folder, denom in mapping.items():
            src   = os.path.join(base_dir, folder)
            imgs  = [f for f in os.listdir(src)
                     if os.path.splitext(f)[1].lower() in {".jpg",".jpeg",".png",".bmp",".webp"}]
            random.shuffle(imgs)
            split = int(0.8 * len(imgs))
            for i, fname in enumerate(imgs):
                dest_dir = os.path.join(train_out if i < split else val_out, denom)
                os.makedirs(dest_dir, exist_ok=True)
                shutil.copy2(os.path.join(src, fname), os.path.join(dest_dir, fname))
            print(f"  {denom}: {split} train / {len(imgs)-split} val")
        return train_out, val_out

    # Recurse one level deeper (some datasets have a wrapper folder)
    for entry in os.listdir(base_dir):
        child = os.path.join(base_dir, entry)
        if os.path.isdir(child):
            mapping = _denom_subdirs(child)
            if mapping:
                return _find_usd_splits(child)

    raise RuntimeError(
        f"[usd] Could not find USD denomination subfolders in {base_dir}.\n"
        f"      Expected child directories named like: 1, 5, 10, 20, 50, 100\n"
        f"      Got: {os.listdir(base_dir)}"
    )


def build_usd_model(data_dir: str | None = None):
    """Train MobileNetV2 USD denomination classifier.

    data_dir: directory containing USD images (Kaggle download location).
              Defaults to USD_data/ at the project root.
    """
    try:
        import tensorflow as tf
        from tensorflow.keras import layers, Model
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
    except ImportError:
        print("[usd] TensorFlow not installed — skipping USD model training.")
        return

    data_dir = data_dir or USD_DATA_DIR
    if not os.path.isdir(data_dir):
        print(f"[usd] Data directory not found: {data_dir}")
        print("      Run with --download-usd to fetch from Kaggle, or manually")
        print("      create USD_data/ with subfolders: 1/ 5/ 10/ 20/ 50/ 100/")
        return

    print("\n=== Training USD denomination classifier (MobileNetV2) ===")

    try:
        train_dir, val_dir = _find_usd_splits(data_dir)
    except RuntimeError as e:
        print(e)
        return

    # ── Data generators ───────────────────────────────────────────────────────
    train_gen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=12,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.05,
        zoom_range=0.15,
        horizontal_flip=True,
        brightness_range=[0.75, 1.25],
        fill_mode="nearest",
    )
    val_gen = ImageDataGenerator(rescale=1.0 / 255)

    def flow(gen, directory):
        return gen.flow_from_directory(
            directory,
            target_size=(IMG_SIZE, IMG_SIZE),
            batch_size=BATCH,
            class_mode="categorical",
            shuffle=True,
        )

    train_ds = flow(train_gen, train_dir)
    val_ds   = flow(val_gen,   val_dir)

    # Map numeric class indices back to USD denomination strings.
    # Kaggle folder names like "1", "20", "100" are already correct; for written
    # names (twenty, fifty, …) the split function already renamed them to digits.
    raw_idx = {v: k for k, v in train_ds.class_indices.items()}  # idx → raw folder name
    idx2label = {i: USD_FOLDER_MAP.get(name.lower(), name)
                 for i, name in raw_idx.items()}
    print(f"  Classes ({train_ds.num_classes}): {idx2label}")

    n_classes = train_ds.num_classes

    # ── Build model ───────────────────────────────────────────────────────────
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
        pooling="avg",
        alpha=MV2_ALPHA,
    )
    base.trainable = False

    inp = base.input
    x   = base.output
    x   = layers.Dropout(0.3)(x)
    x   = layers.Dense(128, activation="relu")(x)
    x   = layers.Dropout(0.3)(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    model = Model(inp, out)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    # ── Phase 1: head only ────────────────────────────────────────────────────
    print(f"\n  Phase 1: classifier head ({EPOCHS_HEAD} epochs, backbone frozen)")
    model.fit(
        train_ds,
        epochs=EPOCHS_HEAD,
        validation_data=val_ds,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5, verbose=1),
        ],
        verbose=1,
    )

    # ── Phase 2: fine-tune top backbone layers ────────────────────────────────
    print(f"\n  Phase 2: fine-tune top backbone layers ({EPOCHS_FT} epochs)")
    base.trainable = True
    for layer in base.layers[:-20]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        epochs=EPOCHS_FT,
        validation_data=val_ds,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        ],
        verbose=1,
    )

    loss, acc = model.evaluate(val_ds, verbose=0)
    print(f"\n  Val accuracy: {acc*100:.1f}%  (loss: {loss:.4f})")

    # ── Save model + label map ────────────────────────────────────────────────
    import json
    h5_path = os.path.join(MODEL_DIR, "usd_mobilenet.h5")
    model.save(h5_path)
    print(f"  Saved H5: {h5_path}")

    label_map = {
        "model":    "usd_mobilenet",
        "currency": "USD",
        "img_size": IMG_SIZE,
        "n_classes": n_classes,
        "val_accuracy": round(float(acc), 4),
        "classes": {str(i): lbl for i, lbl in idx2label.items()},
    }
    lm_path = os.path.join(MODEL_DIR, "usd_label_map.json")
    with open(lm_path, "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"  Saved label map: {lm_path}")
    print(f"\n  USD model ready. Restart the backend — classifier.py picks it up automatically.")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = set(sys.argv[1:])
    usd_only      = "--usd-only"      in args
    download_usd  = "--download-usd"  in args

    if download_usd:
        ok = _download_usd_dataset()
        if not ok:
            sys.exit(1)

    if usd_only or download_usd:
        build_usd_model()
    else:
        if not os.path.isdir(TRAIN_DIR):
            print(f"[train] Train directory not found: {TRAIN_DIR}")
            sys.exit(1)
        build_inr_model()
        build_banknote_classifier()
        if os.path.isdir(USD_DATA_DIR):
            build_usd_model()
        else:
            print("\n[usd] USD_data/ not found — skipping USD model.")
            print("      Run with --download-usd to fetch the Kaggle dataset.")

    print("\n=== Training complete ===")
    print(f"Models saved to: {MODEL_DIR}")
