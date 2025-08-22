#!/bin/bash
# 💾 Script de sauvegarde automatisée pour MxSpoty BlindTest
# Sauvegarde des données, configurations et conteneurs Podman

set -e

# Configuration
BACKUP_DIR="/var/backups/mxspoty-blindtest"
PROJECT_DIR="/opt/mxspoty-blindtest"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mxspoty_backup_${TIMESTAMP}"
LOG_FILE="/var/log/mxspoty-backup.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { log "${YELLOW}[WARNING]${NC} $1"; }
log_error() { log "${RED}[ERROR]${NC} $1"; }

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier que le répertoire de sauvegarde existe
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Vérifier les permissions
    if [ ! -w "$BACKUP_DIR" ]; then
        log_error "Impossible d'écrire dans $BACKUP_DIR"
        exit 1
    fi
    
    # Vérifier que Podman est disponible
    if ! command -v podman &> /dev/null; then
        log_error "Podman n'est pas installé"
        exit 1
    fi
    
    log_success "Prérequis vérifiés"
}

# Sauvegarde des conteneurs Podman
backup_containers() {
    log_info "Sauvegarde des conteneurs Podman..."
    
    local container_backup_dir="$BACKUP_DIR/$BACKUP_NAME/containers"
    mkdir -p "$container_backup_dir"
    
    # Liste des conteneurs en cours d'exécution
    if podman ps -q > /dev/null 2>&1; then
        log_info "Arrêt temporaire des conteneurs..."
        
        # Sauvegarder l'état des conteneurs
        podman ps -a --format json > "$container_backup_dir/containers_state.json"
        
        # Sauvegarder les pods
        podman pod ls --format json > "$container_backup_dir/pods_state.json" 2>/dev/null || true
        
        # Exporter les conteneurs actifs
        for container in $(podman ps -aq 2>/dev/null || true); do
            if [ -n "$container" ]; then
                container_name=$(podman inspect "$container" --format '{{.Name}}' 2>/dev/null || echo "unknown_$container")
                log_info "Export du conteneur: $container_name"
                podman export "$container" > "$container_backup_dir/${container_name}.tar" 2>/dev/null || {
                    log_warning "Impossible d'exporter le conteneur $container_name"
                }
            fi
        done
        
        # Sauvegarder les images personnalisées
        for image in $(podman images --format "{{.Repository}}:{{.Tag}}" | grep -E "mxspoty|blindtest" || true); do
            if [ -n "$image" ] && [ "$image" != "<none>:<none>" ]; then
                image_filename=$(echo "$image" | tr '/:' '_')
                log_info "Export de l'image: $image"
                podman save "$image" > "$container_backup_dir/image_${image_filename}.tar" 2>/dev/null || {
                    log_warning "Impossible d'exporter l'image $image"
                }
            fi
        done
    else
        log_info "Aucun conteneur en cours d'exécution"
    fi
    
    log_success "Sauvegarde des conteneurs terminée"
}

# Sauvegarde des données de l'application
backup_application() {
    log_info "Sauvegarde des données de l'application..."
    
    local app_backup_dir="$BACKUP_DIR/$BACKUP_NAME/application"
    mkdir -p "$app_backup_dir"
    
    if [ -d "$PROJECT_DIR" ]; then
        # Sauvegarde du code source et configuration
        tar -czf "$app_backup_dir/source_code.tar.gz" \
            -C "$(dirname "$PROJECT_DIR")" \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='logs' \
            --exclude='*.log' \
            --exclude='tmp' \
            "$(basename "$PROJECT_DIR")" \
            2>/dev/null || log_warning "Erreur partielle lors de la sauvegarde du code source"
        
        # Sauvegarde spécifique des fichiers de configuration
        if [ -f "$PROJECT_DIR/.env" ]; then
            cp "$PROJECT_DIR/.env" "$app_backup_dir/.env.backup"
        fi
        
        if [ -f "$PROJECT_DIR/package.json" ]; then
            cp "$PROJECT_DIR/package.json" "$app_backup_dir/"
        fi
        
        if [ -f "$PROJECT_DIR/package-lock.json" ]; then
            cp "$PROJECT_DIR/package-lock.json" "$app_backup_dir/"
        fi
        
        # Sauvegarde des logs si ils existent
        if [ -d "/var/log/mxspoty-blindtest" ]; then
            tar -czf "$app_backup_dir/logs.tar.gz" /var/log/mxspoty-blindtest/ 2>/dev/null || true
        fi
        
        log_success "Données de l'application sauvegardées"
    else
        log_warning "Répertoire de l'application non trouvé: $PROJECT_DIR"
    fi
}

# Sauvegarde de la configuration système
backup_system_config() {
    log_info "Sauvegarde de la configuration système..."
    
    local system_backup_dir="$BACKUP_DIR/$BACKUP_NAME/system"
    mkdir -p "$system_backup_dir"
    
    # Configuration Nginx
    if [ -d "/etc/nginx" ]; then
        tar -czf "$system_backup_dir/nginx_config.tar.gz" /etc/nginx/ 2>/dev/null || true
    fi
    
    # Configuration systemd
    if [ -f "/etc/systemd/system/mxspoty-blindtest.service" ]; then
        cp "/etc/systemd/system/mxspoty-blindtest.service" "$system_backup_dir/"
    fi
    
    # Configuration UFW
    if [ -d "/etc/ufw" ]; then
        tar -czf "$system_backup_dir/ufw_config.tar.gz" /etc/ufw/ 2>/dev/null || true
    fi
    
    # Certificats SSL
    if [ -d "/etc/letsencrypt" ]; then
        tar -czf "$system_backup_dir/ssl_certificates.tar.gz" /etc/letsencrypt/ 2>/dev/null || true
    fi
    
    # Crontabs
    crontab -l > "$system_backup_dir/root_crontab.txt" 2>/dev/null || echo "# Pas de crontab" > "$system_backup_dir/root_crontab.txt"
    
    log_success "Configuration système sauvegardée"
}

# Création du manifeste de sauvegarde
create_manifest() {
    log_info "Création du manifeste de sauvegarde..."
    
    local manifest_file="$BACKUP_DIR/$BACKUP_NAME/manifest.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_info": {
    "name": "$BACKUP_NAME",
    "timestamp": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "script_version": "1.0",
    "ubuntu_version": "$(lsb_release -rs)",
    "podman_version": "$(podman --version 2>/dev/null || echo 'N/A')"
  },
  "backup_contents": {
    "containers": $([ -d "$BACKUP_DIR/$BACKUP_NAME/containers" ] && echo "true" || echo "false"),
    "application": $([ -d "$BACKUP_DIR/$BACKUP_NAME/application" ] && echo "true" || echo "false"),
    "system_config": $([ -d "$BACKUP_DIR/$BACKUP_NAME/system" ] && echo "true" || echo "false")
  },
  "disk_usage": {
    "backup_size": "$(du -sh "$BACKUP_DIR/$BACKUP_NAME" 2>/dev/null | cut -f1 || echo 'N/A')",
    "available_space": "$(df -h "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $4}' || echo 'N/A')"
  }
}
EOF
    
    log_success "Manifeste créé: $manifest_file"
}

# Compression de la sauvegarde
compress_backup() {
    log_info "Compression de la sauvegarde..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    if [ -f "${BACKUP_NAME}.tar.gz" ]; then
        rm -rf "$BACKUP_NAME"
        log_success "Sauvegarde compressée: ${BACKUP_NAME}.tar.gz"
        
        # Affichage de la taille
        backup_size=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
        log_info "Taille de la sauvegarde: $backup_size"
    else
        log_error "Échec de la compression"
        exit 1
    fi
}

# Nettoyage des anciennes sauvegardes
cleanup_old_backups() {
    log_info "Nettoyage des anciennes sauvegardes (> $RETENTION_DAYS jours)..."
    
    local deleted_count=0
    
    # Suppression des archives anciennes
    while IFS= read -r -d '' backup_file; do
        rm -f "$backup_file"
        ((deleted_count++))
        log_info "Supprimé: $(basename "$backup_file")"
    done < <(find "$BACKUP_DIR" -name "mxspoty_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)
    
    # Suppression des dossiers de sauvegarde non compressés anciens
    while IFS= read -r -d '' backup_dir; do
        rm -rf "$backup_dir"
        ((deleted_count++))
        log_info "Supprimé: $(basename "$backup_dir")"
    done < <(find "$BACKUP_DIR" -name "mxspoty_backup_*" -type d -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)
    
    if [ $deleted_count -eq 0 ]; then
        log_info "Aucune ancienne sauvegarde à supprimer"
    else
        log_success "$deleted_count ancienne(s) sauvegarde(s) supprimée(s)"
    fi
}

# Vérification de l'intégrité
verify_backup() {
    log_info "Vérification de l'intégrité de la sauvegarde..."
    
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    if [ -f "$backup_file" ]; then
        if tar -tzf "$backup_file" >/dev/null 2>&1; then
            log_success "Intégrité de la sauvegarde vérifiée"
        else
            log_error "Sauvegarde corrompue!"
            exit 1
        fi
    else
        log_error "Fichier de sauvegarde non trouvé"
        exit 1
    fi
}

# Envoi de notification (optionnel)
send_notification() {
    local status=$1
    local message=$2
    
    # Vous pouvez ajouter ici des notifications par email, Slack, etc.
    log_info "Notification: $status - $message"
    
    # Exemple avec logger système
    logger -t "mxspoty-backup" "$status: $message"
}

# Restauration à partir d'une sauvegarde
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Nom de fichier de sauvegarde requis pour la restauration"
        return 1
    fi
    
    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        log_error "Fichier de sauvegarde non trouvé: $BACKUP_DIR/$backup_file"
        return 1
    fi
    
    log_info "🔄 RESTAURATION depuis $backup_file"
    log_warning "Cette opération va remplacer les données actuelles!"
    
    read -p "Êtes-vous sûr de vouloir continuer? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restauration annulée"
        return 0
    fi
    
    # Extraction
    cd "$BACKUP_DIR"
    tar -xzf "$backup_file"
    
    local restore_dir=$(basename "$backup_file" .tar.gz)
    
    # Arrêt de l'application
    systemctl stop mxspoty-blindtest 2>/dev/null || true
    
    # Restauration des données
    if [ -d "$restore_dir/application" ]; then
        log_info "Restauration des données de l'application..."
        tar -xzf "$restore_dir/application/source_code.tar.gz" -C /opt/ 2>/dev/null || true
    fi
    
    # Restauration de la configuration système
    if [ -d "$restore_dir/system" ]; then
        log_info "Restauration de la configuration système..."
        [ -f "$restore_dir/system/nginx_config.tar.gz" ] && tar -xzf "$restore_dir/system/nginx_config.tar.gz" -C / 2>/dev/null || true
        [ -f "$restore_dir/system/mxspoty-blindtest.service" ] && cp "$restore_dir/system/mxspoty-blindtest.service" /etc/systemd/system/ 2>/dev/null || true
    fi
    
    # Redémarrage des services
    systemctl daemon-reload
    systemctl restart nginx
    systemctl start mxspoty-blindtest
    
    log_success "Restauration terminée"
}

# Affichage de l'aide
show_help() {
    echo "💾 Script de sauvegarde MxSpoty BlindTest"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --backup         Effectuer une sauvegarde complète (défaut)"
    echo "  --restore FILE   Restaurer depuis une sauvegarde"
    echo "  --list          Lister les sauvegardes disponibles"
    echo "  --cleanup       Nettoyer les anciennes sauvegardes uniquement"
    echo "  --verify FILE   Vérifier l'intégrité d'une sauvegarde"
    echo "  --help          Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                                    # Sauvegarde complète"
    echo "  $0 --restore mxspoty_backup_20241201_120000.tar.gz"
    echo "  $0 --list                             # Liste des sauvegardes"
}

# Liste des sauvegardes
list_backups() {
    log_info "📋 Sauvegardes disponibles:"
    echo ""
    
    if ls "$BACKUP_DIR"/mxspoty_backup_*.tar.gz >/dev/null 2>&1; then
        for backup in "$BACKUP_DIR"/mxspoty_backup_*.tar.gz; do
            backup_name=$(basename "$backup")
            backup_size=$(du -sh "$backup" | cut -f1)
            backup_date=$(stat -c %y "$backup" | cut -d'.' -f1)
            
            echo "📦 $backup_name"
            echo "   Taille: $backup_size"
            echo "   Date: $backup_date"
            echo ""
        done
    else
        echo "Aucune sauvegarde trouvée dans $BACKUP_DIR"
    fi
}

# Fonction principale
main() {
    case "${1:-}" in
        --restore)
            if [ -z "$2" ]; then
                log_error "Nom de fichier requis pour la restauration"
                show_help
                exit 1
            fi
            restore_backup "$2"
            ;;
        --list)
            list_backups
            ;;
        --cleanup)
            check_prerequisites
            cleanup_old_backups
            ;;
        --verify)
            if [ -z "$2" ]; then
                log_error "Nom de fichier requis pour la vérification"
                show_help
                exit 1
            fi
            BACKUP_NAME=$(basename "$2" .tar.gz)
            verify_backup
            ;;
        --help)
            show_help
            ;;
        --backup|"")
            log_info "🚀 Début de la sauvegarde complète..."
            
            # Sauvegarde complète
            check_prerequisites
            backup_containers
            backup_application  
            backup_system_config
            create_manifest
            compress_backup
            verify_backup
            cleanup_old_backups
            
            backup_size=$(du -sh "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)
            log_success "🎉 Sauvegarde terminée avec succès!"
            log_info "📦 Fichier: ${BACKUP_NAME}.tar.gz ($backup_size)"
            
            send_notification "SUCCESS" "Sauvegarde terminée avec succès ($backup_size)"
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

# Gestion des erreurs
trap 'log_error "Script interrompu"; send_notification "ERROR" "Sauvegarde interrompue"; exit 1' INT TERM

# Exécution
main "$@"
