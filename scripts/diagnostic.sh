#!/bin/bash

# Diagnostic rapide BrokenEye.Space
# Usage: ./scripts/diagnostic.sh

echo "🔍 DIAGNOSTIC RAPIDE - BROKENEYE.SPACE"
echo "======================================"
echo ""

# Configuration
DOMAIN="brokeneye.space"
PUBLIC_IPV4="82.66.66.208"

# Test containers
echo "🐳 CONTAINERS:"
sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(blindtest|NAMES)"
echo ""

# Health checks
echo "🏥 HEALTH CHECKS:"
for container in blindtest_app blindtest_nginx; do
    if sudo podman ps | grep -q "$container"; then
        STATUS=$(sudo podman inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "n/a")
        echo "$container: $STATUS"
    fi
done
echo ""

# Test réseau local
echo "🏠 TESTS LOCAUX:"
curl -s -o /dev/null -w "HTTP localhost: %{http_code}\n" http://localhost/health 2>/dev/null || echo "HTTP localhost: ÉCHEC"
curl -s -o /dev/null -w "App directe: %{http_code}\n" http://localhost:3000/health 2>/dev/null || echo "App directe: ÉCHEC"
echo ""

# Test DNS
echo "🌐 DNS:"
echo "Résolution $DOMAIN: $(dig +short $DOMAIN | head -1)"
echo "IP attendue: $PUBLIC_IPV4"
echo ""

# Test externe (rapide)
echo "🌍 TEST EXTERNE (5s max):"
timeout 5 curl -s -o /dev/null -w "HTTP externe: %{http_code}\n" http://$PUBLIC_IPV4/ 2>/dev/null || echo "HTTP externe: TIMEOUT/ÉCHEC"
echo ""

# Recommandations
echo "💡 ACTIONS:"
if ! sudo podman ps | grep -q blindtest; then
    echo "❌ Containers arrêtés → ./scripts/deploy-production.sh"
elif ! curl -s http://localhost/health >/dev/null 2>&1; then
    echo "❌ App locale KO → Vérifiez les logs: sudo podman logs blindtest_app_new"
elif ! timeout 3 curl -s http://$PUBLIC_IPV4/ >/dev/null 2>&1; then
    echo "❌ Accès externe bloqué → Configurez le routeur (Port Forwarding)"
else
    echo "✅ Configuration semble OK → Testez depuis téléphone (4G)"
fi
echo ""
echo "📱 Test final: http://$DOMAIN (depuis téléphone 4G)"
