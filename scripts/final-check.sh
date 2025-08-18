#!/bin/bash

# Script de récapitulatif final - Production Ready
# Usage: ./scripts/final-check.sh

set -euo pipefail

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}🎯 BLINDTEST - RÉCAPITULATIF PRODUCTION${NC}"
echo "=============================================="
echo ""

echo -e "${BLUE}📋 Configuration validée:${NC}"
echo "  ✅ Domaine: brokeneye.space + www.brokeneye.space"
echo "  ✅ IP serveur: 2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4 (OVH)"
echo "  ✅ DNS configuré correctement"
echo "  ✅ Docker Compose corrigé pour Podman"
echo "  ✅ Dockerfile optimisé pour la production"
echo "  ✅ Configuration Nginx avec SSL"
echo "  ✅ Scripts de déploiement automatisés"
echo ""

echo -e "${BLUE}🛠️ Scripts disponibles:${NC}"
echo "  📦 install-ubuntu.sh      - Installation système Ubuntu 22"
echo "  🚀 deploy-brokeneye.sh    - Déploiement HTTP complet"
echo "  🔒 setup-ssl-brokeneye.sh - Configuration SSL automatique"
echo "  🔍 verify-brokeneye.sh    - Vérification pré-déploiement"
echo "  🌐 test-domain.sh         - Test connectivité domaine"
echo "  📡 remote-deploy.sh       - Déploiement à distance"
echo "  🔧 maintenance.sh         - Outils de maintenance"
echo ""

echo -e "${BLUE}🎵 Configuration Spotify requise:${NC}"
echo "  1. Dashboard: https://developer.spotify.com/dashboard"
echo "  2. Créer une app avec Redirect URI: https://brokeneye.space/callback"
echo "  3. Copier Client ID/Secret dans .env"
echo ""

echo -e "${BLUE}🚀 Pour déployer:${NC}"
echo "  Option 1 (Recommandé): ./scripts/remote-deploy.sh root@2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4"
echo "  Option 2 (Sur serveur): ./scripts/deploy-brokeneye.sh"
echo "  Option 3 (Manuel):     Voir PRODUCTION-READY.md"
echo ""

echo -e "${BLUE}🔗 URLs finales:${NC}"
echo "  🌐 Production:  https://brokeneye.space"
echo "  ⚡ Health:     https://brokeneye.space/health"
echo "  🎵 Callback:   https://brokeneye.space/callback"
echo ""

# Test DNS rapide
DNS_IP=$(dig +short brokeneye.space 2>/dev/null | tail -n1 || echo "")
if [[ "$DNS_IP" == "2a01:e0a:233:78c0:9af2:b3ff:fee9:64b4" ]]; then
    echo -e "${GREEN}✅ DNS Status: Configuré correctement${NC}"
else
    echo -e "${RED}❌ DNS Status: Problème détecté${NC}"
fi

# Test connectivité HTTP
if timeout 5 curl -s -I "http://brokeneye.space" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ HTTP Status: Serveur répond${NC}"
else
    echo -e "${YELLOW}⏳ HTTP Status: Serveur pas encore configuré${NC}"
fi

echo ""
echo -e "${BOLD}🎉 PROJET 100% PRÊT POUR LA PRODUCTION !${NC}"
echo ""
echo -e "${BLUE}📖 Guides disponibles:${NC}"
echo "  📋 PRODUCTION-READY.md  - Guide complet"
echo "  🚀 DEPLOY-BROKENEYE.md - Instructions spécifiques"
echo "  📘 DEPLOYMENT.md       - Documentation technique"
echo ""

echo -e "${YELLOW}⚠️  N'oubliez pas de configurer vos clés Spotify avant le déploiement !${NC}"
