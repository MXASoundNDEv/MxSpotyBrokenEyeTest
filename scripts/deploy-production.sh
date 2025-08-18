#!/bin/bash

# Script de déploiement pour Ubuntu 22 avec Podman
# Usage: ./scripts/deploy-production.sh

set -euo pipefail

echo "🚀 Démarrage du déploiement de production avec Podman..."

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

# Variables
PROJECT_NAME="blindtest"
COMPOSE_FILE="docker-compose.yml"

# Vérifier que Podman est installé
if ! command -v podman &> /dev/null; then
    log_error "Podman n'est pas installé. Installation..."
    sudo apt update
    sudo apt install -y podman podman-compose
fi

# Vérifier que podman-compose est disponible
if ! command -v podman-compose &> /dev/null; then
    log_error "podman-compose n'est pas installé. Installation..."
    pip3 install podman-compose
fi

# Créer les répertoires nécessaires
log_info "Création des répertoires..."
mkdir -p data/{certbot,letsencrypt}
mkdir -p logs

# Vérifier le fichier .env
if [[ ! -f .env ]]; then
    if [[ -f .env.production ]]; then
        log_warn "Copie de .env.production vers .env"
        cp .env.production .env
    else
        log_error "Fichier .env manquant. Copiez .env.example et configurez-le."
        exit 1
    fi
fi

# Vérifier les variables critiques
source .env
required_vars=("SPOTIFY_CLIENT_ID" "SPOTIFY_CLIENT_SECRET" "DOMAIN" "EMAIL")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        log_error "Variable $var manquante dans .env"
        exit 1
    fi
done

# Remplacer le placeholder du domaine dans nginx
log_info "Configuration de Nginx pour le domaine: $DOMAIN"
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/conf.d/app.conf

# Arrêter les anciens conteneurs
log_info "Arrêt des anciens conteneurs..."
podman-compose -f $COMPOSE_FILE down --remove-orphans || true

# Nettoyer les anciennes images
log_info "Nettoyage des anciennes images..."
podman image prune -f || true

# Construire et démarrer
log_info "Construction et démarrage des services..."
podman-compose -f $COMPOSE_FILE build --no-cache
podman-compose -f $COMPOSE_FILE up -d

# Attendre que les services soient prêts
log_info "Attente du démarrage des services..."
sleep 10

# Vérifier l'état des conteneurs
log_info "Vérification de l'état des services..."
podman-compose -f $COMPOSE_FILE ps

# Tester la connectivité
log_info "Test de connectivité..."
if curl -f -s http://localhost/health > /dev/null; then
    log_info "✅ Application démarrée avec succès!"
else
    log_warn "⚠️  Application peut-être pas encore prête. Vérifiez les logs:"
    echo "podman-compose logs app"
fi

# Afficher les logs récents
log_info "Logs récents:"
podman-compose -f $COMPOSE_FILE logs --tail=20

# Instructions SSL
log_warn "📋 Étapes suivantes pour SSL:"
echo "1. Vérifiez que votre domaine $DOMAIN pointe vers ce serveur"
echo "2. Lancez: ./scripts/setup-ssl.sh"
echo "3. Redémarrez nginx: podman-compose restart nginx"

log_info "🎉 Déploiement terminé!"
