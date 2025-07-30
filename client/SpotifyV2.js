// client/spotify.js
const hash = Object.fromEntries(new URLSearchParams(window.location.hash.slice(1)));
const token = hash.access_token;
let player, playlist = [],
    currentIndex = 0,
    spotifyDeviceId = null;
let autoSwipeEnabled = true,
    autoSwipeDelay = 10000,
    autoSwipeAbortController = null;
let playlistHistory = [];

// const loginBtn = document.getElementById('login');
const playlistSelect = document.getElementById('playlistSelect');
// const nextBtn = document.getElementById('next');
// const toggleBtn = document.getElementById('toggleAutoSwipe');
// const currentDisplay = document.getElementById('current');
const thumbnail = document.getElementById('thumbnail');

addEventListener('DOMContentLoaded', () => {
    if (token) {
        initPlayer();
    } else {
        SpotifyconnectModal();
        console.warn('❌ Aucune connexion Spotify détectée. Veuillez vous connecter.');
    }
});

function initUI() {
    console.log('🔑 Token détecté, initialisation de l’interface...');

    fetch(`/api/me/playlists?token=${token}`)
        .then(res => res.json())
        .then(apiPlaylists => {
            console.log('📋 Playlists récupérées:', apiPlaylists);
            const playlists = apiPlaylists.map(p => ({
                id: p.id,
                name: p.name,
                image: p.image || 'https://placehold.co/300x300?text=No+Image'
            }));

            showPlaylistSelector(playlists, selected => {
                if (!selected.length) {
                    showPopup({
                        text: '❌ Aucune playlist sélectionnée',
                        type: 'warn',
                        position: 'top-right'
                    });
                    return;
                }
                loadPlaylist(selected[0].id);
            });
        });
}

async function initPlayer() {
    console.log('🔄 Initialisation du Spotify Player...');
    try {
        window.onSpotifyWebPlaybackSDKReady = () => {
            player = new Spotify.Player({
                name: 'Max Player',
                getOAuthToken: cb => cb(token),
                volume: 0.5
            });

            player.addListener('ready', ({
                device_id
            }) => {
                spotifyDeviceId = device_id;
                initUI();
                console.log('✅ SDK Ready. Device ID:', device_id);
                player.activateElement().catch(err => console.warn('🔇 Activation requise par l’utilisateur'));
            });

            player.addListener('not_ready', ({
                device_id
            }) => {
                console.warn('❌ SDK Not Ready. Device ID:', device_id);
                showPopup({
                    text: "SDK Not Ready. Veuillez vérifier votre connexion.",
                    type: "error",
                    position: "top-middle",
                    duration: 5000
                });
            });

            ['initialization_error', 'authentication_error', 'account_error', 'playback_error']
            .forEach(type => player.addListener(type, e => console.error(`${type}:`, e)));

            player.connect();
        };
    } catch (err) {
        console.error('❌ Erreur lors de l’initialisation du player:', err);
        showPopup({
            text: "Erreur lors de l'initialisation du player Spotify.",
            type: "error",
            position: "top-middle",
            duration: 5000
        });
    }
}

function loadPlaylist(id) {
    fetch(`/api/playlist/${id}?token=${token}`)
        .then(res => res.json())
        .then(data => {
            playlist = data;
            currentIndex = 0;
            if (playlist[0]) {
                playTrack(playlist[0]);
                toggleAutoSwipe(true);
            }
        });
}

async function getCurrentTrackData() {
    const res = await fetch(`/api/me/player?token=${token}`);
    if (res.status === 204) {
        console.warn('⚠️ Aucun morceau en cours de lecture.');
        return null;
    }

    if (!res.ok) {
        console.error('❌ Erreur serveur /api/me/player:', await res.text());
        return null;
    }

    const data = await res.json();
    return data;
}

async function getTrackIDData(id) {
    return fetch(`/api/tracks/${id}?token=${token}`)
        .then(res => res.json())
        .catch(err => {
            console.error('❌ Erreur récupération track ID :', err);
        });
}

async function playTrack(track) {
    if (!track || !track.uri || !player) {
        console.warn('⛔ Impossible de jouer : URI ou player non dispo');
        return;
    }

    try {
        await fetch(`/api/play?device_id=${spotifyDeviceId}&token=${token}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [track.uri]
            })
        });

        showPopup({
            text: `Lecture en cours...`,
            type: "info"
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        const state = await player.getCurrentState();
        const duration_ms = state ?.track_window ?.current_track ?.duration_ms || 0;
        const middle = duration_ms / 2;
        const offset = (Math.random() * 20000) - 10000;
        const seekTo = Math.max(0, Math.min(middle + offset, duration_ms - 20000));

        await fetch(`/api/seek?position_ms=${Math.floor(seekTo)}&token=${token}`, {
            method: 'PUT'
        });

        const data = await getCurrentTrackData();
        const thumb = data ?.image || 'https://placehold.co/300x300?text=No+Image';
        if (playlist[currentIndex]) playlist[currentIndex].image = thumb;
        if (thumbnail) thumbnail.src = thumb;
        //add blur filter effect
        if (thumbnail) thumbnail.style.filter = 'blur(1.5rem)';
    } catch (err) {
        console.error('❌ Erreur dans playTrack :', err);
        showPopup({
            text: "Erreur lecture piste Spotify",
            type: "error"
        });
    }
}

function nextTrack() {
    const currentTrack = playlist[currentIndex];
    if (currentTrack) {
        playlistHistory.push({
            uri: currentTrack.uri,
            title: currentTrack.title,
            image: currentTrack.image || 'https://placehold.co/300x300?text=No+Image'
        });
        updateHistoryPanel(playlistHistory);
    }

    currentIndex++;
    if (playlist[currentIndex]) playTrack(playlist[currentIndex]);
}

async function autoSwipeLoop() {
    autoSwipeAbortController = new AbortController();
    const {
        signal
    } = autoSwipeAbortController;
    try {
        while (autoSwipeEnabled && currentIndex < playlist.length - 1) {
            await delay(autoSwipeDelay, signal);
            nextTrack();
        }
    } catch (e) {
        if (e.name === 'AbortError') console.log('🛑 AutoSwipe arrêté');
    }
}

function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        });
    });
}

function toggleAutoSwipe(force) {
    autoSwipeEnabled = typeof force === 'boolean' ? force : !autoSwipeEnabled;
    if (autoSwipeEnabled) autoSwipeLoop();
    else if (autoSwipeAbortController) autoSwipeAbortController.abort();
}