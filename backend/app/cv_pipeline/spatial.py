"""Technique 3: Spatial Filtering — denoise + edge detection + texture detail.

texture_detail_score() replaces the old sharpness_score().

OLD (wrong): higher Laplacian variance = more authentic.  A over-sharpened
digital fake would score 1.0 while a legitimately soft genuine note scored 0.

NEW (correct): genuine intaglio-printed banknotes have Laplacian variance in
a specific band (150–1400) that reflects fine engraving lines and security
features.  Too low = blurry photocopy.  Too high = artificial sharpening or
noise.  We use a bell-curve score centred on this band.
"""
from __future__ import annotations

import cv2
import numpy as np


def bilateral_denoise(img_bgr: np.ndarray) -> np.ndarray:
    return cv2.bilateralFilter(img_bgr, d=9, sigmaColor=60, sigmaSpace=60)


def median_denoise(img_bgr: np.ndarray, k: int = 5) -> np.ndarray:
    return cv2.medianBlur(img_bgr, k)


def edge_map(img_bgr: np.ndarray) -> np.ndarray:
    g = cv2.cvtColor(bilateral_denoise(img_bgr), cv2.COLOR_BGR2GRAY)
    return cv2.Canny(g, 60, 160)


def edge_density(img_bgr: np.ndarray) -> float:
    e = edge_map(img_bgr)
    return float(e.mean() / 255.0)


def texture_detail_score(img_bgr: np.ndarray) -> float:
    """Bell-curve score around the genuine intaglio-print Laplacian band.

    Genuine notes (intaglio printing) under normal photography:
        variance ~ 150 – 1 400  →  score 1.0

    Too low (< 50):
        blurry, low-detail image — photocopier output or motion blur
        → score ramps from 0.1 at 0 to 0.9 at 150

    Too high (> 2 000):
        artificial over-sharpening or extreme sensor noise
        → score ramps down from 1.0 at 1 400 to 0.2 at 3 000+

    Returns 0.0–1.0.
    """
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    v = float(cv2.Laplacian(g, cv2.CV_64F).var())

    LOW_FLOOR  = 30.0
    LOW_IDEAL  = 150.0
    HIGH_IDEAL = 1400.0
    HIGH_CEIL  = 3000.0

    if v < LOW_FLOOR:
        return 0.1                                         # extremely blurry
    elif v < LOW_IDEAL:
        return float(0.1 + (v - LOW_FLOOR) / (LOW_IDEAL - LOW_FLOOR) * 0.9)
    elif v <= HIGH_IDEAL:
        return 1.0                                         # ideal range
    elif v <= HIGH_CEIL:
        return float(1.0 - (v - HIGH_IDEAL) / (HIGH_CEIL - HIGH_IDEAL) * 0.8)
    else:
        return 0.2                                         # extreme over-sharpen


def sharpness_score(img_bgr: np.ndarray) -> float:
    """Backward-compatible alias → texture_detail_score()."""
    return texture_detail_score(img_bgr)
