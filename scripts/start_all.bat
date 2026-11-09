@echo off
title Smart Electronics Inventory System
cd /d "%~dp0\.."

echo ========================================================
echo   Smart Electronics Inventory - Stanley 1-93-981 Manager
echo   Local-First FastAPI + Windows Dashboard + Android Hub
echo ========================================================

echo [1/2] Launching FastAPI Backend on http://localhost:8000...
start "FastAPI Backend (:8000)" cmd /k "cd /d ""%~dp0\.."" && "".venv\Scripts\python.exe"" backend\run_server.py"

echo [2/2] Waiting for server to initialize...
timeout /t 3 /nobreak > nul

echo Opening Dashboard in your browser...
start http://localhost:8000

echo.
echo ========================================================
echo  System is running live!
echo  - Windows Web Dashboard: http://localhost:8000
echo  - Backend API Docs:       http://localhost:8000/docs
echo ========================================================
echo.
pause
