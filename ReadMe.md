# MxSpoty BlindTest
[![🧪 Tests API Blindtest](https://github.com/MXASoundNDEv/MxSpotyBrokenEyeTest/actions/workflows/node-tests.yml/badge.svg?branch=main)]

### Pré-requis Spotify
- **Compte Spotify Premium** requis pour le SDK Web Playback
- **Identifiants développeur Spotify** valides dans `.env`
- **Navigateur moderne** (Chrome, Edge, Firefox) pour l'interface

### Architecture Moderne
- **Modules ES6** : Le projet utilise `"type": "module"` 
- **Structure modulaire** : SpotifyV2 refactorisé en modules séparés
- **Tests optimisés** : Suite de tests dédupliquée et efficace
- **Interface responsive** : Détection automatique mobile/desktop

### Développement et Production
- **Environnement de développement** : 18 pages de test pour validation
- **Debug intégré** : Scripts de diagnostic Spotify et API
- **CI/CD ready** : Tests GitHub Actions à deux niveaux
- **Maintenance** : Scripts de vérification et correction automatisés

Ce projet est **optimisé pour l'apprentissage** et la **démonstration** des bonnes pratiques de développement web moderne avec les APIs Spotify.is la nouvelle structure `src/client/`.

### 📱 Interfaces Disponibles
- **http://localhost:3000** : Interface principale responsive
- **Pages de test** : Disponibles via `/pages/test/` pour debug et validation

### 🔧 Configuration Avancée
Le projet supporte maintenant :
- **Variables d'environnement** étendues dans `.env`
- **Modules ES6** avec `"type": "module"` 
- **Architecture modulaire** Spotify pour faciliter la maintenance
- **Tests automatisés** intégrés avec GitHub Actionsws/node-tests.yml)

#### 🧪 Tests et Qualité

### Architecture de Tests à Deux Niveaux

Le projet utilise une **approche innovante de tests GitHub Actions** :

#### 📱 **Niveau 1 : Tests Universels** (toujours exécutés)
- ✅ **13 tests** sans secrets requis
- ✅ Routes statiques, authentification, validation sécurité
- ✅ Exécutés sur chaque push/PR

#### 🔑 **Niveau 2 : Tests Complets** (si secrets disponibles)
- ✅ **12 tests optimisés** avec API Spotify complète
- ✅ Validation des corrections principales (erreur 500→403)
- ✅ Tests de playlists privées et gestion d'erreurs

### Exécution Locale

```bash
# Tests rapides optimisés
npm test

# Tests basiques (CI/CD friendly)
npm run test:basic

# Tests Jest avec détails
npm run test:jest
```

### Corrections Principales Validées
- **Fix erreur 500** : Les playlists privées retournent maintenant 403 au lieu de 500
- **Gestion d'erreurs API** : Codes de statut Spotify correctement propagés
- **Validation tokens** : Meilleure gestion des tokens expirés

Le répertoire `tests/` contient des tests utilisant **supertest** pour vérifier les routes avec/sans token Spotify.
Si tu définis `SPOTIFY_TEST_TOKEN` dans `.env`, les tests pourront valider l'API Spotify complète. du projet

```
h:\blindtest\
├── package.json           # Configuration du projet avec scripts optimisés
├── package-lock.json      # Verrouillage des dépendances  
├── jest.config.js         # Configuration Jest pour les tests
├── README.md             # Ce fichier
├── .env / .env.example   # Variables d'environnement
├── .gitignore           # Fichiers ignorés par Git
├── src/                 # Code source principal
│   ├── client/          # Frontend organisé et modulaire
│   │   ├── pages/       # Pages HTML principales et tests
│   │   │   ├── index.html
│   │   │   └── test/    # Pages de test et debug (18 fichiers)
│   │   │       ├── debug.html
│   │   │       ├── mobile.html
│   │   │       ├── test-detection.html
│   │   │       ├── test-mobile-layout.html
│   │   │       ├── test-playlist-fix.html
│   │   │       ├── test-popup-fix.html
│   │   │       └── ... (autres tests)
│   │   ├── scripts/     # JavaScript côté client modulaire
│   │   │   ├── game.js
│   │   │   ├── SpotifyV2.js
│   │   │   ├── SpotifyV3.js
│   │   │   ├── Popup.js
│   │   │   ├── spotify-debug.js
│   │   │   ├── compatibility-bridge.js
│   │   │   ├── test-playlist-launch.js
│   │   │   ├── spotify/     # Architecture modulaire complète
│   │   │   │   ├── config/  # Configuration centralisée
│   │   │   │   ├── utils/   # Utilitaires réutilisables
│   │   │   │   ├── core/    # État de l'application
│   │   │   │   ├── ui/      # Gestion DOM et interface
│   │   │   │   ├── api/     # API Spotify
│   │   │   │   ├── player/  # Lecteur Spotify
│   │   │   │   ├── managers/ # Gestion des playlists
│   │   │   │   ├── features/ # AutoSwipe et fonctionnalités
│   │   │   │   └── compatibility/ # Fonctions globales
│   │   │   └── test/        # Scripts de test mobile/responsive
│   │   └── styles/      # CSS avec support mobile/responsive
│   │       ├── style-responsive.css
│   │       └── test/    # Styles de test
│   └── server/          # Backend API Express
│       ├── index.js     # Serveur Express principal
│       └── utils/       # Utilitaires
│           └── Levenshtein.js
├── scripts/             # Scripts de développement et maintenance
│   ├── getAccessToken.js
│   ├── spotify-fix.js
│   ├── test-playlist-mapping.js
│   ├── test-refresh-token.js
│   └── verify-tests.js
├── tests/              # Suite complète de tests optimisés
│   ├── README.md       # Documentation des tests
│   ├── routes-optimized.test.js
│   ├── test-runner-optimized.js
│   ├── test-runner-basic.js
│   ├── tests-complets-finaux.js
│   ├── test-playlist-fix.js
│   └── rapport-final.js
├── docs/               # Documentation complète
│   ├── MOBILE_README.md
│   ├── GAME_JS_UPDATE.md
│   ├── AUTOSWIPE_IMPROVEMENTS.md
│   ├── REFACTORING_IMPROVEMENTS.md
│   ├── FIX_ERROR_500_PLAYLISTS.md
│   ├── FIX_PLAYLIST_LAUNCH.md
│   ├── FIX_PLAYLIST_NULL_ERROR.md
│   ├── FIX_POPUP_NULL_ERROR.md
│   └── SPOTIFY_FIX_GUIDE.md
└── other/              # Fichiers de référence et anciens
    ├── index.html
    ├── index.js
    ├── interface.html
    ├── randomPlaylistSampler.js
    ├── server.js
    └── test.js
```

## Installation et démarrage

```bash
# Installer les dépendances
npm install

# Démarrer le serveur en production
npm start
# ou
npm run serve

# Lancer les tests optimisés
npm test

# Tests basiques (pour CI/CD sans tokens)
npm run test:basic

# Tests Jest détaillés
npm run test:jest
```

## Fonctionnalités

### 🎮 Interface & Expérience Utilisateur
- **Interface responsive** avec détection automatique desktop/mobile
- **Architecture modulaire** pour une meilleure maintenabilité
- **18 pages de test** pour debug et validation des fonctionnalités
- **Interface mobile optimisée** avec layout adaptatif

### 🎵 Intégration Spotify
- **SpotifyV2/V3** avec architecture modulaire complète
- **Web Playback SDK** pour lecture directe dans le navigateur
- **Gestion avancée des playlists** avec validation et correction d'erreurs
- **API Spotify** avec gestion d'erreurs optimisée (fix erreur 500→403)

### 🔧 Fonctionnalités Avancées
- **AutoSwipe** avec barre de progression et contrôles
- **Système de popup** modernisé et responsive
- **Historique visuel** des morceaux joués
- **Debug Spotify** intégré avec outils de diagnostic
- **Compatibility bridge** pour anciens navigateurs

### 🧪 Tests & Qualité
- **Suite de tests optimisée** avec 25+ tests automatisés
- **GitHub Actions CI/CD** avec tests à deux niveaux
- **Tests mobile et responsive** dédiés
- **Validation API** complète avec gestion d'erreurs

**Blind test musical basé sur Spotify**

Ce projet te permet de jouer à un blind test où tu dois deviner des morceaux tirés de tes propres playlists Spotify.  
Il se compose d’un serveur **Express** et d’une interface web qui s’appuie sur l’API **Web Playback** de Spotify pour diffuser la musique dans ton navigateur.  
Toutes les instructions sont rédigées en français et te tutoient pour rendre l’expérience plus conviviale.

---

## 🎯 Fonctionnalités

- Connexion via **Spotify OAuth 2.0** (autorisation explicite de l’utilisateur).
- Récupération de **tes playlists** et choix d’une playlist pour démarrer le jeu.
- Lecture des titres via le **lecteur Web Spotify**.
- Devine les chansons en **tapant leur nom** : un algorithme de **distance de Levenshtein** tolère les fautes de frappe et accents.
- Historique des morceaux déjà joués **affiché dans la colonne de gauche**.
- **Auto-avancement** des morceaux (AutoSwipe) avec un délai configurable.
- **Tests intégrés** pour vérifier le bon fonctionnement des routes serveur.

---

## 🧰 Pré-requis

Avant de commencer, assure‑toi de disposer des éléments suivants :

- **Node.js 18** ou plus – pour exécuter le serveur Express et les scripts.
- Un **compte Spotify Premium** : le SDK Web Playback ne fonctionne qu’avec un abonnement payant.
- Un **compte développeur Spotify** pour obtenir des identifiants d’application (client ID et secret).
- Un **navigateur moderne** (Chrome, Edge ou Firefox) pour l’interface web.

---

## 🚀 Installation

Clone ce dépôt et installe les dépendances :

```bash
git clone https://github.com/MXASoundNDEv/MxSpotyBrokenEyeTest.git
cd MxSpotyBrokenEyeTest
npm install
```
Crée un fichier .env à la racine du projet avec les variables d’environnement requises :

```ini
SPOTIFY_CLIENT_ID=ton_id_client
SPOTIFY_CLIENT_SECRET=ton_secret_client
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
SPOTIFY_TEST_TOKEN=facultatif_pour_les_tests
```

Pour les recupere va sur 
https://developer.spotify.com


## Lance le serveur :

```bash
npm run serve
```
Par défaut, le serveur écoute sur http://localhost:3000 et sert l’interface web depuis client/.

Ouvre ton navigateur sur http://localhost:3000.
Tu seras invité à te connecter à ton compte Spotify.
Sélectionne ensuite une playlist et laisse‑toi guider pour deviner les titres.

## 📜 Scripts utiles

### Scripts de production
- `npm start` / `npm run serve` – démarre le serveur Express en mode production

### Scripts de test
- `npm test` – lance les tests optimisés avec notre runner personnalisé
- `npm run test:basic` – tests basiques sans token Spotify (CI/CD)  
- `npm run test:jest` – tests Jest détaillés avec couverture

### Scripts de développement et maintenance
- `node scripts/getAccessToken.js` – récupère un refresh token Spotify
- `node scripts/spotify-fix.js` – utilitaires de correction Spotify
- `node scripts/test-playlist-mapping.js` – test mapping des playlists
- `node scripts/test-refresh-token.js` – validation des tokens
- `node scripts/verify-tests.js` – vérification de l'intégrité des tests

## 🔐 HTTPS avec Certbot

Le fichier `docker-compose.yml` inclut désormais un service `certbot` et un proxy Nginx.
Les certificats Let's Encrypt sont stockés dans `./data/certbot` et partagés avec
Nginx via les volumes `./data/certbot:/etc/letsencrypt` et `./data/letsencrypt:/var/www/certbot`.

### Création initiale du certificat

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d exemple.com
```

### Renouvellement automatique

Ajoute une tâche cron sur l'hôte pour renouveler les certificats et recharger Nginx :

```bash
0 0 * * * docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload
```


## Déploiement en production

### Podman

Le script `scripts/deploy-production.sh` utilise **Podman**. Lors d'un déploiement manuel, pensez à exposer également le port des métriques :

```bash
sudo podman pod create -p 80:80 -p 443:443 -p 9100:9100
sudo podman run --pod blindtest -e METRICS_PORT=9100 ...
```

Pour exposer l'application sur Internet, il est conseillé de placer le serveur Node derrière un reverse proxy **Nginx** et de protéger les connexions HTTPS avec **Let's Encrypt**.

### Configuration Nginx

Installe Nginx sur ton serveur puis crée un bloc serveur minimal :

```nginx
server {
    server_name exemple.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ce bloc redirige tout le trafic entrant vers l'application Node écoutant sur le port 3000.

### Génération initiale des certificats

Installe Certbot et son plugin Nginx puis génère un premier certificat Let's Encrypt :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d exemple.com
```

Certbot configure automatiquement Nginx et crée les certificats TLS dans `/etc/letsencrypt/`.

### Renouvellement automatique

Certbot installe un service de renouvellement qui vérifie les certificats deux fois par jour. Tu peux vérifier son activation avec :

```bash
systemctl list-timers | grep certbot
```

À défaut, ajoute une tâche cron mensuelle :

```bash
0 3 * * * certbot renew --quiet
```

Les certificats seront ainsi renouvelés automatiquement avant expiration.

## 🗂 Structure du projet détaillée

```text
MxSpotyBrokenEyeTest
├── src/
│   ├── client/                    # Frontend moderne et modulaire
│   │   ├── pages/
│   │   │   ├── index.html         # Page principale responsive
│   │   │   └── test/              # 18 pages de test et debug
│   │   ├── scripts/
│   │   │   ├── game.js            # Logique de jeu principale
│   │   │   ├── SpotifyV2.js       # Intégration Spotify avancée
│   │   │   ├── SpotifyV3.js       # Version optimisée
│   │   │   ├── Popup.js           # Système de popups moderne
│   │   │   ├── spotify/           # Architecture modulaire Spotify
│   │   │   │   ├── config/        # Configuration centralisée
│   │   │   │   ├── api/           # Appels API Spotify
│   │   │   │   ├── player/        # Lecteur Web Playback
│   │   │   │   ├── managers/      # Gestion playlists/état
│   │   │   │   ├── features/      # AutoSwipe & fonctionnalités
│   │   │   │   └── ui/            # Interface utilisateur
│   │   │   └── test/              # Scripts de test client
│   │   └── styles/                # CSS responsive et thèmes
│   └── server/                    # Backend Express optimisé
│       ├── index.js               # API REST avec gestion d'erreurs
│       └── utils/
│           └── Levenshtein.js     # Algorithme de correspondance
├── tests/                         # Suite de tests complète
│   ├── routes-optimized.test.js   # Tests API optimisés
│   ├── test-runner-optimized.js   # Runner personnalisé
│   ├── test-runner-basic.js       # Tests CI/CD sans tokens
│   └── tests-complets-finaux.js   # Tests complets avec rapport
├── scripts/                       # Maintenance et développement
├── docs/                          # Documentation technique complète
└── other/                         # Fichiers de référence
```

## 🧪 Tests
Le répertoire tests/ contient des tests (dans routes.test.js) qui utilisent supertest pour vérifier que les routes répondent correctement, avec ou sans token Spotify.

Pour exécuter les tests :

```bash
npm run test
```
Si tu définis SPOTIFY_TEST_TOKEN dans ton fichier .env, certains tests pourront appeler l’API Spotify et vérifier les statuts 200.
Sans token valide, les tests accepteront également les codes de statut 401 ou 404.

## ⚠️ Notes importantes
Les appels Spotify nécessitent un compte premium et des identifiants valides.

Ce projet est destiné à l’apprentissage et n’est pas optimisé pour un déploiement en production.

N’hésite pas à l’adapter à tes besoins.

## 🙌 Contributions
Si tu as des suggestions ou des améliorations à proposer,
n’hésite pas à faire un fork et à ouvrir une pull request.

## 📄 Licence
Ce projet est publié sous la licence GPL-3.0.
Consulte le fichier package.json pour plus de détails.
