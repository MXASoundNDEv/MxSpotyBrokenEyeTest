#!/bin/bash

# Script de déploiement spécifique pour brokeneye.space sur OVH
# Usage: ./scripts/deploy-brokeneye.sh

set -euo pipefail

echo "🚀 Déploiement de Blindtest sur brokeneye.space (OVH)..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Variables spécifiques à votre configuration
DOMAIN="brokeneye.space"
SERVER_IP="2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"
PROJECT_NAME="blindtest"
COMPOSE_FILE="docker-compose.yml"

# Vérifier qu'on est bien sur le bon serveur
log_step "1/8 Vérification de l'environnement..."
CURRENT_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "unknown")
if [[ "$CURRENT_IP" != "$SERVER_IP" ]]; then
    log_warn "⚠️  IP actuelle ($CURRENT_IP) différente de l'IP configurée ($SERVER_IP)"
    log_warn "Continuez-vous quand même ? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Déploiement annulé."
        exit 1
    fi
fi

# Vérifier que Podman est installé
log_step "2/8 Vérification de Podman..."
if ! command -v podman &> /dev/null; then
    log_error "Podman n'est pas installé. Lancez d'abord: ./scripts/install-ubuntu.sh"
    exit 1
fi

# Installer podman-compose si nécessaire
if ! command -v podman-compose &> /dev/null; then
    log_info "Installation de podman-compose..."
    pip3 install --user podman-compose
    export PATH="$PATH:$HOME/.local/bin"
fi

# Créer les répertoires nécessaires
log_step "3/8 Création des répertoires..."
mkdir -p data/{certbot,letsencrypt}
mkdir -p logs
sudo mkdir -p /var/log/blindtest
sudo chown $USER:$USER /var/log/blindtest

# Configuration du fichier .env
log_step "4/8 Configuration de l'environnement..."
if [[ ! -f .env ]]; then
    cp .env.production .env
    log_info "Fichier .env créé depuis .env.production"
fi

# Vérifier la résolution DNS
log_step "5/8 Vérification DNS..."
RESOLVED_IP=$(dig +short $DOMAIN | tail -n1)
if [[ "$RESOLVED_IP" == "$SERVER_IP" ]]; then
    log_info "✅ DNS correctement configuré: $DOMAIN -> $SERVER_IP"
else
    log_warn "⚠️  DNS: $DOMAIN résolu vers $RESOLVED_IP (attendu: $SERVER_IP)"
fi

# Test connectivité vers le domaine
if curl -s --connect-timeout 5 -I "http://$DOMAIN" > /dev/null 2>&1; then
    log_info "✅ Domaine $DOMAIN accessible"
else
    log_warn "⚠️  Domaine $DOMAIN non accessible pour le moment"
fi

# Arrêter les anciens conteneurs
log_step "6/8 Nettoyage des anciens déploiements..."
podman-compose -f $COMPOSE_FILE down --remove-orphans || true

# Nettoyer les anciennes images
podman system prune -f || true

# Construire et démarrer les services
log_step "7/8 Construction et démarrage..."
podman-compose -f $COMPOSE_FILE build --no-cache
podman-compose -f $COMPOSE_FILE up -d

# Attendre que les services soient prêts
log_info "Attente du démarrage des services..."
sleep 15

# Vérifier l'état des conteneurs
log_info "État des services:"
podman-compose -f $COMPOSE_FILE ps

# Tester la connectivité locale
log_step "8/8 Tests de connectivité..."
if curl -f -s http://localhost/health > /dev/null; then
    log_info "✅ Health check local réussi"
else
    log_warn "⚠️  Health check local échoué"
fi

# Test depuis l'extérieur si possible
if curl -f -s --connect-timeout 10 "http://$DOMAIN/health" > /dev/null 2>&1; then
    log_info "✅ Health check externe réussi: http://$DOMAIN/health"
else
    log_warn "⚠️  Health check externe échoué (normal avant SSL)"
fi

# Afficher les logs récents
log_info "Logs récents de l'application:"
podman-compose -f $COMPOSE_FILE logs --tail=10 app

echo ""
echo "🎉 Déploiement HTTP terminé avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Vérifiez que http://$DOMAIN/health fonctionne"
echo "2. Configurez SSL: ./scripts/setup-ssl-brokeneye.sh"
echo "3. Testez HTTPS: https://$DOMAIN/health"
echo ""
echo "🔧 Commandes utiles:"
echo "- Logs: podman-compose logs -f"
echo "- Status: podman-compose ps"
echo "- Maintenance: ./scripts/maintenance.sh status"
