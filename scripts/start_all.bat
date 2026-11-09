@echo off
title Smart Electronics Inventory System
cd /d "%~dp0\.."

echo ========================================================
echo   Smart Electronics Inventory - Stanley 1-93-981 Manager
echo   Local-First FastAPI + Windows Dashboard + Android Hub
echo ========================================================

echo [1/3] Initializing and launching FastAPI Backend (:8000)...
start "FastAPI Backend (:8000)" cmd /k "call .venv\Scripts\activate.bat && python backend\run_server.py"

echo [2/3] Waiting for backend to bind...
timeout /t 3 /nobreak > nul

echo [3/3] Opening Dashboard in your browser...
start http://localhost:8000

echo.
echo ========================================================
echo  System is running live!
echo  - Windows Web Dashboard: http://localhost:8000
echo  - Backend API Docs:       http://localhost:8000/docs
echo  - Android Mobile Access:  http://^<your-laptop-ip^>:8000
echo ========================================================
echo.
pause
