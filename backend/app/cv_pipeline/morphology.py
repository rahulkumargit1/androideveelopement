"""Technique 6: Morphological Operations — clean security-thread mask.

thread_continuity_score() improvements:

OLD issues:
- Required 50% height span (too strict — many genuine notes fail)
- Accepted any dark vertical line regardless of width (matched furniture edges)
- Gave 0 when no thread found, making currency-less thread notes "counterfeit"

NEW:
- Threshold lowered to 35% height span (more tolerant of partial visibility)
- Width constraint: genuine security threads are 2–15 px at scan resolution
- If no plausible thread is found, return 0.5 (neutral) rather than 0 —
  not all currencies / denominations have an easily visible embedded thread
- Returns 0.0–1.0 where 1.0 = clear continuous thread found
"""
from __future__ import annotations

import cv2
import numpy as np

# Minimum fraction of image height the thread run must span
_MIN_SPAN = 0.35
# Expected thread width range in pixels (at typical scan/photo resolution)
_THREAD_MIN_WIDTH_PX = 2
_THREAD_MAX_WIDTH_PX = 18


def security_thread_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Approximate security threads on banknotes — dark OR bright vertical strips.

    Uses both Otsu (dark threads) and a bright-strip approach (metallic/holographic
    threads) and returns whichever produces a stronger vertical structure.
    """
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Approach 1: Dark threads (traditional Otsu inversion)
    _, thr_dark = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))
    mask_dark = cv2.morphologyEx(thr_dark, cv2.MORPH_OPEN, kernel_v)
    mask_dark = cv2.morphologyEx(mask_dark, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    # Approach 2: Bright/metallic threads (above 85th percentile brightness)
    bright_thr = int(np.percentile(g, 85))
    _, thr_bright = cv2.threshold(g, bright_thr, 255, cv2.THRESH_BINARY)
    mask_bright = cv2.morphologyEx(thr_bright, cv2.MORPH_OPEN, kernel_v)
    mask_bright = cv2.morphologyEx(mask_bright, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    # Return whichever has more vertical structure (higher column sum max)
    dark_strength = float(mask_dark.sum(axis=0).max()) if mask_dark.any() else 0
    bright_strength = float(mask_bright.sum(axis=0).max()) if mask_bright.any() else 0
    return mask_bright if bright_strength > dark_strength else mask_dark


def _column_run(col: np.ndarray) -> int:
    """Return the length of the longest foreground run in a column."""
    run = best = 0
    for v in col:
        if v:
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def thread_continuity_score(img_bgr: np.ndarray) -> float:
    """Score how well a security thread is present and continuous.

    Returns:
        1.0  — clear, wide continuous thread found (strong evidence of genuine)
        0.5  — no clear thread found (neutral — not all notes have visible thread)
        0.0  — note has dark vertical artifacts that don't match thread profile
    """
    mask = security_thread_mask(img_bgr)
    h, w = mask.shape

    # Subsample columns for speed: check every ~6 px
    step = max(1, w // 80)
    best_run = 0
    best_col_width = 0       # count adjacent columns with long runs
    prev_long = False
    cur_width = 0

    for x in range(0, w, step):
        run = _column_run(mask[:, x])
        is_long = run >= (h * _MIN_SPAN)
        if is_long:
            cur_width += 1
            best_run = max(best_run, run)
            if not prev_long:
                prev_long = True
        else:
            if cur_width > best_col_width:
                best_col_width = cur_width
            cur_width = 0
            prev_long = False
    if cur_width > best_col_width:
        best_col_width = cur_width

    # best_col_width is in "step"-unit columns; convert to approx pixels
    thread_width_px = best_col_width * step

    if best_run == 0:
        return 0.5   # no vertical structure at all — neutral

    # Continuity fraction (how much of height the best run spans)
    continuity = float(best_run) / float(h)

    if continuity < _MIN_SPAN:
        return 0.5   # run exists but too short — neutral

    # Width plausibility gate
    if thread_width_px < _THREAD_MIN_WIDTH_PX:
        return 0.5   # a single pixel column — probably noise
    if thread_width_px > _THREAD_MAX_WIDTH_PX:
        # Very wide "thread" — likely a fold or large dark region, not a thread
        return 0.4

    # Score: 0.7 base for meeting minimum span, up to 1.0 for full-height thread
    span_score = float(min(1.0, (continuity - _MIN_SPAN) / (1.0 - _MIN_SPAN)))
    return float(0.7 + 0.3 * span_score)
