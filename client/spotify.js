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
const loginBtn = document.getElementById('login');
const playlistSelect = document.getElementById('playlistSelect');
const nextBtn = document.getElementById('next');
const toggleBtn = document.getElementById('toggleAutoSwipe');
const currentDisplay = document.getElementById('current');
const thumbnail = document.getElementById('thumbnail');

if (token) {
    initPlayer();
}else {
    SpotifyconnectModal();
    console.warn('❌ Aucune connexion Spotify détectée. Veuillez vous connecter.');
}

function initUI() {
    console.log('🔑 Token détecté, initialisation de l’interface...');

    fetch(`/api/me/playlists?token=${token}`)
        .then(res => res.json())
        .then(apiPlaylists => {
            // Conversion au format attendu par showPlaylistSelector
            console.log('📋 Playlists récupérées:', apiPlaylists);
            const playlists = apiPlaylists.map(p => ({
                id: p.id,
                name: p.name,
                image: p.image || 'https://placehold.co/300x300?text=No+Image'
            }));
            
            // Affichage dans la modal de sélection
            showPlaylistSelector(playlists, selected => {
                if (!selected.length) {
                    showPopup({
                        text: '❌ Aucune playlist sélectionnée',
                        type: 'warn',
                        position: 'top-right'
                    });
                    return;
                }

                // On prend la première playlist sélectionnée et on la charge
                loadPlaylist(selected[0].id);
            });
        });

    // nextBtn.onclick = () => nextTrack();
    // toggleBtn.onclick = () => toggleAutoSwipe();
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
            player.addListener('not_ready', ({ device_id }) => {
                console.warn('❌ SDK Not Ready. Device ID:', device_id);
                showPopup({
                    text: "SDK Not Ready. Veuillez vérifier votre connexion.",
                    type: "error",
                    position: "top-middle",
                    duration: 5000,
                    needValidate: true,
                    onValidate: () => {
                        console.log("Erreur validée !");
                    }
                });
            });

            player.addListener('initialization_error', e => console.error('init error', e));
            player.addListener('authentication_error', e => console.error('auth error', e));
            player.addListener('account_error', e => console.error('account error', e));
            player.addListener('playback_error', e => console.error('playback error', e));

            player.connect();
        };
    } catch (err) {
        console.error('❌ Erreur lors de l’initialisation du player:', err);
        showPopup({
            text: "Erreur lors de l'initialisation du player Spotify.",
            type: "error",
            position: "top-middle",
            duration: 5000,
            needValidate: true,
            onValidate: () => {
                console.log("Erreur validée !");
            }
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
                console.log('📜 musique chargée:', playlist[0].title);
                console.log('🎵 Total de pistes:', playlist.length);
                console.log('🎵 Total:', playlist[0]);

                playTrack(playlist[0]);
                toggleAutoSwipe(true);
            }
        });
}

function getTrackIDData(ID) {
    return fetch(`https://api.spotify.com/v1/tracks/${ID}`, {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
        .then(res => {
            if (!res.ok) throw new Error('Erreur lors de la récupération de la piste actuelle');
            return res.json();
        });
}

async function getCurrentTrackData() {
    const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });

    if (!res.ok) {
        console.error('❌ Erreur lecture player:', await res.text());
        return;
    }

    const data = await res.json();
    if (!data.item) {
        console.warn('⚠️ Aucun morceau en cours de lecture.');
        return;
    }
    console.log('🎧 Data actuel:', data);
    const name = data.item.name;
    const durationMs = data.item.duration_ms;
    const positionMs = data.progress_ms;
    const image = data.item.album.images[0].url || null;

    console.log(`🎵 "${name}" - Durée : ${Math.floor(durationMs / 1000)}s`);
    console.log(`⏱️ Position actuelle : ${Math.floor(positionMs / 1000)}s`);
    return {
        name,
        uri: data.item.uri || null,
        durationMs,
        positionMs,
        image
    };
}

function getCurrentTrack() {
    // Name and URI of the current track
    return getCurrentTrackData().then(track => {
        if (!track) {
            console.warn('⚠️ Aucun morceau en cours de lecture.');
            return null;
        }
        console.log(`🎵 Chanson actuelle : ${track}`);
        return {
            name: track.name,
            uri: track.uri,
            image: track.image || 'https://placehold.co/300x300?text=No+Image'
        };
    });
}

async function playTrack(track) {
    if (!track || !track.uri || !player) {
        console.warn('⛔ Impossible de jouer : URI ou player non dispo');
        return;
    }

    const {
        uri,
        title,
        artists
    } = track;


    try {
        // ▶️ Joue la track
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [uri]
            })
        });

        // currentDisplay.innerText = `▶️ Lecture en cours... (analyse durée)`;
        showPopup({
            text: `Lecture en cours...`,
            type: "info"
        });

        // 🕐 Attendre un peu
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 🔍 Obtenir les infos de lecture via SDK
        const state = await player.getCurrentState();
        if (!state || !state.track_window || !state.track_window.current_track) {
            throw new Error('État de lecture indisponible via SDK');
        }

        const currentTrack = state.track_window.current_track;
        const duration_ms = currentTrack.duration_ms;

        // 📍 Calcul du moment central ±10s
        const middle = duration_ms / 2;
        const offset = (Math.random() * 20000) - 10000; // ±10s
        const seekTo = Math.max(0, Math.min(middle + offset, duration_ms - 20000));

        console.log(`🎧 ${title} – ${artists} | Seek → ${Math.floor(seekTo / 1000)}s / ${Math.floor(duration_ms / 1000)}s`);

        // ⏩ Seek
        await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(seekTo)}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        // 🖼️ Mettre à jour l'affichage
        const thumb = await getCurrentTrackData().then(data => data.image);
        //add image to playlist  playlist[currentIndex]
        if (playlist[currentIndex]) {
            playlist[currentIndex].image = thumb || 'https://placehold.co/300x300?text=No+Image';
        }
        console.log('📸 Image actuelle :', thumb);
        if (thumbnail) {
            thumbnail.src = thumb || 'https://placehold.co/300x300?text=No+Image';
        }

        // currentDisplay.innerText = `▶️ Lecture : ${title} – ${artists} (→ ${Math.floor(seekTo / 1000)}s)`;

    } catch (err) {
        console.error('❌ Erreur dans playTrack (SDK) :', err);
        showPopup({
            text: "Erreur lors de la lecture de la piste Spotify.",
            type: "error"
        });
    }
}


function nextTrack() {
    const currentTrack = playlist[currentIndex];
    console.log('🔄 Chanson actuelle :', currentTrack);
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
    console.log('🔄 Démarrage de la boucle AutoSwipe...');
    autoSwipeAbortController = new AbortController();
    const {
        signal
    } = autoSwipeAbortController;

    try {
        console.log(currentIndex);
        console.log(playlist.length);
        while (autoSwipeEnabled && currentIndex < playlist.length - 1) {
            await delay(autoSwipeDelay, signal);
            nextTrack();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('🛑 AutoSwipe arrêté');
        }
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
    console.log(`🔄 AutoSwipe ${autoSwipeEnabled ? 'activé' : 'désactivé'}`);
    if (autoSwipeEnabled) {
        autoSwipeLoop(); // <--- doit toujours être appelé ici
    } else if (autoSwipeAbortController) {
        autoSwipeAbortController.abort();
    }
}


// showPopup({
//     text: "Spotify Player initialisé avec succès !",
//     type: "success", // info, error, warn, success
//     position: "top-middle", // top-left, top-right, bottom-left, bottom-right
//     duration: 4000, // en ms
//     needValidate: true,
//     onValidate: () => {
//       console.log("Validé !");
//     }
// });


