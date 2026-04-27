"""Multi-signal banknote identifier.

Identification priority:
  1. OCR  — read denomination digits + currency symbols/words directly off the note
  2. Script detection — Unicode block analysis identifies currency from native script
  3. Color fingerprint — Lab k-means for final disambiguation (fallback only)

EasyOCR language groups loaded on demand based on currency hint:
  - No hint      → ["en", "hi"]  (covers Latin digits + Devanagari)
  - INR/NPR hint → ["en", "hi"]
  - AED/SAR/QAR/KWD → ["en", "ar"]
  - CNY          → ["en", "ch_sim"]
  - JPY          → ["en", "ja"]
  - KRW          → ["en", "ko"]
  - THB          → ["en", "th"]
  - RUB          → ["en", "ru"]
  - BDT          → ["en", "bn"]
  Everything else → ["en"]
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

import cv2
import numpy as np

# ── Lazy EasyOCR reader pool (one reader per language set) ────────────────────
_readers: dict[str, Any] = {}
_failed:  set[str] = set()


def _lang_key(langs: list[str]) -> str:
    return "+".join(sorted(langs))


def _get_reader(langs: list[str]) -> Any:
    key = _lang_key(langs)
    if key in _failed:
        return None
    if key in _readers:
        return _readers[key]
    try:
        import easyocr  # type: ignore
        r = easyocr.Reader(langs, gpu=False, verbose=False)
        _readers[key] = r
        print(f"[ocr] EasyOCR loaded ({key})")
        return r
    except Exception as exc:
        print(f"[ocr] EasyOCR load failed ({key}): {exc}")
        _failed.add(key)
        return None


def _langs_for_hint(hint: str | None) -> list[str]:
    """Return the language list that covers the hinted currency."""
    if not hint:
        # Default: English only — adding Hindi (en+hi) causes the Devanagari
        # model to interfere with Latin-script currencies (USD, EUR, GBP…)
        # and lowers OCR confidence on printed numbers.
        return ["en"]
    h = hint.upper()
    mapping = {
        "INR": ["en", "hi"], "NPR": ["en", "hi"],
        "AED": ["en", "ar"], "SAR": ["en", "ar"],
        "QAR": ["en", "ar"], "KWD": ["en", "ar"],
        "CNY": ["en", "ch_sim"],
        "JPY": ["en", "ja"],
        "KRW": ["en", "ko"],
        "THB": ["en", "th"],
        "RUB": ["en", "ru"],
        "BDT": ["en", "bn"],
    }
    return mapping.get(h, ["en"])


# ── Denomination tables ───────────────────────────────────────────────────────
CURRENCY_DENOMS: dict[str, set[str]] = {
    "INR": {"10","20","50","100","200","500","2000"},
    "USD": {"1","2","5","10","20","50","100"},
    "EUR": {"5","10","20","50","100","200","500"},
    "GBP": {"5","10","20","50"},
    "JPY": {"1000","5000","10000"},
    "AED": {"5","10","20","50","100","200","500","1000"},
    "CNY": {"1","5","10","20","50","100"},
    "CAD": {"5","10","20","50","100"},
    "AUD": {"5","10","20","50","100"},
    "CHF": {"10","20","50","100","200","1000"},
    "SGD": {"2","5","10","50","100","1000"},
    "KRW": {"1000","5000","10000","50000"},
    "THB": {"20","50","100","500","1000"},
    "MYR": {"1","5","10","20","50","100"},
    "SAR": {"1","5","10","20","50","100","500"},
    "QAR": {"1","5","10","50","100","500"},
    "KWD": {"250","500","1","5","10","20"},
    "HKD": {"10","20","50","100","500","1000"},
    "BRL": {"2","5","10","20","50","100","200"},
    "MXN": {"20","50","100","200","500","1000"},
    "ZAR": {"10","20","50","100","200"},
    "NZD": {"5","10","20","50","100"},
    "SEK": {"20","50","100","200","500","1000"},
    "NOK": {"50","100","200","500","1000"},
    "DKK": {"50","100","200","500","1000"},
    "IDR": {"1000","2000","5000","10000","20000","50000","100000"},
    "PKR": {"10","20","50","100","500","1000","5000"},
    "BDT": {"10","20","50","100","200","500","1000"},
    "TRY": {"5","10","20","50","100","200"},
    "RUB": {"10","50","100","200","500","1000","2000","5000"},
    "PHP": {"20","50","100","200","500","1000"},
    "VND": {"10000","20000","50000","100000","200000","500000"},
    "TWD": {"100","200","500","1000","2000"},
    "LKR": {"20","50","100","500","1000","5000"},
    "NPR": {"5","10","20","50","100","500","1000"},
}

ALL_DENOMS: set[str] = set()
for _d in CURRENCY_DENOMS.values():
    ALL_DENOMS |= _d


# ── Currency keyword patterns ─────────────────────────────────────────────────
# Ordered from most-specific to least-specific
CURRENCY_KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"[₹\u20b9]|rupee|rupees|bharatiya|reserve.?bank.?of.?india|rbi", re.I), "INR"),
    (re.compile(r"federal.?reserve|united.?states|the.?united.?states", re.I), "USD"),
    (re.compile(r"european.?central|banque.?centrale.?europ|\beuro\b|\beuros\b", re.I), "EUR"),
    (re.compile(r"bank.?of.?england|£|pound.?sterling|sterling", re.I), "GBP"),
    (re.compile(r"nippon.?ginko|bank.?of.?japan|日本銀行", re.I), "JPY"),
    (re.compile(r"united.?arab.?emirates|emirates|dirham|الإمارات", re.I), "AED"),
    (re.compile(r"saudi.?arabia|riyal|مملكة.?العربية", re.I), "SAR"),
    (re.compile(r"qatar|قطر", re.I), "QAR"),
    (re.compile(r"kuwait|الكويت", re.I), "KWD"),
    (re.compile(r"zhongguo|renminbi|people.?bank.?china|中国人民银行|中国人民銀行", re.I), "CNY"),
    (re.compile(r"bank.?of.?korea|한국은행|hanguk", re.I), "KRW"),
    (re.compile(r"bank.?of.?thailand|ธนาคารแห่งประเทศไทย|baht|บาท", re.I), "THB"),
    (re.compile(r"bank.?negara.?malaysia|ringgit", re.I), "MYR"),
    (re.compile(r"monetary.?authority.?singapore|singapore", re.I), "SGD"),
    (re.compile(r"reserve.?bank.?australia|australian", re.I), "AUD"),
    (re.compile(r"bank.?of.?canada|canadian", re.I), "CAD"),
    (re.compile(r"swiss.?national|schweizerische|helvetia|chf", re.I), "CHF"),
    (re.compile(r"bank.?indonesia|rupiah|indonesia", re.I), "IDR"),
    (re.compile(r"state.?bank.?pakistan|pakistan", re.I), "PKR"),
    (re.compile(r"bangladesh|taka|bdt", re.I), "BDT"),
    (re.compile(r"bank.?russia|россия|рубл", re.I), "RUB"),
    (re.compile(r"bangko.?sentral|pilipinas|piso", re.I), "PHP"),
    (re.compile(r"viet|dong|ngân.?hàng.?nhà.?nước", re.I), "VND"),
    (re.compile(r"taiwan|中華民國|new.?taiwan", re.I), "TWD"),
    (re.compile(r"central.?bank.?sri.?lanka|lanka|ceylon", re.I), "LKR"),
    (re.compile(r"nepal.?rastra|nepal|नेपाल", re.I), "NPR"),
    (re.compile(r"mexico|banco.?de.?mexico|mexicano", re.I), "MXN"),
    (re.compile(r"banco.?central.?brasil|real|reais", re.I), "BRL"),
    (re.compile(r"reserve.?bank.?south.?africa|south.?africa|rand", re.I), "ZAR"),
    (re.compile(r"reserve.?bank.?new.?zealand|new.?zealand", re.I), "NZD"),
    (re.compile(r"riksbank|sweden|svenska|kronor", re.I), "SEK"),
    (re.compile(r"norges.?bank|norway|norsk|krone", re.I), "NOK"),
    (re.compile(r"nationalbank|denmark|dansk", re.I), "DKK"),
    (re.compile(r"hong.?kong", re.I), "HKD"),
    (re.compile(r"central.?bank.?turkey|türkiye|türk|lira", re.I), "TRY"),
    # Generic single-char symbols last (ambiguous — colour breaks ties)
    (re.compile(r"\$"), "USD"),
    (re.compile(r"€|\bEUR\b"), "EUR"),
    (re.compile(r"¥|\bJPY\b"), "JPY"),   # could be CNY too — colour breaks tie
    (re.compile(r"£|\bGBP\b"), "GBP"),
    (re.compile(r"₹|\bINR\b"), "INR"),
]

# Written-out denomination words
WORD_DENOM: list[tuple[re.Pattern, str]] = [
    (re.compile(r"two.?thousand|2000",        re.I), "2000"),
    (re.compile(r"one.?thousand|1000",        re.I), "1000"),
    (re.compile(r"five.?hundred|500",         re.I), "500"),
    (re.compile(r"two.?hundred|200",          re.I), "200"),
    (re.compile(r"\bone.?hundred\b|100",      re.I), "100"),
    (re.compile(r"\bfifty\b|50",              re.I), "50"),
    (re.compile(r"\btwenty\b|20",             re.I), "20"),
    (re.compile(r"\bten\b|10",                re.I), "10"),
    (re.compile(r"\bfive\b",                  re.I), "5"),
    # Devanagari
    (re.compile(r"दो.?हज़ार|दो.?हजार",          re.U), "2000"),
    (re.compile(r"पाँच.?सौ|पांच.?सौ",           re.U), "500"),
    (re.compile(r"दो.?सौ",                  re.U), "200"),
    (re.compile(r"एक.?सौ",                  re.U), "100"),
    (re.compile(r"पचास",                    re.U), "50"),
    (re.compile(r"बीस",                     re.U), "20"),
    (re.compile(r"दस",                      re.U), "10"),
    # Japanese
    (re.compile(r"一万|壱万|10000円",          re.U), "10000"),
    (re.compile(r"五千|5000円",               re.U), "5000"),
    (re.compile(r"千円|1000円",               re.U), "1000"),
    # Korean
    (re.compile(r"오만|50000원",              re.U), "50000"),
    (re.compile(r"만원|10000원",              re.U), "10000"),
    (re.compile(r"오천원|5000원",             re.U), "5000"),
    (re.compile(r"천원|1000원",               re.U), "1000"),
    # Chinese
    (re.compile(r"一百|壹佰",                 re.U), "100"),
    (re.compile(r"五十|伍拾",                 re.U), "50"),
    (re.compile(r"二十|贰拾",                 re.U), "20"),
    (re.compile(r"十元|拾元",                 re.U), "10"),
]


# ── Unicode script → currency candidates ─────────────────────────────────────
# Maps Unicode block ranges to likely currencies.
# Used when OCR text alone doesn't identify the currency.

def _script_currencies(text: str) -> list[str]:
    """Detect which currencies are plausible from Unicode script blocks in text."""
    candidates: list[str] = []
    has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in text)
    has_arabic     = any(0x0600 <= ord(c) <= 0x06FF for c in text)
    has_cjk        = any(0x4E00 <= ord(c) <= 0x9FFF for c in text)
    has_hiragana   = any(0x3040 <= ord(c) <= 0x309F for c in text)
    has_katakana   = any(0x30A0 <= ord(c) <= 0x30FF for c in text)
    has_hangul     = any(0xAC00 <= ord(c) <= 0xD7A3 for c in text)
    has_thai       = any(0x0E00 <= ord(c) <= 0x0E7F for c in text)
    has_cyrillic   = any(0x0400 <= ord(c) <= 0x04FF for c in text)
    has_bengali    = any(0x0980 <= ord(c) <= 0x09FF for c in text)
    has_sinhala    = any(0x0D80 <= ord(c) <= 0x0DFF for c in text)

    if has_devanagari:
        candidates += ["INR", "NPR"]
    if has_arabic:
        candidates += ["AED", "SAR", "QAR", "KWD"]
    if has_hiragana or has_katakana:
        candidates += ["JPY"]       # hiragana/katakana = Japanese, not Chinese
    elif has_cjk:
        candidates += ["CNY", "JPY"]
    if has_hangul:
        candidates += ["KRW"]
    if has_thai:
        candidates += ["THB"]
    if has_cyrillic:
        candidates += ["RUB"]
    if has_bengali:
        candidates += ["BDT"]
    if has_sinhala:
        candidates += ["LKR"]
    return candidates


# ── Image preprocessing for OCR ──────────────────────────────────────────────

def _preprocess(img_bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (color_enhanced, gray_sharp) — two variants only.

    Keeping exactly two variants (not three) cuts EasyOCR calls in half
    while covering the two most useful representations for banknote OCR.
    """
    h, w = img_bgr.shape[:2]
    # OCR runs faster on smaller images; cap at 640px (sufficient for printed text).
    # Upscale genuinely tiny images (<320px) so text is legible.
    ocr_max = 640
    ocr_min = 320
    long_side = max(h, w)
    if long_side > ocr_max:
        scale = ocr_max / long_side
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)),
                             interpolation=cv2.INTER_AREA)
    elif long_side < ocr_min:
        scale = ocr_min / long_side
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)),
                             interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    clahe_gray = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp  = cv2.filter2D(clahe_gray, -1, kernel)
    return img_bgr, sharp


# ── Denomination finder ───────────────────────────────────────────────────────

def _find_denomination(numbers: list[str],
                       currency: str | None,
                       full_text: str) -> str | None:
    """Pick the best denomination from extracted numbers and written-out words.

    Strategy (priority order):
    1. Frequency + size combined — a denomination that appears 3× beats one that
       appears once, even if the latter is numerically larger.  This prevents serial
       numbers (e.g. "…295110" → "10") from overriding the printed denomination
       ("200" appears ≥3 times on a genuine ₹200 note).
    2. Written-out word forms (TWO HUNDRED RUPEES, दो सौ, etc.)
    """
    valid = CURRENCY_DENOMS.get(currency, ALL_DENOMS) if currency else ALL_DENOMS

    # Count occurrences of each valid denomination in the raw number list
    freq: dict[str, int] = {}
    for n in numbers:
        if n in valid:
            freq[n] = freq.get(n, 0) + 1

    if freq:
        # Primary sort: frequency desc; secondary sort: denomination value desc
        # (higher denomination wins ties — ₹500 note with "500" once beats "5" once)
        best = max(freq, key=lambda x: (freq[x], int(x)))
        return best

    # Fall back to written-out denomination words
    for pattern, den in WORD_DENOM:
        if pattern.search(full_text) and den in valid:
            return den

    return None


# ── Core parse ────────────────────────────────────────────────────────────────

def _parse_texts(texts: list[str],
                 hint: str | None = None) -> tuple[str | None, str | None, float]:
    """
    Parse OCR text lines → (currency, denomination, confidence).
    hint: operator-supplied currency lock (already validated upstream).
    """
    full = " ".join(texts)

    # ── 1. Currency detection ─────────────────────────────────────────────────
    detected_cur: str | None = hint  # honour hint if already set

    if detected_cur is None:
        # Try keyword/symbol matching first
        for pattern, code in CURRENCY_KEYWORDS:
            if pattern.search(full):
                detected_cur = code
                break

    if detected_cur is None:
        # Fall back to Unicode script analysis
        script_cands = _script_currencies(full)
        if len(script_cands) == 1:
            detected_cur = script_cands[0]
        elif len(script_cands) > 1:
            # Multiple scripts unlikely — take first (most specific)
            detected_cur = script_cands[0]

    # ── 2. Denomination detection ─────────────────────────────────────────────
    # Extract all digit runs (1–6 digits)
    numbers = re.findall(r"\b\d{1,6}\b", full)
    detected_den = _find_denomination(numbers, detected_cur, full)

    # ── 3. Cross-validate currency ↔ denomination ────────────────────────────
    # If denomination doesn't belong to detected currency, try other currencies
    if detected_cur and detected_den:
        if detected_den not in CURRENCY_DENOMS.get(detected_cur, ALL_DENOMS):
            # Check if it fits a script-suggested currency
            script_cands = _script_currencies(full)
            for c in script_cands:
                if detected_den in CURRENCY_DENOMS.get(c, set()):
                    detected_cur = c
                    break

    # ── 4. Infer currency from unique denomination ────────────────────────────
    if detected_cur is None and detected_den is not None:
        owners = [c for c, ds in CURRENCY_DENOMS.items() if detected_den in ds]
        if len(owners) == 1:
            detected_cur = owners[0]

    # ── 5. Confidence ────────────────────────────────────────────────────────
    # Confidence reflects how certain we are the denomination is correct,
    # NOT just that we found some number alongside a currency keyword.
    # A high score requires a specific keyword (not just a generic symbol like $)
    # AND a denomination that appears more than once in the texts.
    confidence = 0.0
    if detected_cur and detected_den:
        # Count how many times the chosen denomination appeared in the full text
        den_freq = len(re.findall(rf"\b{re.escape(detected_den)}\b", full))
        if den_freq >= 3:
            confidence = 0.95  # appears 3+ times — very likely the denomination
        elif den_freq == 2:
            confidence = 0.85
        else:
            confidence = 0.70  # appeared once — might be serial number fragment
    elif detected_den and not detected_cur:
        confidence = 0.50  # denomination found but currency unclear
    elif detected_cur and not detected_den:
        confidence = 0.30  # currency found but no denomination

    return detected_cur, detected_den, confidence


# ── Prewarm helper (call once at startup to load models into RAM) ─────────────

def prewarm(hint: str | None = None) -> None:
    """Load EasyOCR reader(s) into memory so the first scan is not slow."""
    for langs in [_langs_for_hint(hint), ["en"]]:
        _get_reader(langs)


# ── Size-aware text extraction ────────────────────────────────────────────────

def _readtext_sized(reader, img: np.ndarray) -> tuple[list[str], list[str]]:
    """
    Run EasyOCR with detail=1 (returns bounding boxes) and split results into
    LARGE text (likely denomination) and SMALL text (serial numbers, fine print).

    Large = bounding-box height > 4 % of image height  → printed denomination
    Small = everything else                              → serial numbers etc.

    Returns (large_texts, all_texts).
    """
    h, w = img.shape[:2]
    min_h_px = h * 0.04         # 4 % of image height threshold
    large: list[str] = []
    all_t: list[str] = []

    try:
        raw = reader.readtext(img, detail=1, paragraph=False)
    except Exception:
        return [], []

    for (bbox, text, _conf) in raw:
        text = str(text).strip()
        if not text:
            continue
        all_t.append(text)
        # bbox: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        ys = [pt[1] for pt in bbox]
        box_h = max(ys) - min(ys)
        if box_h >= min_h_px:
            large.append(text)

    return large, all_t


# ── Corner-crop digit OCR ────────────────────────────────────────────────────

def _corner_crop_digits(img_bgr: np.ndarray, reader) -> list[str]:
    """Crop 4 corners + center of the note and run digit-only OCR on each.

    Banknotes (especially USD/EUR/GBP) print the denomination at all four corners
    in large bold digits. OCR'ing each corner separately at a higher relative
    resolution catches digits the whole-image pass blurs out, and frequency-counting
    across crops makes the genuine denomination dominate any spurious reads.
    """
    if reader is None:
        return []

    h, w = img_bgr.shape[:2]
    # Corner box dimensions: 35% of width, 40% of height — denomination digits
    # on USD/EUR/GBP are always within this region.
    cw = int(w * 0.35)
    ch = int(h * 0.40)
    # Center crop covers the large central denomination on EUR/GBP (which print
    # the number prominently in the middle of the note).
    center_w = int(w * 0.45)
    center_h = int(h * 0.45)
    cx, cy = w // 2, h // 2

    crops: list[np.ndarray] = [
        img_bgr[0:ch,        0:cw],            # top-left
        img_bgr[0:ch,        w - cw:w],        # top-right
        img_bgr[h - ch:h,    0:cw],            # bottom-left
        img_bgr[h - ch:h,    w - cw:w],        # bottom-right
        img_bgr[cy - center_h // 2:cy + center_h // 2,
                cx - center_w // 2:cx + center_w // 2],  # center
    ]

    digit_texts: list[str] = []
    for crop in crops:
        if crop.size == 0:
            continue
        # Upscale tiny crops so digits are at least ~80px tall — EasyOCR
        # struggles on small text.
        ch2, cw2 = crop.shape[:2]
        target = 480
        if max(ch2, cw2) < target:
            scale = target / max(ch2, cw2)
            crop = cv2.resize(crop, (int(cw2 * scale), int(ch2 * scale)),
                              interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        try:
            results = reader.readtext(
                gray, detail=0, paragraph=False,
                allowlist="0123456789",
            )
            for r in results:
                t = str(r).strip()
                if t and t.isdigit():
                    digit_texts.append(t)
        except Exception:
            continue
    return digit_texts


# ── Public API ────────────────────────────────────────────────────────────────

def detect(img_bgr: np.ndarray,
           currency_hint: str | None = None) -> dict | None:
    """
    Multi-signal banknote identification.

    Strategy:
      1. Run EasyOCR with bounding-box detail on colour image.
         Split results into LARGE text (denomination numbers — >4% of image height)
         and ALL text (includes fine print / serial numbers).
         Parse LARGE text first → if high confidence, return immediately.
         Parse ALL text → if medium confidence, return.
      2. If hint language differs from English, repeat step 1 on sharpened-gray image
         with the English-only reader.
      3. Digit-allowlist pass on gray image (catches faint numbers).

    Returns { currency, denomination, ocr_confidence, ocr_source, ocr_texts }
    or None so pipeline.py falls back to the Lab colour classifier.
    """
    color_img, gray_sharp = _preprocess(img_bgr)

    langs1  = _langs_for_hint(currency_hint)
    reader1 = _get_reader(langs1)

    large1: list[str] = []
    all1:   list[str] = []
    if reader1 is not None:
        large1, all1 = _readtext_sized(reader1, color_img)

    # ── Fast path: hint given — skip multi-pass, go straight to digit scan ────
    # When currency is already known, we only need the denomination number.
    # Skipping the full OCR pipeline saves 10-15s per scan.
    if currency_hint:
        all_texts = large1 + all1
        cur_fast, den_fast, conf_fast = _parse_texts(all_texts, currency_hint)
        if den_fast and conf_fast >= 0.85:
            return {
                "currency":       currency_hint,
                "denomination":   den_fast,
                "ocr_confidence": round(conf_fast, 3),
                "ocr_source":     "easyocr(fast-hint)",
                "ocr_texts":      all_texts[:20],
            }

        # Corner-crop digit OCR — USD/EUR/GBP always print the denomination
        # at all four corners. Running digit-only OCR on each corner separately
        # gives multiple votes and beats the whole-image pass on small/blurry text.
        reader_en = _readers.get("en") or _get_reader(["en"])
        corner_digits = _corner_crop_digits(img_bgr, reader_en)
        merged = all_texts + corner_digits
        cur_cc, den_cc, conf_cc = _parse_texts(merged, currency_hint)
        if den_cc:
            return {
                "currency":       currency_hint,
                "denomination":   den_cc,
                "ocr_confidence": round(max(conf_cc, 0.75), 3),
                "ocr_source":     "easyocr(corner-crop)",
                "ocr_texts":      merged[:20],
            }
        # Digit allowlist pass — last resort for faint text
        if reader_en:
            try:
                texts_dl = [str(r) for r in reader_en.readtext(
                    gray_sharp, detail=0, paragraph=False,
                    allowlist="0123456789"
                )]
                _, den_dl, _ = _parse_texts(texts_dl, currency_hint)
                if den_dl:
                    return {
                        "currency":       currency_hint,
                        "denomination":   den_dl,
                        "ocr_confidence": 0.60,
                        "ocr_source":     "easyocr(digit-allowlist)",
                        "ocr_texts":      texts_dl[:20],
                    }
            except Exception:
                pass
        return None  # currency known but denomination unreadable

    # ── A: parse LARGE text only — cleanest signal, no serial-number noise ────
    cur_a, den_a, conf_a = _parse_texts(large1, currency_hint)
    if conf_a >= 0.80 and den_a:
        return {
            "currency":       cur_a or currency_hint,
            "denomination":   den_a,
            "ocr_confidence": round(conf_a, 3),
            "ocr_source":     f"easyocr({'+'.join(langs1)})-large",
            "ocr_texts":      (large1 + all1)[:20],
        }

    # ── B: parse ALL text from colour image ──────────────────────────────────
    cur_b, den_b, conf_b = _parse_texts(all1, currency_hint)
    # Lowered from 0.80 → 0.65: "100" appearing once with USD keyword = 0.70 conf
    if conf_b >= 0.65 and den_b:
        return {
            "currency":       cur_b or currency_hint,
            "denomination":   den_b,
            "ocr_confidence": round(conf_b, 3),
            "ocr_source":     f"easyocr({'+'.join(langs1)})",
            "ocr_texts":      all1[:20],
        }

    # ── B2: corner-crop digit OCR ────────────────────────────────────────────
    # Whole-image OCR can miss bold corner digits when other text dominates the
    # detection or denomination text is small relative to the full image.
    # Reading each corner separately at higher relative resolution is more reliable.
    reader_en_cc = _readers.get("en") or _get_reader(["en"])
    corner_digits = _corner_crop_digits(img_bgr, reader_en_cc)
    if corner_digits:
        # Use the currency we already detected (if any) to disambiguate digits.
        cur_for_cc = cur_b or cur_a or currency_hint
        cur_cc, den_cc, conf_cc = _parse_texts(all1 + corner_digits, cur_for_cc)
        if den_cc and conf_cc >= 0.50:
            return {
                "currency":       cur_cc or cur_for_cc,
                "denomination":   den_cc,
                "ocr_confidence": round(max(conf_cc, 0.70), 3),
                "ocr_source":     "easyocr(corner-crop)",
                "ocr_texts":      (all1 + corner_digits)[:20],
            }

    # ── C: English-only pass on sharpened gray (different reader → new info) ──
    large2: list[str] = []
    all2:   list[str] = []
    langs2 = ["en"]
    if langs2 != langs1:
        reader2 = _get_reader(langs2)
        if reader2 is not None:
            large2, all2 = _readtext_sized(reader2, gray_sharp)

    # Combine large signals from both passes for denomination (most reliable)
    combined_large = large1 + large2
    cur_c, den_c, conf_c = _parse_texts(combined_large or (all1 + all2), currency_hint)

    if conf_c >= 0.50 and den_c:
        return {
            # Do NOT default to "INR" — if currency unknown, let pipeline decide
            "currency":       cur_c or currency_hint,
            "denomination":   den_c,
            "ocr_confidence": round(conf_c, 3),
            "ocr_source":     "easyocr(multi-pass)",
            "ocr_texts":      (all1 + all2)[:20],
        }

    # ── D: digit/symbol allowlist — last resort for faint denomination text ──
    reader_en = _readers.get("en") or _get_reader(["en"])
    texts3: list[str] = []
    if reader_en is not None:
        try:
            results = reader_en.readtext(
                gray_sharp, detail=0, paragraph=False,
                allowlist="0123456789₹$€£¥₩₫฿"
            )
            texts3 = [str(r) for r in results]
        except Exception:
            pass

    all_combined = list(dict.fromkeys(all1 + all2 + texts3))
    cur_d, den_d, conf_d = _parse_texts(all_combined, currency_hint)

    # Only return digit-scan result if we have a currency from OCR or hint —
    # never silently default to INR (was causing USD/EUR notes to be reported
    # as INR when only digits were readable).
    final_cur = cur_d or currency_hint
    if den_d and final_cur:
        return {
            "currency":       final_cur,
            "denomination":   den_d,
            "ocr_confidence": round(max(conf_d, 0.60), 3),
            "ocr_source":     "easyocr(digit-scan)",
            "ocr_texts":      all_combined[:20],
        }

    return None   # OCR could not identify — pipeline falls back to Lab classifier
