#!/bin/bash

# Script de vérification pré-déploiement
# Usage: ./scripts/verify-production.sh

set -euo pipefail

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

ERRORS=0

check_file() {
    local file="$1"
    local desc="$2"
    
    if [[ -f "$file" ]]; then
        log_success "✅ $desc: $file"
    else
        log_error "❌ $desc manquant: $file"
        ((ERRORS++))
    fi
}

check_directory() {
    local dir="$1"
    local desc="$2"
    
    if [[ -d "$dir" ]]; then
        log_success "✅ $desc: $dir"
    else
        log_error "❌ $desc manquant: $dir"
        ((ERRORS++))
    fi
}

check_executable() {
    local file="$1"
    local desc="$2"
    
    if [[ -x "$file" ]]; then
        log_success "✅ $desc exécutable: $file"
    else
        log_error "❌ $desc non exécutable: $file"
        ((ERRORS++))
    fi
}

echo "🔍 Vérification de la configuration de production..."
echo ""

# Vérifier les fichiers essentiels
log_info "Vérification des fichiers de configuration..."
check_file "docker-compose.yml" "Docker Compose"
check_file "Dockerfile" "Dockerfile"
check_file "package.json" "Package.json"
check_file ".env.production" "Exemple d'environnement production"
check_file "nginx/conf.d/app.conf" "Configuration Nginx"

echo ""

# Vérifier les répertoires
log_info "Vérification des répertoires..."
check_directory "scripts" "Scripts de déploiement"
check_directory "nginx" "Configuration Nginx"
check_directory "src" "Code source"

echo ""

# Vérifier les scripts
log_info "Vérification des scripts..."
check_executable "scripts/deploy-production.sh" "Script de déploiement"
check_executable "scripts/setup-ssl.sh" "Script SSL"
check_executable "scripts/maintenance.sh" "Script de maintenance"

echo ""

# Vérifier le fichier .env
log_info "Vérification du fichier .env..."
if [[ -f ".env" ]]; then
    source .env
    
    # Variables critiques
    vars=("SPOTIFY_CLIENT_ID" "SPOTIFY_CLIENT_SECRET" "DOMAIN" "EMAIL")
    for var in "${vars[@]}"; do
        if [[ -n "${!var:-}" ]] && [[ "${!var}" != "your_"* ]] && [[ "${!var}" != "yourdomain.com" ]]; then
            log_success "✅ Variable $var configurée"
        else
            log_error "❌ Variable $var non configurée ou utilise une valeur par défaut"
            ((ERRORS++))
        fi
    done
else
    log_warn "⚠️  Fichier .env manquant. Il sera créé depuis .env.production lors du déploiement"
fi

echo ""

# Vérifier la configuration Nginx
log_info "Vérification de la configuration Nginx..."
if grep -q "DOMAIN_PLACEHOLDER" nginx/conf.d/app.conf 2>/dev/null; then
    log_warn "⚠️  Placeholder du domaine détecté dans nginx/conf.d/app.conf (sera remplacé automatiquement)"
else
    log_success "✅ Configuration Nginx semble correcte"
fi

echo ""

# Vérifier les dépendances système
log_info "Vérification des dépendances système..."

if command -v podman &> /dev/null; then
    log_success "✅ Podman installé: $(podman --version)"
else
    log_error "❌ Podman non installé"
    ((ERRORS++))
fi

if command -v podman-compose &> /dev/null; then
    log_success "✅ Podman-compose disponible"
else
    log_warn "⚠️  Podman-compose non trouvé. Il sera installé automatiquement"
fi

if command -v curl &> /dev/null; then
    log_success "✅ Curl installé"
else
    log_warn "⚠️  Curl non installé. Il sera installé automatiquement"
fi

echo ""

# Vérifier la syntaxe du docker-compose
log_info "Vérification de la syntaxe docker-compose..."
if podman-compose config &>/dev/null || docker-compose config &>/dev/null; then
    log_success "✅ Docker-compose.yml syntaxiquement correct"
else
    log_error "❌ Erreur de syntaxe dans docker-compose.yml"
    ((ERRORS++))
fi

echo ""

# Test de build (optionnel)
if [[ "${1:-}" == "--test-build" ]]; then
    log_info "Test de build de l'image..."
    if podman build -t blindtest-test . &>/dev/null; then
        log_success "✅ Build de l'image réussie"
        podman rmi blindtest-test &>/dev/null || true
    else
        log_error "❌ Échec du build de l'image"
        ((ERRORS++))
    fi
fi

echo ""

# Résumé final
if [[ $ERRORS -eq 0 ]]; then
    log_success "🎉 Toutes les vérifications sont passées!"
    log_info "Prêt pour le déploiement:"
    echo "  1. Configurez le fichier .env avec vos vraies valeurs"
    echo "  2. Lancez: ./scripts/deploy-production.sh"
    echo "  3. Configurez SSL: ./scripts/setup-ssl.sh"
    exit 0
else
    log_error "❌ $ERRORS erreur(s) détectée(s). Corrigez-les avant le déploiement."
    exit 1
fi
