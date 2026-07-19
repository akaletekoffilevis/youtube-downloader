@echo off
:: YouTube Downloader - Installateur Windows (CMD)
:: Auteur: Koffi Levis Akalete
:: Utilisation: telechargez et double-cliquez ce fichier .bat

echo.
echo   YouTube Downloader - Installation
echo   Auteur: Koffi Levis Akalete
echo.

set REPO=akaletekoffilevis/youtube-downloader
set INSTALL_DIR=%LOCALAPPDATA%\YouTubeDownloader

echo [1/4] Recuperation de la derniere version...
curl -sL "https://api.github.com/repos/%REPO%/releases/latest" > %TEMP%\release.json
for /f "tokens=2 delims=:," %%a in ('findstr "tag_name" %TEMP%\release.json') do set VERSION=%%~a
set VERSION=%VERSION: =%
set VERSION=%VERSION:"=%
set VERSION=%VERSION:v=%
echo   Version: %VERSION%

echo [2/4] Telechargement...
curl -sL "https://github.com/%REPO%/releases/download/v%VERSION%/YouTube-Downloader_%VERSION%_x64-setup.exe" -o %TEMP%\YTDownloader.exe
if not exist %TEMP%\YTDownloader.exe (
    echo   Fichier principal non trouvé, tentative alternative...
    curl -sL "https://github.com/%REPO%/releases/download/v%VERSION%/" -o %TEMP%\page.html
    echo   Telechargez manuellement depuis:
    echo   https://github.com/%REPO%/releases
    pause
    exit /b 1
)

echo [3/4] Installation...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
move /Y %TEMP%\YTDownloader.exe "%INSTALL_DIR%\YouTube Downloader.exe"

echo [4/4] Raccourci Bureau...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\YouTube Downloader.lnk'); $s.TargetPath='%INSTALL_DIR%\YouTube Downloader.exe'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Description='YouTube Downloader - Koffi Levis Akalete'; $s.Save()"

echo.
echo   Installation terminee!
echo   Lancez YouTube Downloader depuis le Bureau.
echo.
pause
