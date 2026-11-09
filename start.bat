@echo off
title Smart Electronics Inventory Manager
echo ======================================================================
echo   STARTING SMART ELECTRONICS INVENTORY MANAGEMENT SYSTEM (PWA)
echo ======================================================================
echo.

REM 1. Check Python installation
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in your system PATH!
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

REM 2. Install requirements if needed
echo [INFO] Checking Python dependencies...
python -m pip install -q -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Failed to install dependencies via pip. Attempting to start anyway...
)

REM 3. Launch default browser to localhost after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

REM 4. Run the dual HTTP & HTTPS server
echo [INFO] Starting Dual HTTP and HTTPS Server...
python run_server.py

pause
