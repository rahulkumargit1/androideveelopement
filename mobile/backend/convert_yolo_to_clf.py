"""Convert org_data YOLO detection dataset → image classification dataset.

YOLO format: each .txt has lines of  class_id  cx  cy  w  h  (normalised 0-1)

Steps:
  1. Read every image + its .txt annotation file
  2. Crop each annotated bounding box
  3. Save crops to  EUR_clf_data/<class_id>/  folders
  4. Run OCR on a few samples per class → build class_id → denomination map
  5. Rename folders to real denominations → ready for flow_from_directory

Run from project root:
    python backend/convert_yolo_to_clf.py
"""
from __future__ import annotations
import os, json, shutil
import cv2
import numpy as np

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_SRC = os.path.join(ROOT, "org_data", "train")
TEST_SRC  = os.path.join(ROOT, "org_data", "test")
OUT_DIR   = os.path.join(ROOT, "EUR_clf_data")

IMG_EXTS  = {".jpeg", ".jpg", ".png", ".bmp"}
PADDING   = 0.05   # add 5% padding around each crop


def _crop_boxes(img: np.ndarray, label_path: str) -> list[tuple[int, np.ndarray]]:
    """Return list of (class_id, crop) from a YOLO label file."""
    h, w = img.shape[:2]
    crops = []
    with open(label_path) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            cls_id = int(parts[0])
            cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
            # Convert to pixel coordinates with padding
            pad_x = bw * PADDING
            pad_y = bh * PADDING
            x1 = max(0,    int((cx - bw / 2 - pad_x) * w))
            y1 = max(0,    int((cy - bh / 2 - pad_y) * h))
            x2 = min(w-1,  int((cx + bw / 2 + pad_x) * w))
            y2 = min(h-1,  int((cy + bh / 2 + pad_y) * h))
            if x2 > x1 and y2 > y1:
                crops.append((cls_id, img[y1:y2, x1:x2]))
    return crops


def extract_crops(src_dir: str, split_name: str) -> dict[int, list[str]]:
    """Crop all annotated boxes and save to OUT_DIR/raw/<split>/<cls_id>/"""
    out_split = os.path.join(OUT_DIR, "raw", split_name)
    class_files: dict[int, list[str]] = {}

    imgs = [f for f in os.listdir(src_dir)
            if os.path.splitext(f)[1].lower() in IMG_EXTS]
    print(f"  [{split_name}] Processing {len(imgs)} images…")

    saved = 0
    for fname in imgs:
        img_path = os.path.join(src_dir, fname)
        base      = os.path.splitext(fname)[0]
        lbl_path  = os.path.join(src_dir, base + ".txt")
        if not os.path.exists(lbl_path):
            continue
        img = cv2.imread(img_path)
        if img is None:
            continue
        for cls_id, crop in _crop_boxes(img, lbl_path):
            dest_dir = os.path.join(out_split, str(cls_id))
            os.makedirs(dest_dir, exist_ok=True)
            out_path = os.path.join(dest_dir, f"{base}_crop{cls_id}_{saved}.jpg")
            cv2.imwrite(out_path, crop)
            class_files.setdefault(cls_id, []).append(out_path)
            saved += 1

    print(f"  [{split_name}] Saved {saved} crops")
    for cls_id in sorted(class_files):
        print(f"    class {cls_id}: {len(class_files[cls_id])} crops")
    return class_files


def ocr_label_classes(class_files: dict[int, list[str]]) -> dict[int, str]:
    """Run OCR on sample crops to determine denomination for each class_id."""
    print("\n  Running OCR to identify denominations…")
    try:
        import sys
        sys.path.insert(0, ROOT)
        from backend.app.cv_pipeline import ocr_classifier
        ocr_classifier.prewarm()
    except Exception as e:
        print(f"  OCR unavailable: {e}")
        return {}

    id_to_denom: dict[int, str] = {}
    for cls_id in sorted(class_files):
        votes: dict[str, int] = {}
        samples = class_files[cls_id][:5]   # OCR up to 5 crops per class
        for path in samples:
            img = cv2.imread(path)
            if img is None:
                continue
            result = ocr_classifier.detect(img, currency_hint="EUR")
            if result and result.get("denomination"):
                d = result["denomination"]
                votes[d] = votes.get(d, 0) + 1
        if votes:
            best = max(votes, key=lambda x: votes[x])
            id_to_denom[cls_id] = best
            print(f"    class {cls_id} → {best}  (votes: {votes})")
        else:
            print(f"    class {cls_id} → UNKNOWN  (OCR found nothing)")
    return id_to_denom


def rename_to_denominations(id_to_denom: dict[int, str]) -> None:
    """Rename class_id folders to denomination names for flow_from_directory."""
    for split_name in ("train", "test"):
        split_dir = os.path.join(OUT_DIR, "raw", split_name)
        if not os.path.isdir(split_dir):
            continue
        for cls_id, denom in id_to_denom.items():
            src = os.path.join(split_dir, str(cls_id))
            dst = os.path.join(split_dir, denom)
            if os.path.isdir(src) and not os.path.isdir(dst):
                os.rename(src, dst)
                print(f"    {split_name}/{cls_id} → {split_name}/{denom}")
            elif os.path.isdir(src) and os.path.isdir(dst):
                # merge into existing
                for f in os.listdir(src):
                    shutil.move(os.path.join(src, f), os.path.join(dst, f))
                os.rmdir(src)
                print(f"    {split_name}/{cls_id} merged → {split_name}/{denom}")


def save_label_map(id_to_denom: dict[int, str]) -> None:
    """Save the discovered class mapping as EUR label map JSON."""
    model_dir = os.path.join(ROOT, "backend", "app", "cv_pipeline", "models")
    label_map = {
        "model":    "eur_mobilenet",
        "currency": "EUR",
        "img_size": 224,
        "n_classes": len(id_to_denom),
        "source":   "org_data YOLO converted",
        "classes":  {str(k): v for k, v in sorted(id_to_denom.items())},
    }
    lm_path = os.path.join(model_dir, "eur_label_map.json")
    with open(lm_path, "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"\n  Saved fixed EUR label map → {lm_path}")
    print(f"  Label map: {label_map['classes']}")


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=== YOLO → Classification Converter (EUR) ===\n")
    print(f"Source: {TRAIN_SRC}")
    print(f"Output: {OUT_DIR}\n")

    if not os.path.isdir(TRAIN_SRC):
        print(f"ERROR: {TRAIN_SRC} not found")
        sys.exit(1)

    # Step 1: Crop bounding boxes
    print("Step 1: Extracting crops from YOLO annotations…")
    train_files = extract_crops(TRAIN_SRC, "train")
    test_files  = extract_crops(TEST_SRC,  "test") if os.path.isdir(TEST_SRC) else {}

    # Step 2: OCR to identify denominations
    print("\nStep 2: OCR labelling…")
    id_to_denom = ocr_label_classes(train_files)

    if not id_to_denom:
        print("\nWARNING: OCR could not identify any denominations.")
        print("  Check that EasyOCR is installed and org_data contains EUR images.")
        sys.exit(1)

    # Step 3: Rename folders
    print("\nStep 3: Renaming folders to denomination names…")
    rename_to_denominations(id_to_denom)

    # Step 4: Fix label map for existing EUR model
    print("\nStep 4: Fixing EUR label map…")
    save_label_map(id_to_denom)

    print("\n=== Done! ===")
    print(f"Classification dataset at: {OUT_DIR}/raw/")
    print("You can now retrain the EUR model:")
    print("  python backend/train_model.py --eur-only")
    print("\nOR the fixed label map alone enables the existing EUR model.")
    print("Restart backend to pick up the new label map.")
