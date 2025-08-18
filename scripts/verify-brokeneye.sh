#!/bin/bash

# Script de vérification pré-déploiement pour brokeneye.space
# Usage: ./scripts/verify-brokeneye.sh

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
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

ERRORS=0
WARNINGS=0
DOMAIN="brokeneye.space"
SERVER_IP="2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"

echo "🔍 Vérification pré-déploiement pour brokeneye.space"
echo "=================================================="

# Vérifier l'IP du serveur
log_step "1/8 Vérification de l'IP serveur..."
CURRENT_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || curl -s --connect-timeout 5 icanhazip.com 2>/dev/null || echo "unknown")
if [[ "$CURRENT_IP" == "$SERVER_IP" ]]; then
    log_success "✅ IP serveur correcte: $CURRENT_IP"
else
    log_warn "⚠️  IP actuelle: $CURRENT_IP (attendue: $SERVER_IP)"
    ((WARNINGS++))
fi

# Vérifier la résolution DNS
log_step "2/8 Vérification DNS..."
RESOLVED_IP=$(dig +short $DOMAIN 2>/dev/null | tail -n1 || echo "")
WWW_RESOLVED_IP=$(dig +short www.$DOMAIN 2>/dev/null | tail -n1 || echo "")

if [[ "$RESOLVED_IP" == "$SERVER_IP" ]]; then
    log_success "✅ DNS $DOMAIN -> $SERVER_IP"
else
    log_error "❌ DNS $DOMAIN -> $RESOLVED_IP (attendu: $SERVER_IP)"
    ((ERRORS++))
fi

if [[ "$WWW_RESOLVED_IP" == "$SERVER_IP" ]]; then
    log_success "✅ DNS www.$DOMAIN -> $SERVER_IP"
else
    log_error "❌ DNS www.$DOMAIN -> $WWW_RESOLVED_IP (attendu: $SERVER_IP)"
    ((ERRORS++))
fi

# Vérifier les ports
log_step "3/8 Vérification des ports..."
if netstat -tuln 2>/dev/null | grep -q ":80 " || ss -tuln 2>/dev/null | grep -q ":80 "; then
    log_warn "⚠️  Port 80 déjà utilisé"
    ((WARNINGS++))
else
    log_success "✅ Port 80 disponible"
fi

if netstat -tuln 2>/dev/null | grep -q ":443 " || ss -tuln 2>/dev/null | grep -q ":443 "; then
    log_warn "⚠️  Port 443 déjà utilisé"
    ((WARNINGS++))
else
    log_success "✅ Port 443 disponible"
fi

# Vérifier Podman
log_step "4/8 Vérification de Podman..."
if command -v podman &> /dev/null; then
    PODMAN_VERSION=$(podman --version)
    log_success "✅ $PODMAN_VERSION"
else
    log_error "❌ Podman non installé"
    ((ERRORS++))
fi

if command -v podman-compose &> /dev/null; then
    log_success "✅ podman-compose disponible"
elif python3 -m pip show podman-compose &>/dev/null; then
    log_success "✅ podman-compose installé via pip"
else
    log_warn "⚠️  podman-compose sera installé automatiquement"
    ((WARNINGS++))
fi

# Vérifier les fichiers de configuration
log_step "5/8 Vérification des fichiers..."
files=(
    "docker-compose.yml:Docker Compose"
    "Dockerfile:Dockerfile"
    "nginx/conf.d/app.conf:Configuration Nginx"
    ".env.production:Variables d'environnement"
)

for file_desc in "${files[@]}"; do
    file="${file_desc%%:*}"
    desc="${file_desc##*:}"
    
    if [[ -f "$file" ]]; then
        log_success "✅ $desc: $file"
    else
        log_error "❌ $desc manquant: $file"
        ((ERRORS++))
    fi
done

# Vérifier la configuration Nginx
log_step "6/8 Vérification configuration Nginx..."
if grep -q "brokeneye.space" nginx/conf.d/app.conf; then
    log_success "✅ Configuration Nginx pour brokeneye.space"
else
    log_error "❌ Configuration Nginx non mise à jour pour brokeneye.space"
    ((ERRORS++))
fi

# Tester la syntaxe YAML
log_step "7/8 Validation docker-compose.yml..."
if python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" 2>/dev/null; then
    log_success "✅ docker-compose.yml syntaxiquement correct"
else
    log_error "❌ Erreur de syntaxe dans docker-compose.yml"
    ((ERRORS++))
fi

# Vérifier l'espace disque
log_step "8/8 Vérification de l'espace disque..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [[ $DISK_USAGE -lt 80 ]]; then
    log_success "✅ Espace disque suffisant (${DISK_USAGE}% utilisé)"
else
    log_warn "⚠️  Espace disque faible (${DISK_USAGE}% utilisé)"
    ((WARNINGS++))
fi

echo ""
echo "=================================================="

# Résumé final
if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
        log_success "🎉 Toutes les vérifications sont passées!"
        echo ""
        echo "🚀 Prêt pour le déploiement:"
        echo "  1. Configurez vos clés Spotify dans .env"
        echo "  2. Lancez: ./scripts/deploy-brokeneye.sh"
        echo "  3. Configurez SSL: ./scripts/setup-ssl-brokeneye.sh"
    else
        log_warn "⚠️  $WARNINGS avertissement(s) détecté(s), mais le déploiement peut continuer"
        echo ""
        echo "🚀 Vous pouvez procéder au déploiement:"
        echo "  1. Configurez vos clés Spotify dans .env"
        echo "  2. Lancez: ./scripts/deploy-brokeneye.sh"
        echo "  3. Configurez SSL: ./scripts/setup-ssl-brokeneye.sh"
    fi
else
    log_error "❌ $ERRORS erreur(s) critique(s) détectée(s)"
    if [[ $WARNINGS -gt 0 ]]; then
        log_warn "⚠️  Et $WARNINGS avertissement(s)"
    fi
    echo ""
    echo "🔧 Corrigez les erreurs avant le déploiement"
    exit 1
fi

echo ""
echo "📋 Récapitulatif de la configuration:"
echo "  - Domaine principal: $DOMAIN"
echo "  - Domaine www: www.$DOMAIN"
echo "  - IP cible: $SERVER_IP"
echo "  - IP actuelle: $CURRENT_IP"
echo "  - Application: Blindtest Spotify"
echo "  - Stack: Node.js + Nginx + Podman"
