#!/bin/bash

echo "🔒 Configuration Let's Encrypt avec challenge DNS pour brokeneye.space"
echo "=================================================="

echo "[INFO] Pour obtenir un certificat Let's Encrypt valide, vous devez configurer un enregistrement TXT dans votre DNS OVH."
echo "[INFO] Ce script va générer le token DNS à ajouter."
echo ""

# Arrêter temporairement Nginx pour libérer le port 443
echo "[STEP] 1/4 Arrêt temporaire de Nginx..."
sudo podman stop blindtest_nginx

# Utiliser certbot avec challenge DNS
echo "[STEP] 2/4 Génération du challenge DNS..."
sudo podman run --rm -it \
  -v ./data/letsencrypt:/etc/letsencrypt \
  docker.io/certbot/certbot:latest certonly \
  --manual \
  --preferred-challenges dns \
  --email admin@brokeneye.space \
  --agree-tos \
  --no-eff-email \
  -d brokeneye.space \
  -d www.brokeneye.space

echo ""
echo "[STEP] 3/4 Copie des certificats..."
if [ -f "./data/letsencrypt/live/brokeneye.space/fullchain.pem" ]; then
    sudo cp ./data/letsencrypt/live/brokeneye.space/fullchain.pem ./data/ssl/
    sudo cp ./data/letsencrypt/live/brokeneye.space/privkey.pem ./data/ssl/
    echo "[SUCCESS] ✅ Certificats Let's Encrypt copiés"
else
    echo "[WARN] ⚠️  Certificats Let's Encrypt non trouvés, utilisation du certificat auto-signé"
fi

echo "[STEP] 4/4 Redémarrage de Nginx..."
sudo podman start blindtest_nginx

echo ""
echo "🎉 Configuration terminée!"
echo "Votre application est maintenant accessible en HTTPS sur https://brokeneye.space"
