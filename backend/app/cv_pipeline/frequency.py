"""Technique 4: Frequency Domain Filtering — FFT high-pass + micro-print energy.

microprint_score() is now calibrated against genuine-note baselines.

OLD (wrong): monotonically "higher energy = more authentic". Any high-res or
over-sharpened image would score 1.0 regardless of whether it was genuine.

NEW (correct): genuine notes with intaglio micro-printing have high-pass energy
ratio in a specific band (~0.35–0.80).  Images outside this band are suspect:
- Too low  (< 0.20): smoothed photocopy, loss of fine detail
- Too high (> 0.85): noise-dominated, artificially sharpened or compressed JPEG
We apply a bell-curve score centred on the genuine-note micro-print band.
"""
from __future__ import annotations

import cv2
import numpy as np


def fft_magnitude(img_bgr: np.ndarray) -> np.ndarray:
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    f = np.fft.fftshift(np.fft.fft2(g))
    return 20 * np.log(np.abs(f) + 1)


def high_pass_energy(img_bgr: np.ndarray,
                     cutoff_ratio: float = 0.15) -> float:
    """Fraction of spectral energy above the low-frequency disk."""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = g.shape
    f = np.fft.fftshift(np.fft.fft2(g))
    mag = np.abs(f) ** 2
    cy, cx = h // 2, w // 2
    r = int(min(h, w) * cutoff_ratio)
    y, x = np.ogrid[:h, :w]
    mask_low = (y - cy) ** 2 + (x - cx) ** 2 <= r * r
    total = mag.sum() + 1e-9
    high = mag[~mask_low].sum()
    return float(high / total)


def microprint_score(img_bgr: np.ndarray) -> float:
    """Bell-curve score centred on genuine micro-print energy band (0.35–0.80).

    Genuine notes photographed normally:
        high-pass ratio ~0.35–0.80  → score 1.0

    Too low (< 0.20):
        smoothed / blurred copy that lost micro-print detail
        → score ramps from 0.1 at 0 to 0.9 at 0.35

    Too high (> 0.85):
        noise-dominated, JPEG-compressed artefacts, or artificial sharpening
        → score ramps down from 1.0 at 0.80 to 0.2 at 0.95+

    Returns 0.0–1.0.
    """
    e = high_pass_energy(img_bgr)

    LOW_FLOOR  = 0.05
    LOW_IDEAL  = 0.35
    HIGH_IDEAL = 0.80
    HIGH_CEIL  = 0.95

    if e < LOW_FLOOR:
        return 0.1
    elif e < LOW_IDEAL:
        return float(0.1 + (e - LOW_FLOOR) / (LOW_IDEAL - LOW_FLOOR) * 0.9)
    elif e <= HIGH_IDEAL:
        return 1.0
    elif e <= HIGH_CEIL:
        return float(1.0 - (e - HIGH_IDEAL) / (HIGH_CEIL - HIGH_IDEAL) * 0.8)
    else:
        return 0.2
