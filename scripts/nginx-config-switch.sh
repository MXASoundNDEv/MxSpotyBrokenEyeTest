#!/bin/bash

echo "🔧 Outil de basculement de configuration Nginx"
echo "=============================================="

NGINX_CONF_DIR="/home/mxa/MxSpotyBrokenEyeTest/nginx/conf.d"
SSL_CERT_PATH="/home/mxa/MxSpotyBrokenEyeTest/data/ssl/fullchain.pem"
SSL_KEY_PATH="/home/mxa/MxSpotyBrokenEyeTest/data/ssl/privkey.pem"

check_ssl_certificates() {
    if [[ -f "$SSL_CERT_PATH" && -f "$SSL_KEY_PATH" ]]; then
        echo "✅ Certificats SSL trouvés"
        return 0
    else
        echo "❌ Certificats SSL manquants"
        return 1
    fi
}

switch_to_http() {
    echo "🔄 Basculement vers configuration HTTP uniquement..."
    
    # Sauvegarder la config SSL
    if [[ -f "$NGINX_CONF_DIR/app.conf" ]]; then
        cp "$NGINX_CONF_DIR/app.conf" "$NGINX_CONF_DIR/app-ssl.conf.bak"
    fi
    
    # Utiliser la config HTTP
    cp "$NGINX_CONF_DIR/app-http-only.conf" "$NGINX_CONF_DIR/app.conf"
    echo "✅ Configuration HTTP activée"
}

switch_to_ssl() {
    echo "🔄 Basculement vers configuration HTTPS..."
    
    # Restaurer la config SSL ou utiliser celle par défaut
    if [[ -f "$NGINX_CONF_DIR/app-ssl.conf.bak" ]]; then
        cp "$NGINX_CONF_DIR/app-ssl.conf.bak" "$NGINX_CONF_DIR/app.conf"
    else
        echo "❌ Sauvegarde SSL non trouvée, utilisation de la config actuelle"
    fi
    echo "✅ Configuration HTTPS activée"
}

auto_configure() {
    echo "🤖 Configuration automatique..."
    
    if check_ssl_certificates; then
        switch_to_ssl
    else
        switch_to_http
    fi
}

restart_nginx() {
    echo "🔄 Redémarrage de Nginx..."
    cd /home/mxa/MxSpotyBrokenEyeTest
    sudo podman restart blindtest_nginx 2>/dev/null || echo "Container nginx non trouvé, démarrage nécessaire"
}

case "$1" in
    "http")
        switch_to_http
        restart_nginx
        ;;
    "ssl")
        if check_ssl_certificates; then
            switch_to_ssl
            restart_nginx
        else
            echo "❌ Impossible de basculer vers SSL : certificats manquants"
            exit 1
        fi
        ;;
    "auto")
        auto_configure
        restart_nginx
        ;;
    "check")
        check_ssl_certificates
        echo "État actuel de la configuration :"
        if grep -q "listen 443 ssl" "$NGINX_CONF_DIR/app.conf" 2>/dev/null; then
            echo "   Configuration actuelle: HTTPS"
        else
            echo "   Configuration actuelle: HTTP"
        fi
        ;;
    *)
        echo "Usage: $0 {http|ssl|auto|check}"
        echo ""
        echo "  http  - Basculer vers HTTP uniquement"
        echo "  ssl   - Basculer vers HTTPS (nécessite des certificats)"
        echo "  auto  - Configuration automatique selon les certificats disponibles"
        echo "  check - Vérifier l'état des certificats et configuration"
        exit 1
        ;;
esac
