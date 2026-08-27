@echo off
title KC Inventory Dev Launcher (Laravel Herd + Ngrok + Expo)
echo.
echo  =======================================================
echo        KC Inventory - Full Dev Environment
echo  =======================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Ngrok Tunnel for Laravel Herd (backend.test)...
start "Ngrok Tunnel" cmd /k "ngrok http --domain=casket-karaoke-playhouse.ngrok-free.dev --host-header=backend.test 80"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend Expo Server...
start "Frontend Mobile (Expo)" cmd /k "cd /d "%~dp0frontend\mobile" && npx expo start -c"

echo.
echo  =======================================================
echo   All services launched!
echo   - Backend (Herd): http://backend.test (port 80)
echo   - Tunnel:         https://casket-karaoke-playhouse.ngrok-free.dev
echo   - Frontend:       Expo running in separate window
echo  =======================================================
echo.
pause
