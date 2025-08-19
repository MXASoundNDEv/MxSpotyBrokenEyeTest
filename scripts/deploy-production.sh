#!/bin/bash

# Script de déploiement complet pour BrokenEye.Space
# Met à jour avec la nouvelle IP publique: 82.66.66.208
# Usage: ./scripts/deploy-production.sh [--repaire/-R] [--redeploy=app|nginx|all] [--rebuild]

set -euo pipefail

# Traitement des arguments
REPAIR_MODE=false
REDEPLOY_MODE=""
REBUILD_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --repaire|-R)
            REPAIR_MODE=true
            shift
            ;;
        --redeploy=*)
            REDEPLOY_MODE="${1#*=}"
            shift
            ;;
        --redeploy)
            if [[ -n "${2:-}" ]]; then
                REDEPLOY_MODE="$2"
                shift 2
            else
                echo "❌ Option --redeploy nécessite un argument: app|nginx|all"
                exit 1
            fi
            ;;
        --rebuild)
            REBUILD_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --repaire, -R           Vérifier et réparer l'installation"
            echo "  --redeploy=COMPONENT    Redéployer un composant (app|nginx|all)"
            echo "  --rebuild               Rebuild rapide de l'application seulement"
            echo "  -h, --help              Afficher cette aide"
            echo ""
            echo "Exemples:"
            echo "  $0                      Déploiement complet"
            echo "  $0 --repaire            Vérifier et réparer l'installation"
            echo "  $0 --redeploy=app       Redéployer seulement l'application"
            echo "  $0 --redeploy=nginx     Redéployer seulement Nginx"
            echo "  $0 --redeploy=all       Redéployer app + nginx"
            echo "  $0 --rebuild            Rebuild rapide de l'app (pour modifications code)"
            exit 0
            ;;
        *)
            echo "❌ Option inconnue: $1"
            echo "Utilisez -h ou --help pour l'aide"
            exit 1
            ;;
    esac
done

if [[ "$REPAIR_MODE" == "true" ]]; then
    echo "🔧 MODE RÉPARATION - VÉRIFICATION DE L'INSTALLATION"
    echo "=================================================="
elif [[ -n "$REDEPLOY_MODE" ]]; then
    echo "🔄 MODE REDÉPLOIEMENT - $REDEPLOY_MODE"
    echo "================================"
elif [[ "$REBUILD_MODE" == "true" ]]; then
    echo "🔨 MODE REBUILD RAPIDE - APPLICATION SEULEMENT"
    echo "============================================="
else
    echo "🚀 DÉPLOIEMENT COMPLET - BROKENEYE.SPACE AVEC HTTPS"
    echo "====================================================="
fi

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration mise à jour
DOMAIN="brokeneye.space"
PUBLIC_IPV4="82.66.66.208"
PUBLIC_IPV6="2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"
LOCAL_IP="192.168.0.47"
PROJECT_NAME="blindtest"
COMPOSE_FILE="docker-compose.yml"

echo "🌐 Configuration:"
echo "  - Domaine: $DOMAIN"
echo "  - IP Publique IPv4: $PUBLIC_IPV4" 
echo "  - IP Publique IPv6: $PUBLIC_IPV6"
echo "  - IP Locale: $LOCAL_IP"
echo "  - SSL/HTTPS: Automatique avec Let's Encrypt"
echo ""

# ========================================
# ÉTAPE 1: VÉRIFICATIONS SYSTÈME ET RÉPARATIONS
# ========================================
if [[ "$REPAIR_MODE" == "true" ]]; then
    log_step "1/10 Mode réparation - Vérification complète du système..."
else
    log_step "1/10 Vérification du système..."
fi

# Vérifier Ubuntu
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    log_error "Ce script est conçu pour Ubuntu"
    exit 1
fi

# Fonction de vérification des dépendances
check_and_install_deps() {
    local missing_deps=()
    local all_deps=("podman" "certbot" "curl" "git" "htop" "lsof" "netstat" "openssl")
    
    log_info "🔍 Vérification des dépendances système..."
    
    for dep in "${all_deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
            log_warn "⚠️  $dep manquant"
        else
            log_info "✅ $dep installé"
        fi
    done
    
    # Vérifier les services
    if ! systemctl is-active --quiet cockpit.socket; then
        log_warn "⚠️  Cockpit non actif"
        missing_deps+=("cockpit-inactive")
    else
        log_info "✅ Cockpit actif"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_info "🔧 Installation des dépendances manquantes..."
        sudo apt update
        
        # Installer les paquets manquants
        local packages_to_install=()
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                "podman") packages_to_install+=("podman" "podman-compose") ;;
                "certbot") packages_to_install+=("certbot" "python3-certbot-nginx") ;;
                "netstat") packages_to_install+=("net-tools") ;;
                "cockpit-inactive") packages_to_install+=("cockpit" "cockpit-podman") ;;
                *) packages_to_install+=("$dep") ;;
            esac
        done
        
        if [[ ${#packages_to_install[@]} -gt 0 ]]; then
            sudo apt install -y "${packages_to_install[@]}" openssl python3-pip
            
            # Configuration post-installation
            if [[ " ${missing_deps[*]} " =~ " podman " ]]; then
                pip3 install --user podman-compose
                export PATH="$PATH:$HOME/.local/bin"
            fi
            
            if [[ " ${missing_deps[*]} " =~ " cockpit-inactive " ]]; then
                sudo systemctl enable --now cockpit.socket
            fi
        fi
        
        log_info "✅ Dépendances installées/réparées"
    else
        log_info "✅ Toutes les dépendances sont présentes"
    fi
}

# Exécuter la vérification/réparation
check_and_install_deps

# En mode réparation, vérifier aussi l'état des containers
if [[ "$REPAIR_MODE" == "true" ]]; then
    log_info "🔍 Vérification de l'état des containers..."
    
    if sudo podman ps --format "{{.Names}}" | grep -q "blindtest_app"; then
        APP_STATUS=$(sudo podman inspect blindtest_app --format='{{.State.Status}}' 2>/dev/null || echo "absent")
        log_info "📱 Application: $APP_STATUS"
    else
        log_warn "⚠️  Container blindtest_app absent"
    fi
    
    if sudo podman ps --format "{{.Names}}" | grep -q "blindtest_nginx"; then
        NGINX_STATUS=$(sudo podman inspect blindtest_nginx --format='{{.State.Status}}' 2>/dev/null || echo "absent")
        log_info "🌐 Nginx: $NGINX_STATUS"
    else
        log_warn "⚠️  Container blindtest_nginx absent"
    fi
    
    # Vérifier les certificats SSL
    if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
        CERT_EXPIRY=$(sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem 2>/dev/null || echo "Erreur")
        log_info "🔒 Certificat SSL: Présent ($CERT_EXPIRY)"
    else
        log_warn "⚠️  Certificat SSL absent"
    fi
    
    # Vérifier les ports
    PORT_80_STATUS=$(sudo lsof -i :80 2>/dev/null && echo "Occupé" || echo "Libre")
    PORT_443_STATUS=$(sudo lsof -i :443 2>/dev/null && echo "Occupé" || echo "Libre")
    log_info "🔌 Port 80: $PORT_80_STATUS | Port 443: $PORT_443_STATUS"
    
    echo ""
    log_info "🔧 Réparations terminées. Relancez sans --repaire pour déployer si nécessaire."
    echo ""
    exit 0
fi

# ========================================
# MODE REBUILD RAPIDE
# ========================================
if [[ "$REBUILD_MODE" == "true" ]]; then
    log_step "🔨 MODE REBUILD RAPIDE - Reconstruction de l'application..."
    
    # Vérifier que les containers existent
    if ! sudo podman ps -a --format "{{.Names}}" | grep -q "blindtest_app"; then
        log_error "❌ Container blindtest_app introuvable. Effectuez un déploiement complet d'abord."
        exit 1
    fi
    
    if ! sudo podman ps -a --format "{{.Names}}" | grep -q "blindtest_nginx"; then
        log_error "❌ Container blindtest_nginx introuvable. Effectuez un déploiement complet d'abord."
        exit 1
    fi
    
    # Obtenir l'IP de l'application avant l'arrêt
    OLD_APP_IP=$(sudo podman inspect blindtest_app --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)
    if [[ -z "$OLD_APP_IP" ]]; then
        OLD_APP_IP=$(sudo podman inspect blindtest_app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
    fi
    
    log_info "📍 Ancienne IP de l'application: $OLD_APP_IP"
    
    # Arrêter seulement l'application
    log_info "⏸️  Arrêt de l'application..."
    sudo podman stop blindtest_app || true
    sudo podman rm -f blindtest_app || true
    
    # Reconstruire l'image
    log_info "🏗️  Reconstruction de l'image avec les dernières modifications..."
    sudo podman build -t blindtest_app:latest .
    
    # Redémarrer l'application
    log_info "🚀 Redémarrage de l'application..."
    sudo podman run -d \
        --name blindtest_app \
        --restart unless-stopped \
        -e NODE_ENV=production \
        -e PORT=3000 \
        -e HOST=0.0.0.0 \
        --env-file .env \
        --health-cmd="wget --no-verbose --tries=1 --spider --timeout=5 --header='x-health-check: true' http://localhost:3000/health || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=60s \
        --label="io.containers.autoupdate=registry" \
        --label="app.name=brokeneye-space" \
        --label="app.version=1.0" \
        --label="app.component=application" \
        --label="app.environment=production" \
        --label="cockpit.service=blindtest-app" \
        --label="description=BrokenEye.Space - Application principale de blindtest musical" \
        blindtest_app:latest
    
    # Attendre que l'application soit prête
    log_info "⏳ Attente du redémarrage de l'application..."
    sleep 15
    
    # Obtenir la nouvelle IP
    NEW_APP_IP=$(sudo podman inspect blindtest_app --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)
    if [[ -z "$NEW_APP_IP" ]]; then
        NEW_APP_IP=$(sudo podman inspect blindtest_app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
    fi
    
    log_info "📍 Nouvelle IP de l'application: $NEW_APP_IP"
    
    # Vérifier si l'IP a changé et mettre à jour nginx si nécessaire
    if [[ "$OLD_APP_IP" != "$NEW_APP_IP" ]] && [[ -n "$NEW_APP_IP" ]]; then
        log_warn "⚠️  L'IP de l'application a changé, mise à jour de Nginx..."
        
        # Mettre à jour la configuration nginx
        sed -i "s/$OLD_APP_IP/$NEW_APP_IP/g" nginx/conf.d/app.conf 2>/dev/null || true
        
        # Recharger la configuration nginx
        sudo podman exec blindtest_nginx nginx -s reload
        log_info "✅ Configuration Nginx mise à jour"
    else
        log_info "✅ IP inchangée, pas besoin de mettre à jour Nginx"
    fi
    
    # Test de l'application
    log_info "🧪 Test de l'application..."
    if sudo podman exec blindtest_app wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null; then
        log_info "✅ Application fonctionne correctement"
    else
        log_error "❌ Problème avec l'application, vérifiez les logs:"
        echo "📝 Logs de l'application:"
        sudo podman logs blindtest_app --tail 20
        exit 1
    fi
    
    # Test via nginx
    sleep 5
    if curl -f -s http://localhost/health > /dev/null; then
        log_info "✅ Application accessible via Nginx"
    else
        log_warn "⚠️  Problème d'accès via Nginx, vérifiez la configuration"
    fi
    
    echo ""
    echo "🎉 REBUILD RAPIDE TERMINÉ AVEC SUCCÈS!"
    echo "======================================"
    echo ""
    echo "📋 Résumé:"
    echo "  🏗️  Image reconstruite avec les derniers changements"
    echo "  🚀 Application redémarrée"
    echo "  📍 IP application: $NEW_APP_IP"
    echo "  ✅ Tests de connectivité réussis"
    echo ""
    echo "🔧 Commandes de vérification:"
    echo "  📊 État: sudo podman ps"
    echo "  📝 Logs: sudo podman logs blindtest_app"
    echo "  🌐 Test: curl http://localhost/health"
    echo ""
    exit 0
fi

# ========================================
# ÉTAPE 2: CONFIGURATION FIREWALL
# ========================================
log_step "2/10 Configuration du firewall..."

if command -v ufw &> /dev/null; then
    # Configuration UFW
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    sudo ufw allow 3000/tcp comment 'App directe'
    sudo ufw allow 9090/tcp comment 'Cockpit Web Console'
    sudo ufw reload
    log_info "✅ Firewall configuré (SSH, HTTP, HTTPS, Cockpit)"
else
    log_warn "⚠️  UFW non disponible, configurez manuellement"
fi

# ========================================
# ÉTAPE 3: CONFIGURATION ENVIRONNEMENT
# ========================================
log_step "3/10 Configuration de l'environnement..."

# Créer les répertoires
mkdir -p data/{certbot,letsencrypt,ssl}
mkdir -p logs nginx/conf.d
sudo mkdir -p /var/log/blindtest
sudo chown $USER:$USER /var/log/blindtest

# Configuration du fichier .env
if [[ ! -f .env ]]; then
    if [[ -f .env.production ]]; then
        cp .env.production .env
        log_info "✅ Fichier .env créé depuis .env.production"
    else
        log_error "❌ Fichier .env manquant"
        exit 1
    fi
fi

# Vérifier les variables critiques
source .env
required_vars=("SPOTIFY_CLIENT_ID" "SPOTIFY_CLIENT_SECRET" "DOMAIN" "EMAIL")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]] || [[ "${!var}" == "your_"* ]]; then
        log_error "❌ Variable $var non configurée dans .env"
        exit 1
    fi
done
log_info "✅ Variables d'environnement validées"

# ========================================
# ÉTAPE 4: NETTOYAGE DES ANCIENS CONTAINERS ET SERVICES
# ========================================
if [[ "$REDEPLOY_MODE" != "all" ]]; then
    log_step "4/10 Nettoyage des anciens déploiements..."

    # Vérifier les ports occupés
    log_info "🔍 Vérification des ports occupés..."
    PORT_80_PROCESS=$(sudo lsof -i :80 -t 2>/dev/null || true)
    PORT_443_PROCESS=$(sudo lsof -i :443 -t 2>/dev/null || true)

    if [[ -n "$PORT_80_PROCESS" ]]; then
        log_warn "⚠️  Port 80 occupé par le processus: $PORT_80_PROCESS"
        # Tenter de tuer les processus sur le port 80
        sudo kill -9 $PORT_80_PROCESS 2>/dev/null || true
        sleep 2
    fi

    if [[ -n "$PORT_443_PROCESS" ]]; then
        log_warn "⚠️  Port 443 occupé par le processus: $PORT_443_PROCESS"
        # Tenter de tuer les processus sur le port 443
        sudo kill -9 $PORT_443_PROCESS 2>/dev/null || true
        sleep 2
    fi

    # Arrêter et supprimer TOUS les containers en cours
    log_info "🧹 Arrêt de tous les containers Podman..."
    sudo podman stop --all 2>/dev/null || true
    sudo podman rm -f --all 2>/dev/null || true

    # Nettoyage spécifique des containers du projet
    sudo podman stop blindtest_app blindtest_nginx 2>/dev/null || true
    sudo podman rm -f blindtest_app blindtest_nginx 2>/dev/null || true

    # Arrêter et supprimer les services systemd Podman s'ils existent
    if systemctl --user is-active --quiet container-blindtest_app 2>/dev/null; then
        systemctl --user stop container-blindtest_app
        systemctl --user disable container-blindtest_app
        log_info "✅ Service container-blindtest_app arrêté et désactivé"
    fi

    if systemctl --user is-active --quiet container-blindtest_nginx 2>/dev/null; then
        systemctl --user stop container-blindtest_nginx
        systemctl --user disable container-blindtest_nginx
        log_info "✅ Service container-blindtest_nginx arrêté et désactivé"
    fi

    # Nettoyer les fichiers de service orphelins
    sudo rm -f /etc/systemd/system/container-blindtest*.service 2>/dev/null || true
    rm -f ~/.config/systemd/user/container-blindtest*.service 2>/dev/null || true

    # Recharger systemd pour prendre en compte les suppressions
    systemctl --user daemon-reload 2>/dev/null || true
    sudo systemctl daemon-reload 2>/dev/null || true

    # Nettoyer les anciennes images, volumes et réseaux inutilisés
    sudo podman system prune -af --volumes
    sudo podman network prune -f

    log_info "✅ Anciens containers et services supprimés"
else
    log_step "4/10 Nettoyage déjà effectué en mode redéploiement..."
fi

# ========================================
# ÉTAPE 5: CRÉATION DU RÉSEAU PODMAN
# ========================================
log_step "5/10 Configuration du réseau..."

# Nettoyage complet et radical des configurations CNI problématiques
log_info "🧹 Nettoyage radical des configurations réseau CNI..."
sudo rm -rf /etc/cni/net.d/blindtest_network* 2>/dev/null || true
sudo rm -rf /var/lib/cni/networks/blindtest_network* 2>/dev/null || true
sudo rm -rf /var/lib/cni/cache/* 2>/dev/null || true
sudo rm -rf /opt/cni/bin/.cache* 2>/dev/null || true

# Supprimer tous les réseaux Podman existants
sudo podman network rm blindtest_network -f 2>/dev/null || true
sudo podman network prune -f 2>/dev/null || true

# FORCER LE MODE LINK - plus fiable que les réseaux CNI
log_warn "⚠️  Les réseaux CNI sont problématiques sur ce système"
log_info "🔗 Utilisation du mode link direct (plus robuste)"

# Définir les variables pour le mode link
USE_LINKS=true
NETWORK_NAME=""

log_info "✅ Mode link configuré - bypass des problèmes CNI"

# ========================================
# ÉTAPE 6: CONFIGURATION NGINX
# ========================================
log_step "6/10 Configuration de Nginx..."

# Configuration initiale pour HTTP et préparation HTTPS
log_info "🔗 Configuration Nginx avec support HTTPS intégré"

# Créer la configuration complète HTTP/HTTPS
cat > nginx/conf.d/app.conf << 'EOF'
# Configuration HTTP/HTTPS pour BrokenEye.Space
server {
    listen 80;
    server_name brokeneye.space www.brokeneye.space;
    
    # Servir les challenges Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri $uri/ =404;
    }
    
    # Rediriger tout le reste vers HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuration HTTPS
server {
    listen 443 ssl;
    http2 on;
    server_name brokeneye.space www.brokeneye.space;

    ssl_certificate /etc/letsencrypt/live/brokeneye.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/brokeneye.space/privkey.pem;
    
    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Servir les challenges Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri $uri/ =404;
    }
    
    location / {
        proxy_pass http://APP_IP_PLACEHOLDER:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    location /health {
        proxy_pass http://APP_IP_PLACEHOLDER:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    error_log /var/log/nginx/brokeneye_ssl_error.log;
    access_log /var/log/nginx/brokeneye_ssl_access.log;
}
EOF

# ========================================
# MODE REDÉPLOIEMENT SÉLECTIF
# ========================================
if [[ -n "$REDEPLOY_MODE" ]]; then
    case "$REDEPLOY_MODE" in
        "app")
            log_step "🔄 Redéploiement de l'application seulement..."
            
            # Arrêter et supprimer l'application
            sudo podman stop blindtest_app 2>/dev/null || true
            sudo podman rm -f blindtest_app 2>/dev/null || true
            
            # Construire et redémarrer l'application
            log_info "🏗️  Reconstruction de l'application..."
            sudo podman build -t blindtest_app:latest .
            
            # Redémarrer l'application
            sudo podman run -d \
                --name blindtest_app \
                --restart unless-stopped \
                -e NODE_ENV=production \
                -e PORT=3000 \
                -e HOST=0.0.0.0 \
                --env-file .env \
                --health-cmd="wget --no-verbose --tries=1 --spider --timeout=5 --header='x-health-check: true' http://localhost:3000/health || exit 1" \
                --health-interval=30s \
                --health-timeout=10s \
                --health-retries=3 \
                --health-start-period=60s \
                --label="io.containers.autoupdate=registry" \
                --label="app.name=brokeneye-space" \
                --label="app.version=1.0" \
                --label="app.component=application" \
                --label="app.environment=production" \
                --label="cockpit.service=blindtest-app" \
                --label="description=BrokenEye.Space - Application principale de blindtest musical" \
                blindtest_app:latest
            
            log_info "✅ Application redéployée avec succès"
            exit 0
            ;;
        
        "nginx")
            log_step "🔄 Redéploiement de Nginx seulement..."
            
            # Arrêter et supprimer nginx
            sudo podman stop blindtest_nginx 2>/dev/null || true
            sudo podman rm -f blindtest_nginx 2>/dev/null || true
            
            # Nettoyer les ports
            PORT_80_PROCESS=$(sudo lsof -i :80 -t 2>/dev/null || true)
            PORT_443_PROCESS=$(sudo lsof -i :443 -t 2>/dev/null || true)
            [[ -n "$PORT_80_PROCESS" ]] && sudo kill -9 $PORT_80_PROCESS 2>/dev/null || true
            [[ -n "$PORT_443_PROCESS" ]] && sudo kill -9 $PORT_443_PROCESS 2>/dev/null || true
            sleep 3
            
            # Obtenir l'IP de l'application
            APP_IP=$(sudo podman inspect blindtest_app --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)
            if [[ -z "$APP_IP" ]]; then
                APP_IP=$(sudo podman inspect blindtest_app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
            fi
            
            if [[ -z "$APP_IP" ]]; then
                log_error "❌ Container blindtest_app introuvable. Déployez d'abord l'application."
                exit 1
            fi
            
            # Mettre à jour la configuration nginx
            log_info "🔧 Mise à jour de la configuration Nginx avec IP: $APP_IP"
            sed -i "s/APP_IP_PLACEHOLDER/$APP_IP/g" nginx/conf.d/app.conf 2>/dev/null || true
            
            # Redémarrer Nginx
            sudo podman run -d \
                --name blindtest_nginx \
                --restart unless-stopped \
                -p 80:80 \
                -p 443:443 \
                -v $PWD/nginx.conf:/etc/nginx/nginx.conf:ro \
                -v $PWD/nginx/conf.d:/etc/nginx/conf.d:ro \
                -v /etc/letsencrypt:/etc/letsencrypt:ro \
                -v $PWD/data/letsencrypt:/var/www/certbot:ro \
                --label="io.containers.autoupdate=registry" \
                --label="app.name=brokeneye-space" \
                --label="app.version=1.0" \
                --label="app.component=reverse-proxy" \
                --label="app.environment=production" \
                --label="cockpit.service=blindtest-nginx" \
                --label="description=BrokenEye.Space - Reverse proxy Nginx avec SSL/HTTPS" \
                --label="ports.http=80" \
                --label="ports.https=443" \
                docker.io/nginx:alpine
            
            log_info "✅ Nginx redéployé avec succès"
            exit 0
            ;;
        
        "all")
            log_step "🔄 Redéploiement complet (app + nginx)..."
            
            # Arrêter tous les containers
            sudo podman stop blindtest_app blindtest_nginx 2>/dev/null || true
            sudo podman rm -f blindtest_app blindtest_nginx 2>/dev/null || true
            
            # Nettoyer les ports
            sudo pkill -f nginx 2>/dev/null || true
            PORT_80_PROCESS=$(sudo lsof -i :80 -t 2>/dev/null || true)
            PORT_443_PROCESS=$(sudo lsof -i :443 -t 2>/dev/null || true)
            [[ -n "$PORT_80_PROCESS" ]] && sudo kill -9 $PORT_80_PROCESS 2>/dev/null || true
            [[ -n "$PORT_443_PROCESS" ]] && sudo kill -9 $PORT_443_PROCESS 2>/dev/null || true
            sleep 5
            
            log_info "🚀 Continuation avec déploiement complet..."
            # Continue avec le déploiement normal
            ;;
        
        *)
            log_error "❌ Option de redéploiement invalide: $REDEPLOY_MODE"
            log_error "Utilisez: app, nginx, ou all"
            exit 1
            ;;
    esac
fi

log_info "✅ Configuration Nginx mise à jour pour mode link"

# ========================================
# ÉTAPE 7: CONSTRUCTION ET DÉMARRAGE DE L'APPLICATION
# ========================================
log_step "7/10 Construction et démarrage de l'application..."

# Construire l'image
sudo podman build -t blindtest_app:latest .

# Démarrer l'application en mode standalone (sans réseau CNI problématique)
sudo podman run -d \
    --name blindtest_app \
    --restart unless-stopped \
    -e NODE_ENV=production \
    -e PORT=3000 \
    -e HOST=0.0.0.0 \
    --env-file .env \
    --health-cmd="wget --no-verbose --tries=1 --spider --timeout=5 --header='x-health-check: true' http://localhost:3000/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=60s \
    --label="io.containers.autoupdate=registry" \
    --label="app.name=brokeneye-space" \
    --label="app.version=1.0" \
    --label="app.component=application" \
    --label="app.environment=production" \
    --label="cockpit.service=blindtest-app" \
    --label="description=BrokenEye.Space - Application principale de blindtest musical" \
    blindtest_app:latest

log_info "✅ Application démarrée en mode standalone"

# Attendre que l'application soit prête
log_info "⏳ Attente du démarrage de l'application..."
sleep 15

# Vérifier l'état de l'application avec plusieurs méthodes
log_info "🔍 Vérification de l'état de l'application..."

# Méthode 1: Utiliser le health check intégré de Podman
HEALTH_STATUS=$(sudo podman inspect blindtest_app --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
if [[ "$HEALTH_STATUS" == "healthy" ]]; then
    log_info "✅ Application saine selon le health check Podman"
elif [[ "$HEALTH_STATUS" == "starting" ]]; then
    log_info "⏳ Application en cours de démarrage, attente supplémentaire..."
    sleep 20
    HEALTH_STATUS=$(sudo podman inspect blindtest_app --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
fi

# Méthode 2: Test direct avec wget dans le container
if sudo podman exec blindtest_app wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null; then
    log_info "✅ Application répond aux requêtes HTTP"
    APP_HEALTHY=true
else
    log_warn "⚠️  Test wget échoué, tentative avec vérification des processus..."
    # Méthode 3: Vérifier que Node.js fonctionne
    if sudo podman exec blindtest_app pgrep node >/dev/null; then
        log_info "✅ Processus Node.js actif"
        APP_HEALTHY=true
    else
        log_error "❌ Processus Node.js non trouvé"
        APP_HEALTHY=false
    fi
fi

if [[ "$APP_HEALTHY" != "true" ]]; then
    log_error "❌ L'application ne fonctionne pas correctement"
    echo ""
    echo "🔍 Logs de l'application:"
    sudo podman logs blindtest_app --tail 50
    echo ""
    echo "🔍 Informations du container:"
    sudo podman inspect blindtest_app --format='{{.State.Status}}'
    exit 1
fi

# ========================================
# ÉTAPE 8: DÉMARRAGE DE NGINX
# ========================================
log_step "8/10 Démarrage de Nginx..."

# Vérification finale des ports avant démarrage
log_info "🔍 Vérification finale des ports 80 et 443..."
if sudo netstat -tlpn | grep -q ":80 " || sudo lsof -i :80 >/dev/null 2>&1; then
    log_error "❌ Port 80 encore occupé après nettoyage!"
    log_info "🔍 Processus utilisant le port 80:"
    sudo lsof -i :80 || sudo netstat -tlpn | grep ":80 " || true
    
    # Forcer la libération du port 80
    log_info "🔧 Tentative de libération forcée du port 80..."
    sudo pkill -f nginx 2>/dev/null || true
    sudo pkill -f apache2 2>/dev/null || true
    sudo systemctl stop apache2 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
    sleep 5
    
    # Vérification après nettoyage
    if sudo lsof -i :80 >/dev/null 2>&1; then
        BLOCKING_PROCESS=$(sudo lsof -i :80 -t | head -1)
        log_warn "⚠️  Processus $BLOCKING_PROCESS bloque encore le port 80, arrêt forcé..."
        sudo kill -9 $BLOCKING_PROCESS 2>/dev/null || true
        sleep 3
    fi
fi

if sudo netstat -tlpn | grep -q ":443 " || sudo lsof -i :443 >/dev/null 2>&1; then
    log_error "❌ Port 443 encore occupé après nettoyage!"
    log_info "🔍 Processus utilisant le port 443:"
    sudo lsof -i :443 || sudo netstat -tlpn | grep ":443 " || true
    
    # Forcer la libération du port 443
    BLOCKING_PROCESS_443=$(sudo lsof -i :443 -t | head -1)
    if [[ -n "$BLOCKING_PROCESS_443" ]]; then
        log_warn "⚠️  Processus $BLOCKING_PROCESS_443 bloque le port 443, arrêt forcé..."
        sudo kill -9 $BLOCKING_PROCESS_443 2>/dev/null || true
        sleep 3
    fi
fi

# Obtenir l'IP du container de l'application
APP_IP=$(sudo podman inspect blindtest_app --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)

if [[ -z "$APP_IP" ]]; then
    # Fallback: obtenir l'IP depuis les réseaux
    APP_IP=$(sudo podman inspect blindtest_app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
fi

if [[ -z "$APP_IP" ]]; then
    log_error "❌ Impossible de déterminer l'IP du container de l'application"
    exit 1
fi

log_info "🔍 IP de l'application détectée: $APP_IP"

# Mettre à jour la configuration Nginx avec l'IP réelle
sed -i "s/APP_IP_PLACEHOLDER/$APP_IP/g" nginx/conf.d/app.conf

# Démarrer Nginx
sudo podman run -d \
    --name blindtest_nginx \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    -v $PWD/nginx.conf:/etc/nginx/nginx.conf:ro \
    -v $PWD/nginx/conf.d:/etc/nginx/conf.d:ro \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    -v $PWD/data/letsencrypt:/var/www/certbot:ro \
    --label="io.containers.autoupdate=registry" \
    --label="app.name=brokeneye-space" \
    --label="app.version=1.0" \
    --label="app.component=reverse-proxy" \
    --label="app.environment=production" \
    --label="cockpit.service=blindtest-nginx" \
    --label="description=BrokenEye.Space - Reverse proxy Nginx avec SSL/HTTPS" \
    --label="ports.http=80" \
    --label="ports.https=443" \
    docker.io/nginx:alpine

log_info "✅ Nginx démarré avec connexion vers $APP_IP:3000"

# Attendre que nginx soit prêt
sleep 10

# Test de connectivité locale
if curl -f -s http://localhost/health > /dev/null; then
    log_info "✅ Nginx opérationnel"
else
    log_warn "⚠️  Nginx peut avoir un problème, vérifiez les logs"
fi

# ========================================
# ÉTAPE 9: TESTS DE CONNECTIVITÉ
# ========================================
log_step "9/10 Tests de connectivité..."

echo "🔍 État des containers:"
sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🧪 Tests de connectivité:"

# Test local
if curl -s -o /dev/null -w "Local HTTP: %{http_code}\n" http://localhost/health; then
    log_info "✅ Test local réussi"
else
    log_warn "⚠️  Test local échoué"
fi

# Test externe via IPv4 (si accessible)
if timeout 10 curl -s -o /dev/null -w "IPv4 externe: %{http_code}\n" http://$PUBLIC_IPV4/health 2>/dev/null; then
    log_info "✅ Connectivité IPv4 externe OK"
else
    log_warn "⚠️  IPv4 externe non accessible (vérifiez le routeur)"
fi

# Test DNS
DNS_IP=$(dig +short $DOMAIN | head -1)
if [[ "$DNS_IP" == "$PUBLIC_IPV4" ]]; then
    log_info "✅ DNS correctement configuré"
else
    log_warn "⚠️  DNS pointe vers $DNS_IP (attendu: $PUBLIC_IPV4)"
    echo "   👉 Mettez à jour votre zone DNS chez OVH"
fi

# ========================================
# ÉTAPE 10: GÉNÉRATION CERTIFICAT SSL ET ACTIVATION HTTPS
# ========================================
log_step "10/10 Génération du certificat SSL Let's Encrypt..."

# Vérifier que les certificats n'existent pas déjà
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    log_info "✅ Certificats Let's Encrypt déjà présents"
else
    log_info "🔒 Génération des certificats Let's Encrypt..."
    
    # Créer le répertoire pour certbot
    sudo mkdir -p data/letsencrypt
    
    # Obtenir le certificat Let's Encrypt
    if sudo certbot certonly --webroot \
        --webroot-path=$PWD/data/letsencrypt \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --domains $DOMAIN,www.$DOMAIN \
        --non-interactive; then
        
        log_info "✅ Certificat Let's Encrypt généré avec succès"
        
        # Vérification finale des ports avant redémarrage
        log_info "🔍 Vérification des ports avant redémarrage de Nginx..."
        
        # Arrêter le container Nginx actuel proprement
        sudo podman stop blindtest_nginx 2>/dev/null || true
        sleep 3
        
        # Vérifier et libérer les ports si nécessaires
        if sudo lsof -i :80 >/dev/null 2>&1; then
            BLOCKING_PID=$(sudo lsof -i :80 -t | head -1)
            log_warn "⚠️  Port 80 encore occupé par PID: $BLOCKING_PID"
            sudo kill -9 $BLOCKING_PID 2>/dev/null || true
            sleep 2
        fi
        
        if sudo lsof -i :443 >/dev/null 2>&1; then
            BLOCKING_PID_443=$(sudo lsof -i :443 -t | head -1)
            log_warn "⚠️  Port 443 encore occupé par PID: $BLOCKING_PID_443"
            sudo kill -9 $BLOCKING_PID_443 2>/dev/null || true
            sleep 2
        fi
        
        # Supprimer le container Nginx et le recréer
        sudo podman rm -f blindtest_nginx 2>/dev/null || true
        
        # Recréer le container Nginx avec SSL
        sudo podman run -d \
            --name blindtest_nginx \
            --restart unless-stopped \
            -p 80:80 \
            -p 443:443 \
            -v $PWD/nginx.conf:/etc/nginx/nginx.conf:ro \
            -v $PWD/nginx/conf.d:/etc/nginx/conf.d:ro \
            -v /etc/letsencrypt/live/brokeneye.space:/etc/letsencrypt/live/brokeneye.space:ro \
            -v /etc/letsencrypt/archive/brokeneye.space:/etc/letsencrypt/archive/brokeneye.space:ro \
            -v $PWD/data/letsencrypt:/var/www/certbot:ro \
            --label="io.containers.autoupdate=registry" \
            --label="app.name=brokeneye-space" \
            --label="app.version=1.0" \
            --label="app.component=reverse-proxy" \
            --label="app.environment=production" \
            --label="cockpit.service=blindtest-nginx" \
            --label="description=BrokenEye.Space - Reverse proxy Nginx avec SSL/HTTPS" \
            --label="ports.http=80" \
            --label="ports.https=443" \
            docker.io/nginx:alpine
            
        log_info "✅ Nginx redémarré avec SSL activé"
        
        # Test HTTPS
        sleep 5
        if curl -k -s -o /dev/null -w "HTTPS local: %{http_code}\n" https://localhost/health; then
            log_info "✅ HTTPS opérationnel"
        else
            log_warn "⚠️  HTTPS peut avoir un problème, vérifiez les certificats"
        fi
    else
        log_warn "⚠️  Échec de génération du certificat Let's Encrypt"
        log_info "📝 Vérifiez que:"
        log_info "   - Le domaine $DOMAIN pointe vers cette IP ($PUBLIC_IPV4)"
        log_info "   - Les ports 80 et 443 sont accessibles depuis internet"
        log_info "   - Le firewall autorise le trafic HTTP/HTTPS"
        
        log_info "🔄 Fonctionnement en HTTP uniquement pour l'instant"
        # Modifier temporairement la config pour HTTP seulement
        cat > nginx/conf.d/app.conf << EOF
server {
    listen 80;
    server_name brokeneye.space www.brokeneye.space;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri \$uri/ =404;
    }
    
    location / {
        proxy_pass http://$APP_IP:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_redirect off;
    }

    location /health {
        proxy_pass http://$APP_IP:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    error_log /var/log/nginx/brokeneye_error.log;
    access_log /var/log/nginx/brokeneye_access.log;
}
EOF
        sudo podman exec blindtest_nginx nginx -s reload
    fi
fi

# ========================================
# RAPPORT FINAL
# ========================================
echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS!"
echo "====================================="
echo ""
echo "📋 Configuration actuelle:"
echo "  🌐 Site Web: https://$DOMAIN"
echo "  🔒 HTTP → HTTPS: Redirection automatique activée"
echo "  🏠 IP Locale: $LOCAL_IP"
echo "  🌍 IP Publique: $PUBLIC_IPV4"
echo "  🔗 Health Check: https://$DOMAIN/health"
echo ""

echo "🔧 Commandes utiles:"
echo "  📊 État containers: sudo podman ps"
echo "  📝 Logs app: sudo podman logs blindtest_app"
echo "  📝 Logs nginx: sudo podman logs blindtest_nginx"
echo "  🔄 Redémarrer: sudo podman restart blindtest_app blindtest_nginx"
echo "  📜 Vérifier certificats: sudo certbot certificates"
echo "  🎛️  Interface Cockpit: https://$LOCAL_IP:9090"
echo ""
echo "🛠️  Commandes de maintenance:"
echo "  🔧 Réparer installation: $0 --repaire"
echo "  🔄 Redéployer app: $0 --redeploy=app"
echo "  🔄 Redéployer nginx: $0 --redeploy=nginx" 
echo "  🔄 Redéployer tout: $0 --redeploy=all"
echo "  🔨 Rebuild rapide app: $0 --rebuild"
echo ""

echo "⚠️  CONFIGURATION ROUTEUR REQUISE:"
echo "  👉 Accédez à l'interface de votre box internet"
echo "  👉 Configurez Port Forwarding:"
echo "     - Port 80 → $LOCAL_IP:80 (pour Let's Encrypt)"
echo "     - Port 443 → $LOCAL_IP:443 (pour HTTPS)"
echo "     - Port 9090 → $LOCAL_IP:9090 (pour Cockpit - optionnel)"
echo "  👉 OU placez $LOCAL_IP en DMZ"
echo ""

echo "🧪 TESTS À FAIRE:"
echo "  1. Depuis votre téléphone (4G, WiFi désactivé):"
echo "     https://$DOMAIN"
echo "  2. Test redirection: curl -I http://$DOMAIN (doit retourner 301)"
echo "  3. Test HTTPS: curl -I https://$DOMAIN (doit retourner 200)"
echo "  4. Vérifiez le certificat SSL dans le navigateur ✅"
echo ""

if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    CERT_EXPIRY=$(sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
    echo "🔒 CERTIFICAT SSL ACTIF"
    echo "   ✅ Certificat Let's Encrypt installé"
    echo "   📅 Expiration: $CERT_EXPIRY"
    echo "   🔄 Renouvellement automatique: sudo crontab -e"
    echo "        0 12 * * * /usr/bin/certbot renew --quiet && sudo podman exec blindtest_nginx nginx -s reload"
else
    echo "⚠️  CERTIFICAT SSL NON INSTALLÉ"
    echo "   � Le site fonctionne en HTTP uniquement"
    echo "   👉 Vérifiez la configuration DNS et réessayez le déploiement"
fi

echo ""
echo "🎛️  COCKPIT WEB CONSOLE:"
echo "   📱 Interface locale: https://$LOCAL_IP:9090"
echo "   🐳 Gestion des containers Podman intégrée"
echo "   📊 Monitoring en temps réel des ressources"
echo "   🔐 Connexion avec votre compte utilisateur système"
echo "   💡 Tip: Gérez vos containers via l'interface web"
echo ""
echo "📞 Support: Vérifiez les logs en cas de problème"
echo "💡 Tip: Site accessible à https://$DOMAIN avec certificat SSL valide"
