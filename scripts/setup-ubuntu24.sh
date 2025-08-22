#!/bin/bash
# 🐧 Configuration système Ubuntu 24.04 pour MxSpoty BlindTest avec Podman
# Script d'installation et optimisation complète

set -e

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

# Variables
USER_NAME=${SUDO_USER:-$USER}
PROJECT_DIR="/opt/mxspoty-blindtest"
SERVICE_NAME="mxspoty-blindtest"

# Vérification Ubuntu 24.04
check_ubuntu_version() {
    log_info "Vérification de la version Ubuntu..."
    
    if ! grep -q "24.04" /etc/os-release; then
        log_warning "Ce script est optimisé pour Ubuntu 24.04 LTS"
        read -p "Continuer quand même ? [y/N]: " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi
    
    log_success "Ubuntu $(lsb_release -rs) détecté"
}

# Mise à jour du système
update_system() {
    log_info "Mise à jour du système Ubuntu 24.04..."
    
    # Mise à jour des paquets
    apt-get update -q
    apt-get upgrade -y
    
    # Installation des outils de base
    apt-get install -y \
        curl \
        wget \
        gnupg \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        tree \
        jq \
        unzip \
        git
    
    log_success "Système mis à jour"
}

# Installation Node.js via NodeSource
install_nodejs() {
    log_info "Installation Node.js 20.x LTS..."
    
    # Ajouter le dépôt NodeSource pour Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    # Installation Node.js et npm
    apt-get install -y nodejs
    
    # Vérification des versions
    node --version
    npm --version
    
    # Configuration npm globale
    npm config set fund false
    npm config set audit-level moderate
    
    log_success "Node.js $(node --version) installé"
}

# Installation Podman avec configuration rootless
install_podman() {
    log_info "Installation Podman pour Ubuntu 24.04..."
    
    # Installation Podman
    apt-get install -y podman podman-compose
    
    # Installation des outils complémentaires
    apt-get install -y \
        buildah \
        skopeo \
        crun \
        fuse-overlayfs \
        slirp4netns
    
    # Vérification version
    podman --version
    
    log_success "Podman $(podman --version | cut -d' ' -f3) installé"
}

# Configuration Podman rootless
configure_podman_rootless() {
    log_info "Configuration Podman rootless pour l'utilisateur $USER_NAME..."
    
    # Configuration des sous-UID/GID pour rootless
    if ! grep -q "$USER_NAME" /etc/subuid; then
        echo "$USER_NAME:100000:65536" >> /etc/subuid
        echo "$USER_NAME:100000:65536" >> /etc/subgid
        log_info "Sous-UID/GID configurés pour $USER_NAME"
    fi
    
    # Activer lingering pour que les conteneurs survivent aux déconnexions
    loginctl enable-linger $USER_NAME
    
    # Configuration des limites système
    cat > /etc/security/limits.d/podman.conf << EOF
# Limites pour Podman rootless
$USER_NAME soft nofile 65536
$USER_NAME hard nofile 65536
$USER_NAME soft nproc 4096
$USER_NAME hard nproc 4096
EOF

    # Configuration sysctl pour containers
    cat > /etc/sysctl.d/99-podman.conf << EOF
# Configuration pour Podman
user.max_user_namespaces = 28633
kernel.unprivileged_userns_clone = 1
net.ipv4.ip_unprivileged_port_start = 80
EOF
    
    sysctl --system
    
    log_success "Configuration Podman rootless terminée"
}

# Installation et configuration Nginx
install_nginx() {
    log_info "Installation et configuration Nginx..."
    
    # Installation Nginx
    apt-get install -y nginx
    
    # Sauvegarde de la configuration par défaut
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # Création des dossiers de logs
    mkdir -p /var/log/nginx/mxspoty
    chown -R www-data:www-data /var/log/nginx/mxspoty
    
    # Configuration du pare-feu pour Nginx
    ufw allow 'Nginx Full'
    
    # Démarrage et activation
    systemctl start nginx
    systemctl enable nginx
    
    log_success "Nginx installé et configuré"
}

# Configuration du pare-feu
configure_firewall() {
    log_info "Configuration du pare-feu UFW..."
    
    # Activation UFW
    ufw --force enable
    
    # Règles de base
    ufw default deny incoming
    ufw default allow outgoing
    
    # SSH (important !)
    ufw allow ssh
    
    # HTTP/HTTPS
    ufw allow 80
    ufw allow 443
    
    # Port application (si accès direct nécessaire)
    ufw allow 3000
    
    # Monitoring (optionnel, à sécuriser en production)
    ufw allow 9090
    
    # Affichage du statut
    ufw status verbose
    
    log_success "Pare-feu configuré"
}

# Installation monitoring avec Prometheus
install_monitoring() {
    log_info "Installation des outils de monitoring..."
    
    # Création utilisateur prometheus
    useradd --no-create-home --shell /bin/false prometheus || true
    
    # Création des dossiers
    mkdir -p /etc/prometheus /var/lib/prometheus
    chown prometheus:prometheus /etc/prometheus /var/lib/prometheus
    
    # Téléchargement Prometheus
    PROM_VERSION="2.45.0"
    cd /tmp
    wget https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz
    tar xvf prometheus-${PROM_VERSION}.linux-amd64.tar.gz
    
    # Installation binaires
    cp prometheus-${PROM_VERSION}.linux-amd64/prometheus /usr/local/bin/
    cp prometheus-${PROM_VERSION}.linux-amd64/promtool /usr/local/bin/
    chown prometheus:prometheus /usr/local/bin/prometheus /usr/local/bin/promtool
    
    # Configuration Prometheus de base
    cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:

scrape_configs:
  - job_name: 'mxspoty-blindtest'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF
    
    chown prometheus:prometheus /etc/prometheus/prometheus.yml
    
    # Service systemd pour Prometheus
    cat > /etc/systemd/system/prometheus.service << EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \\
    --config.file /etc/prometheus/prometheus.yml \\
    --storage.tsdb.path /var/lib/prometheus/ \\
    --web.console.templates=/etc/prometheus/consoles \\
    --web.console.libraries=/etc/prometheus/console_libraries \\
    --web.listen-address=0.0.0.0:9090

[Install]
WantedBy=multi-user.target
EOF
    
    # Démarrage Prometheus
    systemctl daemon-reload
    systemctl start prometheus
    systemctl enable prometheus
    
    # Nettoyage
    rm -rf /tmp/prometheus-*
    
    log_success "Monitoring installé"
}

# Création de l'utilisateur système pour l'application
setup_app_user() {
    log_info "Configuration utilisateur application..."
    
    # Création utilisateur système
    if ! id "mxspoty" &>/dev/null; then
        useradd --system --shell /bin/false --home-dir /opt/mxspoty-blindtest --create-home mxspoty
        log_info "Utilisateur mxspoty créé"
    fi
    
    # Ajout aux groupes nécessaires
    usermod -aG docker mxspoty 2>/dev/null || true
    
    log_success "Utilisateur application configuré"
}

# Configuration des logs
setup_logging() {
    log_info "Configuration du système de logs..."
    
    # Configuration logrotate pour l'application
    cat > /etc/logrotate.d/mxspoty-blindtest << EOF
/var/log/mxspoty-blindtest/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 mxspoty mxspoty
    postrotate
        systemctl reload mxspoty-blindtest || true
    endscript
}
EOF

    # Configuration journald
    mkdir -p /etc/systemd/journald.conf.d
    cat > /etc/systemd/journald.conf.d/mxspoty.conf << EOF
[Journal]
Storage=persistent
MaxRetentionSec=2week
MaxFileSec=1day
EOF

    systemctl restart systemd-journald
    
    log_success "Configuration des logs terminée"
}

# Optimisations système
optimize_system() {
    log_info "Optimisations système Ubuntu 24.04..."
    
    # Optimisations sysctl
    cat > /etc/sysctl.d/99-mxspoty-performance.conf << EOF
# Optimisations réseau pour l'application web
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1

# Optimisations mémoire
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Optimisations pour containers
kernel.keys.maxkeys = 2000
kernel.keys.maxbytes = 2000000
EOF

    # Optimisations limites
    cat > /etc/security/limits.d/99-mxspoty.conf << EOF
# Limites pour l'application
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

    # Application des optimisations
    sysctl --system
    
    log_success "Optimisations système appliquées"
}

# Installation des certificats SSL (Let's Encrypt)
install_ssl() {
    log_info "Installation Certbot pour SSL..."
    
    # Installation certbot
    apt-get install -y certbot python3-certbot-nginx
    
    # Configuration du renouvellement automatique
    cat > /etc/systemd/system/certbot-renewal.timer << EOF
[Unit]
Description=Certbot Automatic Renewal Timer

[Timer]
OnBootSec=300
OnUnitActiveSec=1d
RandomizedDelaySec=3600

[Install]
WantedBy=timers.target
EOF

    systemctl enable certbot-renewal.timer
    systemctl start certbot-renewal.timer
    
    log_success "Certbot installé"
}

# Résumé de l'installation
show_summary() {
    log_info "=== RÉSUMÉ DE L'INSTALLATION ==="
    echo ""
    echo "✅ Système: Ubuntu $(lsb_release -rs)"
    echo "✅ Node.js: $(node --version)"
    echo "✅ npm: $(npm --version)"
    echo "✅ Podman: $(podman --version | cut -d' ' -f3)"
    echo "✅ Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"
    echo "✅ Prometheus: http://localhost:9090"
    echo ""
    log_info "=== ÉTAPES SUIVANTES ==="
    echo ""
    echo "1. Cloner le projet:"
    echo "   git clone <repository> $PROJECT_DIR"
    echo ""
    echo "2. Déployer avec Podman:"
    echo "   cd $PROJECT_DIR"
    echo "   ./scripts/deploy-podman-ubuntu24.sh --install"
    echo "   ./scripts/deploy-podman-ubuntu24.sh --rebuild"
    echo ""
    echo "3. Configurer SSL (optionnel):"
    echo "   certbot --nginx -d votre-domaine.com"
    echo ""
    echo "4. Vérifier le déploiement:"
    echo "   curl http://localhost/health"
    echo ""
    log_success "Installation système terminée !"
}

# Menu principal
case "$1" in
    --full)
        log_info "🚀 Installation complète Ubuntu 24.04..."
        check_ubuntu_version
        update_system
        install_nodejs
        install_podman
        configure_podman_rootless
        install_nginx
        configure_firewall
        install_monitoring
        setup_app_user
        setup_logging
        optimize_system
        install_ssl
        show_summary
        ;;
    --basic)
        log_info "⚡ Installation basique..."
        check_ubuntu_version
        update_system
        install_nodejs
        install_podman
        configure_podman_rootless
        show_summary
        ;;
    --monitoring)
        install_monitoring
        ;;
    --ssl)
        install_ssl
        ;;
    *)
        echo "🐧 Configuration Ubuntu 24.04 pour MxSpoty BlindTest"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --full       Installation complète (recommandé)"
        echo "  --basic      Installation minimale"
        echo "  --monitoring Installation monitoring uniquement"
        echo "  --ssl        Installation SSL uniquement"
        echo ""
        echo "Exemple: $0 --full"
        ;;
esac
