import express from 'express';
import open from 'open';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import querystring from 'querystring';

dotenv.config();

const app = express();
const PORT = 3000;

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

const scope = [
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state'
].join(' ');

app.get('/login', (req, res) => {
    const authURL = `https://accounts.spotify.com/authorize?${querystring.stringify({
    client_id,
    response_type: 'code',
    redirect_uri,
    scope
  })}`;

    open(authURL);
    res.send('🎵 Redirection vers Spotify...');
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri
        })
    });

    const data = await response.json();

    if (data.refresh_token) {
        console.log('✅ Ton REFRESH TOKEN :');
        console.log('\n🔁', data.refresh_token);
        res.send('✅ Refresh token reçu ! Regarde la console.');
    } else {
        console.error('❌ Erreur:', data);
        res.send('❌ Une erreur est survenue. Regarde la console.');
    }

    process.exit();
});

app.listen(PORT, () => {
    console.log(`🟢 Serveur local lancé : http://localhost:${PORT}/login`);
});
