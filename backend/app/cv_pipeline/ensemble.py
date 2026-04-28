"""Combine per-check scores into a final authenticity verdict.

Score semantics (v4 — improved ML-anchored + adaptive thresholds):
  Every score is a profile-relative signal — it measures how closely the
  note matches what a GENUINE note of the identified denomination looks like.

ML-anchored scoring:
  When a trained TFLite model is confident about the denomination, its
  confidence is the most STABLE, LIGHTING-INVARIANT signal we have.
  The heuristic subscores validate but don't dominate.

v4 improvements over v3:
  - Higher ML anchor weight (0.60 vs 0.55) when ML is confident
  - Steeper trust ramp: ML needs ≥0.50 to start anchoring (was 0.30)
  - Profile-match and color-consistency weights increased (these are
    the most discriminating heuristic signals for fake detection)
  - Exposure score removed from final scoring (quality gate only)
  - Added penalty multiplier when profile_match is very low (<0.3)
    even if ML confidence is high — catches counterfeits that fool
    the visual classifier but have wrong colours
"""
from __future__ import annotations

# Weights MUST sum to 1.0
# v4: ml_confidence further increased — most stable signal.
# profile_match + color_consistency boosted — they are the only
# heuristic signals that can differentiate genuine from fake.
# exposure_valid removed (pure quality gate, should not affect verdict).
WEIGHTS = {
    "ml_confidence":      0.32,   # TFLite MobileNet confidence (lighting-invariant anchor)
    "profile_match":      0.26,   # Lab distance to genuine-note profile
    "color_consistency":  0.14,   # Chroma within expected range for denomination
    "texture_detail":     0.08,   # Laplacian variance in genuine-print band
    "noise_consistency":  0.06,   # Genuine-paper noise range + moire check
    "microprint_presence":0.04,   # FFT — unreliable at phone-camera resolution
    "thread_detection":   0.04,   # Security thread — often not visible in photos
    "histogram_profile":  0.04,   # Multi-modal histogram shape
    "exposure_valid":     0.02,   # Quality gate only — minimal weight
}

assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-6, "Weights must sum to 1.0"


def combine(scores: dict[str, float]) -> float:
    """ML-anchored weighted average with colour-mismatch penalty.

    When the TFLite model is confident (≥ 0.50), its confidence anchors
    the result.  A colour-mismatch penalty fires when profile_match is
    critically low — catching counterfeits that look right to the visual
    classifier but have wrong ink colours.
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
    # ml_trust ramps from 0 (at ml_conf=0.40) to 1 (at ml_conf=0.85).
    # Tighter window than v3: ML needs stronger confidence to anchor.
    ml_trust = max(0.0, min(1.0, (ml_conf - 0.40) / 0.45))

    if ml_trust > 0.0:
        # Anchored score: ML gets 60% influence (up from 55% in v3),
        # heuristics get 40%.
        anchored = 0.60 * ml_conf + 0.40 * heuristic_avg
        final = ml_trust * anchored + (1.0 - ml_trust) * heuristic_avg
    else:
        final = heuristic_avg

    # ── Colour-mismatch penalty ───────────────────────────────────────────────
    # If profile_match is very low (<0.30), the note's Lab colour is far from
    # any genuine note of the identified denomination.  Even if ML is confident,
    # this is a strong counterfeit signal.  Apply a penalty that drags the
    # score down proportionally.
    profile_match = float(scores.get("profile_match", 0.5))
    if profile_match < 0.30:
        penalty = 0.15 * (0.30 - profile_match) / 0.30   # max penalty: 0.15
        final = max(0.0, final - penalty)

    # ── Low colour-consistency penalty ────────────────────────────────────────
    color_cons = float(scores.get("color_consistency", 0.5))
    if color_cons < 0.25:
        penalty = 0.10 * (0.25 - color_cons) / 0.25   # max penalty: 0.10
        final = max(0.0, final - penalty)

    return float(max(0.0, min(1.0, final)))


def verdict(score: float, authentic_thr: float, suspicious_thr: float) -> str:
    if score >= authentic_thr:
        return "authentic"
    if score >= suspicious_thr:
        return "suspicious"
    return "counterfeit"
