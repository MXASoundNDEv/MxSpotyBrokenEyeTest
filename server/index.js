import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import querystring from 'querystring';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkSongMatch } from './Levenshtein.js'; // Assuming you have a Levenshtein.js for helper functions

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

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

  res.redirect('https://accounts.spotify.com/authorize?' + query);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('Missing code');

  try {
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
      console.error('[❌] Erreur token:', data);
      return res.status(400).json(data);
    }

    res.redirect('/#' + querystring.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token
    }));
  } catch (err) {
    console.error('[🔥] Erreur callback:', err);
    res.status(500).send('Erreur lors du callback OAuth');
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
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📥 GET user playlists
app.get('/api/me/playlists', async (req, res) => {
  const accessToken = req.query.token;
  if (!accessToken) return res.status(400).json({ error: 'Token requis' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[❌] Erreur /me/playlists:', response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const playlists = data.items.map(p => ({
      id: p.id,
      name: p.name,
      image: p.images[0]?.url || null
    }));

    res.json(playlists);
  } catch (err) {
    console.error('[🔥] Erreur /me/playlists:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
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

    const data = await response.json();

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

// Function to check if song matches with Levenshtein distance
app.post('/api/check-song', (req, res) => {
  const { songName, currentTrack } = req.body;

  if (!songName || !currentTrack) {
    return res.status(400).json({ match: false, error: 'Chanson ou donnée manquante' });
  }

  const match = checkSongMatch(songName, currentTrack);
  res.json({ match });
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
      throw new Error(`Spotify API error: ${res.status}`);
    }

    const data = await res.json();
    allTracks.push(...data.items.map(item => item.track));
    next = data.next;
  }

  return allTracks;
}

// 🟢 Start
app.listen(PORT, () => {
  console.log(`[🚀] Serveur en ligne : http://localhost:${PORT}`);
});
