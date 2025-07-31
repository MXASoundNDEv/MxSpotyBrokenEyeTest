# 🚀 Workflow GitHub Actions - Tests API Blindtest

## 📋 Vue d'ensemble

Ce workflow GitHub Actions exécute automatiquement les tests sur l'API Blindtest Spotify avec une approche à deux niveaux selon la disponibilité des secrets Spotify.

## 🔄 Stratégie de Tests

### 🎯 Niveau 1 : Tests Sans Token (Toujours Exécutés)
- ✅ **Routes statiques** : Pages d'accueil, mobile, desktop
- ✅ **Authentification** : Redirection OAuth Spotify
- ✅ **Validation sécurité** : Vérification des tokens requis
- ✅ **API POST/PUT** : Validation des paramètres

**Commande :** `npm run test:basic`
**Fichier :** `tests/test-runner-basic.js`

### 🔑 Niveau 2 : Tests Complets (Si Secrets Disponibles)
- ✅ Tous les tests du Niveau 1
- ✅ **Tests API Spotify** : Playlists, lecteur, profil
- ✅ **Validation erreurs** : Codes 400/401/403/404
- ✅ **Tests tokens réels** : Si configurés dans les secrets

**Commande :** `npm test`
**Fichier :** `tests/test-runner-optimized.js`

## ⚙️ Configuration Secrets GitHub

Pour activer les tests complets, configurez ces secrets dans votre repo :

```bash
# Settings > Secrets and variables > Actions > Repository secrets
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=your_refresh_token  # Optionnel
```

## 🌍 Variables d'Environnement

Le workflow utilise automatiquement :
- **NODE_ENV=test** : Mode test pour optimisations
- **SPOTIFY_TEST_TOKEN** : Token de test (invalide par défaut)

## 🔧 Déclencheurs du Workflow

```yaml
on:
  push:
    branches: [ main, Mobile, develop, RunTest ]
  pull_request:
    branches: [ main, Mobile ]
```

## 📊 Résultats Attendus

### ✅ Tests Sans Token (13 tests)
```
📱 Routes Statiques: 3/3 ✅
🔐 Authentification: 2/2 ✅  
🔎 Validation Sécurité: 4/4 ✅
📝 API POST/PUT: 3/3 ✅
🔍 Structure Réponses: 1/1 ✅
Total: 100% de réussite
```

### 🔑 Tests Complets (12 tests)
```
📱 Routes Statiques: 3/3 ✅
🔐 Authentification: 2/2 ✅
🔎 API Spotify: 4/4 ✅
🎯 Correction Principale: 2/2 ✅ (Plus d'erreur 500)
📝 API POST/PUT: 2/2 ✅
Total: 100% de réussite
```

## 🎯 Validation Principale

Le workflow valide **la correction critique** :
- ❌ **AVANT :** Playlists privées → Erreur 500
- ✅ **APRÈS :** Playlists privées → Erreur 403/401

## 🚨 Gestion des Échecs

### Tests Sans Token Échouent
```bash
# Actions à prendre :
1. Vérifier les routes statiques
2. Contrôler la configuration Express
3. Valider les middlewares de sécurité
```

### Tests Complets Échouent
```bash
# Actions à prendre :
1. Vérifier les secrets Spotify
2. Contrôler la validité des tokens
3. Tester localement avec un vrai token
```

## 📁 Structure des Fichiers

```
.github/workflows/
└── node-tests.yml           # Workflow principal

tests/
├── test-runner-basic.js     # Tests sans token
├── test-runner-optimized.js # Tests complets  
└── routes-optimized.test.js # Tests Jest (optionnel)

scripts/
└── getAccessToken.js        # Génération token Spotify
```

## 💡 Optimisations

### Performance
- **Cache npm** : Réutilisation des dépendances
- **Parallélisation** : Tests indépendants en parallèle
- **Timeouts courts** : Échec rapide si problème

### Sécurité
- **Pas de logs secrets** : Tokens masqués automatiquement
- **Environnement isolé** : Chaque job dans sa propre VM
- **Nettoyage automatique** : Arrêt des serveurs de test

## 🎉 Avantages

1. **🔄 Exécution systématique** : Tests sur chaque push/PR
2. **📈 Feedback immédiat** : Résultats en 2-3 minutes
3. **🔒 Sécurité garantie** : Validation même sans secrets
4. **🎯 Focus qualité** : Détection automatique des régressions
5. **📋 Documentation** : Logs détaillés pour debugging
