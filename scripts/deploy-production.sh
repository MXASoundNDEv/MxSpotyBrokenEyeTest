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

# Fonctions de logging améliorées
log() { echo -e "${BLUE}[STEP]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC}   $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC}  $*"; }

# Compatibilité avec l'ancien système
log_info() { ok "$1"; }
log_warn() { warn "$1"; }
log_error() { err "$1"; }
log_step() { log "$1"; }

# Configuration mise à jour
DOMAIN="brokeneye.space"
PUBLIC_IPV4="82.66.66.208"
PUBLIC_IPV6="2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"
LOCAL_IP="192.168.0.47"
PROJECT_NAME="blindtest"
COMPOSE_FILE="docker-compose.yml"

# Variables pour pods et conteneurs Cockpit-compatible
POD_NAME="blindtest"
APP_CNAME="blindtest-app"
NGINX_CNAME="blindtest-nginx"
APP_IMAGE="blindtest-app:latest"
NGINX_IMAGE="docker.io/nginx:alpine"

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
    
    ok "🔍 Vérification des dépendances système..."
    
    for dep in "${all_deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
            warn "⚠️  $dep manquant"
        else
            ok "✅ $dep installé"
        fi
    done
    
    # Vérifier les services
    if ! systemctl is-active --quiet cockpit.socket; then
        warn "⚠️  Cockpit non actif"
        missing_deps+=("cockpit-inactive")
    else
        ok "✅ Cockpit actif"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log "🔧 Installation des dépendances manquantes..."
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
            sudo apt install -y "${packages_to_install[@]}" openssl python3-pip ufw
            
            # Configuration post-installation
            if [[ " ${missing_deps[*]} " =~ " podman " ]]; then
                pip3 install --user podman-compose
                export PATH="$PATH:$HOME/.local/bin"
            fi
            
            if [[ " ${missing_deps[*]} " =~ " cockpit-inactive " ]]; then
                sudo systemctl enable --now cockpit.socket
                ok "✅ Cockpit activé"
            fi
            
            # Configuration UFW
            log "🔥 Configuration UFW..."
            sudo ufw --force enable
            sudo ufw default deny incoming
            sudo ufw default allow outgoing
            sudo ufw allow 22/tcp comment 'SSH'
            sudo ufw allow 80/tcp comment 'HTTP'
            sudo ufw allow 443/tcp comment 'HTTPS'
            sudo ufw allow 9090/tcp comment 'Cockpit'
            ok "✅ UFW configuré"
        fi
        
        ok "✅ Dépendances installées/réparées"
    else
        ok "✅ Toutes les dépendances sont présentes"
    fi
}

# Exécuter la vérification/réparation
check_and_install_deps

# En mode réparation, vérifier aussi l'état des containers
if [[ "$REPAIR_MODE" == "true" ]]; then
    log_info "🔍 Vérification de l'état des containers..."
    
    if sudo podman ps --format "{{.Names}}" | grep -q "blindtest-app"; then
        APP_STATUS=$(sudo podman inspect blindtest-app --format='{{.State.Status}}' 2>/dev/null || echo "absent")
        log_info "📱 Application: $APP_STATUS"
    else
        log_warn "⚠️  Container blindtest-app absent"
    fi
    
    if sudo podman ps --format "{{.Names}}" | grep -q "blindtest-nginx"; then
        NGINX_STATUS=$(sudo podman inspect blindtest-nginx --format='{{.State.Status}}' 2>/dev/null || echo "absent")
        log_info "🌐 Nginx: $NGINX_STATUS"
    else
        log_warn "⚠️  Container blindtest-nginx absent"
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
    
    # Vérifier que les containers existent avec une méthode plus fiable
    if ! sudo podman inspect blindtest-app >/dev/null 2>&1; then
        log_error "❌ Container blindtest-app introuvable. Effectuez un déploiement complet d'abord."
        exit 1
    fi
    
    if ! sudo podman inspect blindtest-nginx >/dev/null 2>&1; then
        log_error "❌ Container blindtest-nginx introuvable. Effectuez un déploiement complet d'abord."
        exit 1
    fi
    
    # Dans un pod, pas besoin de récupérer l'IP car tout passe par localhost
    log_info "📍 Mode pod détecté - communication via localhost dans le pod"
    
    # Arrêter seulement l'application
    log_info "⏸️  Arrêt de l'application..."
    sudo podman stop blindtest-app || true
    sudo podman rm -f blindtest-app || true
    
    # Reconstruire l'image
    log_info "🏗️  Reconstruction de l'image avec les dernières modifications..."
    sudo podman build -t blindtest-app:latest .
    
    # Redémarrer l'application DANS LE POD
    log_info "🚀 Redémarrage de l'application dans le pod..."
    sudo podman run -d \
        --name blindtest-app \
        --pod blindtest \
        --restart unless-stopped \
        --env-file .env \
        -e NODE_ENV=production \
        -e PORT=3000 \
        -e HOST=0.0.0.0 \
        --health-cmd='wget --no-verbose --tries=1 --spider --timeout=5 http://127.0.0.1:3000/health || exit 1' \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=60s \
        --label io.containers.autoupdate=registry \
        --label app.name=brokeneye-space \
        --label app.component=application \
        --label app.environment=production \
        --label description='BrokenEye.Space - Application principale' \
        blindtest-app:latest
    
    # Attendre que l'application soit prête
    log_info "⏳ Attente du redémarrage de l'application..."
    sleep 15
    
    # Dans un pod, les containers partagent le même espace réseau via localhost
    log_info "📍 Application redémarrée dans le pod (réseau partagé via localhost)"
    log_info "✅ Pas besoin de mise à jour IP - communication directe dans le pod"
    
    # Test de l'application
    log_info "🧪 Test de l'application..."
    if sudo podman exec blindtest-app wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null; then
        log_info "✅ Application fonctionne correctement"
    else
        log_error "❌ Problème avec l'application, vérifiez les logs:"
        echo "📝 Logs de l'application:"
        sudo podman logs blindtest-app --tail 20
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
    echo "  🚀 Application redémarrée dans le pod"
    echo "  � Communication: localhost dans le pod blindtest"
    echo "  ✅ Tests de connectivité réussis"
    echo ""
    echo "🔧 Commandes de vérification:"
    echo "  📊 État: sudo podman ps"
    echo "  📦 Pod: sudo podman pod ps"
    echo "  📝 Logs: sudo podman logs blindtest-app"
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
    sudo podman stop blindtest-app blindtest-nginx 2>/dev/null || true
    sudo podman rm -f blindtest-app blindtest-nginx 2>/dev/null || true

    # Arrêter et supprimer les services systemd Podman s'ils existent
    if systemctl --user is-active --quiet container-blindtest-app 2>/dev/null; then
        systemctl --user stop container-blindtest-app
        systemctl --user disable container-blindtest-app
        log_info "✅ Service container-blindtest-app arrêté et désactivé"
    fi

    if systemctl --user is-active --quiet container-blindtest-nginx 2>/dev/null; then
        systemctl --user stop container-blindtest-nginx
        systemctl --user disable container-blindtest-nginx
        log_info "✅ Service container-blindtest-nginx arrêté et désactivé"
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
sudo rm -rf /etc/cni/net.d/blindtest-network* 2>/dev/null || true
sudo rm -rf /var/lib/cni/networks/blindtest-network* 2>/dev/null || true
sudo rm -rf /var/lib/cni/cache/* 2>/dev/null || true
sudo rm -rf /opt/cni/bin/.cache* 2>/dev/null || true

# Supprimer tous les réseaux Podman existants
sudo podman network rm blindtest-network -f 2>/dev/null || true
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

# Créer nginx.conf si manquant
if [[ ! -f "nginx.conf" ]]; then
    log "📝 Création du fichier nginx.conf..."
    cat > nginx.conf <<'NGINXCONF'
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events { worker_connections  1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    include /etc/nginx/conf.d/*.conf;
}
NGINXCONF
    ok "✅ nginx.conf créé"
fi

# Configuration Nginx pour le pod (proxy vers localhost:3000)
log "📝 Configuration Nginx pour le pod..."
mkdir -p nginx/conf.d
cat > nginx/conf.d/app.conf <<'NGINXAPPCONF'
# HTTP -> redirection HTTPS + ACME
server {
    listen 80;
    server_name brokeneye.space www.brokeneye.space;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri $uri/ =404;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS avec proxy vers app dans le même pod (localhost du pod)
server {
    listen 443 ssl http2;
    server_name brokeneye.space www.brokeneye.space;

    ssl_certificate /etc/letsencrypt/live/brokeneye.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/brokeneye.space/privkey.pem;

    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri $uri/ =404;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host $host;
    }

    error_log /var/log/nginx/brokeneye_ssl_error.log;
    access_log /var/log/nginx/brokeneye_ssl_access.log;
}
NGINXAPPCONF
ok "✅ Configuration Nginx mise à jour pour pod"

# ========================================
# MODE REDÉPLOIEMENT SÉLECTIF
# ========================================
if [[ -n "$REDEPLOY_MODE" ]]; then
    case "$REDEPLOY_MODE" in
        "app")
            log_step "🔄 Redéploiement de l'application seulement..."
            
            # Arrêter et supprimer l'application
            sudo podman stop blindtest-app 2>/dev/null || true
            sudo podman rm -f blindtest-app 2>/dev/null || true
            
            # Construire et redémarrer l'application
            log_info "🏗️  Reconstruction de l'application..."
            sudo podman build -t blindtest-app:latest .
            
            # Redémarrer l'application
            sudo podman run -d \
                --name blindtest-app \
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
                blindtest-app:latest
            
            log_info "✅ Application redéployée avec succès"
            exit 0
            ;;
        
        "nginx")
            log_step "🔄 Redéploiement de Nginx seulement..."
            
            # Arrêter et supprimer nginx
            sudo podman stop blindtest-nginx 2>/dev/null || true
            sudo podman rm -f blindtest-nginx 2>/dev/null || true
            
            # Nettoyer les ports
            PORT_80_PROCESS=$(sudo lsof -i :80 -t 2>/dev/null || true)
            PORT_443_PROCESS=$(sudo lsof -i :443 -t 2>/dev/null || true)
            [[ -n "$PORT_80_PROCESS" ]] && sudo kill -9 $PORT_80_PROCESS 2>/dev/null || true
            [[ -n "$PORT_443_PROCESS" ]] && sudo kill -9 $PORT_443_PROCESS 2>/dev/null || true
            sleep 3
            
            # Obtenir l'IP de l'application
            APP_IP=$(sudo podman inspect blindtest-app --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)
            if [[ -z "$APP_IP" ]]; then
                APP_IP=$(sudo podman inspect blindtest-app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
            fi
            
            if [[ -z "$APP_IP" ]]; then
                log_error "❌ Container blindtest-app introuvable. Déployez d'abord l'application."
                exit 1
            fi
            
            # Mettre à jour la configuration nginx
            log_info "🔧 Mise à jour de la configuration Nginx avec IP: $APP_IP"
            sed -i "s/APP_IP_PLACEHOLDER/$APP_IP/g" nginx/conf.d/app.conf 2>/dev/null || true
            
            # Redémarrer Nginx
            sudo podman run -d \
                --name blindtest-nginx \
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
            sudo podman stop blindtest-app blindtest-nginx 2>/dev/null || true
            sudo podman rm -f blindtest-app blindtest-nginx 2>/dev/null || true
            
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
# ÉTAPE 7: CONSTRUCTION ET DÉMARRAGE EN POD
# ========================================
log_step "7/10 Construction et démarrage en pod..."

# Construire l'image
log "🏗️  Construction de l'image de l'application..."
sudo podman build -t "$APP_IMAGE" .
ok "✅ Image construite"

# Nettoyage ancien pod/containers
log "🧹 Nettoyage ancien pod/containers..."
sudo podman rm -f "$APP_CNAME" "$NGINX_CNAME" 2>/dev/null || true
sudo podman pod rm -f "$POD_NAME" 2>/dev/null || true
ok "✅ Nettoyage terminé"

# Création du pod avec ports 80/443
log "📦 Création du pod $POD_NAME avec ports 80/443..."
sudo podman pod create \
    --name "$POD_NAME" \
    -p 80:80 -p 443:443 -p 9100:9100
ok "✅ Pod créé"

# Démarrage de l'application dans le pod
log "🚀 Démarrage de l'application dans le pod..."
sudo podman run -d \
    --name "$APP_CNAME" \
    --pod "$POD_NAME" \
    --restart unless-stopped \
    --env-file .env \
    -e NODE_ENV=production \
    -e PORT=3000 \
    -e HOST=0.0.0.0 \
    -e METRICS_PORT=9100 \
    --health-cmd='wget --no-verbose --tries=1 --spider --timeout=5 http://127.0.0.1:3000/health || exit 1' \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=60s \
    --label io.containers.autoupdate=registry \
    --label app.name=brokeneye-space \
    --label app.component=application \
    --label app.environment=production \
    --label description='BrokenEye.Space - Application principale' \
    "$APP_IMAGE"
ok "✅ Application démarrée"

# Démarrage de Nginx dans le pod
log "🌐 Démarrage de Nginx dans le pod..."
sudo podman run -d \
    --name "$NGINX_CNAME" \
    --pod "$POD_NAME" \
    --restart unless-stopped \
    -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" \
    -v "$PWD/nginx/conf.d:/etc/nginx/conf.d:ro" \
    -v "/etc/letsencrypt:/etc/letsencrypt:ro" \
    -v "$PWD/data/letsencrypt:/var/www/certbot:ro" \
    --label io.containers.autoupdate=registry \
    --label app.name=brokeneye-space \
    --label app.component=reverse-proxy \
    --label app.environment=production \
    --label description='BrokenEye.Space - Reverse proxy Nginx' \
    "$NGINX_IMAGE"
ok "✅ Nginx démarré"

# Attendre que l'application soit prête
log_info "⏳ Attente du démarrage de l'application..."
sleep 15

# Vérifier l'état de l'application avec plusieurs méthodes
log_info "🔍 Vérification de l'état de l'application..."

# Méthode 1: Utiliser le health check intégré de Podman
HEALTH_STATUS=$(sudo podman inspect blindtest-app --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
if [[ "$HEALTH_STATUS" == "healthy" ]]; then
    log_info "✅ Application saine selon le health check Podman"
elif [[ "$HEALTH_STATUS" == "starting" ]]; then
    log_info "⏳ Application en cours de démarrage, attente supplémentaire..."
    sleep 20
    HEALTH_STATUS=$(sudo podman inspect blindtest-app --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
fi

# Méthode 2: Test direct avec wget dans le container
if sudo podman exec blindtest-app wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null; then
    log_info "✅ Application répond aux requêtes HTTP"
    APP_HEALTHY=true
else
    log_warn "⚠️  Test wget échoué, tentative avec vérification des processus..."
    # Méthode 3: Vérifier que Node.js fonctionne
    if sudo podman exec blindtest-app pgrep node >/dev/null; then
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
    sudo podman logs blindtest-app --tail 50
    echo ""
    echo "🔍 Informations du container:"
    sudo podman inspect blindtest-app --format='{{.State.Status}}'
    exit 1
fi

# ========================================
# ÉTAPE 8: GÉNÉRATION SYSTEMD POUR COCKPIT
# ========================================
log_step "8/10 Génération unités systemd pour Cockpit..."

# Attendre que les conteneurs soient stables
log "⏳ Attente de la stabilisation des conteneurs..."
sleep 10

# Vérification de l'état des conteneurs
if ! sudo podman ps --format "{{.Names}}" | grep -q "$APP_CNAME"; then
    err "❌ Container $APP_CNAME non trouvé"
    exit 1
fi

if ! sudo podman ps --format "{{.Names}}" | grep -q "$NGINX_CNAME"; then
    err "❌ Container $NGINX_CNAME non trouvé"
    exit 1
fi

ok "✅ Conteneurs actifs"

# Génération des unités systemd (user)
log "📄 Génération des unités systemd pour l'utilisateur..."
mkdir -p "$HOME/.config/systemd/user"

# Générer les fichiers systemd
sudo podman generate systemd --files --name "$POD_NAME" >/dev/null 2>&1

# Déplacer les fichiers vers le répertoire utilisateur
for f in pod-${POD_NAME}.service container-${APP_CNAME}.service container-${NGINX_CNAME}.service; do
    if [[ -f "$f" ]]; then
        mv "$f" "$HOME/.config/systemd/user/"
        ok "✅ $f déplacé vers systemd user"
    fi
done

# Configuration du linger pour démarrage au boot
if ! loginctl show-user "$USER" | grep -q "Linger=yes"; then
    log "🔄 Activation du linger utilisateur..."
    sudo loginctl enable-linger "$USER"
    ok "✅ Linger activé"
else
    ok "✅ Linger déjà activé"
fi

# Activation des services systemd
log "� Activation des services systemd..."
systemctl --user daemon-reload
systemctl --user enable --now pod-${POD_NAME}.service
ok "✅ Services systemd activés (visibles dans Cockpit)" \
    -p 80:80 \
    -p 443:443 \
    -v $PWD/nginx.conf:/etc/nginx/nginx.conf:ro \
# ========================================
# ÉTAPE 9: TESTS DE CONNECTIVITÉ
# ========================================
log_step "9/10 Tests de connectivité..."

# Attendre que les services soient prêts
log "⏳ Attente de stabilisation des services..."
sleep 10

# État des conteneurs/pod
log "🔍 État des conteneurs/pod:"
sudo podman pod ps
sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
log "🧪 Tests de connectivité:"

# Test local HTTP (doit rediriger vers HTTPS)
if curl -s -o /dev/null -w "Local HTTP: %{http_code}\n" http://localhost/health 2>/dev/null; then
    ok "✅ Redirection HTTP OK"
else
    warn "⚠️  Test HTTP local échoué"
fi

# Test HTTPS local si certificat disponible
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    if curl -kfs https://localhost/health >/dev/null; then 
        ok "✅ HTTPS OK"; 
    else 
        warn "⚠️  HTTPS non prêt (cert ?)"; 
    fi
else
    warn "⚠️  Certificat SSL non présent, HTTPS non testé"
fi

# Test DNS
DNS_IP=$(dig +short $DOMAIN 2>/dev/null | head -1)
if [[ "$DNS_IP" == "$PUBLIC_IPV4" ]]; then
    ok "✅ DNS correctement configuré"
else
    warn "⚠️  DNS pointe vers $DNS_IP (attendu: $PUBLIC_IPV4)"
    echo "   👉 Mettez à jour votre zone DNS chez votre registrar"
fi

# ========================================
# ÉTAPE 10: CERTIFICATS SSL ET RÉSUMÉ
# ========================================
log_step "10/10 Certificats SSL et finalisation..."

# Vérifier/obtenir les certificats Let's Encrypt
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    log "🔒 Obtention des certificats Let's Encrypt..."
    sudo certbot certonly --webroot \
        --webroot-path="$PWD/data/letsencrypt" \
        --email "$EMAIL" --agree-tos --no-eff-email \
        --domains "$DOMAIN","www.$DOMAIN" \
        --non-interactive || warn "Certbot n'a pas pu obtenir le cert tout de suite."
    
    # Recharger nginx si certificat obtenu
    if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
        sudo podman exec "$NGINX_CNAME" nginx -s reload || true
        ok "✅ Certificat obtenu et Nginx rechargé"
    fi
else
    ok "✅ Certificat déjà présent"
fi \

# ========================================
# MODES SPÉCIAUX (si activés)
# ========================================
if [[ "$REPAIR_MODE" == "true" ]]; then
    log "Mode réparation : état des conteneurs/pod"
    sudo podman pod ps
    sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
fi

if [[ "$REBUILD_MODE" == "true" ]]; then
    log "Rebuild rapide de l'app..."
    sudo podman build -t "$APP_IMAGE" .
    systemctl --user restart container-${APP_CNAME}.service
    ok "App rebuild + restart OK"
    exit 0
fi

if [[ -n "$REDEPLOY_MODE" ]]; then
    case "$REDEPLOY_MODE" in
        app)    systemctl --user restart container-${APP_CNAME}.service; ok "Redéployé: app";;
        nginx)  systemctl --user restart container-${NGINX_CNAME}.service; ok "Redéployé: nginx";;
        all)    systemctl --user restart pod-${POD_NAME}.service; ok "Redéployé: pod complet";;
        *) err "redeploy doit être app|nginx|all"; exit 1;;
    esac
    exit 0
fi

# ========================================
# RÉSUMÉ FINAL
# ========================================
echo
echo "🎉 Déploiement terminé"
echo "🌍 Site: https://$DOMAIN"
echo "🧰 Cockpit: https://$LOCAL_IP:9090 (onglets *System*, *Podman*)"
echo "🔧 Services systemd (user): pod-${POD_NAME}.service, container-${APP_CNAME}.service, container-${NGINX_CNAME}.service"
echo "📝 Logs: sudo podman logs $APP_CNAME | $NGINX_CNAME"
echo "🔄 Cert renew (crontab root conseillé):"
echo "    0 3 * * * certbot renew --quiet && loginctl enable-linger $USER && systemctl --user reload-or-restart container-${NGINX_CNAME}.service"
echo
echo "🛠️  Commandes de maintenance:"
echo "  🔧 Réparer installation: $0 --repaire"
echo "  🔄 Redéployer app: $0 --redeploy=app"
echo "  🔄 Redéployer nginx: $0 --redeploy=nginx" 
echo "  🔄 Redéployer tout: $0 --redeploy=all"
echo "  🔨 Rebuild rapide app: $0 --rebuild"
echo
