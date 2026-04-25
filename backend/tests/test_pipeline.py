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
    res = analyze(_fake_note())
    subscores = res["breakdown"]["subscores"]
    expected = {
        "exposure", "histogram_match", "noise_quality",
        "sharpness", "microprint_fft", "thread_continuity",
        "color_chroma", "ml_confidence",
    }
    for key in expected:
        assert key in subscores, f"Missing subscore: {key}"
        assert 0.0 <= subscores[key] <= 1.0, f"Subscore {key} out of [0,1]: {subscores[key]}"


def test_noise_quality_score():
    """Noise module: clean synthetic image should score near 1.0."""
    arr = np.full((300, 600, 3), 128, dtype=np.uint8)  # flat grey — minimal noise
    score = noise.noise_quality_score(arr)
    assert 0.0 <= score <= 1.0, f"Score out of range: {score}"
    # A nearly-clean image should score > 0.5
    assert score > 0.5, f"Expected score > 0.5 for clean image, got {score}"


def test_noise_quality_noisy_image():
    """Noise module: heavy-noise image should score lower than clean image."""
    rng = np.random.default_rng(0)
    # Very noisy image
    noisy = rng.integers(0, 256, (300, 600, 3), dtype=np.uint8).astype(np.uint8)
    clean = np.full((300, 600, 3), 128, dtype=np.uint8)
    assert noise.noise_quality_score(noisy) < noise.noise_quality_score(clean)


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
