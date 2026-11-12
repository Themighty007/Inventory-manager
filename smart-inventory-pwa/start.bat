@echo off
title SKR Tech's Inventory System
echo ======================================================================
echo   STARTING SKR TECH'S INVENTORY SYSTEM (PWA)
echo   Hardware Innovations - Stanley 39-Compartment Storage
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

REM 3. Ensure Windows Firewall permits incoming LAN connections on ports 8000 & 8443
netsh advfirewall firewall show rule name="SKR Tech Inventory System (HTTP 8000)" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="SKR Tech Inventory System (HTTP 8000)" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>nul
    netsh advfirewall firewall add rule name="SKR Tech Inventory System (HTTPS 8443)" dir=in action=allow protocol=TCP localport=8443 profile=any >nul 2>nul
)

REM 4. Launch default browser to localhost after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

REM 5. Run the dual HTTP & HTTPS server
echo [INFO] Starting SKR Tech Dual HTTP & HTTPS Server...
python run_server.py

pause
