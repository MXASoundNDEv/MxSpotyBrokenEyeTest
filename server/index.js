import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import querystring from 'querystring';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../client')));

// Spotify credentials
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'http://127.0.0.1:3000/callback';

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
