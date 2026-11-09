@echo off
title Smart Electronics Inventory - FastAPI Backend (:8000)
cd /d "%~dp0\.."
echo [1/2] Activating Python virtual environment...
call .venv\Scripts\activate.bat
echo [2/2] Starting Uvicorn backend on 0.0.0.0:8000 (Local Wi-Fi Accessible)...
python backend\run_server.py
pause
