#!/bin/bash

# Test rapide de connectivité vers brokeneye.space
# Usage: ./scripts/test-domain.sh

set -euo pipefail

DOMAIN="brokeneye.space"
SERVER_IP="2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"

echo "🔍 Test de connectivité pour $DOMAIN"
echo "===================================="

# Test de résolution DNS
echo "1. Résolution DNS:"
echo "   $DOMAIN -> $(dig +short $DOMAIN 2>/dev/null || echo 'N/A')"
echo "   www.$DOMAIN -> $(dig +short www.$DOMAIN 2>/dev/null || echo 'N/A')"

# Test de ping
echo ""
echo "2. Test de ping vers $DOMAIN:"
if ping -c 2 -W 3 $DOMAIN >/dev/null 2>&1; then
    echo "   ✅ $DOMAIN est pingable"
else
    echo "   ❌ $DOMAIN n'est pas pingable"
fi

# Test de connectivité HTTP (port 80)
echo ""
echo "3. Test connectivité HTTP (port 80):"
if timeout 10 curl -s -I "http://$DOMAIN" >/dev/null 2>&1; then
    echo "   ✅ Port 80 accessible sur $DOMAIN"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" 2>/dev/null || echo "000")
    echo "   Status HTTP: $HTTP_STATUS"
else
    echo "   ❌ Port 80 non accessible sur $DOMAIN"
fi

# Test de connectivité HTTPS (port 443)
echo ""
echo "4. Test connectivité HTTPS (port 443):"
if timeout 10 curl -s -I "https://$DOMAIN" >/dev/null 2>&1; then
    echo "   ✅ Port 443 accessible sur $DOMAIN"
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
    echo "   Status HTTPS: $HTTPS_STATUS"
else
    echo "   ❌ Port 443 non accessible sur $DOMAIN"
fi

# Informations sur l'IP locale
echo ""
echo "5. Informations serveur local:"
LOCAL_IPV4=$(curl -4 -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "N/A")
LOCAL_IPV6=$(curl -6 -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "N/A")
echo "   IPv4 locale: $LOCAL_IPV4"
echo "   IPv6 locale: $LOCAL_IPV6"
echo "   IP cible: $SERVER_IP"

if [[ "$LOCAL_IPV4" == "$SERVER_IP" ]]; then
    echo "   ✅ IPv4 correspond"
elif [[ "$LOCAL_IPV4" == "N/A" ]]; then
    echo "   ❓ IPv4 non détectable"
else
    echo "   ❌ IPv4 différente (vous n'êtes pas sur le serveur cible)"
fi

echo ""
echo "===================================="

# Recommandation
if [[ "$LOCAL_IPV4" != "$SERVER_IP" ]] && [[ "$LOCAL_IPV4" != "N/A" ]]; then
    echo "⚠️  Vous semblez tester depuis un autre serveur"
    echo "    Ce script est à lancer sur le serveur OVH (2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4)"
else
    echo "📋 Tests terminés. Consultez les résultats ci-dessus."
fi
