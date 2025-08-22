#!/bin/bash

echo "🔍 Test de configuration DNS pour brokeneye.space"
echo "================================================"

DOMAIN="brokeneye.space"

echo "1. Serveurs DNS autoritatifs:"
dig +short NS $DOMAIN

echo ""
echo "2. Enregistrements A:"
dig +short A $DOMAIN
dig +short A www.$DOMAIN

echo ""
echo "3. Test de résolution depuis différents serveurs:"
echo "   - Google DNS (8.8.8.8):"
dig @8.8.8.8 +short A $DOMAIN
echo "   - Cloudflare DNS (1.1.1.1):"
dig @1.1.1.1 +short A $DOMAIN
echo "   - OVH DNS (2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4):"
dig @2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4 +short A $DOMAIN 2>/dev/null || echo "     (serveur non accessible)"

echo ""
echo "4. Test d'accès HTTP/HTTPS:"
echo "   - Test HTTP:"
curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" http://$DOMAIN/health || echo "HTTP: Échec"
echo "   - Test HTTPS:"
curl -s -k -o /dev/null -w "HTTPS %{http_code} - %{time_total}s\n" https://$DOMAIN/health || echo "HTTPS: Échec"

echo ""
echo "5. Vérification des certificats actuels:"
if [[ -f "./data/ssl/fullchain.pem" ]]; then
    echo "   Certificat présent:"
    openssl x509 -in ./data/ssl/fullchain.pem -noout -subject -issuer -dates
else
    echo "   Aucun certificat trouvé"
fi

echo ""
echo "6. État des conteneurs:"
sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
