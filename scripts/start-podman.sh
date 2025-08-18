#!/bin/bash

echo "🚀 Démarrage de l'application BrokenEye avec Podman"
echo "================================================="

cd /home/mxa/MxSpotyBrokenEyeTest

# Créer le réseau
echo "📡 Création du réseau..."
sudo podman network create blindtest_network 2>/dev/null || echo "Réseau déjà existant"

# Construire l'image de l'app
echo "🔨 Construction de l'application..."
sudo podman build -t blindtest_app .

# Démarrer l'application
echo "🚀 Démarrage de l'application..."
sudo podman run -d \
  --name blindtest_app \
  --network blindtest_network \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  --env-file .env \
  blindtest_app

# Attendre que l'app soit prête
echo "⏳ Attente du démarrage de l'application..."
sleep 10

# Vérifier que l'app fonctionne
echo "🔍 Test de l'application..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Application démarrée avec succès"
else
    echo "❌ L'application ne répond pas"
    exit 1
fi

# Démarrer Nginx avec la bonne configuration
echo "🌐 Démarrage de Nginx..."
sudo podman run -d \
  --name blindtest_nginx \
  --network blindtest_network \
  -p 80:80 \
  -p 443:443 \
  -v /home/mxa/MxSpotyBrokenEyeTest/nginx/conf.d:/etc/nginx/conf.d:ro \
  -v /home/mxa/MxSpotyBrokenEyeTest/data/ssl:/etc/letsencrypt/live/brokeneye.space:ro \
  -v /home/mxa/MxSpotyBrokenEyeTest/data/letsencrypt:/var/www/certbot:ro \
  docker.io/nginx:alpine

# Vérifier Nginx
echo "⏳ Attente du démarrage de Nginx..."
sleep 5

echo "🔍 Test de Nginx..."
if curl -s http://localhost/health > /dev/null; then
    echo "✅ Nginx démarré avec succès"
else
    echo "❌ Nginx ne répond pas"
    sudo podman logs blindtest_nginx
    exit 1
fi

echo "🎉 Déploiement terminé !"
echo "📊 État des containers :"
sudo podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
