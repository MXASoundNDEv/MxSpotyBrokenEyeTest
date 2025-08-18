#!/bin/bash

# Script de déploiement à distance pour brokeneye.space
# Usage: ./scripts/remote-deploy.sh [user@server]
# Exemple: ./scripts/remote-deploy.sh root@2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4

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

# Configuration
SERVER="${1:-root@2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4}"
REMOTE_DIR="/opt/blindtest"
DOMAIN="brokeneye.space"

echo "🚀 Déploiement à distance de Blindtest"
echo "Serveur: $SERVER"
echo "Domaine: $DOMAIN"
echo "========================================"

# Vérifier la connectivité SSH
log_step "1/6 Test de connectivité SSH..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" "echo 'SSH OK'" 2>/dev/null; then
    log_info "✅ Connexion SSH établie"
else
    log_error "❌ Impossible de se connecter via SSH"
    log_error "Vérifiez:"
    echo "  - La clé SSH est configurée"
    echo "  - L'utilisateur a les droits sudo"
    echo "  - L'adresse IP est correcte"
    exit 1
fi

# Créer le répertoire et transférer les fichiers
log_step "2/6 Transfer des fichiers..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Exclure les fichiers non nécessaires
rsync -avz --progress \
    --exclude=".git/" \
    --exclude="node_modules/" \
    --exclude="data/" \
    --exclude="logs/" \
    --exclude="*.log" \
    ./ "$SERVER:$REMOTE_DIR/"

log_info "✅ Fichiers transférés"

# Installation des dépendances système
log_step "3/6 Installation des dépendances..."
ssh "$SERVER" "cd $REMOTE_DIR && chmod +x scripts/*.sh && ./scripts/install-ubuntu.sh" || log_warn "Installation peut nécessiter une intervention manuelle"

# Configuration de l'environnement
log_step "4/6 Configuration de l'environnement..."
ssh "$SERVER" "cd $REMOTE_DIR && cp .env.production .env"

log_warn "⚠️  Configurez maintenant vos clés Spotify sur le serveur:"
echo "ssh $SERVER"
echo "cd $REMOTE_DIR"
echo "nano .env"
echo ""
echo "Appuyez sur Entrée quand c'est fait..."
read -r

# Vérification pré-déploiement
log_step "5/6 Vérification de la configuration..."
if ssh "$SERVER" "cd $REMOTE_DIR && ./scripts/verify-brokeneye.sh"; then
    log_info "✅ Configuration validée"
else
    log_error "❌ Erreurs de configuration détectées"
    log_warn "Corrigez les erreurs sur le serveur avant de continuer"
    exit 1
fi

# Déploiement
log_step "6/6 Déploiement de l'application..."
ssh "$SERVER" "cd $REMOTE_DIR && ./scripts/deploy-brokeneye.sh"

echo ""
echo "🎉 Déploiement terminé!"
echo ""
echo "📋 Étapes suivantes:"
echo "1. Testez: http://$DOMAIN/health"
echo "2. Configurez SSL:"
echo "   ssh $SERVER"
echo "   cd $REMOTE_DIR" 
echo "   ./scripts/setup-ssl-brokeneye.sh"
echo "3. Testez: https://$DOMAIN"
echo ""
echo "🔧 Maintenance à distance:"
echo "   ssh $SERVER 'cd $REMOTE_DIR && ./scripts/maintenance.sh status'"
