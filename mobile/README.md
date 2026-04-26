# VeriCash — Fake Currency Detection

End-to-end fake currency detection: a **FastAPI** backend with an image-processing pipeline, a **Next.js** web app, and an **Expo React Native** Android app — all hitting the same server.

Built for the PBL on real-world image-processing applications.

---

## What's inside

| Folder | Purpose |
|---|---|
| `backend/` | FastAPI API + image-processing pipeline + SQLite store |
| `web/` | Next.js 14 web app (scan / history / team / settings) |
| `mobile/` | Expo React Native Android app (same screens) |
| `infra/` | docker-compose for one-box deploy |
| `.github/workflows/` | CI for backend, web, and **APK build via GitHub Actions** |
| `docs/` | Architecture notes |

---

## Image-processing techniques (PBL coverage)

We implement **6 of 7** required techniques and earn **both bonus marks**:

| # | Technique (PBL) | Where | Used for |
|---|---|---|---|
| 1 | Image Enhancement | `cv_pipeline/enhancement.py` (CLAHE + gamma) | Even out lighting, boost local contrast |
| 2 | Histogram Processing | `cv_pipeline/histogram.py` (equalisation, Bhattacharyya) | Match colour distribution against reference |
| 3 | Spatial Filtering | `cv_pipeline/spatial.py` (bilateral, Canny, Laplacian) | Edge density, sharpness scoring |
| 4 | Frequency-Domain Filtering | `cv_pipeline/frequency.py` (FFT high-pass) | Detect micro-print energy |
| 6 | Morphological Operations | `cv_pipeline/morphology.py` (vertical opening) | Security-thread continuity |
| 7 | Colour-Model Analysis | `cv_pipeline/colorspace.py` (HSV / LaB) | Currency / denomination guess |

**Bonus #1 (beyond RGB):** HSV + LaB + frequency-domain analysis.
**Bonus #2 (comparison of techniques):** the response includes a `comparison_of_techniques` block (raw vs CLAHE vs gamma) so you can see which enhancement helps most.

The six sub-scores are combined by a weighted ensemble (`cv_pipeline/ensemble.py`) into an authenticity score and a verdict (`authentic` / `suspicious` / `counterfeit`).

> **Honesty note.** Real-world counterfeit detection cannot honestly claim 100% accuracy from images alone (UV / IR / magnetic features need dedicated hardware). The pipeline is designed to maximise accuracy on visible-spectrum cues and is plug-and-play for a CNN classifier when training data is available — see `cv_pipeline/classifier.py`.

---

## Quick start (dev)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Swagger UI: <http://localhost:8000/docs>

### Web
```bash
cd web
npm install
npm run dev
```
Open <http://localhost:3000>.

### Mobile (Expo)
```bash
cd mobile
npm install
npx expo start
```
Scan the QR with Expo Go, or `a` to run on Android emulator. The app talks to `http://10.0.2.2:8000` by default (Android emulator → host machine).

### One-box deploy
```bash
cd infra
docker compose up --build -d
```

---

## APK build (GitHub Actions)

The APK is built **in the cloud** by `.github/workflows/android-apk.yml`:

1. Push to `main` (or run the workflow manually from the Actions tab).
2. The job runs `expo prebuild` and `gradlew assembleRelease` on Ubuntu.
3. The signed-debug release APK is uploaded as the `vericash-release-apk` artifact.
4. Cutting a GitHub Release also attaches the APK to the release.

No local Android Studio install is required.

---

## Project members & settings

Both the web and Android apps include:

- **Team** — public list of project members (admins can edit).
- **Settings** — sign-in, detection thresholds, currency manager (enable / add / disable currencies), appearance.

The first user to register is auto-promoted to **admin**.

---

## License

MIT — see [`LICENSE`](./LICENSE).
