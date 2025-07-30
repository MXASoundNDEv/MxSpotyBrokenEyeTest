# MxSpoty BrokenEye Test

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
- ``` npm run test``` – lance les tests Jest pour les routes API.

- ``` npm run serve ```– démarre le serveur Express en mode production.

node scripts/getAccessToken.js – utilitaire pour récupérer un refresh token Spotify en local (facultatif).

## 🗂 Structure du projet
```text
MxSpotyBrokenEyeTest
├── client/             # Interface web (HTML, CSS, JS)
│   ├── index.html      # Page principale du jeu
│   ├── SpotifyV2.js    # Logiques de connexion & lecture Spotify
│   ├── Popup.js        # Fonctions pour afficher des popups et modales
│   ├── game.js         # Gestion des entrées utilisateur & historique
│   └── style.css       # Styles CSS
├── server/             # Serveur Node.js (Express)
│   ├── index.js        # Routes API et gestion OAuth
│   └── Levenshtein.js  # Utilitaire pour comparer les titres
├── scripts/            # Scripts additionnels
│   └── getAccessToken.js
├── tests/              # Tests Jest
│   └── routes.test.js
├── package.json        # Configuration du projet
└── package-lock.json
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
