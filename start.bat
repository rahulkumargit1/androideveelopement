@echo off
title VeriCash Launcher
echo ============================================
echo   VeriCash - Fake Currency Detection
echo ============================================
echo.

REM ── Check Python ──────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download from https://www.python.org/downloads/
    pause & exit /b 1
)

REM ── Check Node ────────────────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download from https://nodejs.org/
    pause & exit /b 1
)

REM ── Backend setup ─────────────────────────────────────────────────
echo [1/4] Setting up backend...
cd /d "%~dp0backend"

if not exist ".venv" (
    echo      Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo      Installing backend dependencies...
pip install -r requirements.txt --quiet

if not exist ".env" (
    echo      Creating .env from template...
    copy .env.example .env >nul
)

REM ── Web setup ─────────────────────────────────────────────────────
echo [2/4] Setting up web frontend...
cd /d "%~dp0web"

if not exist "node_modules" (
    echo      Installing web dependencies (first time, may take 2-3 minutes)...
    call npm install --legacy-peer-deps
)

REM ── Start backend in new window ────────────────────────────────────
echo [3/4] Starting backend on http://localhost:8000 ...
start "VeriCash Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

REM ── Start web in new window ────────────────────────────────────────
echo [4/4] Starting web frontend on http://localhost:3000 ...
start "VeriCash Web" cmd /k "cd /d "%~dp0web" && npm run dev"

echo.
echo ============================================
echo   VeriCash is starting!
echo.
echo   Backend:  http://localhost:8000
echo   Web App:  http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Two terminal windows have opened.
echo   Wait ~15 seconds then open your browser.
echo ============================================
echo.
echo Opening web app in browser in 15 seconds...
timeout /t 15 /nobreak >nul
start http://localhost:3000
