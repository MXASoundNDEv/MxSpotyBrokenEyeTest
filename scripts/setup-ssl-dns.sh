#!/bin/bash
set -e

echo "🔒 Configuration SSL avec challenge DNS pour brokeneye.space"
echo "DNS Servers: ns10.ovh.net, 2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"
echo "=================================================="

DOMAIN="brokeneye.space"
EMAIL="admin@brokeneye.space"
SSL_DIR="./data/ssl"
LETSENCRYPT_DIR="./data/letsencrypt"

# Fonction pour afficher les étapes
log_step() {
    echo "[STEP] $1"
}

log_info() {
    echo "[INFO] ✅ $1"
}

log_warn() {
    echo "[WARN] ⚠️  $1"
}

log_error() {
    echo "[ERROR] ❌ $1"
}

# Étape 1: Vérification des prérequis
log_step "1/6 Vérification des prérequis..."
if ! command -v dig &> /dev/null; then
    log_error "dig n'est pas installé. Installation..."
    sudo apt update && sudo apt install -y dnsutils
fi

# Étape 2: Vérification DNS actuelle
log_step "2/6 Vérification DNS actuelle..."
CURRENT_IP=$(dig +short $DOMAIN A | head -1)
log_info "IP actuelle pour $DOMAIN: $CURRENT_IP"

if [[ -z "$CURRENT_IP" ]]; then
    log_error "Impossible de résoudre $DOMAIN"
    exit 1
fi

# Étape 3: Arrêter Nginx pour libérer le port 80
log_step "3/6 Préparation du challenge DNS..."
if sudo podman ps | grep -q blindtest_nginx; then
    log_info "Arrêt temporaire de Nginx..."
    sudo podman stop blindtest_nginx
fi

# Étape 4: Instructions pour le challenge DNS
log_step "4/6 Instructions pour le challenge DNS..."
echo ""
echo "⚠️  ATTENTION: Le challenge DNS nécessite une intervention manuelle"
echo ""
echo "1. Exécutez cette commande pour démarrer le challenge:"
echo "   sudo podman run --rm -it -v $PWD/data/letsencrypt:/etc/letsencrypt \\"
echo "   docker.io/certbot/certbot:latest certonly --manual --preferred-challenges dns \\"
echo "   --email $EMAIL --agree-tos --no-eff-email \\"
echo "   -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "2. Certbot vous demandera d'ajouter un enregistrement TXT DNS"
echo "3. Ajoutez l'enregistrement TXT dans votre zone DNS OVH:"
echo "   - Nom: _acme-challenge"
echo "   - Type: TXT" 
echo "   - Valeur: (celle fournie par certbot)"
echo "   - TTL: 300"
echo ""
echo "4. Vérifiez la propagation DNS avec:"
echo "   dig _acme-challenge.$DOMAIN TXT"
echo ""
echo "5. Appuyez sur Entrée dans certbot quand l'enregistrement est propagé"
echo ""

read -p "Voulez-vous continuer avec le challenge DNS maintenant? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Challenge DNS reporté. Redémarrage de Nginx..."
    sudo podman start blindtest_nginx
    exit 0
fi

# Étape 5: Exécution du challenge DNS
log_step "5/6 Exécution du challenge DNS..."
sudo podman run --rm -it -v $PWD/data/letsencrypt:/etc/letsencrypt \
    docker.io/certbot/certbot:latest certonly --manual --preferred-challenges dns \
    --email $EMAIL --agree-tos --no-eff-email \
    -d $DOMAIN -d www.$DOMAIN

# Étape 6: Configuration Nginx avec les nouveaux certificats
log_step "6/6 Configuration des certificats..."
if [[ -f "./data/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    log_info "Certificats Let's Encrypt obtenus avec succès!"
    
    # Copier les certificats vers le répertoire SSL
    sudo cp "./data/letsencrypt/live/$DOMAIN/fullchain.pem" "./data/ssl/"
    sudo cp "./data/letsencrypt/live/$DOMAIN/privkey.pem" "./data/ssl/"
    
    # Redémarrer Nginx avec les nouveaux certificats
    log_info "Redémarrage de Nginx avec les certificats Let's Encrypt..."
    if sudo podman ps | grep -q blindtest_nginx; then
        sudo podman restart blindtest_nginx
    else
        sudo podman start blindtest_nginx
    fi
    
    log_info "✅ SSL configuré avec succès!"
    log_info "Testez avec: curl -I https://$DOMAIN/health"
    
else
    log_error "Les certificats Let's Encrypt n'ont pas été obtenus"
    log_info "Redémarrage de Nginx avec le certificat auto-signé..."
    sudo podman start blindtest_nginx
    exit 1
fi

echo ""
echo "🎉 Configuration SSL terminée!"
echo "Votre application est maintenant accessible via HTTPS avec un certificat valide."
