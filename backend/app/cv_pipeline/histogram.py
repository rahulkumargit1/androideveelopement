"""Technique 2: Histogram Processing — equalization, matching, shape analysis.

histogram_profile_score() replaces the old entropy fallback.
Genuine banknotes have a multi-modal intensity distribution (dark ink regions,
mid-tone paper regions, highlight features).  Photocopies and poor reprints
tend to produce flattened, unimodal, or heavily quantised histograms.
"""
from __future__ import annotations

import cv2
import numpy as np


def hist_equalize_gray(img_bgr: np.ndarray) -> np.ndarray:
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return cv2.equalizeHist(g)


def color_hist(img_bgr: np.ndarray, bins: int = 32) -> np.ndarray:
    h = cv2.calcHist([img_bgr], [0, 1, 2], None,
                     [bins, bins, bins], [0, 256, 0, 256, 0, 256])
    cv2.normalize(h, h)
    return h.flatten()


def hist_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Bhattacharyya distance — 0 identical, 1 totally different."""
    return float(cv2.compareHist(
        a.astype("float32"), b.astype("float32"), cv2.HISTCMP_BHATTACHARYYA
    ))


def _count_peaks(hist_norm: np.ndarray, min_height: float = 0.01,
                 min_distance: int = 8) -> int:
    """Count local maxima in a normalised histogram."""
    peaks = 0
    n = len(hist_norm)
    for i in range(1, n - 1):
        if hist_norm[i] >= min_height:
            lo = max(0, i - min_distance)
            hi = min(n, i + min_distance + 1)
            if hist_norm[i] == hist_norm[lo:hi].max():
                peaks += 1
    return peaks


def histogram_profile_score(img_bgr: np.ndarray) -> float:
    """Score histogram multi-modality — genuine notes have 2–5 distinct peaks.

    The score rewards:
    - Multiple distinct intensity peaks (ink + paper + security features)
    - Reasonable dynamic range (not completely clipped or flat)
    - Smooth, continuous distribution without heavy quantisation banding

    Returns 0.0–1.0 where 1.0 is a histogram typical of a genuine note.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    total = hist.sum() + 1e-9
    hist_norm = hist / total

    # ── Peak count score ─────────────────────────────────────────────────────
    # Smooth first to avoid counting noise spikes
    kernel = np.ones(5) / 5.0
    smoothed = np.convolve(hist_norm, kernel, mode="same")
    n_peaks = _count_peaks(smoothed)
    # Genuine notes: 2–5 peaks.  Score peaks in [2,5] highly.
    if n_peaks < 1:
        peak_score = 0.1
    elif n_peaks == 1:
        peak_score = 0.4    # unimodal — possibly a photocopy
    elif 2 <= n_peaks <= 5:
        peak_score = 1.0    # ideal range
    elif n_peaks <= 8:
        peak_score = 0.7    # slightly noisy but ok
    else:
        peak_score = 0.3    # too many peaks → heavy noise / quantisation

    # ── Dynamic range score ───────────────────────────────────────────────────
    # Find the range that contains 98 % of pixels
    cumsum = np.cumsum(hist_norm)
    lo_bin = int(np.searchsorted(cumsum, 0.01))
    hi_bin = int(np.searchsorted(cumsum, 0.99))
    dynamic_range = hi_bin - lo_bin  # out of 255
    # Genuine note photos typically span 80–220 intensity levels
    if dynamic_range < 40:
        range_score = 0.1   # almost no range — very flat/low-contrast
    elif dynamic_range < 80:
        range_score = float(dynamic_range - 40) / 40.0 * 0.6 + 0.1
    elif dynamic_range <= 220:
        range_score = 1.0
    else:
        range_score = 0.8   # very wide range: might be high-contrast scan

    # ── Anti-banding score (quantisation artefact check) ─────────────────────
    # Poor reprints often have "comb" histograms with regular zero-bins.
    zero_bins = int((hist[10:245] == 0).sum())
    # Genuine notes scanned/photographed: very few zero bins in mid-range
    banding_score = float(max(0.0, 1.0 - zero_bins / 60.0))

    return float(min(1.0, 0.45 * peak_score + 0.35 * range_score + 0.20 * banding_score))


# Keep backward-compat name used by old pipeline
def histogram_match_score(img_bgr: np.ndarray,
                           reference_hist: np.ndarray | None) -> float:
    """Backward-compatible wrapper — ignores reference_hist, uses profile score."""
    return histogram_profile_score(img_bgr)
