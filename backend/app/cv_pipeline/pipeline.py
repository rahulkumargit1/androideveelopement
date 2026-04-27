from __future__ import annotations

"""End-to-end pipeline: bytes -> ScanResult dict.

REDESIGNED FLOW (v2):
  1. Decode + pre-process image
  2. Identify currency + denomination FIRST (Lab classifier + OCR)
  3. Retrieve the matched NoteProfile for that denomination
  4. Compute ALL sub-scores RELATIVE TO the matched profile
     (i.e. "does this note look like a genuine <currency> <denomination>?")
  5. Ensemble → authenticity score → verdict

This replaces the old approach where sub-scores measured image quality
(sharpness, noise, exposure) rather than note authenticity.
"""

# Notes recalled / demonetized by their central banks.
# currency → denomination strings withdrawn from circulation.
DEMONETIZED: dict[str, set[str]] = {
    "INR": {"2000"},   # RBI recalled ₹2000 notes in May 2023
}

from io import BytesIO
from typing import Iterable

import cv2
import numpy as np
from PIL import Image, ImageOps

from . import (
    classifier,
    colorspace,
    enhancement,
    ensemble,
    frequency,
    histogram,
    morphology,
    noise,
    ocr_classifier,
    spatial,
    vision_api,
)


def _decode(image_bytes: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img).convert("RGB")
    arr = np.array(img)[:, :, ::-1].copy()   # RGB -> BGR
    h, w = arr.shape[:2]
    # Upscale tiny images (thumbnails from web searches etc.) so CV ops have
    # enough pixels — Canny, FFT, morphology all need ≥ 200px on the short side.
    min_side = 300
    if min(h, w) < min_side:
        s = min_side / min(h, w)
        arr = cv2.resize(arr, (int(w * s), int(h * s)), interpolation=cv2.INTER_CUBIC)
        h, w = arr.shape[:2]
    # Downscale very large images to keep processing fast
    max_side = 1024
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        arr = cv2.resize(arr, (int(w * s), int(h * s)))
    return arr


def _find_matched_profile(currency: str, denomination: str):
    """Return the NoteProfile for the identified denomination, or None."""
    return next(
        (p for p in colorspace.PROFILES
         if p.currency == currency and p.denomination == denomination),
        None,
    )


# Currencies where all denominations share the same colour family —
# Lab colour ML cannot reliably distinguish denominations for these.
# OCR is always authoritative; if OCR fails, denomination = "unknown".
OCR_ALWAYS_WINS: set[str] = {
    "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF",
    "SGD", "HKD", "KRW", "CNY", "THB", "MYR",
}


def analyze(
    image_bytes: bytes,
    authentic_thr: float = 0.75,
    suspicious_thr: float = 0.5,
    enabled_currencies: Iterable[str] | None = None,
    currency_hint: str | None = None,
) -> dict:
    img = _decode(image_bytes)

    # ── Step 1: Pre-process (Techniques 1 & 5) ───────────────────────────────
    enhanced = enhancement.auto_enhance(img)
    denoised = noise.denoise(enhanced)

    # ── Step 2: Identify currency + denomination FIRST ────────────────────────
    # Priority: Vision API > EasyOCR > Lab colour classifier
    ocr = vision_api.detect(img) or ocr_classifier.detect(img, currency_hint=currency_hint)

    effective_hint = currency_hint
    if ocr and ocr.get("currency") and not currency_hint:
        effective_hint = ocr["currency"]

    ml = classifier.predict(
        img,
        enabled_currencies=list(enabled_currencies) if enabled_currencies else None,
        currency_hint=effective_hint,
    )

    if ocr:
        # OCR may find a denomination but fail to identify the currency
        # (e.g. digit-scan returns "500" without any currency keyword match).
        # Fall back to ML's currency in that case — ML's colour classifier is
        # more reliable for currency identity than denomination-only OCR.
        out_currency = ocr["currency"] or ml["currency"]
        ocr_den  = ocr["denomination"]
        ocr_conf = float(ocr.get("ocr_confidence", 0.0))

        # ── Cross-validate denomination: ML colour analysis vs OCR text ─────────
        #
        # Two cases where ML is allowed to override OCR:
        #
        # Case 1 — Distinct-colour currencies (INR etc.):
        #   Each denomination has a unique colour, so Lab-space ML is reliable.
        #   Override whenever ML is decisive (≥62% conf, ≥18% spread).
        #
        # Case 2 — Same-colour currencies (USD, EUR, GBP …) where OCR is uncertain:
        #   All denominations share the same colour family, so Lab ML is normally
        #   unreliable.  BUT if OCR confidence is low (< 0.80 → denomination
        #   appeared only once in the scan — typical of a serial-number fragment
        #   like "A12345678" yielding a stray "2") AND the TFLite visual classifier
        #   is very decisive (≥90% conf, ≥35% spread), the ML read is more
        #   trustworthy than a single spurious OCR hit.
        #
        ml_top    = ml["top_denominations"][0] if ml["top_denominations"] else None
        ml_second = ml["top_denominations"][1] if len(ml["top_denominations"]) > 1 else None
        ml_spread = (ml_top[2] - ml_second[2]) if (ml_top and ml_second) else (ml_top[2] if ml_top else 0.0)

        # OCR confidence < 0.80 means the denomination appeared only once in the
        # full scan text — high chance it came from a serial number, not the
        # printed denomination (which normally appears 2-4× on a real note).
        ocr_uncertain = ocr_conf < 0.80

        ml_decisive = (
            ml_top is not None
            and ml_top[2]  >= 0.62   # strong absolute confidence
            and ml_spread  >= 0.18   # clearly ahead of second-best denomination
            and (
                out_currency not in OCR_ALWAYS_WINS            # Case 1: distinct colours
                or (                                            # Case 2: same colour, but OCR is weak
                    ocr_uncertain
                    and ml_top[2]  >= 0.90   # ML must be very confident
                    and ml_spread  >= 0.35   # ML must dominate all other denominations
                )
                or (                                            # Case 3: ML extremely confident
                    ml_top[2]  >= 0.95       # near-certain TFLite prediction
                    and ml_spread  >= 0.50   # dominates all other denominations by half
                )
            )
        )

        if ml_decisive and ml_top[1] != ocr_den:
            out_denomination = ml_top[1]
            override_note    = f"ml_override({ml_top[2]:.0%},Δ{ml_spread:.0%},ocr_conf={ocr_conf:.0%})"
        else:
            # If OCR denomination is None (OCR found currency but no denomination),
            # fall back to ML's top denomination rather than returning None.
            out_denomination = ocr_den or (ml_top[1] if ml_top else None)
            override_note    = None

        ocr_info = {
            "source":     ocr.get("ocr_source", "easyocr") + (f"+{override_note}" if override_note else ""),
            "confidence": ocr_conf,
            "texts":      ocr.get("ocr_texts", []),
        }
    else:
        out_currency = ml["currency"]
        # For currencies where all denominations share the same colour (USD, EUR etc.),
        # Lab colour ML cannot reliably distinguish denominations.
        # HOWEVER, the per-currency TFLite models (usd_mobilenet, eur_mobilenet, etc.)
        # ARE denomination-specific and reliable.  Use them when confident; otherwise
        # show "unknown" to avoid a confidently-wrong Lab guess.
        if out_currency in OCR_ALWAYS_WINS:
            ml_den_conf = float(ml.get("denom_confidence") or 0.0)
            ml_den = ml.get("denomination") or ""
            if ml_den_conf >= 0.55 and ml_den not in ("", "Unknown", "unknown"):
                out_denomination = ml_den
            else:
                out_denomination = "unknown"
        else:
            out_denomination = ml["denomination"]
        ocr_info = None

    # ── Step 3: Retrieve matched NoteProfile ──────────────────────────────────
    matched_profile = _find_matched_profile(out_currency, out_denomination)

    # ── Step 4: Profile-relative sub-scores ───────────────────────────────────
    # Each score now answers: "does this image look like a genuine
    # <out_currency> <out_denomination> note?" rather than "is this a
    # good photograph?"

    scores: dict[str, float] = {}

    # profile_match: Lab colour distance to the matched denomination profile
    scores["profile_match"] = colorspace.profile_match_score(
        img, matched_profile=matched_profile
    )

    # color_consistency: chroma within the expected range for this denomination
    scores["color_consistency"] = colorspace.color_consistency_score(
        img, matched_profile=matched_profile
    )

    # texture_detail: Laplacian variance in genuine-print band (Technique 3)
    scores["texture_detail"] = spatial.texture_detail_score(denoised)

    # microprint_presence: FFT high-freq energy in genuine micro-print band (Technique 4)
    scores["microprint_presence"] = frequency.microprint_score(enhanced)

    # thread_detection: continuous security thread morphology (Technique 6)
    scores["thread_detection"] = morphology.thread_continuity_score(enhanced)

    # noise_consistency: noise sigma in genuine-paper range, moire check (Technique 5)
    scores["noise_consistency"] = noise.noise_consistency_score(img)

    # histogram_profile: multi-modal histogram shape (Technique 2)
    scores["histogram_profile"] = histogram.histogram_profile_score(enhanced)

    # exposure_valid: quality gate only — does NOT affect authenticity
    scores["exposure_valid"] = enhancement.exposure_score(img)

    # ml_confidence is the TFLite MobileNet's confidence in the predicted
    # denomination. It is lighting-invariant (the network was trained on
    # varied images), so it stabilises the ensemble against the more
    # lighting-sensitive Lab profile_match signal.
    ml_confidence = float(ml["ml_confidence"])
    scores["ml_confidence"] = ml_confidence

    # ── Step 5: Ensemble → final score → verdict ──────────────────────────────
    final = ensemble.combine(scores)
    v = ensemble.verdict(final, authentic_thr, suspicious_thr)

    # ── Step 6: Scan quality indicator (separate from authenticity) ───────────
    scan_quality = float(
        0.5 * scores["exposure_valid"] +
        0.3 * scores["noise_consistency"] +
        0.2 * scores["texture_detail"]
    )
    scan_quality_label = (
        "good" if scan_quality >= 0.70
        else "acceptable" if scan_quality >= 0.45
        else "poor"
    )

    # ── Step 7: Comparison-of-techniques breakdown (PBL bonus) ───────────────
    comparison = {
        "raw":   round(spatial.texture_detail_score(img),                        4),
        "clahe": round(spatial.texture_detail_score(enhancement.clahe_on_l(img)), 4),
        "gamma": round(spatial.texture_detail_score(
                       enhancement.gamma_correction(img, 1.4)),                   4),
    }

    breakdown: dict = {
        "subscores": {k: round(float(val), 4) for k, val in scores.items()},
        "ml_confidence": round(ml_confidence, 4),
        "comparison_of_techniques": comparison,
        "scan_quality": {
            "score": round(scan_quality, 4),
            "label": scan_quality_label,
        },
        "model": ml["model"],
        "lab":   ml["lab"],
        "top_currencies":   ml["top_currencies"],
        "top_denominations": ml["top_denominations"],
        "techniques_used": [
            "Image Enhancement (CLAHE + adaptive gamma)",
            "Histogram Processing (multi-modal shape analysis)",
            "Spatial Filtering (texture detail in genuine-print band)",
            "Frequency-Domain Filtering (micro-print energy band)",
            "Noise Removal (genuine-paper sigma + moire detection)",
            "Morphological Operations (security thread with width constraint)",
            "Color-Space Transformations (profile-relative Lab distance)",
        ],
    }
    if ocr_info:
        breakdown["ocr"] = ocr_info
    if matched_profile:
        breakdown["matched_profile"] = {
            "currency":    matched_profile.currency,
            "denomination": matched_profile.denomination,
            "expected_L":  matched_profile.L,
            "expected_a":  matched_profile.a,
            "expected_b":  matched_profile.b,
            "chroma_min":  matched_profile.chroma_min,
            "chroma_max":  matched_profile.chroma_max,
        }

    # ── Final safety net: never return None for currency/denomination ────────
    # OCR may identify a denomination without a currency, and the visual classifier
    # may fail entirely on non-currency images.  ScanResult requires strings, so
    # surface "Unknown" to the user instead of crashing the request with a 500.
    if not out_currency:
        out_currency = "Unknown"
    if not out_denomination:
        out_denomination = "unknown"

    # ── Demonetization check ──────────────────────────────────────────────────
    is_demonetized = out_denomination in DEMONETIZED.get(out_currency, set())

    return {
        "currency":           out_currency,
        "denomination":       out_denomination,
        "authenticity_score": round(final, 4),
        "confidence":         round(max(ml_confidence, final), 4),
        "verdict":            v,
        "demonetized":        is_demonetized,
        "breakdown":          breakdown,
    }
