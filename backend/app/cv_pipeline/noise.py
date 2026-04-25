"""Noise Removal — PBL Technique #5.

noise_consistency_score() replaces the old noise_quality_score().

OLD (wrong): lower noise = more authentic. A scanned fake with low noise
would score 1.0.

NEW (correct): genuine banknotes have noise sigma in a specific range that
reflects paper grain and natural print texture (~2–7 sigma).
- Camera photos of genuine notes: sigma 2–6 (paper + sensor grain)
- Laser/inkjet reprints: either too clean (sigma < 1) or banding noise (> 10)
- Screen photos (phone screen): often sigma 1–3 but with periodic moire pattern
We score highest in the genuine-paper range and penalise both extremes.
"""
from __future__ import annotations

import cv2
import numpy as np


def estimate_noise_sigma(img_bgr: np.ndarray) -> float:
    """Median-filter residual estimate of luminance noise sigma."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    smooth = cv2.medianBlur(gray, 3)
    residual = gray.astype(np.int16) - smooth.astype(np.int16)
    mad = float(np.median(np.abs(residual - np.median(residual))))
    return float(1.4826 * mad)


def _moire_score(img_bgr: np.ndarray) -> float:
    """Detect periodic moire / banding pattern (screen photo signature).

    Returns 0.0 (strong moire detected) to 1.0 (no moire).
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape
    f = np.fft.fftshift(np.fft.fft2(gray))
    mag = np.abs(f)

    cy, cx = h // 2, w // 2
    # Look for sharp energy spikes outside the DC component but within the
    # mid-frequency band (typical of screen moire patterns)
    r_inner = int(min(h, w) * 0.05)
    r_outer = int(min(h, w) * 0.35)
    y_g, x_g = np.ogrid[:h, :w]
    dist = np.sqrt((y_g - cy) ** 2 + (x_g - cx) ** 2)
    band_mask = (dist > r_inner) & (dist < r_outer)

    band_mag = mag[band_mask]
    if band_mag.size == 0:
        return 1.0

    mean_e = float(band_mag.mean()) + 1e-9
    max_e = float(band_mag.max())
    # A sharp isolated spike indicates moire; spike-to-mean ratio > 15 = suspicious
    spike_ratio = max_e / mean_e
    if spike_ratio > 30:
        return 0.2
    elif spike_ratio > 15:
        return float(0.2 + (30 - spike_ratio) / 15.0 * 0.5)
    return 1.0


def denoise(img_bgr: np.ndarray) -> np.ndarray:
    """Edge-preserving denoise — fast non-local means in colour space."""
    try:
        return cv2.fastNlMeansDenoisingColored(img_bgr, None, 5, 5, 7, 15)
    except cv2.error:
        return cv2.bilateralFilter(img_bgr, 7, 35, 35)


def noise_consistency_score(img_bgr: np.ndarray) -> float:
    """Score based on whether noise sigma falls in the genuine-paper range.

    Genuine-paper range: sigma 2.0 – 7.0  → score 1.0
    Too clean (< 1.0)   → laser print or screencap → score drops
    Too noisy (> 12)    → poor reprint / severe compression → score drops
    Also checks for moire patterns which indicate screen photography.

    Returns 0.0–1.0.
    """
    sigma = estimate_noise_sigma(img_bgr)

    # Bell-curve centred on the genuine-paper range [2.0, 7.0]
    if sigma < 0.5:
        sigma_score = 0.2   # suspiciously clean: laser/screen capture
    elif sigma < 2.0:
        sigma_score = float(0.2 + (sigma - 0.5) / 1.5 * 0.8)
    elif sigma <= 7.0:
        sigma_score = 1.0   # genuine paper noise range
    elif sigma <= 12.0:
        sigma_score = float(1.0 - (sigma - 7.0) / 5.0 * 0.7)
    else:
        sigma_score = float(max(0.0, 0.3 - (sigma - 12.0) / 10.0 * 0.3))

    moire = _moire_score(img_bgr)
    return float(min(1.0, 0.65 * sigma_score + 0.35 * moire))


def noise_quality_score(img_bgr: np.ndarray) -> float:
    """Backward-compatible alias → noise_consistency_score()."""
    return noise_consistency_score(img_bgr)
