@echo off
echo Installing Server dependencies...
call npm install

echo.
echo Installing UI dependencies...
cd ui
call npm install

echo.
echo Building UI...
call npm run build
cd ..

echo.
echo Starting AI Auth Proxy with Cloudflare Tunnel...
call npm run dev:tunnel
pause
