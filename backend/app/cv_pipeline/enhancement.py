"""Technique 1: Image Enhancement — intensity transformations + gamma + CLAHE.

We expose three variants for the PBL "compare 2+ techniques" bonus.
exposure_score() is now a QUALITY GATE — it only penalises truly unusable
images (extreme over/under exposure) rather than acting as an authenticity
signal.  Most photos of real notes will pass with 0.8+.
"""
from __future__ import annotations

import cv2
import numpy as np


def gamma_correction(img: np.ndarray, gamma: float = 1.2) -> np.ndarray:
    inv = 1.0 / max(gamma, 1e-3)
    table = np.array([((i / 255.0) ** inv) * 255 for i in range(256)]).astype("uint8")
    return cv2.LUT(img, table)


def clahe_on_l(img_bgr: np.ndarray, clip: float = 2.5, grid: int = 8) -> np.ndarray:
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(grid, grid))
    l2 = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l2, a, b]), cv2.COLOR_LAB2BGR)


def auto_enhance(img_bgr: np.ndarray) -> np.ndarray:
    """Adaptive: estimate mean luma; apply gamma if dark, CLAHE always."""
    luma = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).mean()
    g = 1.4 if luma < 90 else (0.85 if luma > 180 else 1.0)
    return clahe_on_l(gamma_correction(img_bgr, g))


def exposure_score(img_bgr: np.ndarray) -> float:
    """Image quality gate — penalises only severely over/under-exposed photos.

    This is NOT an authenticity signal.  Genuine notes photographed in poor
    lighting should not be penalised as counterfeit.

    Returns:
        1.0  — acceptable exposure (most real-world photos)
        0.6+ — somewhat clipped but still usable
        0.0  — completely blown out or pitch black (unusable)
    """
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    total = float(g.size)
    # Only penalise very extreme clipping (< 2 or > 253)
    severely_clipped = float((g < 2).sum() + (g > 253).sum()) / total
    # Score: 1.0 when < 5 % severely clipped, 0.0 when > 40 % clipped
    return float(max(0.0, min(1.0, 1.0 - (severely_clipped - 0.05) / 0.35)))
