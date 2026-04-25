# VeriCash - Fake Currency Detection (Project Context)

This file (`claude.md`) serves as a system context document for any AI agents interacting with this repository. It outlines the purpose, architecture, and structural decisions made in the "VeriCash" project.

## Project Overview

**VeriCash** is an end-to-end fake currency detection system developed as a PBL (Problem Based Learning) project on real-world image-processing applications. It analyzes images of currency notes and uses a pipeline of classical computer vision techniques to determine their authenticity, returning a verdict of `authentic`, `suspicious`, or `counterfeit`.

## System Architecture

The project consists of three main user-facing components, supported by an infrastructure layer:

- **Backend (`backend/`)**: Built with FastAPI. It houses the API, the SQLite database (for storing scans, team members, and settings), and the core image-processing pipeline (`cv_pipeline/`).
- **Web App (`web/`)**: Built with Next.js 14. Provides a web interface for scanning notes, viewing scan history, team management, and system settings.
- **Mobile App (`mobile/`)**: Built with Expo React Native. Serves as the Android application mirroring the web application's functionality.
- **Infrastructure (`infra/`)**: Contains `docker-compose` configuration for a one-box local deployment.
- **CI/CD (`.github/workflows/`)**: Automates backend and web tests, and specifically includes a workflow for building the Expo Android APK in the cloud without needing a local Android Studio setup.

## Image-Processing Pipeline

The core logic resides in the backend's `cv_pipeline`. To meet the PBL requirements, the system implements 6 of 7 standard image processing techniques, plus bonus items (color spaces beyond RGB and technique comparisons).

The techniques employed include:
1. **Image Enhancement** (`cv_pipeline/enhancement.py`): CLAHE and gamma correction for lighting/contrast issues.
2. **Histogram Processing** (`cv_pipeline/histogram.py`): Histogram equalization and Bhattacharyya distance for color distribution matching.
3. **Spatial Filtering** (`cv_pipeline/spatial.py`): Bilateral filtering, Canny edge detection, and Laplacian variance for sharpness/edge analysis.
4. **Frequency-Domain Filtering** (`cv_pipeline/frequency.py`): FFT high-pass filtering to detect fine, high-frequency security details like micro-printing.
5. **Morphological Operations** (`cv_pipeline/morphology.py`): Vertical opening to analyze security thread continuity.
6. **Color-Model Analysis** (`cv_pipeline/colorspace.py`): Converting to HSV and LaB spaces for robust color/denomination guessing.

These techniques generate sub-scores which are then aggregated by a weighted ensemble (`cv_pipeline/ensemble.py`) to produce the final authenticity rating. Note: While highly optimized for visible spectrum detection, it lacks physical UV/IR/magnetic sensors. The pipeline is designed to be plug-and-play with a CNN classifier if data becomes available (`cv_pipeline/classifier.py`).

## Quick Start & Dev Commands

- **Backend**:
  ```bash
  cd backend
  python -m venv .venv
  source .venv/Scripts/activate  # Windows
  pip install -r requirements.txt
  cp .env.example .env
  uvicorn app.main:app --reload --port 8000
  ```
  Swagger UI is at `http://localhost:8000/docs`

- **Web Frontend**:
  ```bash
  cd web
  npm install
  npm run dev
  ```
  Running on `http://localhost:3000`

- **Mobile App**:
  ```bash
  cd mobile
  npm install
  npx expo start
  ```
  (App defaults to `http://10.0.2.2:8000` for the backend when run on an Android emulator)

- **Docker Deploy**:
  ```bash
  cd infra
  docker compose up --build -d
  ```

## State & Data

- The first user to register on the platform is automatically promoted to an **admin**.
- Admins can manage currencies (add/enable/disable) and edit the public team roster from the Settings page.
- All configuration/scan data is currently persisted in SQLite (`backend/vericash.db`).
