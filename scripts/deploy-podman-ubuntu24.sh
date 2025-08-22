#!/bin/bash
# 🐳 Script de déploiement Podman pour MxSpoty BlindTest sur Ubuntu 24
# Utilisation: ./deploy-podman-ubuntu24.sh [--rebuild|--restart|--logs|--status]

set -e

# Configuration
IMAGE_NAME="mxspoty-blindtest"
CONTAINER_NAME="mxspoty-blindtest-prod"
PORT_HOST="3000"
PORT_CONTAINER="3000"
NETWORK_NAME="mxspoty-network"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Ubuntu 24
    if ! grep -q "24.04" /etc/os-release 2>/dev/null; then
        log_warning "Ce script est optimisé pour Ubuntu 24.04"
    fi
    
    # Vérifier Podman
    if ! command -v podman &> /dev/null; then
        log_error "Podman n'est pas installé"
        log_info "Installation: sudo apt-get install -y podman"
        exit 1
    fi
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js n'est pas installé (nécessaire pour les tests)"
    fi
    
    log_success "Prérequis vérifiés"
}

# Installation des dépendances système
install_dependencies() {
    log_info "Installation des dépendances système Ubuntu 24..."
    
    sudo apt-get update -q
    sudo apt-get install -y \
        podman \
        curl \
        jq \
        netcat-openbsd \
        htop \
        nginx-full
    
    log_success "Dépendances installées"
}

# Configuration Podman rootless
setup_podman() {
    log_info "Configuration Podman rootless..."
    
    # Créer les dossiers de configuration
    mkdir -p ~/.config/containers
    
    # Configuration des registres
    cat > ~/.config/containers/registries.conf << EOF
unqualified-search-registries = ["docker.io", "ghcr.io"]

[[registry]]
location = "docker.io"
insecure = false

[[registry]]
location = "ghcr.io"
insecure = false
EOF

    # Configuration des politiques
    cat > ~/.config/containers/policy.json << EOF
{
    "default": [
        {
            "type": "insecureAcceptAnything"
        }
    ],
    "transports": {
        "docker-daemon": {
            "": [{"type": "insecureAcceptAnything"}]
        }
    }
}
EOF

    # Créer un réseau custom
    podman network exists $NETWORK_NAME || podman network create $NETWORK_NAME
    
    log_success "Podman configuré"
}

# Build de l'image
build_image() {
    log_info "Build de l'image Podman..."
    
    # Nettoyage des images précédentes
    podman rmi $IMAGE_NAME:latest 2>/dev/null || true
    
    # Build avec optimisations
    podman build \
        --tag $IMAGE_NAME:latest \
        --tag $IMAGE_NAME:$(date +%Y%m%d-%H%M%S) \
        --label "version=$(date +%Y%m%d-%H%M%S)" \
        --label "build-host=$(hostname)" \
        --label "ubuntu-version=$(lsb_release -rs)" \
        --no-cache \
        .
    
    log_success "Image construite: $IMAGE_NAME:latest"
}

# Déploiement du conteneur
deploy_container() {
    log_info "Déploiement du conteneur..."
    
    # Arrêter le conteneur existant s'il existe
    if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Arrêt du conteneur existant..."
        podman stop $CONTAINER_NAME || true
        podman rm $CONTAINER_NAME || true
    fi
    
    # Créer et démarrer le nouveau conteneur
    podman run -d \
        --name $CONTAINER_NAME \
        --network $NETWORK_NAME \
        -p $PORT_HOST:$PORT_CONTAINER \
        -e NODE_ENV=production \
        -e PORT=$PORT_CONTAINER \
        --restart unless-stopped \
        --security-opt label=disable \
        --health-cmd "curl -f http://localhost:$PORT_CONTAINER/health || exit 1" \
        --health-interval 30s \
        --health-timeout 10s \
        --health-retries 3 \
        $IMAGE_NAME:latest
    
    log_success "Conteneur déployé: $CONTAINER_NAME"
}

# Tests post-déploiement
run_tests() {
    log_info "Exécution des tests post-déploiement..."
    
    # Attendre que le conteneur soit prêt
    log_info "Attente du démarrage du conteneur..."
    sleep 10
    
    # Test health check
    for i in {1..30}; do
        if curl -sf http://localhost:$PORT_HOST/health > /dev/null 2>&1; then
            log_success "Health check réussi"
            break
        fi
        log_info "Tentative $i/30..."
        sleep 2
    done
    
    if ! curl -sf http://localhost:$PORT_HOST/health > /dev/null 2>&1; then
        log_error "Health check échoué"
        show_logs
        exit 1
    fi
    
    # Tests fonctionnels
    log_info "Tests fonctionnels..."
    
    # Test page d'accueil
    if curl -s http://localhost:$PORT_HOST/ | grep -q "BlindTest" 2>/dev/null; then
        log_success "Page d'accueil accessible"
    else
        log_warning "Page d'accueil potentiellement inaccessible"
    fi
    
    # Test API
    if curl -s http://localhost:$PORT_HOST/api/health > /dev/null 2>&1; then
        log_success "API accessible"
    else
        log_warning "API potentiellement inaccessible"
    fi
    
    log_success "Tests post-déploiement terminés"
}

# Configuration Nginx reverse proxy
setup_nginx() {
    log_info "Configuration Nginx reverse proxy..."
    
    # Créer la configuration Nginx
    sudo tee /etc/nginx/sites-available/mxspoty-blindtest << EOF
server {
    listen 80;
    server_name localhost;
    
    # Logs spécifiques
    access_log /var/log/nginx/mxspoty-access.log;
    error_log /var/log/nginx/mxspoty-error.log;
    
    # Headers de sécurité
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:$PORT_HOST;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:$PORT_HOST/health;
        access_log off;
    }
}
EOF

    # Activer le site
    sudo ln -sf /etc/nginx/sites-available/mxspoty-blindtest /etc/nginx/sites-enabled/
    
    # Tester la configuration
    sudo nginx -t
    
    # Recharger Nginx
    sudo systemctl reload nginx
    
    log_success "Nginx configuré"
}

# Affichage des logs
show_logs() {
    log_info "Logs du conteneur $CONTAINER_NAME:"
    podman logs --tail 50 $CONTAINER_NAME
}

# Affichage du status
show_status() {
    log_info "Status du déploiement:"
    
    echo "=== Conteneurs ==="
    podman ps -a --filter name=$CONTAINER_NAME
    
    echo "=== Images ==="
    podman images $IMAGE_NAME
    
    echo "=== Réseau ==="
    podman network inspect $NETWORK_NAME 2>/dev/null || echo "Réseau non trouvé"
    
    echo "=== Health Check ==="
    if curl -sf http://localhost:$PORT_HOST/health > /dev/null 2>&1; then
        echo "✅ Health check: OK"
    else
        echo "❌ Health check: FAILED"
    fi
    
    echo "=== Ressources système ==="
    free -h
    df -h
    
    echo "=== Nginx ==="
    sudo systemctl status nginx --no-pager -l || echo "Nginx non configuré"
}

# Nettoyage complet
cleanup() {
    log_info "Nettoyage du déploiement..."
    
    # Arrêter et supprimer le conteneur
    podman stop $CONTAINER_NAME 2>/dev/null || true
    podman rm $CONTAINER_NAME 2>/dev/null || true
    
    # Supprimer les images
    podman rmi $IMAGE_NAME:latest 2>/dev/null || true
    
    # Supprimer le réseau
    podman network rm $NETWORK_NAME 2>/dev/null || true
    
    # Désactiver Nginx
    sudo rm -f /etc/nginx/sites-enabled/mxspoty-blindtest
    sudo systemctl reload nginx 2>/dev/null || true
    
    log_success "Nettoyage terminé"
}

# Menu principal
case "$1" in
    --rebuild)
        log_info "🔄 Rebuild complet..."
        check_prerequisites
        build_image
        deploy_container
        run_tests
        ;;
    --restart)
        log_info "🔄 Redémarrage du conteneur..."
        podman restart $CONTAINER_NAME
        run_tests
        ;;
    --logs)
        show_logs
        ;;
    --status)
        show_status
        ;;
    --nginx)
        setup_nginx
        ;;
    --cleanup)
        cleanup
        ;;
    --install)
        check_prerequisites
        install_dependencies
        setup_podman
        log_success "Installation terminée. Utilisez --rebuild pour déployer."
        ;;
    *)
        echo "🐳 Déploiement Podman MxSpoty BlindTest - Ubuntu 24"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --install     Installation initiale des dépendances"
        echo "  --rebuild     Build et déploiement complet"
        echo "  --restart     Redémarrage du conteneur existant"
        echo "  --logs        Affichage des logs"
        echo "  --status      Status du déploiement"
        echo "  --nginx       Configuration Nginx reverse proxy"
        echo "  --cleanup     Nettoyage complet"
        echo ""
        echo "Exemples:"
        echo "  $0 --install     # Premier déploiement"
        echo "  $0 --rebuild     # Mise à jour complète"
        echo "  $0 --status      # Vérifier l'état"
        ;;
esac
