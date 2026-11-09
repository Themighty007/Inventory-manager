@echo off
title Antigravity Android Device Hub Launcher
cd /d "%~dp0\.."

echo ========================================================
echo   Antigravity Android Device Hub & Emulator Launcher
echo ========================================================
echo.

set "ANDROID_SDK_ROOT=C:\Android\sdk"
set "PATH=%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin;C:\Users\test\AppData\AndroidCLI;%PATH%"

echo Checking connected adb devices...
adb devices
echo.

echo Launching Antigravity Android Device Hub Sidecar...
echo You can view and control your mirrored Android device inside Antigravity!
echo Sidecar URL: sidecar://android-cli/device-hub
echo.

android sidecar run device-hub
pause
