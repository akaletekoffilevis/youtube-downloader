#!/bin/bash
# YouTube Downloader - Installateur Linux/macOS
# Auteur: Koffi Levis Akalete
# Utilisation: curl -fsSL https://raw.githubusercontent.com/akaletekoffilevis/youtube-downloader/main/scripts/install.sh | bash

set -e
REPO="akaletekoffilevis/youtube-downloader"
INSTALL_DIR="$HOME/.local/bin"
APP_NAME="youtube-downloader"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  YouTube Downloader - Installation${NC}"
echo -e "${GRAY}  Auteur: Koffi Levis Akalete${NC}"
echo ""

# Detecter l'OS
detect_platform() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"
    case "$os" in
        Linux)
            case "$arch" in
                x86_64|amd64)  echo "linux-x64" ;;
                i*86)          echo "linux-x86" ;;
                aarch64|arm64) echo "linux-arm64" ;;
                *)             echo "linux-x64" ;;
            esac
            ;;
        Darwin)
            case "$arch" in
                arm64) echo "macos-arm64" ;;
                *)     echo "macos-x64" ;;
            esac
            ;;
        *)
            echo "unsupported"
            ;;
    esac
}

PLATFORM=$(detect_platform)
if [ "$PLATFORM" = "unsupported" ]; then
    echo -e "${RED}  ERREUR: OS non supporte${NC}"
    exit 1
fi
echo -e "${YELLOW}[1/4] Plateforme detectee: $PLATFORM${NC}"

# Recuperer la derniere version
echo -e "${YELLOW}[2/4] Recuperation de la derniere version...${NC}"
LATEST_URL="https://api.github.com/repos/$REPO/releases/latest"
RELEASE_INFO=$(curl -sL "$LATEST_URL")

VERSION=$(echo "$RELEASE_INFO" | grep -o '"tag_name":"[^"]*"' | head -1 | cut -d'"' -f4)
VERSION="${VERSION#v}"
echo -e "  Version: ${GREEN}$VERSION${NC}"

# Trouver le bon asset
case "$PLATFORM" in
    linux-x64)  ASSET_PATTERN="linux-x64" ;;
    linux-x86)  ASSET_PATTERN="linux-x64" ;;
    linux-arm64) ASSET_PATTERN="linux-arm64" ;;
    macos-arm64) ASSET_PATTERN="macos-arm64" ;;
    macos-x64)  ASSET_PATTERN="macos-x64" ;;
esac

ASSET_URL=$(echo "$RELEASE_INFO" | grep -o "\"browser_download_url\":\"[^\"]*$ASSET_PATTERN[^\"]*\"" | head -1 | cut -d'"' -f4)
if [ -z "$ASSET_URL" ]; then
    # Fallback: telecharger depuis GitHub Releases
    ASSET_URL="https://github.com/$REPO/releases/download/v$VERSION"
    echo -e "${RED}  ERREUR: Aucun asset trouve pour $PLATFORM${NC}"
    echo -e "  Telechargez manuellement depuis: https://github.com/$REPO/releases"
    exit 1
fi

# Telecharger et extraire
echo -e "${YELLOW}[3/4] Telechargement...${NC}"
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

if [[ "$ASSET_URL" == *.tar.gz ]]; then
    curl -sL "$ASSET_URL" -o archive.tar.gz
    tar -xzf archive.tar.gz
    chmod +x youtube-downloader 2>/dev/null || true
    BIN_FILE=$(find . -name "youtube-downloader*" -type f | head -1)
elif [[ "$ASSET_URL" == *.deb ]]; then
    curl -sL "$ASSET_URL" -o package.deb
    if command -v dpkg &>/dev/null; then
        echo -e "${YELLOW}  Installation du paquet .deb (necessite sudo)...${NC}"
        sudo dpkg -i package.deb
        echo -e "${GREEN}  Installe via apt/dpkg!${NC}"
        rm -rf "$TMP_DIR"
        echo ""
        echo -e "${GREEN}  Installation terminee!${NC}"
        echo -e "  Version: $VERSION"
        echo -e "  Lancez: youtube-downloader"
        exit 0
    fi
elif [[ "$ASSET_URL" == *.AppImage ]]; then
    curl -sL "$ASSET_URL" -o YouTubeDownloader.AppImage
    chmod +x YouTubeDownloader.AppImage
    BIN_FILE="YouTubeDownloader.AppImage"
else
    curl -sL "$ASSET_URL" -o archive
    chmod +x archive
    BIN_FILE="archive"
fi

# Installer
mkdir -p "$INSTALL_DIR"
if [ -n "$BIN_FILE" ]; then
    mv "$BIN_FILE" "$INSTALL_DIR/$APP_NAME"
fi
chmod +x "$INSTALL_DIR/$APP_NAME"
rm -rf "$TMP_DIR"

# Ajouter au PATH si necessement
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    SHELL_RC=""
    if [ -f "$HOME/.bashrc" ]; then SHELL_RC="$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then SHELL_RC="$HOME/.zshrc"
    fi
    if [ -n "$SHELL_RC" ]; then
        if ! grep -q "$INSTALL_DIR" "$SHELL_RC" 2>/dev/null; then
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_RC"
            echo -e "  PATH mis a jour dans $SHELL_RC"
        fi
    fi
fi

echo -e "${YELLOW}[4/4] Verification...${NC}"

echo ""
echo -e "${GREEN}  Installation terminee!${NC}"
echo -e "  Version: ${GREEN}$VERSION${NC} | Repertoire: $INSTALL_DIR"
echo -e "  Lancez: ${CYAN}$APP_NAME${NC}"
echo ""
