@echo off
title Smart Electronics Inventory - FastAPI Backend (:8000)
cd /d "%~dp0\.."
echo Starting Uvicorn backend on 0.0.0.0:8000 (Local Wi-Fi Accessible)...
".venv\Scripts\python.exe" backend\run_server.py
pause
