# VeriCash — Fake Currency Detection System
## Complete Project Documentation

**Version:** 1.0.0 (v4 Detection Engine)  
**Date:** April 2026  
**Platform:** Web + Android APK + REST API  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Installation Guide](#4-installation-guide)
5. [Detection Pipeline — 7 PBL Techniques](#5-detection-pipeline)
6. [API Reference](#6-api-reference)
7. [User Roles & Authentication](#7-user-roles--authentication)
8. [Deployment (AWS EC2)](#8-deployment)
9. [Mobile App (Android APK)](#9-mobile-app)
10. [Project Team](#10-project-team)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Project Overview

**VeriCash** is a counterfeit currency detection system that uses **7 image-processing techniques** (Problem-Based Learning approach) to analyse banknote photographs and issue an authenticity verdict: **authentic**, **suspicious**, or **counterfeit**.

### Key Features
- **Multi-currency support:** INR, USD, EUR (with TFLite ML models)
- **7-technique pipeline:** Image enhancement, histogram analysis, spatial filtering, frequency-domain (FFT), noise analysis, morphological operations, colour-space transformations
- **ML-anchored scoring (v4):** TensorFlow Lite models provide the primary confidence signal, validated by heuristic checks
- **Web interface:** Responsive Next.js app with government-inspired design
- **Android APK:** Native Expo React Native app with camera scanning
- **REST API:** FastAPI backend serving both web and mobile
- **Role-based access:** Admin, Inspector, Viewer roles
- **Batch scanning:** Scan up to 10 notes at once
- **Scan history & analytics:** Donut charts, trend bars, CSV export

### Live URLs
| Resource | URL |
|----------|-----|
| Web App | https://vericash.duckdns.org |
| API Docs | https://vericash.duckdns.org/api/docs |
| System Status | https://vericash.duckdns.org/status |
| APK Download | https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk |

---

## 2. System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Frontend   │     │  Mobile App     │     │  Direct API     │
│   (Next.js)      │     │  (Expo/RN)      │     │  (curl/Postman) │
│   Port 3000      │     │  Android APK    │     │                 │
└────────┬─────────┘     └────────┬────────┘     └────────┬────────┘
         │                        │                       │
         └────────────┬───────────┴───────────────────────┘
                      │ HTTPS (port 443 via Caddy)
                      ▼
              ┌───────────────┐
              │  FastAPI       │
              │  Backend       │
              │  Port 8001     │
              └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ CV       │ │ TFLite   │ │ SQLite   │
   │ Pipeline │ │ Models   │ │ Database │
   │ (OpenCV) │ │ INR/USD/ │ │ (scans,  │
   │          │ │ EUR      │ │  users)  │
   └──────────┘ └──────────┘ └──────────┘
```

### Data Flow (Scan Request)
1. User captures/uploads a banknote image
2. Frontend compresses to 800px max, sends to `/api/scan`
3. Backend runs the 7-technique pipeline:
   - Pre-processing (resize, exposure check)
   - Classification (TFLite + Lab colour matching)
   - Scoring (8 subscores → ensemble v4 weighted average)
4. Returns verdict with confidence, breakdown, and subscores
5. Result is displayed with colour-coded verdict band

---

## 3. Technology Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | FastAPI | 0.111+ |
| Language | Python | 3.11 |
| Image Processing | OpenCV (cv2) | 4.x |
| ML Inference | TensorFlow Lite | 2.x |
| OCR | EasyOCR | 1.x |
| Database | SQLite + SQLAlchemy | - |
| Server | Uvicorn | - |

### Web Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 14.2 |
| Language | TypeScript | 5.3 |
| Styling | CSS (custom design system) | - |
| Icons | Lucide React | - |
| Build | Node.js | 20.x |

### Mobile App
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Expo (React Native) | SDK 51 |
| Camera | expo-camera | 15.x |
| Build | EAS Build / Gradle | - |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Server | AWS EC2 (t2.micro, Ubuntu) |
| Reverse Proxy | Caddy (auto HTTPS) |
| DNS | DuckDNS (vericash.duckdns.org) |
| CI/CD | GitHub Actions (4 workflows) |

---

## 4. Installation Guide

### Prerequisites
- **Python 3.11+** (with pip)
- **Node.js 20+** (with npm)
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/rahulkumargit1/androideveelopement.git
cd androideveelopement
```

### Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The backend will be available at `http://localhost:8001`.  
API docs at `http://localhost:8001/docs`.

### Step 3: Web Frontend Setup

```bash
cd web

# Install dependencies
npm install --legacy-peer-deps

# Create environment config
echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local

# Start the development server
npm run dev
```

The web app will be available at `http://localhost:3000`.

### Step 4: First-Time Login

1. Open `http://localhost:3000` in your browser
2. Go to **Settings** page
3. The default admin credentials are:
   - **Email:** `admin@vericash.gov`
   - **Password:** `admin`
4. After logging in, you can create additional users

### Step 5: Run Tests

```bash
cd backend

# Activate the virtual environment
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Run all tests
python -m pytest tests/ -v
```

Expected output: **7 tests passed**.

---

## 5. Detection Pipeline

### 7 PBL Techniques

| # | Technique | Module | What It Detects |
|---|-----------|--------|-----------------|
| 1 | **Image Enhancement** | `enhance.py` | Exposure quality (over/under-exposed images) |
| 2 | **Histogram Processing** | `histogram.py` | Multi-modal intensity distribution + channel diversity |
| 3 | **Spatial Filtering** | `spatial.py` | Fine print detail via Laplacian variance |
| 4 | **Frequency-Domain (FFT)** | `frequency.py` | Micro-print energy in high-frequency bands |
| 5 | **Noise Removal** | `noise.py` | Paper-grain noise sigma + moire pattern detection |
| 6 | **Morphological Operations** | `morphology.py` | Security thread continuity (dark + metallic threads) |
| 7 | **Colour-Space (CIE Lab)** | `colorspace.py` | Lab colour fingerprint matching to genuine note profiles |

### Ensemble Scoring (v4)

The final authenticity score is computed by the **ML-anchored ensemble** in `ensemble.py`:

| Signal | Weight | Description |
|--------|--------|-------------|
| `ml_confidence` | 32% | TFLite MobileNet classification confidence |
| `profile_match` | 26% | CIE Lab distance to genuine-note colour profile |
| `color_consistency` | 14% | Chroma within expected denomination range |
| `texture_detail` | 8% | Laplacian variance in genuine-print band |
| `noise_consistency` | 6% | Paper-grain noise + moire check |
| `microprint_presence` | 4% | FFT high-frequency micro-print energy |
| `thread_detection` | 4% | Security thread morphology score |
| `histogram_profile` | 4% | Multi-modal histogram shape |
| `exposure_valid` | 2% | Quality gate (minimal weight) |

**ML Anchoring:** When the TFLite model confidence is ≥ 0.40, it anchors the result at 60% weight, with heuristics providing 40%.

**Colour-Mismatch Penalty:** If `profile_match` < 0.30, a penalty of up to -0.15 is applied — catching counterfeits that look visually correct but have wrong ink colours.

### Verdict Thresholds
| Score Range | Verdict |
|-------------|---------|
| ≥ 0.78 | **Authentic** ✅ |
| 0.45 – 0.77 | **Suspicious** ⚠️ |
| < 0.45 | **Counterfeit** ❌ |

---

## 6. API Reference

### Base URL
- Local: `http://localhost:8001`
- Production: `https://vericash.duckdns.org`
- Swagger UI: `/docs`

### Key Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/scan` | Scan a single banknote image | Required |
| `POST` | `/api/scan/batch` | Scan multiple images (up to 10) | Required |
| `GET` | `/api/history` | Get scan history | Required |
| `GET` | `/api/stats` | Get analytics/statistics | Required |
| `DELETE` | `/api/history` | Clear scan history | Admin/Inspector |
| `GET` | `/health` | Backend health check | Public |
| `POST` | `/api/auth/login` | Login with email/password | Public |
| `POST` | `/api/auth/logout` | Logout | Required |
| `GET` | `/api/auth/me` | Get current user info | Required |
| `GET` | `/api/currencies` | List supported currencies | Public |
| `GET` | `/api/members` | List team members | Public |
| `PUT` | `/api/members` | Add/update team member | Admin |
| `DELETE` | `/api/members/:id` | Remove team member | Admin |
| `GET` | `/api/settings` | Get app settings | Public |
| `PUT` | `/api/settings` | Update app settings | Admin |

### Scan Request Example

```bash
curl -X POST https://vericash.duckdns.org/api/scan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@banknote.jpg" \
  -F "currency_hint=INR"
```

### Scan Response Example

```json
{
  "currency": "INR",
  "denomination": "500",
  "authenticity_score": 0.8523,
  "confidence": 0.8901,
  "verdict": "authentic",
  "demonetized": false,
  "breakdown": {
    "subscores": {
      "profile_match": 0.92,
      "color_consistency": 0.87,
      "texture_detail": 0.78,
      "microprint_presence": 0.65,
      "thread_detection": 0.82,
      "noise_consistency": 0.74,
      "histogram_profile": 0.71,
      "exposure_valid": 0.95
    },
    "ml_confidence": 0.89,
    "model": "tflite-inr-v4",
    "techniques_used": [
      "Image Enhancement (exposure quality gate)",
      "Histogram Processing (multi-modal + channel diversity)",
      "Spatial Filtering (Laplacian detail)",
      "Frequency-Domain (FFT micro-print)",
      "Noise Removal (sigma + moire)",
      "Morphological Operations (security thread)",
      "Color-Space Transformations (CIE Lab fingerprint)"
    ]
  }
}
```

---

## 7. User Roles & Authentication

| Role | Scan | View History | Manage Members | App Settings |
|------|------|-------------|----------------|-------------|
| **Admin** | ✅ | All scans | ✅ Add/edit/delete | ✅ |
| **Inspector** | ✅ | Own scans | ❌ | ❌ |
| **Viewer** | ❌ | All scans (read-only) | ❌ | ❌ |
| **Anonymous** | ❌ | ❌ | View only | ❌ |

### Default Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@vericash.gov` | `admin` | Admin |

Admins can create additional users via the Settings page.

---

## 8. Deployment

### AWS EC2 Setup

1. **Instance:** t2.micro (Ubuntu 22.04)
2. **Services:** `vericash` (backend) + `vericash-web` (frontend) as systemd units
3. **Reverse proxy:** Caddy with automatic HTTPS
4. **DNS:** DuckDNS → vericash.duckdns.org

### CI/CD Workflows (GitHub Actions)

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| `deploy-ec2.yml` | Push to `main` (backend/web changes) | SSH into EC2, pull, rebuild, restart services |
| `build-android.yml` | Push to `main` | Build APK, publish to GitHub Releases |
| `backend-ci.yml` | Push to `main` | Run pytest |
| `web-ci.yml` | Push to `main` | Run Next.js build |

### Manual Deployment

```bash
# SSH into EC2
ssh ubuntu@YOUR_EC2_IP

# Pull latest code
cd /home/ubuntu/FAKECURRENCYDETECTION
git pull origin main

# Rebuild backend
cd backend
source .venv/bin/activate
pip install -r requirements.txt
deactivate

# Rebuild frontend
cd ../web
npm install --legacy-peer-deps
npm run build

# Restart services
sudo systemctl restart vericash
sudo systemctl restart vericash-web
```

---

## 9. Mobile App

### Download & Install

1. Download the APK from: https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk
2. On your Android phone, enable **"Install unknown apps"** in Settings
3. Open the downloaded APK and install
4. Launch VeriCash → Settings → set server URL to `https://vericash.duckdns.org`
5. Sign in with your credentials

### Building from Source

```bash
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Generate Android project
npx expo prebuild --platform android --non-interactive --clean

# Build APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 10. Project Team

The team roster is managed through the **Administration** page at `/members`. Admins can add/edit team members with:
- Name & role
- Profile photo (upload or URL)
- Contribution description
- GitHub profile link

---

## 11. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to backend" | Ensure backend is running on port 8001. Check `.env.local` has correct `NEXT_PUBLIC_API_URL` |
| "Scan failed" | Check if the image is a valid JPEG/PNG. Ensure the backend has TFLite models in `backend/app/cv_pipeline/models/` |
| "Module not found" errors | Run `pip install -r requirements.txt` in the backend venv |
| "npm install fails" | Use `npm install --legacy-peer-deps` |
| APK won't install | Enable "Install unknown apps" in Android settings for your browser/file manager |
| Dark mode not persisting | Clear browser localStorage and reload |
| "System status" not showing | Hard-refresh the page (Ctrl+Shift+R) to clear cached old version |

### Port Configuration

| Service | Default Port |
|---------|-------------|
| Backend API | 8001 |
| Web Frontend | 3000 |
| EC2 Backend (systemd) | 8001 |
| EC2 Web (systemd) | 3000 |
| Caddy (HTTPS) | 443 → 8001 (API), 443 → 3000 (Web) |

### Log Files (EC2)

```bash
# Backend logs
sudo journalctl -u vericash -f

# Web frontend logs
sudo journalctl -u vericash-web -f

# Caddy logs
sudo journalctl -u caddy -f
```

---

## File Structure

```
FAKECURRENCYDETECTION/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Configuration
│   │   ├── cv_pipeline/
│   │   │   ├── pipeline.py      # Main analysis function
│   │   │   ├── ensemble.py      # v4 weighted scoring
│   │   │   ├── classifier.py    # TFLite + Lab classification
│   │   │   ├── colorspace.py    # CIE Lab colour matching
│   │   │   ├── enhance.py       # Image enhancement
│   │   │   ├── histogram.py     # Histogram analysis
│   │   │   ├── spatial.py       # Spatial filtering
│   │   │   ├── frequency.py     # FFT frequency analysis
│   │   │   ├── noise.py         # Noise analysis
│   │   │   ├── morphology.py    # Security thread detection
│   │   │   └── models/          # TFLite model files
│   │   ├── routes/              # API route handlers
│   │   └── database/            # SQLAlchemy models
│   ├── tests/
│   │   └── test_pipeline.py     # 7 unit tests
│   └── requirements.txt
├── web/
│   ├── app/
│   │   ├── page.tsx             # Scan page
│   │   ├── layout.tsx           # App shell
│   │   ├── globals.css          # Design system
│   │   ├── history/page.tsx     # Scan history + analytics
│   │   ├── members/page.tsx     # Team administration
│   │   ├── settings/page.tsx    # Auth + app settings
│   │   └── status/page.tsx      # System health dashboard
│   ├── components/
│   │   ├── Nav.tsx              # Navigation header
│   │   ├── ScanCamera.tsx       # Camera + upload widget
│   │   └── ResultCard.tsx       # Verdict display card
│   └── package.json
├── mobile/
│   ├── app/                     # Expo Router screens
│   ├── src/                     # Shared components
│   ├── app.json                 # Expo config
│   └── package.json
├── .github/workflows/
│   ├── deploy-ec2.yml           # Auto-deploy to EC2
│   └── build-android.yml        # Build + publish APK
└── PROJECT_DOCUMENTATION.md     # This file
```

---

*This document was generated for the VeriCash project. For the latest version, visit the [GitHub repository](https://github.com/rahulkumargit1/androideveelopement).*
