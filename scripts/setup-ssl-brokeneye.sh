#!/bin/bash

# Script SSL spécifique pour brokeneye.space
# Usage: ./scripts/setup-ssl-brokeneye.sh

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

DOMAIN="brokeneye.space"
EMAIL="admin@brokeneye.space"

echo "🔒 Configuration SSL pour $DOMAIN"

# Vérifier que l'application fonctionne
log_step "1/5 Vérification de l'application..."
if ! curl -f -s http://localhost/health > /dev/null; then
    log_error "L'application ne répond pas sur http://localhost/health"
    log_error "Lancez d'abord: ./scripts/deploy-brokeneye.sh"
    exit 1
fi

# Vérifier que le domaine est accessible
log_step "2/5 Vérification de l'accès au domaine..."
if curl -f -s --connect-timeout 10 "http://$DOMAIN/health" > /dev/null; then
    log_info "✅ $DOMAIN est accessible"
else
    log_error "❌ $DOMAIN n'est pas accessible. Vérifiez:"
    echo "- Que le domaine pointe vers ce serveur"
    echo "- Que les ports 80/443 sont ouverts"
    echo "- Que nginx fonctionne"
    exit 1
fi

# Créer les répertoires SSL
log_step "3/5 Préparation des répertoires SSL..."
mkdir -p data/{certbot,letsencrypt}

# Test du challenge ACME
log_info "Test du répertoire ACME challenge..."
echo "test" > data/letsencrypt/test.txt
if curl -f -s "http://$DOMAIN/.well-known/acme-challenge/test.txt" | grep -q "test"; then
    log_info "✅ Challenge ACME accessible"
    rm -f data/letsencrypt/test.txt
else
    log_warn "⚠️  Challenge ACME peut-être non accessible"
fi

# Obtenir le certificat SSL
log_step "4/5 Obtention du certificat SSL..."
podman run --rm \
    --name certbot-brokeneye \
    -v "./data/certbot:/etc/letsencrypt:Z" \
    -v "./data/letsencrypt:/var/www/certbot:Z" \
    certbot/certbot:latest \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domains "$DOMAIN" \
    --domains "www.$DOMAIN" \
    --non-interactive

if [[ $? -eq 0 ]]; then
    log_info "✅ Certificat SSL obtenu avec succès!"
    
    # Vérifier que les certificats existent
    if [[ -f "data/certbot/live/$DOMAIN/fullchain.pem" ]]; then
        log_info "✅ Fichiers de certificat trouvés"
    else
        log_error "❌ Fichiers de certificat non trouvés"
        exit 1
    fi
    
    # Redémarrer nginx pour charger les certificats
    log_step "5/5 Redémarrage de nginx..."
    podman-compose restart nginx
    
    # Attendre le redémarrage
    sleep 5
    
    # Tester HTTPS
    log_info "Test de la connectivité HTTPS..."
    if curl -f -s --connect-timeout 10 "https://$DOMAIN/health" > /dev/null; then
        log_info "✅ HTTPS fonctionne: https://$DOMAIN/health"
    else
        log_warn "⚠️  HTTPS non accessible immédiatement (peut prendre quelques minutes)"
    fi
    
    # Tester la redirection HTTP vers HTTPS
    REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/health")
    if [[ "$REDIRECT_CODE" == "301" ]]; then
        log_info "✅ Redirection HTTP->HTTPS configurée"
    else
        log_warn "⚠️  Redirection HTTP->HTTPS: code $REDIRECT_CODE"
    fi
    
    echo ""
    echo "🎉 SSL configuré avec succès!"
    echo ""
    echo "🔗 Testez votre site:"
    echo "  - HTTP (redirigé): http://$DOMAIN"
    echo "  - HTTPS: https://$DOMAIN"
    echo "  - Health check: https://$DOMAIN/health"
    echo ""
    echo "🔄 Renouvellement automatique configuré via le service certbot"
    echo ""
    
    # Informations sur le certificat
    log_info "Informations du certificat:"
    openssl x509 -in "data/certbot/live/$DOMAIN/fullchain.pem" -text -noout | grep -E "(Subject|Issuer|Not After)" || true
    
else
    log_error "❌ Échec de l'obtention du certificat SSL"
    log_error "Vérifiez:"
    echo "- Que $DOMAIN et www.$DOMAIN pointent vers ce serveur"
    echo "- Que les ports 80/443 sont ouverts"
    echo "- Que nginx fonctionne et sert /.well-known/acme-challenge/"
    echo ""
    echo "Logs de certbot:"
    podman run --rm -v "./data/certbot:/etc/letsencrypt:Z" certbot/certbot:latest logs || true
    exit 1
fi
