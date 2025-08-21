import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
const fetch = global.fetch;
import cors from 'cors';
import cookieParser from 'cookie-parser';
import querystring from 'querystring';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { checkSongMatch, getDetailedMatchAnalysis } from './utils/logic.js'; // Utilitaires pour la correspondance de chansons

// Chargement intelligent des variables d'environnement
// Priorité: .env.<NODE_ENV> puis .env
const runtimeEnv = process.env.NODE_ENV;
const HOST = process.env.HOST
if (runtimeEnv) {
  const specificEnvFile = `.env.${runtimeEnv}`;
  dotenv.config({ path: specificEnvFile });
}
// Toujours charger .env comme fallback (sans override pour conserver les spécifiques)
dotenv.config();

const app = express();
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Redirection HTTPS si nécessaire (sauf pour les health checks)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Exclure les health checks et endpoints internes de la redirection HTTPS
    if (req.path === '/health' || req.path.startsWith('/health/') || req.headers['x-health-check']) {
      return next();
    }
    if (req.protocol !== 'https') {
      return res.redirect(`https://${req.get('host')}${req.originalUrl}`);
    }
    next();
  });
}

// Middleware pour générer un nonce CSP
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.locals.cspNonce = generateRandomString(16);
    next();
  });
}

// Middlewares spécifiques production
if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet({
      crossOriginResourcePolicy: false, // OK pour images cross-origin
      contentSecurityPolicy: {
        useDefaults: false, // on définit explicitement
        directives: {
          "default-src": ["'self'"],

          // Scripts : ton domaine + nonce + SDK Spotify
          "script-src": [
            "'self'",
            (req, res) => `'nonce-${res.locals.cspNonce}'`,
            "https://sdk.scdn.co",
          ],
          "script-src-elem": [
            "'self'",
            (req, res) => `'nonce-${res.locals.cspNonce}'`,
            "https://sdk.scdn.co",
          ],
          "script-src-attr": ["'https://github.com/MXASoundNDEv/MxSpotyBrokenEyeTest'"],

          // Requêtes réseau nécessaires au Web Playback SDK
          "connect-src": [
            "'self'",
            "https://api.spotify.com",
            "https://apresolve.spotify.com",
            "wss://dealer.spotify.com",
          ],

          // Images (Spotify covers + GitHub logo)
          "img-src": [
            "'self'",
            "data:",
            "https://i.scdn.co",
            "https://github.githubassets.com",
            "https://mosaic.scdn.co/",
            "https://image-cdn-fa.spotifycdn.com/image/",
            "https://image-cdn-ak.spotifycdn.com/image/",
            "https://placehold.co/300x300?text=No+Image",
          ],

          // Autorise styles inline (facile). Pour être strict, remplace par un nonce/hash plus tard.
          "style-src": ["'self'", "'unsafe-inline'"],
          "font-src": ["'self'", "data:"],

          // Iframe/popup d’auth Spotify si tu l’utilises
          "frame-src": ["'self'", "https://accounts.spotify.com", 'https://sdk.scdn.co/'],
          // Si tu ouvres des popups d’auth :
          "frame-ancestors": ["'self'"],

          "base-uri": ["'self'"],
          "form-action": ["'self'"],
          "object-src": ["'none'"],
          "upgrade-insecure-requests": [],
        },
      },

      // (optionnel) utile si tu fais l’auth dans une popup
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
  );
  app.use(compression());
  // Cache basique pour assets statiques
  app.use((req, res, next) => {
    if (req.method === 'GET' && /\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/i.test(req.path)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    }
    next();
  });
}

// Servir les fichiers statiques avec la nouvelle structure
app.use('/scripts', express.static(path.join(__dirname, '../client/scripts')));
app.use('/styles', express.static(path.join(__dirname, '../client/styles')));
app.use('/pages', express.static(path.join(__dirname, '../client/pages')));
app.use(express.static(path.join(__dirname, '../client')));



app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // Lire le fichier HTML et injecter le nonce
    const htmlPath = path.join(__dirname, '../client/pages/index.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Erreur lecture index.html:', err);
        return res.status(500).send('Erreur serveur');
      }

      // Remplacer le placeholder par le vrai nonce
      const htmlWithNonce = data.replace(/nonce=""/g, `nonce="${res.locals.cspNonce}"`);
      res.send(htmlWithNonce);
    });
  } else {
    // En développement, servir directement
    res.sendFile(path.join(__dirname, '../client/pages/index.html'));
  }
});


// Spotify credentials
const PORT = process.env.PORT || 3000;
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

// Utils
const generateRandomString = length =>
  [...Array(length)].map(() => Math.random().toString(36)[2]).join('');

// Routes
app.get('/login', (req, res) => {
  try {
    // Validation des variables d'environnement
    if (!client_id) {
      console.error('[❌] SPOTIFY_CLIENT_ID manquant dans .env');
      return res.status(500).json({ error: 'Configuration Spotify incomplète - CLIENT_ID manquant' });
    }

    if (!client_secret) {
      console.error('[❌] SPOTIFY_CLIENT_SECRET manquant dans .env');
      return res.status(500).json({ error: 'Configuration Spotify incomplète - CLIENT_SECRET manquant' });
    }

    if (!redirect_uri) {
      console.error('[❌] SPOTIFY_REDIRECT_URI manquant dans .env');
      return res.status(500).json({ error: 'Configuration Spotify incomplète - REDIRECT_URI manquant' });
    }

    console.log('[🔐] Tentative de connexion Spotify:');
    console.log(`    Client ID: ${client_id}`);
    console.log(`    Redirect URI: ${redirect_uri}`);
    console.log(`    Port actuel: ${PORT}`);

    const state = generateRandomString(16);
    const scope = [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state'
    ].join(' ');

    const query = querystring.stringify({
      response_type: 'code',
      client_id,
      scope,
      redirect_uri,
      state,
    });

    const authUrl = 'https://accounts.spotify.com/authorize?' + query;
    console.log('[🔗] URL d\'autorisation générée');

    res.redirect(authUrl);
  } catch (err) {
    console.error('[🔥] Erreur /login:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Health check route
app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const error_description = req.query.error_description;

  console.log('[🔄] Callback Spotify reçu:', { code: code ? 'Présent' : 'Absent', error, error_description });

  if (error) {
    console.error('[❌] Erreur OAuth Spotify:', error, error_description);
    return res.status(400).send(`Erreur OAuth: ${error} - ${error_description}`);
  }

  if (!code) {
    console.error('[❌] Code d\'autorisation manquant');
    return res.status(400).send('Code d\'autorisation manquant');
  }

  try {
    console.log('[🔄] Échange du code contre un token...');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri
      })
    });

    const data = await tokenRes.json();

    if (data.error) {
      console.error('[❌] Erreur token Spotify:', data);
      return res.status(400).json(data);
    }

    console.log('[✅] Token obtenu avec succès!');

    // Redirection avec les tokens et durée d'expiration
    res.redirect('/#' + querystring.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600
    }));
  } catch (err) {
    console.error('[🔥] Erreur callback:', err);
    res.status(500).send('Erreur lors du callback OAuth');
  }
});

// Route pour rafraîchir le token
app.post('/api/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token requis' });
  }

  try {
    console.log('[🔄] Rafraîchissement du token...');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
      },
      body: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('[❌] Erreur lors du rafraîchissement:', data);
      return res.status(400).json(data);
    }

    console.log('[✅] Token rafraîchi avec succès!');
    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
      refresh_token: data.refresh_token || refresh_token // Garder l'ancien si pas de nouveau
    });

  } catch (err) {
    console.error('[🔥] Erreur rafraîchissement token:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📥 GET playlist tracks
app.get('/api/playlist/:id', async (req, res) => {
  const accessToken = req.query.token;
  const playlistId = req.params.id;

  if (!accessToken) return res.status(400).json({ error: 'Token requis' });

  try {
    console.log(`🔐 Requête playlist ${playlistId} avec token ${accessToken.slice(0, 10)}...`);
    const tracks = await getPlaylistTracks(playlistId, accessToken);

    const results = tracks.slice(0, 50).map(track => ({
      uri: track.uri,
      title: track.name,
      artists: track.artists.map(a => a.name).join(', ')
    }));

    res.json(results);
  } catch (err) {
    console.error('[🔥] Erreur /api/playlist:', err);

    // Gestion complète des codes d'erreur Spotify selon la documentation officielle
    if (err.statusCode) {
      const statusCode = err.statusCode;
      let errorMessage = 'Erreur Spotify API';

      switch (statusCode) {
        case 400:
          errorMessage = 'Requête invalide - ID de playlist incorrect ou format invalide';
          break;
        case 401:
          errorMessage = 'Token d\'accès invalide ou expiré - Veuillez vous reconnecter';
          break;
        case 403:
          errorMessage = 'Accès interdit - Cette playlist est privée et appartient à un autre utilisateur';
          break;
        case 404:
          errorMessage = 'Playlist non trouvée - L\'ID de playlist n\'existe pas';
          break;
        case 429:
          errorMessage = 'Trop de requêtes - Limite de débit Spotify atteinte, réessayez plus tard';
          break;
        case 500:
          errorMessage = 'Erreur interne du serveur Spotify';
          break;
        case 502:
          errorMessage = 'Passerelle défaillante - Problème temporaire avec Spotify';
          break;
        case 503:
          errorMessage = 'Service Spotify temporairement indisponible';
          break;
        default:
          errorMessage = `Erreur Spotify API non documentée: ${statusCode}`;
      }

      return res.status(statusCode).json({
        error: errorMessage,
        spotifyError: err.spotifyError,
        statusCode: statusCode,
        isSpotifyError: true
      });
    }

    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📥 GET user playlists
app.get('/api/me/playlists', async (req, res) => {
  const accessToken = req.query.token;
  if (!accessToken) {
    console.error('[❌] Token manquant pour /api/me/playlists');
    return res.status(400).json({ error: 'Token requis' });
  }

  try {
    console.log('[📋] Récupération des playlists pour l\'utilisateur...');

    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[❌] Erreur API Spotify /me/playlists:', {
        status: response.status,
        statusText: response.statusText,
        response: text,
        token: accessToken.substring(0, 20) + '...' // Log partiel du token pour debug
      });

      // Si c'est une erreur d'autorisation, renvoyer un message plus clair
      if (response.status === 401) {
        return res.status(401).json({
          error: 'Token expiré ou invalide',
          needsReauth: true
        });
      }

      return res.status(response.status).json({
        error: `Erreur Spotify API: ${response.status} ${response.statusText}`,
        details: text
      });
    }

    const data = await response.json();
    console.log('[✅] Playlists récupérées:', data.items?.length || 0);

    // Vérification que data.items existe et est un tableau
    if (!data.items || !Array.isArray(data.items)) {
      console.warn('[⚠️] Aucune playlist trouvée ou format inattendu:', data);
      return res.json([]);
    }

    const playlists = data.items
      .filter(p => p && p.id && p.name) // Filtrer les playlists invalides
      .map(p => ({
        id: p.id,
        name: p.name,
        image: (p.images && Array.isArray(p.images) && p.images.length > 0) ? p.images[0].url : null
      }));

    console.log('[📊] Playlists traitées:', playlists.length);
    res.json(playlists);
  } catch (err) {
    console.error('[🔥] Erreur interne /me/playlists:', {
      message: err.message,
      stack: err.stack,
      token: accessToken ? accessToken.substring(0, 20) + '...' : 'undefined'
    });
    res.status(500).json({
      error: 'Erreur serveur interne',
      details: err.message
    });
  }
});

// GET current track
app.get('/api/me/player', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ error: 'Token manquant' });
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Erreur Spotify /me/player:', response.status, text);
      return res.status(response.status).send(text);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Erreur JSON:', jsonError);
      return res.status(500).json({ error: 'Erreur serveur', details: jsonError.message });
    }

    if (!data || !data.item) {
      return res.status(204).send(); // Aucun morceau en cours
    }

    res.json({
      name: data.item.name,
      uri: data.item.uri,
      durationMs: data.item.duration_ms,
      positionMs: data.progress_ms,
      image: data.item.album?.images?.[0]?.url || null
    });

  } catch (err) {
    console.error('[🔥] Erreur serveur /api/me/player:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET track by ID
app.get('/api/tracks/:id', async (req, res) => {
  const accessToken = req.query.token;
  const trackId = req.params.id;
  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  res.json(data);
});

// GET Player devices
app.get('/api/me/player/devices', async (req, res) => {
  const accessToken = req.query.token;
  if (!accessToken) return res.status(400).json({ error: 'Token requis' });
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[❌] Erreur /me/player/devices:', response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    console.log('[✅] Récupération des appareils Spotify réussie:', data.devices.length, 'appareils trouvés');
    console.log(data.devices.map(d => d.name).join(', '));
    res.json(data.devices);
  } catch (err) {
    console.error('[🔥] Erreur /api/me/player/devices:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET User profile data
app.get('/api/me', async (req, res) => {
  const accessToken = req.query.token;
  if (!accessToken) return res.status(400).json({ error: 'Token requis' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[❌] Erreur /me:', response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    console.log('[✅] Récupération du profil utilisateur réussie:', data.display_name);
    res.json(data);
  } catch (err) {
    console.error('[🔥] Erreur /api/me:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Advanced song matching with detailed scoring system
app.post('/api/check-song', (req, res) => {
  const { songName, currentTrack, detailed = false } = req.body;

  if (!songName || !currentTrack) {
    return res.status(400).json({
      match: false,
      error: 'Chanson ou donnée manquante',
      score: 0,
      quality: 'POOR'
    });
  }

  try {
    if (detailed) {
      // Analyse complète avec tous les détails
      const analysis = getDetailedMatchAnalysis(songName, currentTrack);
      return res.json({
        match: analysis.finalDecision,
        detailed: true,
        ...analysis
      });
    } else {
      // Match simple avec informations de base
      const result = checkSongMatch(songName, currentTrack, true);
      return res.json({
        match: typeof result === 'boolean' ? result : result.isValid,
        score: typeof result === 'object' ? result.score : (result ? 1 : 0),
        quality: typeof result === 'object' ? result.quality : (result ? 'PERFECT' : 'POOR'),
        detailed: false
      });
    }
  } catch (error) {
    console.error('[🔥] Erreur lors de la vérification du match:', error);
    return res.status(500).json({
      match: false,
      error: 'Erreur serveur lors de la vérification',
      details: error.message
    });
  }
});

// Endpoint for detailed song match analysis (useful for debugging/tuning)
app.post('/api/analyze-song-match', (req, res) => {
  const { songName, currentTrack } = req.body;

  if (!songName || !currentTrack) {
    return res.status(400).json({
      error: 'Chanson ou donnée manquante'
    });
  }

  try {
    const analysis = getDetailedMatchAnalysis(songName, currentTrack);
    res.json(analysis);
  } catch (error) {
    console.error('[🔥] Erreur lors de l\'analyse détaillée:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de l\'analyse',
      details: error.message
    });
  }
});

// PUT play track
app.put('/api/play', async (req, res) => {
  const { device_id, token } = req.query;
  const { uris } = req.body;

  if (!uris || !Array.isArray(uris)) {
    return res.status(400).json({ error: 'URIs manquants ou invalides dans le corps de la requête' });
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Spotify API Error]', response.status, text);
      return res.status(response.status).send(text);
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('[🔥] Erreur serveur /api/play:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// PUT seek
app.put('/api/seek', async (req, res) => {
  const { position_ms, token } = req.query;
  const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position_ms}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  res.sendStatus(response.status);
});


// 📚 Fonction helper
async function getPlaylistTracks(playlistId, token) {
  let allTracks = [];
  let next = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[❌] Erreur Spotify API:', res.status, errText);

      // Créer une erreur avec le code de statut pour une meilleure gestion
      const error = new Error(`Spotify API error: ${res.status}`);
      error.statusCode = res.status;
      error.spotifyError = errText;
      throw error;
    }

    const data = await res.json();
    allTracks.push(...data.items.map(item => item.track));
    next = data.next;
  }

  return allTracks;
}

// 🟢 Start
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`[🚀] Serveur en ligne sur ${HOST}:${PORT}`);
  });
}


export default app;
