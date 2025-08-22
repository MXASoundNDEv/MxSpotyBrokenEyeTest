#!/bin/bash

# Script de configuration SSL avec Let's Encrypt
# Usage: ./scripts/setup-ssl.sh

set -euo pipefail

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier le fichier .env
if [[ ! -f .env ]]; then
    log_error "Fichier .env manquant"
    exit 1
fi

source .env

# Vérifier les variables nécessaires
if [[ -z "${DOMAIN:-}" ]] || [[ -z "${EMAIL:-}" ]]; then
    log_error "DOMAIN et EMAIL doivent être définis dans .env"
    exit 1
fi

log_info "Configuration SSL pour le domaine: $DOMAIN"

# Créer les répertoires
mkdir -p data/{certbot,letsencrypt}

# Obtenir le certificat SSL initial
log_info "Demande du certificat SSL..."
podman run --rm \
    --name certbot \
    -v "./data/certbot:/etc/letsencrypt:Z" \
    -v "./data/letsencrypt:/var/www/certbot:Z" \
    certbot/certbot:latest \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    --domains "$DOMAIN"

if [[ $? -eq 0 ]]; then
    log_info "✅ Certificat SSL obtenu avec succès!"
    
    # Redémarrer nginx pour charger le certificat
    log_info "Redémarrage de nginx..."
    podman-compose restart nginx
    
    log_info "🔒 SSL configuré avec succès pour $DOMAIN"
else
    log_error "❌ Échec de l'obtention du certificat SSL"
    log_warn "Vérifiez que:"
    echo "- Le domaine $DOMAIN pointe vers ce serveur"
    echo "- Le port 80 est ouvert et accessible"
    echo "- Nginx fonctionne correctement"
    exit 1
fi
