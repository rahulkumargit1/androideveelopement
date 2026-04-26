# Architecture

```
┌──────────┐    HTTPS    ┌──────────────────────────────┐
│  Web app │ ──────────▶│                              │
│ Next.js  │            │     FastAPI backend          │
└──────────┘            │  ┌────────────────────────┐  │
                        │  │ cv_pipeline (OpenCV)   │  │
┌──────────┐  HTTPS     │  │ enhancement / hist /   │  │
│ Android  │ ──────────▶│  │ spatial / frequency /  │  │
│ Expo APK │            │  │ morphology / colour    │  │
└──────────┘            │  └────────────────────────┘  │
                        │  SQLite (aiosqlite)          │
                        └──────────────────────────────┘
```

## Detection pipeline

```
image bytes
   │
   ▼
PIL decode → resize ≤1024 → BGR ndarray
   │
   ├── enhancement.auto_enhance  → CLAHE + adaptive gamma
   │     └── exposure_score
   ├── histogram.histogram_match_score (or entropy)
   ├── spatial.bilateral + edge_map → edge_density / sharpness_score
   ├── frequency.high_pass_energy → microprint_score   (FFT)
   ├── morphology.thread_continuity_score              (vertical opening)
   ├── colorspace.best_currency_guess + lab_saturation (HSV/LaB)
   └── classifier.predict (heuristic now, CNN later)
   │
   ▼
ensemble.combine (weighted) → ensemble.verdict
   │
   ▼
ScanResult { currency, denomination, authenticity_score, confidence,
             verdict, breakdown { subscores, comparison_of_techniques } }
```

## Auth model

- JWT (HS256), 7-day expiry.
- Roles: `admin`, `inspector`, `viewer`.
- First registered user is auto-promoted to `admin` (bootstrap).
- Member / currency / setting **mutations** require admin.
- Reads are public so the public Team page works without auth.

## Storage

- `data/vericash.db` — SQLite (users, scans, members, currencies, settings).
- `uploads/` — original scan images (kept for audit; delete-on-purge job is a TODO).

## Deployment

`infra/docker-compose.yml` brings up `api` (port 8000) and `web` (port 3000) on one host. Mobile points at the public host's `:8000`. Override `apiUrl` in `mobile/app.json` `expo.extra.apiUrl` (or set `EXPO_PUBLIC_API_URL` and read it in `client.ts`) before building the release APK.

## Extending currency support

1. Add a hue hint in `cv_pipeline/colorspace.py` `CURRENCY_HUE_HINTS`.
2. (Optional) Add reference colour histograms under `data/refs/<CCY>/<denom>.npy` and call `histogram_match_score(img, ref)`.
3. Insert via `POST /api/currencies` (admin) — the Settings → Currencies UI already does this.

## Why not 100% accuracy?

Visible-spectrum cues alone (CLAHE, edges, FFT, morphology, colour) cannot detect modern colour-laser counterfeits that replicate visual features perfectly. UV/IR/magnetic detection requires dedicated hardware. The architecture leaves a slot for a CNN (`cv_pipeline/classifier.py`) — drop in trained weights and the verdict re-balances automatically through the ensemble weights.
