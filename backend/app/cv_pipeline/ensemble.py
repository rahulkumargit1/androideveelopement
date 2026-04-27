"""Combine per-check scores into a final authenticity verdict.

Score semantics (post-fix v3 — ML-anchored):
  Every score is NOW a profile-relative signal — it measures how closely the
  note matches what a GENUINE note of the identified denomination looks like,
  NOT how good the photograph is.

ML-anchored scoring:
  When a trained TFLite model is confident about the denomination, its
  confidence is the most STABLE, LIGHTING-INVARIANT signal we have.
  The heuristic subscores (texture, noise, histogram, FFT, morphology)
  measure image quality properties that are identical for genuine and
  counterfeit notes — a well-printed fake scores the same as a real note
  on all of them.  They serve as secondary validation only.

  When ML confidence is HIGH (≥ 0.65), we anchor the result around it
  and blend in heuristic validation.  When ML confidence is LOW, we
  fall back to the weighted heuristic average.
"""
from __future__ import annotations

# Weights MUST sum to 1.0
# v3: ml_confidence dramatically increased (most stable, lighting-invariant
# signal from trained TFLite models).  Heuristic image-quality scores
# (texture, noise, microprint, thread, histogram) reduced — they cannot
# distinguish genuine from counterfeit.
WEIGHTS = {
    "ml_confidence":      0.30,   # TFLite MobileNet confidence (lighting-invariant anchor)
    "profile_match":      0.24,   # Lab distance to genuine-note profile (now consistent via caching)
    "color_consistency":  0.12,   # Chroma within expected range for denomination
    "texture_detail":     0.10,   # Laplacian variance in genuine-print band
    "noise_consistency":  0.06,   # Genuine-paper noise range + moire check
    "microprint_presence":0.05,   # FFT — unreliable at phone-camera resolution
    "thread_detection":   0.05,   # Security thread — often not visible on phone photos
    "histogram_profile":  0.04,   # Multi-modal histogram shape
    "exposure_valid":     0.04,   # Quality gate only
}

assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-6, "Weights must sum to 1.0"


def combine(scores: dict[str, float]) -> float:
    """ML-anchored weighted average.

    When the TFLite model is confident (≥ 0.65), its confidence anchors the
    result — the heuristic scores validate but don't dominate.  This prevents
    the 'everything scores 0.65–0.75' problem caused by image-quality metrics
    that are identical for genuine and counterfeit notes.

    When ML confidence is low or unavailable, falls back to the traditional
    weighted average of all available scores.
    """
    ml_conf = float(scores.get("ml_confidence", 0.0))
    ml_conf = max(0.0, min(1.0, ml_conf))

    # ── Compute heuristic-only weighted average ───────────────────────────────
    heur_w = 0.0
    heur_s = 0.0
    for k, w in WEIGHTS.items():
        if k == "ml_confidence":
            continue
        if k in scores:
            v = float(max(0.0, min(1.0, scores[k])))
            heur_s += w * v
            heur_w += w
    heuristic_avg = float(heur_s / heur_w) if heur_w > 0 else 0.5

    # ── ML-anchored blending ──────────────────────────────────────────────────
    # ml_trust ramps from 0 (at ml_conf=0.3) to 1 (at ml_conf=0.80).
    # Below 0.3: ML is too uncertain to anchor anything.
    # Above 0.8: ML is authoritative.
    ml_trust = max(0.0, min(1.0, (ml_conf - 0.30) / 0.50))

    if ml_trust > 0.0:
        # Anchored score: blend ML confidence with heuristic validation.
        # ML gets 55% influence, heuristics get 45% — so a genuine note with
        # ML=0.95 + heuristic=0.70 scores ~0.84 (authentic), while a fake with
        # ML=0.40 + heuristic=0.70 falls back to ~0.70 (see below).
        anchored = 0.55 * ml_conf + 0.45 * heuristic_avg
        # Blend between anchored and pure-heuristic based on trust level.
        final = ml_trust * anchored + (1.0 - ml_trust) * heuristic_avg
    else:
        final = heuristic_avg

    return float(max(0.0, min(1.0, final)))


def verdict(score: float, authentic_thr: float, suspicious_thr: float) -> str:
    if score >= authentic_thr:
        return "authentic"
    if score >= suspicious_thr:
        return "suspicious"
    return "counterfeit"
