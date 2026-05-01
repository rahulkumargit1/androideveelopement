<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=13&duration=2000&pause=800&color=8A96B2&center=true&vCenter=true&multiline=false&width=480&lines=OFFICE+OF+CURRENCY+AUTHENTICATION" alt="eyebrow" />

# ★ VeriCash

**Fake Currency Detection System**

*Scan any banknote · Instant verdict · 7 image-processing techniques*

<br/>

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-vericash.duckdns.org-162e51?style=for-the-badge&labelColor=0b1729)](https://vericash.duckdns.org)
[![Download APK](https://img.shields.io/badge/📱_Download_APK-Latest_Build-25D366?style=for-the-badge&labelColor=1a3a1a)](https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk)
[![Backend CI](https://img.shields.io/github/actions/workflow/status/rahulkumargit1/androideveelopement/backend-ci.yml?branch=main&style=for-the-badge&label=Backend+CI&labelColor=162e51)](https://github.com/rahulkumargit1/androideveelopement/actions)
[![APK Build](https://img.shields.io/github/actions/workflow/status/rahulkumargit1/androideveelopement/build-android.yml?branch=main&style=for-the-badge&label=APK+Build&labelColor=162e51)](https://github.com/rahulkumargit1/androideveelopement/actions)

<br/>

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ██╗   ██╗███████╗██████╗ ██╗ ██████╗ █████╗ ███████╗██╗  ██╗    │
│   ██║   ██║██╔════╝██╔══██╗██║██╔════╝██╔══██╗██╔════╝██║  ██║    │
│   ██║   ██║█████╗  ██████╔╝██║██║     ███████║███████╗███████║    │
│   ╚██╗ ██╔╝██╔══╝  ██╔══██╗██║██║     ██╔══██║╚════██║██╔══██║    │
│    ╚████╔╝ ███████╗██║  ██║██║╚██████╗██║  ██║███████║██║  ██║    │
│     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    │
│                                                                     │
│          Authentic ✅  ·  Suspicious ⚠️  ·  Counterfeit ❌           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

<br/>

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React Native](https://img.shields.io/badge/Expo_React_Native-000020?style=flat-square&logo=expo&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white)
![TFLite](https://img.shields.io/badge/TFLite_MobileNetV2-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white)
![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=flat-square&logo=amazonec2&logoColor=white)

</div>

---

## 📋 Overview

**VeriCash** is a full-stack banknote authentication system built as a PBL (Problem-Based Learning) project on real-world image-processing applications. It combines **7 classical CV techniques** with a **TFLite MobileNetV2 classifier** to determine whether a banknote is authentic, suspicious, or counterfeit.

```
  User (Web or Mobile)
       │
       ▼
  HTTPS · vericash.duckdns.org
       │
       ▼
  ┌─── Nginx Reverse Proxy ────────────────┐
  │  /api/*  →  FastAPI :8001              │
  │  /*      →  Next.js :3000              │
  └────────────────────────────────────────┘
       │
       ▼
  ┌─── 7-Technique CV Pipeline ────────────┐
  │  1. Image Enhancement (CLAHE + Gamma)  │
  │  2. Histogram Processing               │
  │  3. Spatial Filtering (Texture/Edge)   │
  │  4. Frequency Domain (FFT Micro-print) │
  │  5. Noise Analysis                     │
  │  6. Morphology (Security Thread)       │
  │  7. CIE Lab Colour Fingerprint         │
  │  +  TFLite MobileNetV2 Classifier      │
  └────────────────────────────────────────┘
       │
       ▼
  Weighted Ensemble → Authenticity Score → Verdict
```

---

## 🏗️ Project Structure

```
FAKECURRENCYDETECTION/
├── backend/                    # FastAPI + CV Pipeline
│   ├── app/
│   │   ├── cv_pipeline/        # 7 detection techniques
│   │   │   ├── pipeline.py     # End-to-end orchestrator
│   │   │   ├── ensemble.py     # Weighted score combiner
│   │   │   ├── colorspace.py   # CIE Lab fingerprints
│   │   │   ├── classifier.py   # TFLite MobileNetV2
│   │   │   ├── enhancement.py  # CLAHE + gamma
│   │   │   ├── frequency.py    # FFT micro-print
│   │   │   ├── histogram.py    # Histogram analysis
│   │   │   ├── morphology.py   # Security thread
│   │   │   ├── noise.py        # Noise consistency
│   │   │   ├── spatial.py      # Texture/sharpness
│   │   │   ├── ocr_classifier.py # EasyOCR denomination
│   │   │   └── vision_api.py   # Vision API integration
│   │   ├── routes/             # API endpoints
│   │   └── main.py             # FastAPI entry point
│   └── requirements.txt
│
├── web/                        # Next.js 14 Web App
│   ├── app/
│   │   ├── page.tsx            # Scan page
│   │   ├── history/            # Scan history
│   │   ├── members/            # Team roster
│   │   ├── settings/           # Admin settings
│   │   ├── status/             # System health
│   │   └── opengraph-image.tsx # WhatsApp/social preview
│   ├── components/
│   │   ├── ScanCamera.tsx      # Camera + upload UI
│   │   ├── ResultCard.tsx      # Verdict display
│   │   └── Nav.tsx             # Navigation bar
│   └── lib/api.ts              # API client
│
├── mobile/                     # Expo React Native
│   ├── app/
│   │   ├── index.tsx           # Scanner screen
│   │   ├── history.tsx         # History screen
│   │   ├── members.tsx         # Team screen
│   │   └── settings.tsx        # Server config
│   └── src/
│       ├── api/client.ts       # API client
│       └── components/
│           └── ResultCard.tsx  # Result + Share buttons
│
├── infra/                      # Infrastructure
├── .github/workflows/          # CI/CD pipelines
└── start.bat                   # One-click Windows launcher
```

---

## 🔬 Detection Techniques

| # | Technique | File | What it detects |
|---|-----------|------|-----------------|
| 1 | **Image Enhancement** | `enhancement.py` | CLAHE + adaptive gamma — normalises lighting |
| 2 | **Histogram Processing** | `histogram.py` | Multi-modal channel histogram shape |
| 3 | **Spatial Filtering** | `spatial.py` | Laplacian variance in genuine-print frequency band |
| 4 | **Frequency Domain** | `frequency.py` | FFT high-energy band for micro-print patterns |
| 5 | **Noise Analysis** | `noise.py` | Genuine paper noise sigma + moiré detection |
| 6 | **Morphological Ops** | `morphology.py` | Security thread continuity with width constraint |
| 7 | **CIE Lab Fingerprint** | `colorspace.py` | Profile-relative Lab distance from genuine note |
| + | **TFLite Classifier** | `classifier.py` | MobileNetV2 denomination confidence (lighting-invariant) |

### Ensemble Weights
```
profile_match       ████████░░  28%   Lab colour distance to genuine profile
texture_detail      █████░░░░░  16%   Sharpness in genuine print band
color_consistency   ████░░░░░░  13%   Chroma within expected range
ml_confidence       ████░░░░░░  12%   TFLite MobileNet (lighting-invariant anchor)
noise_consistency   ███░░░░░░░  10%   Genuine paper noise range
microprint_presence ██░░░░░░░░   6%   FFT micro-print energy
thread_detection    ██░░░░░░░░   6%   Security thread continuity
histogram_profile   █░░░░░░░░░   5%   Multi-modal histogram shape
exposure_valid      █░░░░░░░░░   4%   Image quality gate
```

**Verdicts:** `authentic` (≥ 75%) · `suspicious` (50–75%) · `counterfeit` (< 50%)

---

## 🚀 Quick Start

### Windows — One Click
```bat
start.bat
```
Automatically sets up Python venv, installs all deps, starts backend + web, opens browser.

### Manual Setup

#### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs
```

#### Web
```bash
cd web
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# → http://localhost:3000
```

#### Mobile
```bash
cd mobile
npm install
npx expo start
# Scan QR with Expo Go, or press 'a' for Android emulator
```

#### Docker (all-in-one)
```bash
cd infra
docker compose up --build -d
```

---

## 🌐 Live Deployment

| Service | URL |
|---------|-----|
| 🌐 Web App | https://vericash.duckdns.org |
| 📡 API | https://vericash.duckdns.org/api/ |
| 📚 API Docs | https://vericash.duckdns.org/docs |
| 📊 System Status | https://vericash.duckdns.org/status |
| 📱 Android APK | [Download Latest](https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk) |

**Infrastructure:** AWS EC2 t2.micro · Nginx · Let's Encrypt SSL · DuckDNS

---

## 📱 Android APK

**[⬇️ Download VeriCash.apk](https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk)**

Built automatically by GitHub Actions on every push to `main`. Features:
- 📷 Live camera scan + gallery upload
- 📊 Full breakdown with 8 sub-scores
- 💚 **Share via WhatsApp** (rich text with verdict + link preview)
- 📤 Native Android share sheet
- 🔐 Auth with JWT tokens
- 🌍 35 currencies · Auto-detect mode

**Install:** Enable *Install unknown apps* in Android settings → open APK → install.

---

## 🔄 CI/CD Pipelines

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `backend-ci.yml` | Push to `main` | Runs pytest on CV pipeline |
| `web-ci.yml` | Push to `main` | Next.js build check |
| `build-android.yml` | Push to `main` | Builds signed APK → GitHub Release |
| `deploy-ec2.yml` | Push to `main` | SSH deploy → EC2, rebuild web, restart services |

---

## 💬 WhatsApp Link Preview

When you share `https://vericash.duckdns.org` on WhatsApp, Telegram, or iMessage, you get a rich preview card:

```
┌────────────────────────────────────────┐
│  [VeriCash dark navy image 1200×630]   │
│  Fake Currency / Detection             │
│  INR · USD · EUR chips                 │
├────────────────────────────────────────┤
│  VeriCash — Fake Currency Detection    │
│  Scan any banknote and get an instant  │
│  authenticity verdict...               │
│  🔗 vericash.duckdns.org              │
└────────────────────────────────────────┘
```

Powered by Next.js `opengraph-image.tsx` → generates a real PNG at `/opengraph-image`.

---

## 🪙 Supported Currencies

| Currency | Denominations |
|----------|--------------|
| 🇮🇳 INR | ₹10, ₹20, ₹50, ₹100, ₹200, ₹500 |
| 🇺🇸 USD | $1, $5, $10, $20, $50, $100 |
| 🇪🇺 EUR | €5, €10, €20, €50, €100 |
| 🇬🇧 GBP | £5, £10, £20, £50 |
| 🇯🇵 JPY | ¥1000, ¥5000, ¥10000 |
| + 30 more | AED, SGD, AUD, CAD, CHF, KRW, CNY... |

> ⚠️ **₹2000 INR** — Demonetized May 2023. VeriCash detects and flags recalled notes.

---

## 👥 Team

Built by the **VeriCash Project Team** for the PBL on Real-World Image Processing Applications.

- First user to register becomes **Admin**
- Admins manage currencies, team roster, and detection thresholds
- Inspector accounts can scan; Viewer accounts are read-only

---

## 📄 License

MIT — see [`LICENSE`](./LICENSE)

---

<div align="center">

**VeriCash** · Office of Currency Authentication · Built with ❤️ for PBL

[![vericash.duckdns.org](https://img.shields.io/badge/Visit-vericash.duckdns.org-162e51?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vericash.duckdns.org)

</div>
