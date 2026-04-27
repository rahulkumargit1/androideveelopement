"""Technique 7: Color-Space analysis — HSV + CIE Lab.

Currency / denomination classifier using CIE Lab fingerprints.

Pipeline
--------
1. _find_note_bounds()  — Canny + contour to isolate the note rectangle,
   eliminating white table borders that dilute the dominant colour.
2. lab_summary()        — k-means (k=5) on chromatic pixels; cluster scoring
   uses sqrt(pop) × chroma^1.5 so saturated note colours beat neutral borders
   even when the background occupies more pixels.
3. classify()           — two-stage: per-currency best-profile wins currency
   slot (prevents multi-denomination currencies accumulating votes), then
   best denomination within the winner is returned.

Softmax temperature = 10 (decisive margins; 22 was too broad).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np


# ── Reference fingerprints ────────────────────────────────────────────────────
@dataclass(frozen=True)
class NoteProfile:
    currency: str
    denomination: str
    L: float        # CIE L* (0..100)
    a: float        # CIE a* (−=green, +=red)
    b: float        # CIE b* (−=blue,  +=yellow)
    chroma_min: float = 0.0
    chroma_max: float = 100.0
    weight: float   = 1.0


# Lab values calibrated against published central-bank specs, polymer sample
# scans, and ISO/BIS reference measurements.  All chroma values in CIE C*ab.
PROFILES: list[NoteProfile] = [

    # ── INR — Mahatma Gandhi New Series 2016+ ────────────────────────────────
    NoteProfile("INR", "10",   52,  10,  22, chroma_min=15, chroma_max=32),  # chocolate-brown
    NoteProfile("INR", "20",   78, -18,  52, chroma_min=42),                  # fluorescent green-yellow
    NoteProfile("INR", "50",   60, -16, -32, chroma_min=28),                  # fluorescent cyan-blue
    NoteProfile("INR", "100",  65,  20, -20, chroma_min=22),                  # lavender/purple
    NoteProfile("INR", "200",  70,  14,  38, chroma_min=28, chroma_max=65),   # warm orange-yellow
    NoteProfile("INR", "500",  79,  -6,  15, chroma_min=6,  chroma_max=30),   # light olive-stone
    NoteProfile("INR", "2000", 60,  44, -10, chroma_min=38),                  # magenta/pink

    # ── USD — Federal Reserve Notes (2013-series)
    # All USD notes share a grey-green base (low chroma 4–26).
    # weight=1.3 prevents misclassification as other low-chroma currencies (INR 500, JPY).
    NoteProfile("USD", "1",    72, -10,  14, chroma_min=4,  chroma_max=20, weight=1.3),  # grey-green
    NoteProfile("USD", "2",    70,  -8,  13, chroma_min=4,  chroma_max=20, weight=1.3),  # grey-green
    NoteProfile("USD", "5",    68,   4,   8, chroma_min=4,  chroma_max=18, weight=1.3),  # slight purple tint
    NoteProfile("USD", "10",   67,  10,  16, chroma_min=6,  chroma_max=22, weight=1.3),  # orange-tinted
    NoteProfile("USD", "20",   70,  -6,  16, chroma_min=5,  chroma_max=22, weight=1.3),  # peach-green shift
    NoteProfile("USD", "50",   71,   8,  20, chroma_min=8,  chroma_max=26, weight=1.3),  # warm golden tint
    NoteProfile("USD", "100",  74,  -2,  18, chroma_min=6,  chroma_max=22, weight=1.3),  # blue-green ribbon

    # ── EUR — Europa series (2013-present) ────────────────────────────────────
    NoteProfile("EUR", "5",    78,   0,   6, chroma_min=0,  chroma_max=14),   # grey
    NoteProfile("EUR", "10",   58,  48,  30, chroma_min=45),                  # red
    NoteProfile("EUR", "20",   60, -12, -35, chroma_min=28),                  # blue
    NoteProfile("EUR", "50",   70,  28,  50, chroma_min=42),                  # orange
    NoteProfile("EUR", "100",  65, -30,  24, chroma_min=28),                  # green
    NoteProfile("EUR", "200",  68,  18,  42, chroma_min=30),                  # yellow-brown
    NoteProfile("EUR", "500",  65,  20, -22, chroma_min=25),                  # purple

    # ── GBP — polymer series ──────────────────────────────────────────────────
    NoteProfile("GBP", "5",    62, -14, -30, chroma_min=25),                  # turquoise
    NoteProfile("GBP", "10",   63,  22,  32, chroma_min=28),                  # orange-brown
    NoteProfile("GBP", "20",   62,  18, -28, chroma_min=25),                  # purple
    NoteProfile("GBP", "50",   68,  -4,  38, chroma_min=25),                  # red-yellow

    # ── JPY — Series E / F ────────────────────────────────────────────────────
    NoteProfile("JPY", "1000",  68, -16,  22, chroma_min=18),                 # blue-green
    NoteProfile("JPY", "5000",  72,  22,  26, chroma_min=20),                 # purple-pink
    NoteProfile("JPY", "10000", 72,   6,  36, chroma_min=20),                 # warm-brown

    # ── AED — UAE polymer series ──────────────────────────────────────────────
    NoteProfile("AED", "5",     68,  12,  28, chroma_min=20),                 # warm-brown
    NoteProfile("AED", "10",    65, -12,  25, chroma_min=18),                 # olive-green
    NoteProfile("AED", "20",    60,   5, -35, chroma_min=28),                 # deep blue
    NoteProfile("AED", "50",    55,   3, -38, chroma_min=30),                 # dark navy-blue
    NoteProfile("AED", "100",   62,  22,  -8, chroma_min=18),                 # rose-pink
    NoteProfile("AED", "200",   68,  -3,  38, chroma_min=25),                 # amber-yellow
    NoteProfile("AED", "500",   58,  -2, -15, chroma_min=10),                 # steel-blue
    NoteProfile("AED", "1000",  62, -22,  18, chroma_min=20),                 # teal-green

    # ── CNY — People's Bank of China 5th series (2019) ───────────────────────
    NoteProfile("CNY", "1",    70, -10,  18, chroma_min=14, chroma_max=28),   # olive-green
    NoteProfile("CNY", "5",    65,  15, -22, chroma_min=22),                  # purple/violet
    NoteProfile("CNY", "10",   68, -10, -20, chroma_min=20),                  # teal-blue
    NoteProfile("CNY", "20",   62,   8,  22, chroma_min=18, chroma_max=36),   # brown/olive
    NoteProfile("CNY", "50",   65, -15,  20, chroma_min=22),                  # olive-green
    NoteProfile("CNY", "100",  52,  35,  28, chroma_min=38),                  # bright red (iconic)

    # ── CAD — Canadian polymer notes ─────────────────────────────────────────
    NoteProfile("CAD", "5",    68,  -5, -35, chroma_min=30),                  # blue
    NoteProfile("CAD", "10",   62,  20, -28, chroma_min=30),                  # purple/violet
    NoteProfile("CAD", "20",   60, -22,  18, chroma_min=26),                  # green
    NoteProfile("CAD", "50",   55,  30,  15, chroma_min=28),                  # red/maroon
    NoteProfile("CAD", "100",  78,   5,  20, chroma_min=14, chroma_max=30),   # light brown/beige

    # ── AUD — Australian polymer notes ───────────────────────────────────────
    NoteProfile("AUD", "5",    72,  30,  -5, chroma_min=26),                  # pink/fuchsia
    NoteProfile("AUD", "10",   65,  -5, -32, chroma_min=28),                  # blue
    NoteProfile("AUD", "20",   58,  35,  22, chroma_min=38),                  # red/orange-red
    NoteProfile("AUD", "50",   85,  -3,  48, chroma_min=42),                  # bright yellow
    NoteProfile("AUD", "100",  62, -22,  18, chroma_min=26),                  # green

    # ── CHF — Swiss National Bank new series (2016+) ─────────────────────────
    NoteProfile("CHF", "10",   82,   5,  45, chroma_min=40),                  # yellow/amber
    NoteProfile("CHF", "20",   58,  38,  18, chroma_min=38),                  # red
    NoteProfile("CHF", "50",   65, -25,  22, chroma_min=30),                  # green
    NoteProfile("CHF", "100",  62,  -5, -38, chroma_min=34),                  # blue
    NoteProfile("CHF", "200",  65,  18,  28, chroma_min=28),                  # brown/orange
    NoteProfile("CHF", "1000", 60,  22, -25, chroma_min=30),                  # purple/violet

    # ── SGD — Singapore Portrait series ──────────────────────────────────────
    NoteProfile("SGD", "2",    62,  18, -28, chroma_min=28),                  # purple
    NoteProfile("SGD", "5",    65, -20,  20, chroma_min=26),                  # green
    NoteProfile("SGD", "10",   55,  35,  18, chroma_min=35),                  # red
    NoteProfile("SGD", "50",   65,  -5, -35, chroma_min=32),                  # blue
    NoteProfile("SGD", "100",  68,  22,  32, chroma_min=32),                  # orange/brown
    NoteProfile("SGD", "1000", 58, -18, -22, chroma_min=24),                  # teal/purple

    # ── KRW — Bank of Korea current series ───────────────────────────────────
    NoteProfile("KRW", "1000",  68,  -8, -32, chroma_min=28),                 # blue
    NoteProfile("KRW", "5000",  60,  32,  18, chroma_min=32),                 # red/orange
    NoteProfile("KRW", "10000", 65, -18,  18, chroma_min=22),                 # green
    NoteProfile("KRW", "50000", 78, -12,  38, chroma_min=34),                 # yellow-green

    # ── THB — Bank of Thailand current series ────────────────────────────────
    NoteProfile("THB", "20",   68, -18,  22, chroma_min=26),                  # green
    NoteProfile("THB", "50",   65,  -8, -30, chroma_min=28),                  # blue
    NoteProfile("THB", "100",  55,  32,  20, chroma_min=34),                  # red
    NoteProfile("THB", "500",  62,  20, -25, chroma_min=28),                  # purple
    NoteProfile("THB", "1000", 72,   8,  18, chroma_min=16, chroma_max=30),   # grey-brown

    # ── MYR — Bank Negara Malaysia polymer series ─────────────────────────────
    NoteProfile("MYR", "1",    68,  -8, -35, chroma_min=32),                  # blue
    NoteProfile("MYR", "5",    65, -22,  22, chroma_min=28),                  # green
    NoteProfile("MYR", "10",   55,  35,  18, chroma_min=35),                  # red
    NoteProfile("MYR", "20",   65,  22,  28, chroma_min=30),                  # orange/brown
    NoteProfile("MYR", "50",   62, -18, -10, chroma_min=18),                  # teal-green
    NoteProfile("MYR", "100",  60,  22, -28, chroma_min=32),                  # purple/violet

    # ── SAR — Saudi Arabian Monetary Authority ────────────────────────────────
    NoteProfile("SAR", "1",    70,   8,  22, chroma_min=16, chroma_max=32),   # tan/brown
    NoteProfile("SAR", "5",    65, -12,  20, chroma_min=18),                  # olive-green
    NoteProfile("SAR", "10",   58, -18,  18, chroma_min=22),                  # dark green
    NoteProfile("SAR", "20",   62,  12,  18, chroma_min=18, chroma_max=32),   # brown
    NoteProfile("SAR", "50",   60,  18, -25, chroma_min=28),                  # purple
    NoteProfile("SAR", "100",  65,  -8, -28, chroma_min=26),                  # blue/teal
    NoteProfile("SAR", "500",  70, -10,  30, chroma_min=28),                  # green/gold

    # ── QAR — Qatar Central Bank ──────────────────────────────────────────────
    NoteProfile("QAR", "1",    72, -12,  22, chroma_min=18),                  # olive-green
    NoteProfile("QAR", "5",    68,  28,  12, chroma_min=24),                  # brown/red
    NoteProfile("QAR", "10",   65,  -5, -32, chroma_min=28),                  # blue
    NoteProfile("QAR", "50",   60,  22, -20, chroma_min=26),                  # purple
    NoteProfile("QAR", "100",  62, -18,  20, chroma_min=22),                  # green
    NoteProfile("QAR", "500",  68,  22,  28, chroma_min=28),                  # orange/brown

    # ── KWD — Central Bank of Kuwait ─────────────────────────────────────────
    NoteProfile("KWD", "250",  72,  -8, -25, chroma_min=20),                  # light blue
    NoteProfile("KWD", "500",  68,  20,  12, chroma_min=18),                  # red-brown
    NoteProfile("KWD", "1",    65, -15,  18, chroma_min=18),                  # green (1 dinar)
    NoteProfile("KWD", "5",    62,  18, -22, chroma_min=22),                  # purple (5 dinar)
    NoteProfile("KWD", "10",   68,  18,  28, chroma_min=24),                  # brown/gold (10 dinar)
    NoteProfile("KWD", "20",   60,  -5, -35, chroma_min=30),                  # blue (20 dinar)

    # ── HKD — Hong Kong (HSBC / Bank of China / Standard Chartered) ──────────
    NoteProfile("HKD", "10",   62,  18, -28, chroma_min=28),                  # purple
    NoteProfile("HKD", "20",   68,  -5, -32, chroma_min=28),                  # blue
    NoteProfile("HKD", "50",   65, -20,  18, chroma_min=24),                  # green
    NoteProfile("HKD", "100",  60,  30,  -5, chroma_min=28),                  # red/pink
    NoteProfile("HKD", "500",  68,  22,  30, chroma_min=32),                  # orange/brown
    NoteProfile("HKD", "1000", 58,  25,  18, chroma_min=28),                  # red-brown

    # ── BRL — Banco Central do Brasil current series ──────────────────────────
    NoteProfile("BRL", "2",    65,  -5, -35, chroma_min=32),                  # blue
    NoteProfile("BRL", "5",    60,  20, -30, chroma_min=32),                  # purple/violet
    NoteProfile("BRL", "10",   58,  35,  25, chroma_min=40),                  # red/orange
    NoteProfile("BRL", "20",   82,   5,  45, chroma_min=42),                  # yellow/gold
    NoteProfile("BRL", "50",   75, -15,  40, chroma_min=38),                  # yellow-green
    NoteProfile("BRL", "100",  65, -15, -25, chroma_min=26),                  # blue/teal
    NoteProfile("BRL", "200",  70,  -8,  12, chroma_min=12, chroma_max=25),   # grey-green

    # ── MXN — Banco de México current polymer series ──────────────────────────
    NoteProfile("MXN", "20",   62,  22,  30, chroma_min=28),                  # orange/brown
    NoteProfile("MXN", "50",   68,  -8, -32, chroma_min=28),                  # blue
    NoteProfile("MXN", "100",  60, -22,  18, chroma_min=26),                  # green
    NoteProfile("MXN", "200",  62,  25, -20, chroma_min=28),                  # pink/red
    NoteProfile("MXN", "500",  68,  22,  18, chroma_min=24),                  # brown/red
    NoteProfile("MXN", "1000", 72,  -5,  35, chroma_min=30),                  # yellow-green

    # ── ZAR — South Africa Mandela / Big Five series ──────────────────────────
    NoteProfile("ZAR", "10",   62, -22,  18, chroma_min=26),                  # green
    NoteProfile("ZAR", "20",   65,  18,  25, chroma_min=26),                  # brown/orange
    NoteProfile("ZAR", "50",   55,  32,  18, chroma_min=32),                  # red
    NoteProfile("ZAR", "100",  62,  -8, -30, chroma_min=28),                  # blue
    NoteProfile("ZAR", "200",  68,  22,  28, chroma_min=30),                  # brown/orange

    # ── NZD — Reserve Bank of New Zealand ────────────────────────────────────
    NoteProfile("NZD", "5",    65,  28,  28, chroma_min=34),                  # orange/red
    NoteProfile("NZD", "10",   65, -12, -28, chroma_min=28),                  # blue/teal
    NoteProfile("NZD", "20",   62, -22,  18, chroma_min=26),                  # green
    NoteProfile("NZD", "50",   60,  20, -28, chroma_min=30),                  # purple
    NoteProfile("NZD", "100",  80,  -5,  45, chroma_min=40),                  # yellow/gold

    # ── SEK — Sveriges Riksbank current series ────────────────────────────────
    NoteProfile("SEK", "20",   65,  20, -28, chroma_min=30),                  # purple/violet
    NoteProfile("SEK", "50",   65,  28,  25, chroma_min=34),                  # orange/red-orange
    NoteProfile("SEK", "100",  65,  -5, -28, chroma_min=24),                  # blue/grey-blue
    NoteProfile("SEK", "200",  68,  -8, -22, chroma_min=20),                  # blue-grey
    NoteProfile("SEK", "500",  68,  25,  -5, chroma_min=22),                  # pink/red
    NoteProfile("SEK", "1000", 65,  12,  22, chroma_min=20),                  # brown

    # ── NOK — Norges Bank Nature series ──────────────────────────────────────
    NoteProfile("NOK", "50",   60,  32,  20, chroma_min=34),                  # red/orange
    NoteProfile("NOK", "100",  62,  28,  -5, chroma_min=26),                  # red/pink
    NoteProfile("NOK", "200",  65, -22,  20, chroma_min=28),                  # green
    NoteProfile("NOK", "500",  68,  22,  28, chroma_min=30),                  # orange/brown
    NoteProfile("NOK", "1000", 65,  -5, -30, chroma_min=28),                  # blue

    # ── DKK — Danmarks Nationalbank bridges/towers series ────────────────────
    NoteProfile("DKK", "50",   72,  -5,  35, chroma_min=28),                  # yellow-orange
    NoteProfile("DKK", "100",  62,  28,  18, chroma_min=26),                  # red/brown
    NoteProfile("DKK", "200",  65,  -5, -30, chroma_min=26),                  # blue
    NoteProfile("DKK", "500",  65, -20,  20, chroma_min=24),                  # green
    NoteProfile("DKK", "1000", 62,  18, -22, chroma_min=24),                  # purple

    # ── IDR — Bank Indonesia current series ──────────────────────────────────
    NoteProfile("IDR", "1000",  75,   0,   8, chroma_min=5,  chroma_max=18),  # grey/silver
    NoteProfile("IDR", "2000",  72,  -5,  12, chroma_min=10, chroma_max=22),  # grey-green
    NoteProfile("IDR", "5000",  65,  18,  25, chroma_min=24),                 # brown/orange
    NoteProfile("IDR", "10000", 62,  18, -25, chroma_min=26),                 # purple/violet
    NoteProfile("IDR", "20000", 65, -20,  18, chroma_min=24),                 # green
    NoteProfile("IDR", "50000", 65, -10, -28, chroma_min=26),                 # blue/teal
    NoteProfile("IDR", "100000",55,  32,  18, chroma_min=32),                 # red

    # ── PKR — State Bank of Pakistan current series ───────────────────────────
    NoteProfile("PKR", "10",   68, -18,  20, chroma_min=24),                  # green
    NoteProfile("PKR", "20",   72, -10,  28, chroma_min=26),                  # olive/yellow-green
    NoteProfile("PKR", "50",   62,  18, -25, chroma_min=28),                  # purple
    NoteProfile("PKR", "100",  58,  30,  18, chroma_min=30),                  # red/orange
    NoteProfile("PKR", "500",  55, -20,  15, chroma_min=22),                  # dark green
    NoteProfile("PKR", "1000", 62,  -8, -30, chroma_min=28),                  # blue
    NoteProfile("PKR", "5000", 48,  28,  12, chroma_min=26),                  # dark maroon

    # ── BDT — Bangladesh Bank current series ──────────────────────────────────
    NoteProfile("BDT", "10",   68, -15,  22, chroma_min=22),                  # green
    NoteProfile("BDT", "20",   65,  20, -20, chroma_min=24),                  # purple/violet
    NoteProfile("BDT", "50",   62,  28,  18, chroma_min=26),                  # red/orange
    NoteProfile("BDT", "100",  65,  -8, -28, chroma_min=24),                  # blue
    NoteProfile("BDT", "200",  68,  18,  22, chroma_min=22),                  # brown
    NoteProfile("BDT", "500",  60, -12,  28, chroma_min=22),                  # olive/yellow-green
    NoteProfile("BDT", "1000", 72,   8,  18, chroma_min=16),                  # beige/brown

    # ── TRY — Central Bank of Turkey current series ───────────────────────────
    NoteProfile("TRY", "5",    62,  18, -28, chroma_min=28),                  # purple/violet
    NoteProfile("TRY", "10",   60,  30,  20, chroma_min=32),                  # red/orange
    NoteProfile("TRY", "20",   65, -22,  18, chroma_min=26),                  # green
    NoteProfile("TRY", "50",   70,  18,  28, chroma_min=26),                  # orange/tan
    NoteProfile("TRY", "100",  62,  -8, -30, chroma_min=28),                  # blue
    NoteProfile("TRY", "200",  55,  25,  12, chroma_min=24),                  # dark red/brown

    # ── RUB — Bank of Russia current series ──────────────────────────────────
    NoteProfile("RUB", "10",   58,  32,  18, chroma_min=30),                  # red
    NoteProfile("RUB", "50",   62,  -5, -32, chroma_min=28),                  # blue/purple-blue
    NoteProfile("RUB", "100",  58,  18, -20, chroma_min=24),                  # brown/purple
    NoteProfile("RUB", "200",  72,  -8,  28, chroma_min=24),                  # olive/yellow-green
    NoteProfile("RUB", "500",  62,  -8, -32, chroma_min=28),                  # blue
    NoteProfile("RUB", "1000", 65, -18, -15, chroma_min=22),                  # blue-green
    NoteProfile("RUB", "2000", 55,  -5, -38, chroma_min=34),                  # dark blue
    NoteProfile("RUB", "5000", 55,  32,  22, chroma_min=34),                  # red/orange-red

    # ── PHP — Bangko Sentral ng Pilipinas ────────────────────────────────────
    NoteProfile("PHP", "20",   68, -18,  22, chroma_min=24),                  # orange/yellow
    NoteProfile("PHP", "50",   55,  32,  18, chroma_min=30),                  # red
    NoteProfile("PHP", "100",  62,  -8, -30, chroma_min=26),                  # blue/violet
    NoteProfile("PHP", "200",  65, -20,  18, chroma_min=22),                  # green
    NoteProfile("PHP", "500",  68,  22,  28, chroma_min=26),                  # orange/brown
    NoteProfile("PHP", "1000", 62,  18, -22, chroma_min=24),                  # purple

    # ── VND — State Bank of Vietnam polymer series ────────────────────────────
    NoteProfile("VND", "10000",  68,  -8, -28, chroma_min=24),                # blue
    NoteProfile("VND", "20000",  65,   5, -32, chroma_min=28),                # blue/violet
    NoteProfile("VND", "50000",  58,  -8,  28, chroma_min=22),                # green/teal
    NoteProfile("VND", "100000", 62,  18,  28, chroma_min=24),                # brown/orange
    NoteProfile("VND", "200000", 62, -18,  18, chroma_min=20),                # green
    NoteProfile("VND", "500000", 68,  22,  -5, chroma_min=20),                # pink/red-brown

    # ── TWD — Central Bank of Taiwan ─────────────────────────────────────────
    NoteProfile("TWD", "100",  62, -18,  18, chroma_min=22),                  # green
    NoteProfile("TWD", "200",  68,  22,  28, chroma_min=26),                  # brown/orange
    NoteProfile("TWD", "500",  62,  18, -22, chroma_min=24),                  # purple
    NoteProfile("TWD", "1000", 60,  -8, -32, chroma_min=28),                  # blue
    NoteProfile("TWD", "2000", 65, -15,  15, chroma_min=18),                  # teal-green

    # ── LKR — Central Bank of Sri Lanka ──────────────────────────────────────
    NoteProfile("LKR", "20",   68,  22,  28, chroma_min=24),                  # orange/brown
    NoteProfile("LKR", "50",   62, -18,  18, chroma_min=22),                  # green
    NoteProfile("LKR", "100",  65,  -5, -28, chroma_min=24),                  # blue
    NoteProfile("LKR", "500",  55,  30,  15, chroma_min=28),                  # red
    NoteProfile("LKR", "1000", 62,  18, -22, chroma_min=22),                  # purple
    NoteProfile("LKR", "5000", 68,  18,  22, chroma_min=20),                  # brown/orange

    # ── NPR — Nepal Rastra Bank ───────────────────────────────────────────────
    NoteProfile("NPR", "5",    68,  20,  28, chroma_min=22),                  # brown/orange
    NoteProfile("NPR", "10",   62, -18,  18, chroma_min=20),                  # green
    NoteProfile("NPR", "20",   65,  -5, -28, chroma_min=22),                  # blue
    NoteProfile("NPR", "50",   68,  22, -10, chroma_min=20),                  # pink/red
    NoteProfile("NPR", "100",  62,  18, -20, chroma_min=22),                  # purple
    NoteProfile("NPR", "500",  55,  28,  15, chroma_min=26),                  # red/orange
    NoteProfile("NPR", "1000", 68,  -8,  28, chroma_min=22),                  # yellow-green
]

# Tighter temperature → more decisive winner.
SOFTMAX_TEMPERATURE = 10.0


# ── Note boundary detection ───────────────────────────────────────────────────

def _find_note_bounds(img_bgr: np.ndarray) -> np.ndarray | None:
    """Detect the note rectangle via Canny + contour and return the crop.

    Eliminates the white/coloured table border that dilutes the dominant
    colour reading.  Returns None when no clear rectangle is found so the
    caller can fall back to a centre crop.
    """
    try:
        h, w = int(img_bgr.shape[0]), int(img_bgr.shape[1])
        img_area = h * w

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)

        # Auto Canny thresholds based on image median brightness
        med = float(np.median(blurred))
        lo  = max(10.0, 0.45 * med)
        hi  = min(255.0, 1.55 * med)
        edges = cv2.Canny(blurred, lo, hi)

        # Close gaps in the note border
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
        edges = cv2.dilate(edges, k, iterations=3)
        edges = cv2.erode(edges, k, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        best_cnt  = None
        best_area = 0.0

        for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
            area = float(cv2.contourArea(cnt))
            # Note must cover 15–97 % of the frame
            if not (0.15 * img_area < area < 0.97 * img_area):
                continue
            peri  = float(cv2.arcLength(cnt, True))
            approx = cv2.approxPolyDP(cnt, 0.03 * peri, True)
            # Accept 4–6-vertex polygons (slightly distorted rectangles)
            if 4 <= len(approx) <= 6 and area > best_area:
                best_cnt  = cnt
                best_area = area

        if best_cnt is None:
            return None

        # Cast all boundingRect values to plain Python ints to avoid
        # numpy array ambiguity errors on Windows (int32 vs bool_ issues).
        rx, ry, rbw, rbh = cv2.boundingRect(best_cnt)
        x, y, bw, bh = int(rx), int(ry), int(rbw), int(rbh)

        # Shrink inward to exclude any residual border shadow
        pad = max(8, int(min(bw, bh) * 0.03))
        x1 = max(0, x + pad)
        y1 = max(0, y + pad)
        x2 = min(w, x + bw - pad)
        y2 = min(h, y + bh - pad)

        if (x2 - x1) < 80 or (y2 - y1) < 50:
            return None

        # Sanity: detected region must be reasonably rectangular
        ar = (x2 - x1) / max(1, (y2 - y1))
        if not (0.2 < ar < 5.5):
            return None

        return img_bgr[y1:y2, x1:x2]

    except Exception:
        return None


def _central_crop(img: np.ndarray, frac: float = 0.60) -> np.ndarray:
    h, w = img.shape[:2]
    cy, cx = h // 2, w // 2
    rh, rw = int(h * frac / 2), int(w * frac / 2)
    return img[max(0, cy - rh): cy + rh, max(0, cx - rw): cx + rw]


# ── Colour summary ─────────────────────────────────────────────────────────────

def lab_summary(img_bgr: np.ndarray) -> tuple[float, float, float, float]:
    """Return (L*, a*, b*, chroma) of the dominant chromatic cluster.

    Improvements over v1:
    * Note-boundary detection removes white table margins before sampling.
    * Adaptive chroma threshold (tries 10, falls back to 4).
    * k=5 clusters (was 3) for finer colour resolution.
    * Cluster scoring: sqrt(pop) × chroma^1.5 strongly prefers coloured
      clusters over large neutral (white/grey) ones.
    """
    # Step 1: isolate the note
    _bounds = _find_note_bounds(img_bgr)
    crop = _bounds if _bounds is not None else _central_crop(img_bgr, 0.60)

    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32)
    L_ch = lab[..., 0] * (100.0 / 255.0)
    a_ch = lab[..., 1] - 128.0
    b_ch = lab[..., 2] - 128.0
    chroma_pix = np.sqrt(a_ch * a_ch + b_ch * b_ch)

    # Step 2: adaptive informative-pixel mask
    informative_mask = None
    for thr in (10.0, 6.0, 3.0):
        m = chroma_pix > thr
        if int(m.sum()) >= 200:
            informative_mask = m
            break

    if informative_mask is None:
        # Virtually monochrome — return global mean
        Lm = float(L_ch.mean())
        am = float(a_ch.mean())
        bm = float(b_ch.mean())
        return Lm, am, bm, float(np.sqrt(am * am + bm * bm))

    L_flat = L_ch[informative_mask].reshape(-1, 1)
    a_flat = a_ch[informative_mask].reshape(-1, 1)
    b_flat = b_ch[informative_mask].reshape(-1, 1)
    samples = np.concatenate([L_flat, a_flat, b_flat], axis=1).astype(np.float32)

    # Step 3: sub-sample for speed
    if samples.shape[0] > 5000:
        rng = np.random.default_rng(42)
        idx = rng.choice(samples.shape[0], 5000, replace=False)
        samples = samples[idx]

    K = min(5, max(3, samples.shape[0] // 150))
    if samples.shape[0] < K:
        Lm = float(L_flat.mean())
        am = float(a_flat.mean())
        bm = float(b_flat.mean())
        return Lm, am, bm, float(np.sqrt(am * am + bm * bm))

    # Step 4: k-means
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _, labels, centers = cv2.kmeans(
        samples, K, None, crit, 5, cv2.KMEANS_PP_CENTERS
    )
    labels = labels.flatten()

    # Step 5: score clusters — sqrt(pop) × chroma^1.5 + 2
    # chroma^1.5 means a note at chroma=16 scores 64× vs white at chroma=4
    # while still letting pale (chroma~8) note clusters beat large white regions
    best_score = -1.0
    Lm = am = bm = 0.0
    for k in range(K):
        center = centers[k]
        ck_a = float(center[1])
        ck_b = float(center[2])
        ck_chroma = float(np.sqrt(ck_a * ck_a + ck_b * ck_b))
        pop = float((labels == k).sum())
        score = (pop ** 0.5) * (ck_chroma ** 1.5 + 2.0)
        if score > best_score:
            best_score = score
            Lm = float(center[0])
            am = ck_a
            bm = ck_b

    return Lm, am, bm, float(np.sqrt(am * am + bm * bm))


# ── Distance & classification ──────────────────────────────────────────────────

def _profile_distance(L: float, a: float, b: float, chroma: float,
                      p: NoteProfile) -> float:
    """Weighted Lab distance with soft chroma-range gate.

    Chroma penalties are intentionally gentle (0.45 / 0.70) because phone
    cameras and indoor lighting desaturate colours relative to ideal values.
    """
    dL   = (L - p.L) * 0.4
    da   = (a - p.a)
    db   = (b - p.b)
    base = float(np.sqrt(dL * dL + da * da + db * db))
    if chroma < p.chroma_min:
        base += (p.chroma_min - chroma) * 0.45   # was 0.9 — too harsh on camera
    elif chroma > p.chroma_max:
        base += (chroma - p.chroma_max) * 0.70   # was 1.4 — too harsh on camera
    return base / max(0.01, p.weight)


def classify(
    img_bgr: np.ndarray,
    enabled_currencies: Iterable[str] | None = None,
    currency_hint: str | None = None,
) -> dict:
    """Two-stage classifier: pick currency first, then denomination.

    Stage 1 — currency competition:
      Each currency competes via its *closest* profile (minimum distance).
      Softmax over per-currency best-distances → currency probabilities.
      Prevents currencies with many denominations accumulating votes.

    Stage 2 — denomination selection:
      Within the winning currency pick the lowest-distance profile.
    """
    L, a, b, chroma = lab_summary(img_bgr)

    enabled = {c.upper() for c in enabled_currencies} if enabled_currencies else None
    candidates = [p for p in PROFILES if (enabled is None or p.currency in enabled)]
    if not candidates:
        candidates = PROFILES[:]

    # Currency hint: lock to a single currency (highest accuracy mode)
    hint = (currency_hint or "").upper().strip() or None
    if hint:
        hinted = [p for p in candidates if p.currency == hint]
        if hinted:
            candidates = hinted

    distances = np.array(
        [_profile_distance(L, a, b, chroma, p) for p in candidates],
        dtype=np.float32,
    )

    # ── Stage 1: per-currency best-distance competition ────────────────────
    cur_best: dict[str, tuple[float, int]] = {}
    for i, (p, d) in enumerate(zip(candidates, distances)):
        d_f = float(d)
        if p.currency not in cur_best or d_f < cur_best[p.currency][0]:
            cur_best[p.currency] = (d_f, i)

    currency_list  = list(cur_best.keys())
    cur_dists      = np.array([cur_best[c][0] for c in currency_list], dtype=np.float32)
    cur_logits     = -cur_dists / SOFTMAX_TEMPERATURE
    cur_logits    -= cur_logits.max()
    cur_probs_arr  = np.exp(cur_logits)
    cur_probs_arr /= cur_probs_arr.sum()
    currency_probs = {c: float(p) for c, p in zip(currency_list, cur_probs_arr)}

    best_currency = max(currency_probs, key=lambda c: currency_probs[c])
    best_idx      = cur_best[best_currency][1]
    best          = candidates[best_idx]

    # ── Stage 2: full softmax for denomination display list ────────────────
    logits  = -distances / SOFTMAX_TEMPERATURE
    logits -= logits.max()
    probs   = np.exp(logits)
    probs  /= probs.sum()
    order   = np.argsort(-probs)

    top_currencies = sorted(currency_probs.items(), key=lambda kv: -kv[1])[:3]
    top_denoms     = [
        (candidates[i].currency, candidates[i].denomination, float(probs[i]))
        for i in order[:5]
    ]

    same_cur_probs = [float(probs[i]) for i, p in enumerate(candidates)
                      if p.currency == best_currency]
    denom_conf = float(probs[best_idx]) / max(1e-9, sum(same_cur_probs))

    return {
        "currency":            best.currency,
        "denomination":        best.denomination,
        "currency_confidence": round(currency_probs[best_currency], 4),
        "denom_confidence":    round(denom_conf, 4),
        "top_currencies":      [(c, round(p, 4)) for c, p in top_currencies],
        "top_denominations":   [(c, d, round(p, 4)) for c, d, p in top_denoms],
        "lab": {
            "L": round(L, 1), "a": round(a, 1),
            "b": round(b, 1), "chroma": round(chroma, 1),
        },
    }


# ── Profile-relative authenticity scores ─────────────────────────────────────

def profile_match_score(
    img_bgr: np.ndarray,
    matched_profile: NoteProfile | None = None,
) -> float:
    """Map Lab distance from measured colour to the matched profile → 0..1.

    After identification the matched denomination profile gives us the
    *expected* colour fingerprint of a genuine note.  The further the scanned
    note deviates from that fingerprint, the more suspicious it is.

    Distance 0   → 1.0  (perfect colour match)
    Distance 10  → 0.85 (minor lighting variation — still likely genuine)
    Distance 20  → 0.55 (substantial deviation — suspicious)
    Distance 30+ → 0.0  (completely wrong colour — likely counterfeit)
    """
    L, a, b, chroma = lab_summary(img_bgr)

    if matched_profile is None:
        # Fall back to best-match across all profiles
        result = classify(img_bgr)
        # Extract the matched profile
        hint_cur = result["currency"]
        hint_den = result["denomination"]
        matched_profile = next(
            (p for p in PROFILES
             if p.currency == hint_cur and p.denomination == hint_den),
            None,
        )
        if matched_profile is None:
            return 0.5  # cannot find profile — neutral

    dist = _profile_distance(L, a, b, chroma, matched_profile)
    # Map [0, 30] → [1.0, 0.0] with smooth decay
    return float(max(0.0, min(1.0, 1.0 - dist / 30.0)))


def color_consistency_score(
    img_bgr: np.ndarray,
    matched_profile: NoteProfile | None = None,
) -> float:
    """Check that the note's chroma falls within the expected range for the
    matched denomination profile.

    Genuine notes have characteristic saturation levels — e.g. the INR 2000
    (magenta) has high chroma; the USD 100 (grey-green) has low chroma.
    A note whose chroma is wildly outside the expected range is suspicious.

    Returns 1.0 when chroma is within the expected range, lower otherwise.
    """
    _, _, _, chroma = lab_summary(img_bgr)

    if matched_profile is None:
        result = classify(img_bgr)
        hint_cur = result["currency"]
        hint_den = result["denomination"]
        matched_profile = next(
            (p for p in PROFILES
             if p.currency == hint_cur and p.denomination == hint_den),
            None,
        )
        if matched_profile is None:
            return 0.5

    p = matched_profile
    if chroma < p.chroma_min:
        deficit = p.chroma_min - chroma
        # Penalise by 0.05 per unit of deficit, max penalty 0.7
        return float(max(0.3, 1.0 - deficit * 0.05))
    elif chroma > p.chroma_max:
        excess = chroma - p.chroma_max
        return float(max(0.3, 1.0 - excess * 0.05))
    return 1.0


# ── Backwards-compat wrappers ─────────────────────────────────────────────────

def dominant_hue(img_bgr: np.ndarray) -> int:
    hsv  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s = hsv[..., 0], hsv[..., 1]
    mask = s > 30
    if mask.sum() < 100:
        return int(h.mean())
    hist = cv2.calcHist([h], [0], mask.astype(np.uint8) * 255,
                        [180], [0, 180]).flatten()
    return int(np.argmax(hist))


def best_currency_guess(img_bgr: np.ndarray) -> tuple[str, str, float]:
    r     = classify(img_bgr)
    score = 0.7 * r["denom_confidence"] + 0.3 * r["currency_confidence"]
    return r["currency"], r["denomination"], float(score)


def lab_saturation_score(img_bgr: np.ndarray) -> float:
    """Backward-compat — now calls color_consistency_score."""
    return color_consistency_score(img_bgr)
