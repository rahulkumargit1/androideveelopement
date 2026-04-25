"""Google Cloud Vision API text-detection wrapper.

Falls back gracefully (returns None) when:
  - GOOGLE_VISION_API_KEY is not set
  - The API returns an error or no text
  - The detected text does not contain a recognisable denomination

Set the environment variable before starting the server:
    set GOOGLE_VISION_API_KEY=AIza...
    (or add it to a .env file that your process loads)

The return shape is identical to ocr_classifier.detect() so pipeline.py
can treat both sources interchangeably.
"""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from typing import Any

import cv2
import numpy as np

from .ocr_classifier import _parse_texts  # reuse the same denomination parser

_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"


def _api_key() -> str | None:
    # pydantic_settings loads .env into Settings but not os.environ — read .env directly too
    key = os.environ.get("GOOGLE_VISION_API_KEY") or os.environ.get("VISION_API_KEY")
    if key:
        return key
    # Fallback: parse the .env file in the backend directory
    env_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
    ]
    for env_path in env_paths:
        env_path = os.path.normpath(env_path)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GOOGLE_VISION_API_KEY="):
                        return line.split("=", 1)[1].strip()
    return None


def detect(img_bgr: np.ndarray) -> dict | None:
    """
    Send the image to Google Cloud Vision for text detection, then parse
    the returned OCR strings for currency and denomination.

    Returns the same dict shape as ocr_classifier.detect(), or None.
    """
    key = _api_key()
    if not key:
        return None  # API not configured — skip silently

    # Encode image as JPEG bytes → base64
    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        return None
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    payload = json.dumps({
        "requests": [{
            "image": {"content": b64},
            "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
        }]
    }).encode("utf-8")

    url = f"{_ENDPOINT}?key={key}"
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data: Any = json.loads(resp.read())
    except (urllib.error.URLError, OSError) as exc:
        print(f"[vision_api] request failed: {exc}")
        return None
    except json.JSONDecodeError:
        return None

    # Extract text annotations
    try:
        annotations = data["responses"][0].get("textAnnotations", [])
    except (KeyError, IndexError):
        return None

    if not annotations:
        return None

    # First annotation is the full concatenated text; rest are individual words
    texts = [a.get("description", "") for a in annotations]

    currency, denomination, confidence = _parse_texts(texts)

    if confidence < 0.55 or denomination is None:
        return None

    return {
        "currency":       currency or "INR",
        "denomination":   denomination,
        "ocr_confidence": round(confidence, 3),
        "ocr_texts":      texts[:20],
        "ocr_source":     "google_vision",
    }
