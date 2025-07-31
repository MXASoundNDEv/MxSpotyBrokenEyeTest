# 🧪 Tests API Blindtest

# Test Status
[![🧪 Tests API Blindtest](https://github.com/MXASoundNDEv/MxSpotyBrokenEyeTest/actions/workflows/node-tests.yml/badge.svg?branch=main)](https://github.com/MXASoundNDEv/MxSpotyBrokenEyeTest/actions/workflows/node-tests.yml)
## 📋 Aperçu

Suite de tests optimisée pour l'API Blindtest Spotify. Les tests sont fusionnés et dédupliqués pour une exécution efficace.

## 🎯 Problème Principal Résolu

**AVANT :** Les playlists privées d'autres utilisateurs retournaient une erreur 500 au lieu de 403
**APRÈS :** Codes d'erreur Spotify correctement propagés selon la documentation officielle

## 🚀 Exécution des Tests

```bash
# Tests rapides avec notre runner optimisé
npm test

# Tests basiques sans token (pour CI/CD)
npm run test:basic

# Tests avec Jest (plus détaillés)
npm run test:jest
```

## 🔧 GitHub Actions Workflow

Le projet utilise un **workflow GitHub Actions à deux niveaux** :

### 📱 Niveau 1 : Tests Sans Token (Toujours Exécutés)
- ✅ Routes statiques, authentification, validation sécurité
- ✅ **13 tests** - Aucun secret requis
- ✅ Exécutés sur chaque push/PR

### 🔑 Niveau 2 : Tests Complets (Si Secrets Disponibles)  
- ✅ Tous les tests + API Spotify complète
- ✅ **12 tests optimisés** - Secrets Spotify requis
- ✅ Validation de la correction principale (403 vs 500)

**Configuration :** Voir `.github/workflows/README.md`

## 📊 Couverture des Tests

### 📱 Routes Statiques
- `GET /` - Page d'accueil avec détection mobile
- `GET /mobile` - Interface mobile
- `GET /desktop` - Interface desktop

### 🔐 Authentification Spotify
- `GET /login` - Redirection OAuth Spotify
- `GET /callback` - Gestion du callback OAuth

### 🔎 API Spotify GET
- **Sécurité :** Validation des tokens pour tous les endpoints
- **Playlists :** Gestion correcte des erreurs 400/401/403/404
- **Profil utilisateur :** `/api/me`, `/api/me/playlists`
- **Lecteur :** `/api/me/player`, `/api/me/player/devices`
- **Tracks :** `/api/tracks/:id`

### 📝 API POST
- `POST /api/check-song` - Validation des correspondances de chansons

### 🎵 API PUT
- `PUT /api/play` - Contrôle de lecture
- `PUT /api/seek` - Navigation dans les tracks

## 🔍 Codes d'Erreur Spotify Gérés

| Code    | Description             | Exemple                                    |
| ------- | ----------------------- | ------------------------------------------ |
| 400     | Requête invalide        | ID playlist format incorrect               |
| 401     | Token invalide/expiré   | Token d'accès périmé                       |
| **403** | **Accès interdit**      | **Playlist privée d'un autre utilisateur** |
| 404     | Ressource non trouvée   | Playlist supprimée                         |
| 429     | Limite de débit         | Trop de requêtes                           |
| 500+    | Erreurs serveur Spotify | Maintenance Spotify                        |

## ✅ Validation Principale

Le test principal vérifie que :
1. ❌ **Aucune erreur 500 incorrecte** n'est retournée
2. ✅ **Codes d'erreur Spotify appropriés** sont propagés
3. ✅ **Messages d'erreur informatifs** sont fournis
4. ✅ **Flag `isSpotifyError`** est présent pour les erreurs API

## 📁 Structure des Tests

```
tests/
├── routes-optimized.test.js    # Tests Jest (détaillés)
├── test-runner-optimized.js    # Runner simple (rapide)
└── README.md                   # Cette documentation
```

## 🔧 Configuration

Les tests utilisent :
- **Token de test :** `process.env.SPOTIFY_TEST_TOKEN` (optionnel)
- **Playlists de test :** IDs publiques Spotify
- **Timeouts :** 15 secondes pour les appels API

## 🎉 Résultat

**12/12 tests passés** - 100% de réussite
- ✅ Plus d'erreur 500 pour les playlists privées
- ✅ Gestion correcte des codes d'erreur Spotify
- ✅ API robuste et conforme à la documentation Spotify
