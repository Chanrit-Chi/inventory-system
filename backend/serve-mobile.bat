@echo off
title KC Inventory Backend Tunnel Launcher
echo.
echo  ================================================
echo   KC Inventory - Ngrok Tunnel (Laravel Herd)
echo   URL: https://casket-karaoke-playhouse.ngrok-free.dev
echo  ================================================
echo.

cd /d "%~dp0"

echo Starting Ngrok Tunnel forwarding to Herd (backend.test:80)...
ngrok http --domain=casket-karaoke-playhouse.ngrok-free.dev --host-header=backend.test 80
