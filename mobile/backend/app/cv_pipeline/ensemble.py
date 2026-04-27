"""Combine per-check scores into a final authenticity verdict.

Score semantics (post-fix):
  Every score is NOW a profile-relative signal — it measures how closely the
  note matches what a GENUINE note of the identified denomination looks like,
  NOT how good the photograph is.

Weights are calibrated for the heuristic baseline; values closest to real
discriminating power come first.
"""
from __future__ import annotations

# Weights MUST sum to 1.0
# Tuned for phone-camera captures: thread_detection and microprint_presence
# are unreliable at phone resolution, so they are down-weighted.
# profile_match is the strongest direct authenticity signal.
WEIGHTS = {
    "profile_match":      0.35,   # Lab distance to genuine-note profile (strongest signal)
    "color_consistency":  0.15,   # Chroma within expected range for denomination
    "texture_detail":     0.18,   # Laplacian variance in genuine-print band
    "microprint_presence":0.07,   # FFT — unreliable at phone-camera resolution
    "thread_detection":   0.06,   # Security thread — often not visible on phone photos
    "noise_consistency":  0.10,   # Genuine-paper noise range + moire check
    "histogram_profile":  0.05,   # Multi-modal histogram shape
    "exposure_valid":     0.04,   # Quality gate only
}

assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-6, "Weights must sum to 1.0"


def combine(scores: dict[str, float]) -> float:
    """Weighted average; gracefully skips missing keys (re-normalises weights)."""
    total_w = 0.0
    s = 0.0
    for k, w in WEIGHTS.items():
        if k in scores:
            v = float(scores[k])
            s += w * max(0.0, min(1.0, v))
            total_w += w
    if total_w == 0:
        return 0.0
    return float(max(0.0, min(1.0, s / total_w)))


def verdict(score: float, authentic_thr: float, suspicious_thr: float) -> str:
    if score >= authentic_thr:
        return "authentic"
    if score >= suspicious_thr:
        return "suspicious"
    return "counterfeit"
