#!/bin/bash
# ⏰ Configuration des tâches cron pour MxSpoty BlindTest
# Automatisation du monitoring, backups, et maintenance

set -e

# Configuration
PROJECT_DIR="/opt/mxspoty-blindtest"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
BACKUP_TIME="02:30"  # Sauvegarde quotidienne à 2h30
MONITORING_INTERVAL="*/5"  # Monitoring toutes les 5 minutes
MAINTENANCE_TIME="03:00"  # Maintenance hebdomadaire le dimanche à 3h

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if [ ! -d "$SCRIPTS_DIR" ]; then
        log_error "Répertoire des scripts non trouvé: $SCRIPTS_DIR"
        exit 1
    fi
    
    # Vérifier que les scripts existent et sont exécutables
    local scripts=("monitoring.sh" "backup-system.sh" "deploy-podman-ubuntu24.sh")
    
    for script in "${scripts[@]}"; do
        local script_path="$SCRIPTS_DIR/$script"
        if [ ! -f "$script_path" ]; then
            log_error "Script non trouvé: $script_path"
            exit 1
        fi
        
        if [ ! -x "$script_path" ]; then
            log_info "Ajout des permissions d'exécution pour $script"
            chmod +x "$script_path"
        fi
    done
    
    log_success "Prérequis vérifiés"
}

# Configuration des tâches cron pour root
setup_root_cron() {
    log_info "Configuration des tâches cron pour root..."
    
    # Sauvegarde du crontab existant
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || touch /tmp/crontab_empty
    
    # Création du nouveau crontab
    cat > /tmp/mxspoty_root_cron << EOF
# MxSpoty BlindTest - Tâches automatisées (Root)
# Généré automatiquement le $(date)

# Variables d'environnement
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
SHELL=/bin/bash
MAILTO=root

# === MONITORING === 
# Monitoring complet toutes les 5 minutes
$MONITORING_INTERVAL * * * * $SCRIPTS_DIR/monitoring.sh check >/dev/null 2>&1

# Monitoring avec rapport HTML toutes les heures
0 * * * * $SCRIPTS_DIR/monitoring.sh check && $SCRIPTS_DIR/monitoring.sh report

# === SAUVEGARDES ===
# Sauvegarde quotidienne à 2h30
30 2 * * * $SCRIPTS_DIR/backup-system.sh --backup >> /var/log/mxspoty-backup.log 2>&1

# Nettoyage des anciennes sauvegardes (tous les dimanches à 4h)
0 4 * * 0 $SCRIPTS_DIR/backup-system.sh --cleanup >> /var/log/mxspoty-backup.log 2>&1

# === MAINTENANCE ===
# Maintenance système hebdomadaire (dimanche à 3h)
0 3 * * 0 $SCRIPTS_DIR/deploy-podman-ubuntu24.sh --maintenance >> /var/log/mxspoty-maintenance.log 2>&1

# Redémarrage des services si nécessaire (tous les jours à 5h)
0 5 * * * systemctl is-active mxspoty-blindtest >/dev/null || systemctl restart mxspoty-blindtest

# === NETTOYAGE ===
# Nettoyage des logs anciens (tous les lundis à 1h)
0 1 * * 1 find /var/log -name "*.log" -mtime +30 -delete 2>/dev/null

# Nettoyage des conteneurs et images non utilisés (tous les dimanches à 5h)
0 5 * * 0 podman system prune -f >/dev/null 2>&1

# === SÉCURITÉ ===
# Mise à jour des certificats SSL (tous les jours à 6h)
0 6 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"

# Vérification des permissions critiques (tous les jours à 1h30)
30 1 * * * find $PROJECT_DIR -type f -name "*.sh" ! -perm -u+x -exec chmod +x {} \;

# === MÉTRIQUES ===
# Collecte des métriques pour Prometheus (toutes les minutes)
* * * * * $SCRIPTS_DIR/monitoring.sh metrics >/dev/null 2>&1

EOF

    # Application du nouveau crontab
    crontab /tmp/mxspoty_root_cron
    
    log_success "Crontab root configuré avec $(crontab -l | grep -v '^#' | grep -v '^$' | wc -l) tâches"
    
    # Nettoyage
    rm -f /tmp/mxspoty_root_cron
}

# Configuration des tâches cron pour l'utilisateur mxspoty
setup_user_cron() {
    log_info "Configuration des tâches cron pour l'utilisateur mxspoty..."
    
    if ! id "mxspoty" &>/dev/null; then
        log_warning "Utilisateur mxspoty non trouvé, création..."
        useradd --system --shell /bin/bash --home-dir /opt/mxspoty-blindtest --create-home mxspoty
    fi
    
    # Crontab pour l'utilisateur mxspoty
    sudo -u mxspoty cat > /tmp/mxspoty_user_cron << EOF
# MxSpoty BlindTest - Tâches utilisateur
# Généré automatiquement le $(date)

# Variables d'environnement
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
SHELL=/bin/bash

# === MONITORING APPLICATION ===
# Vérification de l'application toutes les 2 minutes
*/2 * * * * curl -s http://localhost:3000/health >/dev/null || echo "Application down at \$(date)" >> /var/log/mxspoty-app-check.log

# Test des endpoints critiques toutes les 10 minutes  
*/10 * * * * curl -s http://localhost:3000/api/playlists >/dev/null 2>&1

# === NETTOYAGE APPLICATION ===
# Nettoyage des logs temporaires de l'application
0 2 * * * find /opt/mxspoty-blindtest/logs -name "*.log" -mtime +7 -delete 2>/dev/null || true

# Nettoyage du cache Node.js (si présent)
0 3 * * 1 rm -rf /opt/mxspoty-blindtest/node_modules/.cache 2>/dev/null || true

EOF

    # Application du crontab utilisateur
    sudo -u mxspoty crontab /tmp/mxspoty_user_cron
    
    log_success "Crontab utilisateur mxspoty configuré"
    
    # Nettoyage
    rm -f /tmp/mxspoty_user_cron
}

# Configuration de logrotate pour les logs personnalisés
setup_logrotate() {
    log_info "Configuration de logrotate..."
    
    cat > /etc/logrotate.d/mxspoty-blindtest << 'EOF'
# Configuration logrotate pour MxSpoty BlindTest
/var/log/mxspoty*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 root root
    postrotate
        # Signaler aux processus de rouvrir leurs logs si nécessaire
        killall -SIGUSR1 node 2>/dev/null || true
    endscript
}

/var/log/mxspoty-blindtest/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 mxspoty mxspoty
    postrotate
        systemctl reload mxspoty-blindtest 2>/dev/null || true
    endscript
}
EOF

    # Test de la configuration logrotate
    logrotate -d /etc/logrotate.d/mxspoty-blindtest >/dev/null 2>&1
    
    log_success "Logrotate configuré"
}

# Configuration des alertes par email (optionnel)
setup_email_alerts() {
    log_info "Configuration des alertes email..."
    
    if command -v mailx &>/dev/null || command -v sendmail &>/dev/null; then
        # Script d'alerte email personnalisé
        cat > "$SCRIPTS_DIR/send-alert.sh" << 'EOF'
#!/bin/bash
# Script d'envoi d'alertes email pour MxSpoty BlindTest

ALERT_LEVEL=$1
MESSAGE=$2
HOSTNAME=$(hostname)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Configuration email (à personnaliser)
TO_EMAIL="${ADMIN_EMAIL:-root@localhost}"
FROM_EMAIL="mxspoty@${HOSTNAME}"
SUBJECT="[MxSpoty BlindTest] Alert $ALERT_LEVEL - $HOSTNAME"

# Corps de l'email
cat << EMAIL_BODY | sendmail "$TO_EMAIL" 2>/dev/null || mailx -s "$SUBJECT" "$TO_EMAIL" 2>/dev/null || true
From: $FROM_EMAIL
To: $TO_EMAIL
Subject: $SUBJECT

Alerte MxSpoty BlindTest
=======================

Niveau: $ALERT_LEVEL
Serveur: $HOSTNAME
Timestamp: $TIMESTAMP

Message:
$MESSAGE

---
Système de monitoring automatique MxSpoty BlindTest
EMAIL_BODY
EOF
        
        chmod +x "$SCRIPTS_DIR/send-alert.sh"
        log_success "Script d'alerte email créé"
    else
        log_warning "Aucun système d'email détecté (mailx/sendmail)"
    fi
}

# Configuration du service de monitoring systemd
setup_monitoring_service() {
    log_info "Configuration du service de monitoring systemd..."
    
    cat > /etc/systemd/system/mxspoty-monitoring.service << EOF
[Unit]
Description=MxSpoty BlindTest Monitoring Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
Group=root
WorkingDirectory=$PROJECT_DIR
ExecStart=$SCRIPTS_DIR/monitoring.sh check
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mxspoty-monitoring

[Install]
WantedBy=multi-user.target
EOF

    # Timer pour exécution périodique
    cat > /etc/systemd/system/mxspoty-monitoring.timer << EOF
[Unit]
Description=MxSpoty BlindTest Monitoring Timer
Requires=mxspoty-monitoring.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
RandomizedDelaySec=30sec

[Install]
WantedBy=timers.target
EOF

    # Activation des services
    systemctl daemon-reload
    systemctl enable mxspoty-monitoring.timer
    systemctl start mxspoty-monitoring.timer
    
    log_success "Service de monitoring systemd configuré"
}

# Affichage du statut des tâches programmées
show_status() {
    log_info "=== STATUT DES TÂCHES PROGRAMMÉES ==="
    echo ""
    
    echo "🔧 Crontab root:"
    crontab -l | grep -v '^#' | grep -v '^$' || echo "  Aucune tâche"
    echo ""
    
    echo "👤 Crontab utilisateur mxspoty:"
    sudo -u mxspoty crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' || echo "  Aucune tâche"
    echo ""
    
    echo "⏰ Timer systemd:"
    systemctl list-timers mxspoty-* --no-pager 2>/dev/null || echo "  Aucun timer"
    echo ""
    
    echo "📋 Services cron:"
    systemctl status cron --no-pager -l 2>/dev/null || echo "  Service cron non actif"
    echo ""
    
    echo "📊 Dernières exécutions de monitoring:"
    tail -n 5 /var/log/mxspoty-monitoring.log 2>/dev/null || echo "  Aucun log de monitoring"
    echo ""
    
    echo "💾 Dernières sauvegardes:"
    ls -lth /var/backups/mxspoty-blindtest/*.tar.gz 2>/dev/null | head -3 || echo "  Aucune sauvegarde"
}

# Test des tâches programmées
test_cron_tasks() {
    log_info "Test des tâches programmées..."
    
    # Test monitoring
    if [ -x "$SCRIPTS_DIR/monitoring.sh" ]; then
        log_info "Test du script de monitoring..."
        "$SCRIPTS_DIR/monitoring.sh" check >/dev/null 2>&1 && log_success "Monitoring: OK" || log_error "Monitoring: ÉCHEC"
    fi
    
    # Test backup
    if [ -x "$SCRIPTS_DIR/backup-system.sh" ]; then
        log_info "Test du script de sauvegarde..."
        "$SCRIPTS_DIR/backup-system.sh" --help >/dev/null 2>&1 && log_success "Backup: OK" || log_error "Backup: ÉCHEC"
    fi
    
    # Test des permissions
    log_info "Vérification des permissions..."
    find "$SCRIPTS_DIR" -name "*.sh" -not -executable -print | while read -r file; do
        log_warning "Permissions manquantes: $file"
    done
    
    # Test de l'espace disque pour les sauvegardes
    local backup_dir="/var/backups/mxspoty-blindtest"
    if [ -d "$backup_dir" ]; then
        local available_space=$(df "$backup_dir" | tail -1 | awk '{print $4}')
        local available_gb=$((available_space / 1024 / 1024))
        
        if [ "$available_gb" -gt 5 ]; then
            log_success "Espace disque suffisant pour les sauvegardes: ${available_gb}GB"
        else
            log_warning "Espace disque faible pour les sauvegardes: ${available_gb}GB"
        fi
    fi
}

# Menu principal
case "${1:-}" in
    --install)
        log_info "🚀 Installation complète des tâches automatisées..."
        check_prerequisites
        setup_root_cron
        setup_user_cron
        setup_logrotate
        setup_email_alerts
        setup_monitoring_service
        show_status
        ;;
        
    --status)
        show_status
        ;;
        
    --test)
        test_cron_tasks
        ;;
        
    --remove)
        log_info "🗑️ Suppression des tâches automatisées..."
        
        # Suppression des crontabs
        echo "# Crontab vidé par setup-cron.sh" | crontab -
        sudo -u mxspoty echo "# Crontab vidé par setup-cron.sh" | sudo -u mxspoty crontab - 2>/dev/null || true
        
        # Suppression des services systemd
        systemctl stop mxspoty-monitoring.timer 2>/dev/null || true
        systemctl disable mxspoty-monitoring.timer 2>/dev/null || true
        rm -f /etc/systemd/system/mxspoty-monitoring.* 
        
        # Suppression logrotate
        rm -f /etc/logrotate.d/mxspoty-blindtest
        
        systemctl daemon-reload
        
        log_success "Tâches automatisées supprimées"
        ;;
        
    *)
        echo "⏰ Configuration des tâches automatisées MxSpoty BlindTest"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --install    Installation complète des tâches automatisées"
        echo "  --status     Affichage du statut des tâches"
        echo "  --test       Test des tâches programmées"
        echo "  --remove     Suppression de toutes les tâches automatisées"
        echo ""
        echo "Tâches automatisées configurées:"
        echo "  • Monitoring toutes les 5 minutes"
        echo "  • Sauvegarde quotidienne à 2h30"
        echo "  • Maintenance hebdomadaire le dimanche à 3h"
        echo "  • Nettoyage automatique des logs anciens"
        echo "  • Renouvellement automatique des certificats SSL"
        echo "  • Collecte de métriques pour Prometheus"
        echo ""
        ;;
esac
