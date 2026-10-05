Write-Host "Installing Server dependencies..." -ForegroundColor Cyan
npm install

Write-Host "`nInstalling UI dependencies..." -ForegroundColor Cyan
Push-Location ui
npm install

Write-Host "`nBuilding UI..." -ForegroundColor Cyan
npm run build
Pop-Location

Write-Host "`nStarting AI Auth Proxy with Cloudflare Tunnel..." -ForegroundColor Cyan
npm run dev:tunnel
