# VeriCash — Project Memory & Session Log

> **Purpose:** This file captures everything that has been done across sessions so any AI model or developer joining the project knows the full context.

---

## Project Overview

**VeriCash** is a fake currency detection system with three components:
- **Backend** (`/backend`): FastAPI + OpenCV + TFLite — 7-technique ensemble pipeline for banknote authentication
- **Web** (`/web`): Next.js 14 App Router — inspector console with scan, history, settings, admin
- **Mobile** (`/mobile`): Expo/React Native — camera-based scanner app

### Architecture
```
User → Web (Next.js :3000) or Mobile (Expo APK)
         ↓
       Nginx (vericash.duckdns.org)
         ↓ /api/* → Backend (FastAPI :8001)
         ↓ /*     → Web (Next.js :3000)
         ↓
       7-Technique CV Pipeline → Verdict (authentic/suspicious/counterfeit)
```

### 7 PBL Detection Techniques
1. **Colour-space fingerprint** — CIE Lab dominant-colour k-means clustering
2. **Frequency-domain analysis** — FFT magnitude spectrum for micro-print patterns
3. **Edge & morphology** — Canny + morphological gradient for line sharpness
4. **Histogram distribution** — Channel histogram comparison against reference
5. **Noise-level estimation** — Gaussian noise variance measurement
6. **Spatial-texture analysis** — GLCM (Gray Level Co-occurrence Matrix) features
7. **TFLite classifier** — MobileNetV2 binary classifier for denomination detection

### Ensemble Scoring
- Each technique produces a 0–1 score
- Weighted ensemble via `ensemble.py` with configurable thresholds
- Final verdict: `authentic` (≥0.55), `suspicious` (0.35–0.55), `counterfeit` (<0.35)

---

## Deployment

### EC2 (AWS Free Tier)
- **IP:** 54.162.220.67
- **Domain:** https://vericash.duckdns.org (SSL via Let's Encrypt)
- **SSH Key:** `C:\Users\Lenovo\Downloads\vericash.pem` (local) — also at `infra/vericash.pem` (gitignored)
- **Services:**
  - `vericash.service` — Backend FastAPI on port **8001**
  - `vericash-web.service` — Next.js web app on port **3000**
- **Nginx** routes `/api/*` → 8001, everything else → 3000
- **Deploy command:** `ssh ubuntu@54.162.220.67` then `cd FAKECURRENCYDETECTION && git pull && cd web && npm run build && sudo systemctl restart vericash vericash-web`

### GitHub Actions (CI/CD)
- **`.github/workflows/deploy-ec2.yml`** — Auto-deploys backend + web on push to `main` (uses `EC2_HOST` and `EC2_SSH_KEY` secrets)
- **`.github/workflows/build-android.yml`** — Builds signed APK, publishes to GitHub Releases with permanent download link
- **`.github/workflows/android-apk.yml`** — Secondary APK build workflow
- **`.github/workflows/backend-ci.yml`** — Runs pytest on backend changes
- **`.github/workflows/web-ci.yml`** — Web CI checks

### Mobile APK
- **EAS Project:** `@rahulgatty1/vericash` (ID: `b3fdb32c-e631-487c-9493-29a723a4d49c`)
- **Download:** https://github.com/rahulkumargit1/androideveelopement/releases/latest/download/VeriCash.apk
- **Build:** GitHub Actions auto-builds on push to `main` when `mobile/**` changes

### Environment Variables
- **Web `.env.local` (local):** `NEXT_PUBLIC_API_URL=http://localhost:8001`
- **Web `.env.local` (EC2):** `NEXT_PUBLIC_API_URL=https://vericash.duckdns.org` — **MUST exist** or the web app can't reach the API
- **Backend `.env`:** `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`

---

## Session Log

### Session: 2026-04-28 (02:00–03:30 IST)

**Goal:** Fix UI issues from WhatsApp screenshots, deploy updates, set up CI/CD

#### Issues Fixed:
1. **Header alignment (mobile+desktop)**
   - `Nav.tsx`: Logo scales 36→48px, text scales, nav items use `whitespace-nowrap` + horizontal scroll, removed `flex-wrap`
   - `layout.tsx`: Gov-strip compact with `truncate`, hidden system-status link on mobile

2. **Camera "off" box overflow**
   - `ScanCamera.tsx`: Both dashed frame guide AND idle placeholder use `inset: clamp(8px, 5%, 24px)` so text stays inside border
   - Corner brackets repositioned with matching `calc()` offsets

3. **Settings scroll barrier → mobile dropdown**
   - `settings/page.tsx`: Mobile shows a native `<select>` dropdown instead of sidebar; desktop keeps sticky sidebar
   - Added `ChevronDown` icon import

4. **WhatsApp OG image**
   - Generated static `og-preview.png` (1200×630) with navy/gold VeriCash branding
   - Placed in `web/public/og-preview.png`
   - Changed from dynamic edge-runtime to static file with absolute URL + `?v=2` cache buster
   - **Note:** WhatsApp caches aggressively — to force refresh, share to a new chat or wait ~24h. Can also use https://developers.facebook.com/tools/debug/ to scrape fresh.

#### Infrastructure Done:
- ✅ EC2 backend updated and restarted (port 8001)
- ✅ EC2 web frontend built with correct `NEXT_PUBLIC_API_URL` and restarted
- ✅ GitHub Actions `deploy-ec2.yml` created — auto-deploys on push to `main`
- ✅ GitHub Secrets set: `EC2_HOST`, `EC2_SSH_KEY`
- ✅ EAS project registered: `@rahulgatty1/vericash`
- ✅ APK auto-built via GitHub Actions and published to Releases
- ✅ Removed accidentally committed `.pem` file, added `*.pem` to `.gitignore`

#### Commits (chronological):
```
dddd496 fix: header alignment, camera box overflow, settings scroll barrier, WhatsApp OG image
6b51105 ci: add EC2 deploy workflow, fix EAS project ID, add web rebuild to deploy
190f0f0 security: remove SSH key from repo, add *.pem to gitignore
47f9228 ci: ensure .env.local is created on EC2 deploy with correct API URL
baf84bd fix: settings mobile dropdown, absolute OG URLs for WhatsApp cache bust
```

### Session: 2026-04-28 (10:15–10:35 IST)

**Goal:** Check memory, fix leftover issues, start local servers

#### Issues Fixed:
1. **EC2 deploy workflow failure** (`deploy-ec2.yml`)
   - **Root cause:** `git reset --hard` during deploy wiped stale `.next` build artifacts, then `npm run build` failed with `ENOENT pages-manifest.json`, causing `vericash-web.service` to crash on restart
   - **Fix:** Added `rm -rf .next` before `npm run build` to force a clean build
   - Increased SSH `timeout` from 120s → 300s and added `command_timeout: 240s` (npm build takes ~90s on t2.micro)
   - Added `NODE_OPTIONS="--max-old-space-size=512"` for t2.micro's 1GB RAM
   - Increased service wait from 3s → 8s (Next.js cold-start is slow on micro)

#### Audit Notes:
- **Backend**: Pipeline, ensemble, scan routes — all clean. ML-anchored scoring (v3) is working correctly. Lab caching eliminates the old 3x-computation inconsistency.
- **Web**: API client, main page, settings — all solid. Batch scan, compression, auth flows work.
- **Mobile**: Camera capture, image compression, currency selector, auth banners — clean.
- **EC2**: Both services `active`, latest commit deployed, health endpoints returning 200.

#### Commits:
```
329063c fix: EC2 deploy workflow - clean .next before build, increase timeout, wait for services
```

---

## Key Files & Their Roles

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI entry point, mounts routes |
| `backend/app/cv_pipeline/pipeline.py` | Orchestrates 7-technique scan |
| `backend/app/cv_pipeline/ensemble.py` | Weighted scoring + verdict logic |
| `backend/app/cv_pipeline/colorspace.py` | CIE Lab fingerprint technique |
| `backend/app/config.py` | Settings (thresholds, DB path, CORS) |
| `web/app/layout.tsx` | Root layout, OG metadata, nav shell |
| `web/components/Nav.tsx` | Header + navigation bar |
| `web/components/ScanCamera.tsx` | Camera capture + frame guide UI |
| `web/app/settings/page.tsx` | Settings page (8 panels) |
| `web/app/globals.css` | Design tokens, theme, USWDS-inspired styling |
| `web/lib/api.ts` | API client (auth, scan, settings) |
| `mobile/app/index.tsx` | Mobile scanner screen |
| `mobile/app/settings.tsx` | Mobile settings (server URL config) |
| `infra/aws_deploy.sh` | First-time EC2 setup script |
| `infra/deploy-ec2.yml` | GitHub Actions EC2 deploy |
| `.github/workflows/build-android.yml` | APK build + GitHub Release |

---

## Known Issues & Gotchas

1. **Backend port is 8001, NOT 8000** — both EC2 systemd and local `.env.local` use 8001
2. **EC2 `.env.local` for web is not in git** — the deploy workflow creates it, but if you deploy manually, you must create it: `echo 'NEXT_PUBLIC_API_URL=https://vericash.duckdns.org' > web/.env.local`
3. **WhatsApp OG cache** — WhatsApp caches link previews aggressively. Change the `?v=N` param in `layout.tsx` to bust cache
4. **t2.micro RAM** — Only 1GB RAM; swap is configured (2GB). TensorFlow + EasyOCR can be slow on first request
5. **EasyOCR cold start** — First scan request after restart takes ~30s to load OCR models
6. **PowerShell SSH** — `git push` stderr triggers PowerShell error display even on success; check actual output for `main -> main` confirmation
7. **`.pem` files are gitignored** — Never commit SSH keys; they're stored as GitHub Secrets

---

## Design System

- **Theme:** USWDS-inspired government aesthetic
- **Colors:** Navy (`#162e51`), Gold (`#ffbc78`), White
- **Dark mode:** `data-theme="dark"` on `<html>`, CSS custom properties flip
- **Typography:** Inter (sans), JetBrains Mono (mono)
- **Components:** `.card`, `.btn`, `.chip`, `.alert`, `.input`, `.switch`, `.gov-hero`, `.gov-strip`
