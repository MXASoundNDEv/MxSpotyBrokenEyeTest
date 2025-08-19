#!/bin/bash

# Script de maintenance consolidé pour BrokenEye.Space
# Usage: ./scripts/maintenance.sh {status|logs|restart|update|backup|cleanup}

set -euo pipefail

# Configuration
DOMAIN="brokeneye.space"
PUBLIC_IPV4="82.66.66.208"
BACKUP_DIR="/var/backups/blindtest"

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

show_status() {
    log_info "État des services:"
    podman-compose -f $COMPOSE_FILE ps
    
    echo ""
    log_info "Utilisation des ressources:"
    podman stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" || true
    
    echo ""
    log_info "Espace disque:"
    df -h /
    
    echo ""
    log_info "Logs d'erreur récents:"
    podman-compose -f $COMPOSE_FILE logs --tail=10 | grep -i error || echo "Aucune erreur récente"
}

show_logs() {
    local service="${1:-}"
    if [[ -n "$service" ]]; then
        podman-compose -f $COMPOSE_FILE logs -f "$service"
    else
        podman-compose -f $COMPOSE_FILE logs -f
    fi
}

restart_services() {
    local service="${1:-}"
    if [[ -n "$service" ]]; then
        log_info "Redémarrage du service: $service"
        podman-compose -f $COMPOSE_FILE restart "$service"
    else
        log_info "Redémarrage de tous les services..."
        podman-compose -f $COMPOSE_FILE restart
    fi
}

backup_data() {
    log_info "Sauvegarde des données..."
    
    # Créer le répertoire de sauvegarde
    sudo mkdir -p "$BACKUP_DIR"
    
    # Timestamp pour la sauvegarde
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/blindtest_backup_$TIMESTAMP.tar.gz"
    
    # Sauvegarder les certificats SSL et configuration
    sudo tar -czf "$BACKUP_FILE" \
        data/ \
        .env \
        nginx/ \
        || log_error "Erreur lors de la sauvegarde"
    
    log_info "Sauvegarde créée: $BACKUP_FILE"
    
    # Nettoyer les anciennes sauvegardes (garder 7 dernières)
    sudo find "$BACKUP_DIR" -name "blindtest_backup_*.tar.gz" -mtime +7 -delete || true
}

update_app() {
    log_info "Mise à jour de l'application..."
    
    # Sauvegarde avant mise à jour
    backup_data
    
    # Mise à jour du code
    if [[ -d .git ]]; then
        git pull origin main || log_warn "Échec du git pull"
    fi
    
    # Rebuild et redémarrage
    podman-compose -f $COMPOSE_FILE build --no-cache app
    podman-compose -f $COMPOSE_FILE up -d
    
    log_info "Mise à jour terminée"
}

cleanup() {
    log_info "Nettoyage du système..."
    
    # Supprimer les images inutilisées
    podman image prune -f
    
    # Supprimer les conteneurs arrêtés
    podman container prune -f
    
    # Supprimer les volumes inutilisés
    podman volume prune -f
    
    # Supprimer les réseaux inutilisés
    podman network prune -f
    
    log_info "Nettoyage terminé"
}

# Menu principal
case "${1:-status}" in
    "status")
        show_status
        ;;
    "logs")
        show_logs "${2:-}"
        ;;
    "restart")
        restart_services "${2:-}"
        ;;
    "backup")
        backup_data
        ;;
    "update")
        update_app
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 [status|logs|restart|backup|update|cleanup] [service_name]"
        echo ""
        echo "Commandes disponibles:"
        echo "  status   - Afficher l'état des services"
        echo "  logs     - Afficher les logs (optionnel: nom du service)"
        echo "  restart  - Redémarrer les services (optionnel: nom du service)"
        echo "  backup   - Sauvegarder les données"
        echo "  update   - Mettre à jour l'application"
        echo "  cleanup  - Nettoyer le système"
        ;;
esac
