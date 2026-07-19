# YT Downloader - Installateur Windows (PowerShell)
# Auteur: Koffi Levis Akalete
# Utilisation: iex (irm https://raw.githubusercontent.com/akaletekoffilevis/youtube-downloader/main/scripts/install.ps1)

$ErrorActionPreference = "Stop"
$REPO = "akaletekoffilevis/youtube-downloader"
$INSTALL_DIR = "$env:LOCALAPPDATA\YTDownloader"
$APP_EXE = "$INSTALL_DIR\YTDownloader.exe"

Write-Host ""
Write-Host "  YT Downloader - Installation" -ForegroundColor Cyan
Write-Host "  Auteur: Koffi Levis Akalete" -ForegroundColor Gray
Write-Host ""

# Recuperer la derniere version
Write-Host "[1/4] Recuperation de la derniere version..." -ForegroundColor Yellow
$headers = @{ "Accept" = "application/vnd.github.v3+json" }
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest" -Headers $headers
$version = $release.tag_name -replace "^v", ""
$asset = $release.assets | Where-Object { $_.name -match "\.exe$" } | Select-Object -First 1

if (-not $asset) {
    Write-Host "ERREUR: Aucun fichier .exe trouve dans la release $version" -ForegroundColor Red
    exit 1
}

Write-Host "  Version: $version" -ForegroundColor Green
Write-Host "  Fichier: $($asset.name)" -ForegroundColor Gray

# Telecharger
Write-Host "[2/4] Telechargement..." -ForegroundColor Yellow
$dlUrl = $asset.browser_download_url
$exePath = "$env:TEMP\YTDownloaderSetup.exe"
Invoke-WebRequest -Uri $dlUrl -OutFile $exePath -UseBasicParsing
Write-Host "  Telecharge: $exePath" -ForegroundColor Green

# Installer
Write-Host "[3/4] Installation dans $INSTALL_DIR..." -ForegroundColor Yellow
if (-not (Test-Path $INSTALL_DIR)) { New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null }
Copy-Item $exePath "$INSTALL_DIR\YTDownloader.exe" -Force
Remove-Item $exePath -Force
Write-Host "  Installe!" -ForegroundColor Green

# Creer raccourci bureau
Write-Host "[4/4] Creation du raccourci Bureau..." -ForegroundColor Yellow
$shortcutPath = "$env:USERPROFILE\Desktop\YT Downloader.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $APP_EXE
$shortcut.WorkingDirectory = $INSTALL_DIR
$shortcut.Description = "YT Downloader - Koffi Levis Akalete"
$shortcut.Save()
Write-Host "  Raccourci cree sur le Bureau!" -ForegroundColor Green

Write-Host ""
Write-Host "  Installation terminee!" -ForegroundColor Green
Write-Host "  Version: $version | Repertoire: $INSTALL_DIR" -ForegroundColor Gray
Write-Host "  Lancez YT Downloader depuis le Bureau ou le Menu Demarrer." -ForegroundColor Gray
Write-Host ""

# Proposer de lancer
$launch = Read-Host "  Lancer maintenant ? (O/N)"
if ($launch -eq "O" -or $launch -eq "o") {
    Start-Process $APP_EXE
}
