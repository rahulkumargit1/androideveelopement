@echo off
setlocal

echo ======================================================================
echo VeriCash — Currency Authentication System (Startup)
echo ======================================================================
echo.

:: Detect if we are in the root directory
if not exist "backend" (
    echo [ERROR] Could not find 'backend' directory. 
    echo Please run this script from the project root.
    pause
    exit /b 1
)

echo [1/3] Launching Backend API (Port 8001)...
cd backend
if exist ".venv\Scripts\activate.bat" (
    start "VeriCash Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8001"
) else (
    start "VeriCash Backend" cmd /k "uvicorn app.main:app --reload --port 8001"
)
cd ..

echo [2/3] Launching Web Frontend (Port 3000)...
cd web
start "VeriCash Web" cmd /k "npm run dev"
cd ..

echo [3/3] Starting Internet Tunnel (vericash-inspector.loca.lt)...
start "VeriCash Tunnel" cmd /k "lt --port 8001 --subdomain vericash-inspector"

echo.
echo ----------------------------------------------------------------------
echo STARTUP COMMANDS ISSUED
echo ----------------------------------------------------------------------
echo.
echo Backend URL:   http://127.0.0.1:8001/docs
echo Frontend URL:  http://localhost:3000
echo Public URL:    https://vericash-inspector.loca.lt  (internet-accessible)
echo.
echo The APK is hardcoded to use the public URL above.
echo Any device in the world can use the app while this script is running.
echo.
echo Note: The backend may take a few seconds to pre-warm OCR models.
echo       Check the individual terminal windows for logs.
echo.
pause
