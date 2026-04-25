"""Smoke tests for the CV pipeline — 7 PBL techniques."""
from io import BytesIO

import numpy as np
from PIL import Image

from app.cv_pipeline.pipeline import analyze
from app.cv_pipeline import noise


def _fake_note(width=600, height=300, color=(50, 90, 60)) -> bytes:
    arr = np.zeros((height, width, 3), dtype=np.uint8)
    arr[:, :] = color
    # add texture so FFT/sharpness aren't zero
    rng = np.random.default_rng(42)
    n = rng.integers(0, 60, size=(height, width, 3), dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + n, 0, 255).astype(np.uint8)
    # vertical "thread"
    arr[:, width // 3] = 0
    buf = BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def test_pipeline_runs_and_returns_keys():
    res = analyze(_fake_note())
    for key in ("currency", "denomination", "authenticity_score",
                "verdict", "confidence", "breakdown"):
        assert key in res, f"Missing key: {key}"
    assert 0.0 <= res["authenticity_score"] <= 1.0
    assert res["verdict"] in {"authentic", "suspicious", "counterfeit"}
    assert "subscores" in res["breakdown"]
    assert len(res["breakdown"]["techniques_used"]) >= 7


def test_pipeline_reports_seven_techniques():
    res = analyze(_fake_note())
    techs = res["breakdown"]["techniques_used"]
    # All 7 PBL techniques must be represented
    assert any("Enhancement" in t for t in techs),   "Missing: Image Enhancement"
    assert any("Histogram" in t for t in techs),     "Missing: Histogram Processing"
    assert any("Spatial" in t for t in techs),       "Missing: Spatial Filtering"
    assert any("Frequency" in t for t in techs),     "Missing: Frequency-Domain"
    assert any("Noise" in t for t in techs),         "Missing: Noise Removal"
    assert any("Morphological" in t for t in techs), "Missing: Morphological Operations"
    assert any("Color" in t for t in techs),         "Missing: Color-Space Transformations"
    assert len(techs) == 7, f"Expected exactly 7 techniques, got {len(techs)}: {techs}"


def test_subscores_include_all_seven():
    """All 8 pipeline sub-scores must be present and in [0, 1]."""
    res = analyze(_fake_note())
    subscores = res["breakdown"]["subscores"]
    # These are the actual keys returned by pipeline.py
    expected = {
        "profile_match",        # Lab colour distance to genuine note profile (Technique 7)
        "color_consistency",    # Chroma within denomination's expected range (Technique 7)
        "texture_detail",       # Laplacian variance in genuine-print band (Technique 3)
        "microprint_presence",  # FFT high-freq micro-print energy (Technique 4)
        "thread_detection",     # Security thread morphology (Technique 6)
        "noise_consistency",    # Genuine-paper noise sigma + moire check (Technique 5)
        "histogram_profile",    # Multi-modal histogram shape (Technique 2)
        "exposure_valid",       # Quality gate: exposure (Technique 1)
    }
    for key in expected:
        assert key in subscores, f"Missing subscore: {key}"
        assert 0.0 <= subscores[key] <= 1.0, f"Subscore {key} out of [0,1]: {subscores[key]}"
    # ml_confidence lives in breakdown (not subscores) for reference
    assert "ml_confidence" in res["breakdown"]


def test_noise_quality_score():
    """Noise module: image with genuine paper-grain sigma (~4) should score > 0.5."""
    rng = np.random.default_rng(42)
    # Genuine banknote paper has noise sigma 2-7; use sigma≈4
    base = np.full((300, 600, 3), 128, dtype=np.float32)
    noise_arr = rng.normal(0, 4, base.shape).astype(np.float32)
    arr = np.clip(base + noise_arr, 0, 255).astype(np.uint8)
    score = noise.noise_quality_score(arr)
    assert 0.0 <= score <= 1.0, f"Score out of range: {score}"
    # Paper-grain image (sigma 2-7) should score high
    assert score > 0.5, f"Expected score > 0.5 for paper-grain image, got {score}"


def test_noise_quality_noisy_image():
    """Noise module: heavy-noise image should score lower than paper-grain image."""
    rng = np.random.default_rng(0)
    # Very noisy image (sigma >> 7, well outside genuine range)
    noisy = rng.integers(0, 256, (300, 600, 3), dtype=np.uint8).astype(np.uint8)
    # Paper-grain image (sigma ≈ 4)
    base = np.full((300, 600, 3), 128, dtype=np.float32)
    grain = rng.normal(0, 4, base.shape).astype(np.float32)
    paper = np.clip(base + grain, 0, 255).astype(np.uint8)
    assert noise.noise_quality_score(noisy) < noise.noise_quality_score(paper)


def test_pipeline_with_currency_hint():
    """Currency hint should restrict classification without crashing."""
    for hint in ("INR", "USD", "EUR"):
        res = analyze(_fake_note(), currency_hint=hint)
        assert "currency" in res
        assert res["verdict"] in {"authentic", "suspicious", "counterfeit"}


def test_comparison_of_techniques_present():
    res = analyze(_fake_note())
    cmp = res["breakdown"].get("comparison_of_techniques", {})
    assert "raw" in cmp
    assert "clahe" in cmp
    assert "gamma" in cmp
