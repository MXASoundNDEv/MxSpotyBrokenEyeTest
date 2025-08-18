#!/bin/bash

# Script d'installation Ubuntu 22.04 pour Blindtest avec Podman
# Usage: curl -fsSL https://raw.githubusercontent.com/votre-repo/blindtest/main/scripts/install-ubuntu.sh | bash
# ou: ./scripts/install-ubuntu.sh

set -euo pipefail

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Vérifier qu'on est sur Ubuntu 22
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release || ! grep -q "22\." /etc/os-release; then
    log_error "Ce script est conçu pour Ubuntu 22.04 LTS"
    exit 1
fi

log_info "🚀 Installation de Blindtest sur Ubuntu 22.04 avec Podman"
echo ""

# Mise à jour du système
log_step "1/6 Mise à jour du système..."
sudo apt update
sudo apt upgrade -y

# Installation des outils de base
log_step "2/6 Installation des outils de base..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Installation de Podman
log_step "3/6 Installation de Podman..."
sudo apt install -y podman podman-compose

# Alternative si podman-compose n'est pas disponible
if ! command -v podman-compose &> /dev/null; then
    log_warn "Installation de podman-compose via pip..."
    sudo apt install -y python3-pip
    pip3 install podman-compose
    echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc
    export PATH=$PATH:$HOME/.local/bin
fi

# Configuration de Podman pour les utilisateurs non-root
log_step "4/6 Configuration de Podman..."
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $USER
podman system migrate || true

# Installation d'outils de monitoring (optionnel)
log_step "5/6 Installation d'outils supplémentaires..."
sudo apt install -y \
    htop \
    iotop \
    netstat-ss \
    certbot \
    logrotate

# Configuration du firewall de base
log_step "6/6 Configuration du firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    log_info "Firewall configuré (SSH, HTTP, HTTPS autorisés)"
else
    log_warn "UFW non disponible, configurez votre firewall manuellement"
fi

# Créer les répertoires de base
log_info "Création des répertoires système..."
sudo mkdir -p /var/backups/blindtest
sudo mkdir -p /var/log/blindtest
sudo chown $USER:$USER /var/log/blindtest

# Message de fin
echo ""
log_info "✅ Installation système terminée!"
echo ""
echo "Prochaines étapes:"
echo "1. Redémarrez votre session ou lancez: newgrp $(id -gn)"
echo "2. Clonez votre projet: git clone <votre-repo>"
echo "3. Configurez le fichier .env"
echo "4. Lancez: ./scripts/deploy-production.sh"
echo ""
echo "Vérification de l'installation:"
echo "- Podman: $(podman --version)"
echo "- Podman-compose: $(podman-compose --version 2>/dev/null || echo 'Via pip3')"
echo ""

# Test rapide de Podman
log_info "Test de Podman..."
if podman run --rm alpine:latest echo "Podman fonctionne correctement"; then
    log_info "✅ Podman opérationnel"
else
    log_warn "⚠️  Podman installé mais problème de configuration. Redémarrez votre session."
fi

echo ""
log_info "🎉 Système prêt pour le déploiement de Blindtest!"
