"""
VeriCash — USD MobileNetV2 Standalone Trainer
==============================================
Run this on ANY PC or Google Colab — no VeriCash project needed.

USAGE
-----
1. Place this file next to the "USD_data" folder  OR  set DATA_DIR below.
2. Install dependencies:
       pip install tensorflow opencv-python
3. Run:
       python train_usd_standalone.py

OUTPUT
------
  usd_mobilenet.h5      ← copy this back to:
                           backend/app/cv_pipeline/models/
  usd_label_map.json    ← copy this back to:
                           backend/app/cv_pipeline/models/

GOOGLE COLAB USAGE
------------------
  !pip install tensorflow opencv-python -q
  from google.colab import drive
  drive.mount('/content/drive')
  # upload USD_data.zip to Google Drive first, then:
  !unzip /content/drive/MyDrive/USD_data.zip -d /content/
  # Then run this script.
"""

import os, json, shutil, random
import numpy as np

# ── CONFIG ────────────────────────────────────────────────────────────────────
# Point this at the "USA currency" folder inside USD_data/
DATA_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "USD_data", "USA currency")
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))   # save models here

IMG_SIZE   = 96    # 96 px — fast on CPU, ~5x speedup vs 224 px
BATCH      = 32
EPOCHS_HEAD = 20   # train head only
EPOCHS_FT  = 8     # fine-tune top backbone
MV2_ALPHA  = 0.5   # slim model — 2× faster, minimal accuracy loss

# ── Folder name → denomination mapping ───────────────────────────────────────
FOLDER_MAP = {
    "1": "1",  "2": "2",  "5": "5",  "10": "10",
    "20": "20", "50": "50", "100": "100",
    "1 dollar":    "1",   "2 dollar":    "2",   "2 doolar":  "2",
    "5 dollar":    "5",   "10 dollar":   "10",  "20 dollar": "20",
    "50 dollar":  "50",  "100 dollar":  "100",
    "one":   "1", "two":  "2",  "five":  "5",
    "ten":  "10", "twenty":"20","fifty":"50", "hundred":"100",
}

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"


def find_or_create_split(base_dir: str):
    """Find denomination folders + create 80/20 train/val split."""
    # Check if split already exists
    train_out = os.path.join(base_dir, "_train")
    val_out   = os.path.join(base_dir, "_val")
    if os.path.isdir(train_out) and os.path.isdir(val_out):
        print(f"  Using existing split: {train_out}")
        return train_out, val_out

    # Find denomination folders
    denom_dirs = {}
    for name in os.listdir(base_dir):
        path = os.path.join(base_dir, name)
        if not os.path.isdir(path):
            continue
        mapped = FOLDER_MAP.get(name.lower().strip())
        if mapped:
            denom_dirs[mapped] = path

    if not denom_dirs:
        raise RuntimeError(
            f"No USD denomination folders found in: {base_dir}\n"
            f"Expected folders named like: '1 Dollar', '5 Dollar', '100 Dollar'\n"
            f"Found: {os.listdir(base_dir)}"
        )

    print(f"  Found denominations: {sorted(denom_dirs.keys())}")
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    random.seed(42)

    for denom, src in sorted(denom_dirs.items()):
        imgs = [f for f in os.listdir(src)
                if os.path.splitext(f)[1].lower() in exts]
        random.shuffle(imgs)
        split = int(0.8 * len(imgs))
        for i, fname in enumerate(imgs):
            dest = os.path.join(train_out if i < split else val_out, denom)
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(os.path.join(src, fname), os.path.join(dest, fname))
        print(f"    {denom}: {split} train / {len(imgs)-split} val")

    return train_out, val_out


def preprocess_to_96(split_dir: str, out_dir: str):
    """Pre-resize all images to IMG_SIZE so training reads tiny files."""
    if os.path.isdir(out_dir):
        print(f"  Pre-sized cache exists: {out_dir}")
        return
    import cv2
    count = 0
    for cls in os.listdir(split_dir):
        src_cls = os.path.join(split_dir, cls)
        dst_cls = os.path.join(out_dir,   cls)
        if not os.path.isdir(src_cls):
            continue
        os.makedirs(dst_cls, exist_ok=True)
        for fname in os.listdir(src_cls):
            if os.path.splitext(fname)[1].lower() not in {".jpg",".jpeg",".png",".bmp"}:
                continue
            img = cv2.imread(os.path.join(src_cls, fname))
            if img is None:
                continue
            img = cv2.resize(img, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(dst_cls, fname), img,
                        [cv2.IMWRITE_JPEG_QUALITY, 90])
            count += 1
    print(f"  Resized {count} images → {out_dir}")


def train():
    try:
        import tensorflow as tf
        from tensorflow.keras import layers, Model
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
    except ImportError:
        print("TensorFlow not found. Install with:  pip install tensorflow")
        return

    print(f"\nTensorFlow {tf.__version__}")
    gpus = tf.config.list_physical_devices("GPU")
    print(f"GPU available: {bool(gpus)} — {gpus if gpus else 'using CPU'}")

    print(f"\n=== USD MobileNetV2 Trainer ===")
    print(f"IMG_SIZE={IMG_SIZE}  BATCH={BATCH}  alpha={MV2_ALPHA}")

    # ── Step 1: locate data ───────────────────────────────────────────────────
    if not os.path.isdir(DATA_DIR):
        raise FileNotFoundError(
            f"DATA_DIR not found: {DATA_DIR}\n"
            "Edit DATA_DIR at the top of this script to point at 'USA currency' folder."
        )
    print(f"\nData: {DATA_DIR}")
    train_dir, val_dir = find_or_create_split(DATA_DIR)

    # ── Step 2: pre-resize ────────────────────────────────────────────────────
    print("\nPre-resizing images to 96px (one-time, ~2 min)…")
    cache = os.path.join(os.path.dirname(DATA_DIR), "_cache_96")
    train96 = os.path.join(cache, "train")
    val96   = os.path.join(cache, "val")
    preprocess_to_96(train_dir, train96)
    preprocess_to_96(val_dir,   val96)

    # ── Step 3: data generators ───────────────────────────────────────────────
    train_gen = ImageDataGenerator(
        rescale=1.0/255,
        rotation_range=10,
        width_shift_range=0.08,
        height_shift_range=0.08,
        zoom_range=0.12,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode="nearest",
    )
    val_gen = ImageDataGenerator(rescale=1.0/255)

    def flow(gen, d):
        return gen.flow_from_directory(
            d, target_size=(IMG_SIZE, IMG_SIZE),
            batch_size=BATCH, class_mode="categorical", shuffle=True,
        )

    train_ds = flow(train_gen, train96)
    val_ds   = flow(val_gen,   val96)
    n_classes = train_ds.num_classes

    raw_idx  = {v: k for k, v in train_ds.class_indices.items()}
    idx2label = {i: FOLDER_MAP.get(name.lower(), name) for i, name in raw_idx.items()}
    print(f"\nClasses ({n_classes}): {idx2label}")

    # ── Step 4: build model ───────────────────────────────────────────────────
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False, weights="imagenet",
        pooling="avg", alpha=MV2_ALPHA,
    )
    base.trainable = False
    inp = base.input
    x   = layers.Dropout(0.3)(base.output)
    x   = layers.Dense(128, activation="relu")(x)
    x   = layers.Dropout(0.3)(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    model = Model(inp, out)
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
                  loss="categorical_crossentropy", metrics=["accuracy"])

    # ── Step 5: Phase 1 — head only ──────────────────────────────────────────
    print(f"\nPhase 1: head only ({EPOCHS_HEAD} epochs)…")
    model.fit(train_ds, epochs=EPOCHS_HEAD, validation_data=val_ds,
              callbacks=[
                  tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
                  tf.keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5, verbose=1),
              ], verbose=1)

    # ── Step 6: Phase 2 — fine-tune top backbone layers ──────────────────────
    print(f"\nPhase 2: fine-tune top layers ({EPOCHS_FT} epochs)…")
    base.trainable = True
    for layer in base.layers[:-20]:
        layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, epochs=EPOCHS_FT, validation_data=val_ds,
              callbacks=[
                  tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
              ], verbose=1)

    # ── Step 7: evaluate + save ───────────────────────────────────────────────
    loss, acc = model.evaluate(val_ds, verbose=0)
    print(f"\nVal accuracy: {acc*100:.1f}%  (loss: {loss:.4f})")

    h5_path = os.path.join(OUTPUT_DIR, "usd_mobilenet.h5")
    lm_path = os.path.join(OUTPUT_DIR, "usd_label_map.json")

    model.save(h5_path)
    print(f"Saved: {h5_path}")

    label_map = {
        "model": "usd_mobilenet", "currency": "USD",
        "img_size": IMG_SIZE, "n_classes": n_classes,
        "val_accuracy": round(float(acc), 4),
        "classes": {str(i): lbl for i, lbl in idx2label.items()},
    }
    with open(lm_path, "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"Saved: {lm_path}")

    print(f"\n{'='*50}")
    print(f"DONE! Copy these 2 files back to your project:")
    print(f"  {h5_path}")
    print(f"  {lm_path}")
    print(f"  → backend/app/cv_pipeline/models/")
    print(f"{'='*50}")


if __name__ == "__main__":
    train()
