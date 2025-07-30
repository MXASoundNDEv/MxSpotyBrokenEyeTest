// client/SpotifyV2.js - Refactored Spotify Player
'use strict';

// Configuration constants
const CONFIG = {
    PLAYER_NAME: 'Blindtest Player',
    DEFAULT_VOLUME: 0.5,
    PROGRESS_UPDATE_INTERVAL: 100,
    AUTOSWIPE_MIN_DELAY: 1000,
    AUTOSWIPE_MAX_DELAY: 60000,
    DEFAULT_AUTOSWIPE_DELAY: 10000,
    DEFAULT_MAX_SONGS: 10,
    SEEK_OFFSET_RANGE: 20000,
    TRACK_LOAD_DELAY: 1000,
    AUTOSWIPE_RESTART_DELAY: 500
};

// Utility functions
const utils = {
    parseUrlHash: () => Object.fromEntries(new URLSearchParams(window.location.hash.slice(1))),
    
    getUserOptions: () => {
        try {
            const options = JSON.parse(localStorage.getItem('userOptions') || '{}');
            return options.Optionlist || {};
        } catch (error) {
            console.warn('⚠️ Erreur lors du parsing des options utilisateur:', error);
            return {};
        }
    },
    
    showError: (message, error = null) => {
        console.error('❌', message, error);
        showPopup({
            text: message,
            type: "error",
            duration: 3000
        });
    },
    
    showInfo: (message, duration = 2000) => {
        //console.log('ℹ️', message);
        showPopup({
            text: message,
            type: "info",
            duration
        });
    },
    
    ensurePlayerReady: (player) => {
        if (!player) {
            utils.showError("Player non initialisé");
            return false;
        }
        return true;
    }
};

// Application state
const appState = {
    token: utils.parseUrlHash().access_token,
    player: null,
    deviceId: null,
    playlist: [],
    currentIndex: 0,
    playlistHistory: [],
    
    // AutoSwipe state
    autoSwipe: {
        enabled: utils.getUserOptions().AutoSwipeEnabled || true,
        delay: (utils.getUserOptions().songtime || 10) * 1000,
        abortController: null,
        status: 'stopped', // 'running', 'paused', 'stopped'
        progressElement: null,
        timeRemaining: 0
    },
    
    // Settings
    maxSongs: utils.getUserOptions().PlaylistMaxSongs || CONFIG.DEFAULT_MAX_SONGS
};

// DOM element cache
const domElements = {
    get playlistSelect() {
        return this._playlistSelect || (this._playlistSelect = document.getElementById('playlistSelect'));
    },
    
    get thumbnail() {
        return this._thumbnail || (this._thumbnail = document.getElementById('thumbnail'));
    }
};

// Initialization
addEventListener('DOMContentLoaded', () => {
    // Protection contre l'initialisation multiple
    if (window.spotifyAppInitialized) {
        //console.log('⚠️ Application Spotify déjà initialisée');
        return;
    }
    window.spotifyAppInitialized = true;
    
    if (appState.token) {
        initPlayer();
    } else {
        SpotifyconnectModal();
        console.warn('❌ Aucune connexion Spotify détectée. Veuillez vous connecter.');
    }
});

// Player initialization
async function initPlayer() {
    //console.log('🔄 Initialisation du Spotify Player...');
    try {
        window.onSpotifyWebPlaybackSDKReady = () => {
            appState.player = new Spotify.Player({
                name: CONFIG.PLAYER_NAME,
                getOAuthToken: cb => cb(appState.token),
                volume: CONFIG.DEFAULT_VOLUME
            });

            appState.player.addListener('ready', ({ device_id }) => {
                appState.deviceId = device_id;
                initUI();
                //console.log('✅ SDK Ready. Device ID:', device_id);
                appState.player.activateElement().catch(err => 
                    console.warn('Activation requise par l\'utilisateur:', err)
                );
            });

            appState.player.addListener('not_ready', ({ device_id }) => {
                console.warn('❌ SDK Not Ready. Device ID:', device_id);
                showPopup({
                    text: "SDK Not Ready. Veuillez vérifier votre connexion.",
                    type: "error",
                    position: "top-middle",
                    duration: 5000
                });
            });

            // Error listeners
            const errorTypes = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
            errorTypes.forEach(type => 
                appState.player.addListener(type, error => console.error(`${type}:`, error))
            );

            appState.player.connect();
        };
    } catch (error) {
        utils.showError('Erreur lors de l\'initialisation du player Spotify', error);
    }
}

// Playlist management
async function loadPlaylist(id) {
    clearPlaylist();
    
    if (!id || !appState.token) {
        console.warn('⛔ ID de playlist ou token manquant');
        return;
    }
    
    // Arrêter l'autoswipe précédent s'il est en cours
    if (appState.autoSwipe.status === 'running') {
        stopAutoSwipe();
    }
    
    try {
        const res = await fetch(`/api/playlist/${id}?token=${appState.token}`);
        const data = await res.json();
        
        // Récupérer les options utilisateur pour le mélange et le nombre max
        const userOptions = utils.getUserOptions();
        const shouldShuffle = userOptions.RandomSong || true; // Par défaut, mélanger la playlist
        const maxSongs = userOptions.MaxPlaylistSongs || appState.maxSongs || CONFIG.DEFAULT_MAX_SONGS;
        
        console.log(`📊 Options: Mélange=${shouldShuffle}, MaxSongs=${maxSongs}, Playlist=${data.length} chansons`);
        
        // Mélanger la playlist si l'option est activée
        let processedPlaylist = [...data]; // Copie de la playlist
        if (shouldShuffle) {
            // Algorithme de mélange Fisher-Yates
            for (let i = processedPlaylist.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [processedPlaylist[i], processedPlaylist[j]] = [processedPlaylist[j], processedPlaylist[i]];
            }
            console.log('🎲 Playlist mélangée');
            console.log(`🔀 Playlist mélangée: ${processedPlaylist.length} chansons`);
        }
        
        // Limiter au nombre maximum de chansons
        if (processedPlaylist.length > maxSongs) {
            processedPlaylist = processedPlaylist.slice(0, maxSongs);
            console.log(`✂️ Playlist limitée à ${maxSongs} chansons (était ${data.length})`);
        }
        
        appState.playlist = processedPlaylist;
        appState.currentIndex = 0;
        
        // Créer l'historique complet avec toutes les chansons de la playlist
        // Récupérer les données détaillées pour chaque track
        const playlistHistoryPromises = appState.playlist.map(async (track, index) => {
            try {
                // Extraire l'ID Spotify de l'URI (spotify:track:ID)
                const trackId = track.uri.split(':').pop();
                const trackDetails = await getTrackIDData(trackId);
                
                return {
                    uri: track.uri,
                    title: trackDetails?.name || track.title || 'Titre inconnu',
                    artist: trackDetails?.artists?.map(a => a.name).join(', ') || 
                           track.artist || 
                           (track.artists && Array.isArray(track.artists) ? track.artists.map(a => a.name).join(', ') : 'Artiste inconnu'),
                    image: trackDetails?.album?.images?.[0]?.url || 
                           track.image?.url || 
                           track.image || 
                           'https://placehold.co/300x300?text=No+Image',
                    discovered: false, // Toutes les chansons commencent non découvertes
                    played: false, // Toutes les chansons commencent non jouées
                    index: index // Garder l'index pour référence
                };
            } catch (error) {
                console.warn(`⚠️ Erreur lors de la récupération des détails pour la track ${index}:`, error);
                // Fallback vers les données de base
                return {
                    uri: track.uri,
                    title: track.title || 'Titre inconnu',
                    artist: track.artist || (track.artists && Array.isArray(track.artists) ? track.artists.map(a => a.name).join(', ') : 'Artiste inconnu'),
                    image: track.image?.url || track.image || 'https://placehold.co/300x300?text=No+Image',
                    discovered: false,
                    played: false,
                    index: index
                };
            }
        });
        
        // Attendre que toutes les données soient récupérées
        appState.playlistHistory = await Promise.all(playlistHistoryPromises);
        
        // Mettre à jour l'affichage de l'historique
        updateHistoryPanel(appState.playlistHistory);
        
        console.log(`✅ Playlist chargée: ${appState.playlist.length} chansons (mélangée: ${shouldShuffle})`);
        
        if (appState.playlist[0]) {
            playTrack(appState.playlist[0]);
            
            // Redémarrer l'autoswipe si activé
            if (appState.autoSwipe.enabled) {
                setTimeout(() => {
                    autoSwipeLoop();
                }, CONFIG.TRACK_LOAD_DELAY);
            }
        }
    } catch (error) {
        utils.showError('Erreur lors du chargement de la playlist', error);
    }
}

// API functions
async function getCurrentTrackData() {
    const res = await fetch(`/api/me/player?token=${appState.token}`);
    
    if (res.status === 204) {
        console.warn('⚠️ Aucun morceau en cours de lecture.');
        return null;
    }

    if (!res.ok) {
        console.error('❌ Erreur serveur /api/me/player:', await res.text());
        return null;
    }

    return await res.json();
}

async function getTrackIDData(id) {
    try {
        const res = await fetch(`/api/tracks/${id}?token=${appState.token}`);
        return await res.json();
    } catch (error) {
        console.error('❌ Erreur récupération track ID :', error);
        return null;
    }
}

// Track playback
async function playTrack(track) {
    if (!track?.uri || !utils.ensurePlayerReady(appState.player)) {
        console.warn('⛔ Impossible de jouer : URI ou player non disponible');
        return;
    }

    try {
        // Start playback
        await startTrackPlayback(track);
        
        // Wait for track to load
        await new Promise(resolve => setTimeout(resolve, CONFIG.TRACK_LOAD_DELAY));
        
        // Seek to random position
        await seekToRandomPosition();
        
        // Update UI
        await updateTrackUI();
        
        // Marquer la chanson comme en cours de lecture (pas encore jouée complètement)
        //console.log(`🎵 Début de lecture de la chanson ${appState.currentIndex + 1}`);
        
    } catch (error) {
        utils.showError('Erreur lecture piste Spotify', error);
    }
}

async function startTrackPlayback(track) {
    await fetch(`/api/play?device_id=${appState.deviceId}&token=${appState.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [track.uri] })
    });
    
    utils.showInfo('Lecture en cours...');
}

async function seekToRandomPosition() {
    const state = await appState.player.getCurrentState();
    const duration = state?.track_window?.current_track?.duration_ms || 0;
    
    if (duration > 0) {
        const middle = duration / 2;
        const offset = (Math.random() * CONFIG.SEEK_OFFSET_RANGE) - (CONFIG.SEEK_OFFSET_RANGE / 2);
        const seekTo = Math.max(0, Math.min(middle + offset, duration - CONFIG.SEEK_OFFSET_RANGE));
        
        await fetch(`/api/seek?position_ms=${Math.floor(seekTo)}&token=${appState.token}`, {
            method: 'PUT'
        });
    }
}

// Track navigation
function nextTrack() {
    const currentTrack = appState.playlist[appState.currentIndex];
    
    // Marquer la chanson actuelle comme jouée et mettre à jour son statut dans l'historique
    if (currentTrack && appState.playlistHistory[appState.currentIndex]) {
        appState.playlistHistory[appState.currentIndex].discovered = currentTrack.discovered || false;
        appState.playlistHistory[appState.currentIndex].played = true; // Marquer comme jouée
        
        // Mettre à jour l'historique immédiatement pour afficher les chansons jouées
        updateHistoryPanel(appState.playlistHistory);
    }

    appState.currentIndex++;
    
    // Check if we've reached the end
    if (appState.currentIndex >= appState.playlist.length) {
        //console.log('🏁 Fin de la playlist atteinte');
        
        if (appState.autoSwipe.status === 'running') {
            stopAutoSwipe();
        }
        
        utils.showInfo("Fin de la playlist atteinte", 3000);
        return;
    }

    // Play next track
    const nextTrack = appState.playlist[appState.currentIndex];
    if (nextTrack) {
        playTrack(nextTrack);
        //console.log(`🎵 Piste ${appState.currentIndex + 1}/${appState.playlist.length}: ${nextTrack.title}`);
    }
}

// Fonction pour marquer une chanson comme jouée (sans la découvrir)
function markTrackAsPlayed(trackIndex) {
    if (appState.playlistHistory[trackIndex]) {
        appState.playlistHistory[trackIndex].played = true;
        //console.log(`🎵 Chanson ${trackIndex + 1} marquée comme jouée`);
        updateHistoryPanel(appState.playlistHistory);
    }
}

// Fonction de test pour débugger - accessible depuis la console
window.debugMarkCurrentAsPlayed = function() {
    markTrackAsPlayed(appState.currentIndex);
};

window.debugShowHistory = function() {
    //console.log('Historique complet:', appState.playlistHistory);
};

// Fonction pour synchroniser le statut découvert entre playlist et historique
function updateDiscoveredStatus(trackIndex, discovered) {
    let needsUpdate = false;
    
    if (appState.playlist[trackIndex]) {
        appState.playlist[trackIndex].discovered = discovered;
        needsUpdate = true;
    }
    if (appState.playlistHistory[trackIndex]) {
        appState.playlistHistory[trackIndex].discovered = discovered;
        appState.playlistHistory[trackIndex].played = true; // Marquer comme jouée quand découverte
        needsUpdate = true;
    }
    
    // Mise à jour unique de l'historique seulement si nécessaire
    if (needsUpdate && typeof updateHistoryPanel === 'function') {
        // Utilisation d'un délai pour éviter les appels multiples rapides
        if (updateDiscoveredStatus.updateTimeout) {
            clearTimeout(updateDiscoveredStatus.updateTimeout);
        }
        updateDiscoveredStatus.updateTimeout = setTimeout(() => {
            updateHistoryPanel(appState.playlistHistory);
            updateDiscoveredStatus.updateTimeout = null;
        }, 50); 
    }
}

// AutoSwipe functionality
async function autoSwipeLoop() {
    if (appState.autoSwipe.status === 'running') {
        //console.log('🔄 AutoSwipe déjà en cours');
        return;
    }
    
    appState.autoSwipe.abortController = new AbortController();
    const { signal } = appState.autoSwipe.abortController;
    appState.autoSwipe.status = 'running';
    
    //console.log('🚀 Démarrage de l\'AutoSwipe');
    
    try {
        while (shouldContinueAutoSwipe()) {
            // Update progress and wait
            appState.autoSwipe.timeRemaining = appState.autoSwipe.delay;
            updateAutoSwipeProgress();
            
            await delayWithProgress(appState.autoSwipe.delay, signal);
            
            // Check if autoswipe should continue
            if (!appState.autoSwipe.enabled || appState.autoSwipe.status !== 'running') {
                break;
            }
            
            //console.log(`⏭️ AutoSwipe: passage à la piste ${appState.currentIndex + 1}`);
            nextTrack();
            
            // Small delay for track loading
            await delay(CONFIG.AUTOSWIPE_RESTART_DELAY, signal);
        }
        
        finishAutoSwipe();
        
    } catch (error) {
        handleAutoSwipeError(error);
    } finally {
        clearAutoSwipeProgress();
    }
}

function shouldContinueAutoSwipe() {
    return appState.autoSwipe.enabled && 
           appState.currentIndex < Math.min(appState.playlist.length, appState.maxSongs - 1);
}

function finishAutoSwipe() {
    appState.autoSwipe.status = 'stopped';
    //console.log('✅ AutoSwipe terminé');
    showPopup({
        text: "AutoSwipe terminé - Fin de la playlist",
        type: "success",
        duration: 3000
    });
}

function handleAutoSwipeError(error) {
    appState.autoSwipe.status = 'stopped';
    
    if (error.name === 'AbortError') {
        //console.log('🛑 AutoSwipe arrêté manuellement');
    } else {
        console.error('❌ Erreur dans AutoSwipe:', error);
        utils.showError("Erreur dans l'AutoSwipe", error);
    }
}

// Utility delay functions
function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            });
        }
    });
}

async function delayWithProgress(ms, signal) {
    const intervalTime = CONFIG.PROGRESS_UPDATE_INTERVAL;
    let elapsed = 0;
    
    while (elapsed < ms) {
        if (signal?.aborted) {
            throw new DOMException('Progression annulée', 'AbortError');
        }
        
        appState.autoSwipe.timeRemaining = ms - elapsed;
        updateAutoSwipeProgress();
        
        await delay(Math.min(intervalTime, ms - elapsed), signal);
        elapsed += intervalTime;
    }
}

// Progress bar management
function updateAutoSwipeProgress() {
    if (!appState.autoSwipe.progressElement) {
        createProgressBar();
    }
    
    const { delay: totalDelay, timeRemaining } = appState.autoSwipe;
    const percentage = Math.max(0, (totalDelay - timeRemaining) / totalDelay * 100);
    const timeLeft = Math.ceil(timeRemaining / 1000);
    
    if (appState.autoSwipe.progressElement) {
        appState.autoSwipe.progressElement.style.width = `${percentage}%`;
        
        const timeDisplay = document.getElementById('autoswipe-time-display');
        if (timeDisplay) {
            timeDisplay.textContent = `${timeLeft}s`;
        }
    }
}

// CSS styles as constants
const PROGRESS_BAR_STYLES = {
    container: `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        padding: 10px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 1000;
        min-width: 200px;
    `,
    progressBackground: `
        background: #333;
        height: 4px;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 5px;
    `,
    progressBar: `
        background: linear-gradient(90deg, #1db954, #1ed760);
        height: 100%;
        width: 0%;
        transition: width 0.1s ease;
    `,
    stopButton: `
        background: #ff4444;
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        margin-top: 5px;
        width: 100%;
    `
};

function createProgressBar() {
    // Check if progress bar already exists
    let container = document.getElementById('autoswipe-progress-container');
    if (container) {
        //console.log('⚠️ Barre de progression déjà existante, réutilisation...');
        return;
    }

    // Protection contre la création multiple simultanée
    if (createProgressBar.isCreating) {
        //console.log('⚠️ Création de barre de progression déjà en cours...');
        return;
    }
    createProgressBar.isCreating = true;

    // Create container
    container = document.createElement('div');
    container.id = 'autoswipe-progress-container';
    container.style.cssText = PROGRESS_BAR_STYLES.container;

    // Create elements
    const elements = {
        label: createProgressLabel(),
        progressBackground: createProgressBackground(),
        timeDisplay: createTimeDisplay(),
        stopButton: createStopButton()
    };

    // Assemble components
    elements.progressBackground.appendChild(appState.autoSwipe.progressElement);
    Object.values(elements).forEach(el => container.appendChild(el));
    
    document.body.appendChild(container);
    
    // Marquer la fin de la création
    createProgressBar.isCreating = false;
}

function createProgressLabel() {
    const label = document.createElement('div');
    label.textContent = '🎵 AutoSwipe actif';
    label.style.marginBottom = '5px';
    return label;
}

function createProgressBackground() {
    const background = document.createElement('div');
    background.style.cssText = PROGRESS_BAR_STYLES.progressBackground;
    
    appState.autoSwipe.progressElement = document.createElement('div');
    appState.autoSwipe.progressElement.style.cssText = PROGRESS_BAR_STYLES.progressBar;
    
    return background;
}

function createTimeDisplay() {
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'autoswipe-time-display';
    timeDisplay.style.textAlign = 'center';
    timeDisplay.textContent = '0s';
    return timeDisplay;
}

function createStopButton() {
    const stopButton = document.createElement('button');
    stopButton.textContent = '⏹️ Arrêter';
    stopButton.style.cssText = PROGRESS_BAR_STYLES.stopButton;
    stopButton.onclick = stopAutoSwipe;
    return stopButton;
}

function clearAutoSwipeProgress() {
    const container = document.getElementById('autoswipe-progress-container');
    if (container) {
        container.remove();
    }
    appState.autoSwipe.progressElement = null;
}

// AutoSwipe control functions
function stopAutoSwipe() {
    appState.autoSwipe.enabled = false;
    appState.autoSwipe.status = 'stopped';
    
    if (appState.autoSwipe.abortController) {
        appState.autoSwipe.abortController.abort();
    }
    
    clearAutoSwipeProgress();
    //console.log('🛑 AutoSwipe arrêté manuellement');
    utils.showInfo("AutoSwipe arrêté");
}

function pauseAutoSwipe() {
    if (appState.autoSwipe.status === 'running') {
        appState.autoSwipe.status = 'paused';
        
        if (appState.autoSwipe.abortController) {
            appState.autoSwipe.abortController.abort();
        }
        
        //console.log('⏸️ AutoSwipe mis en pause');
        utils.showInfo("AutoSwipe mis en pause");
    }
}

function resumeAutoSwipe() {
    if (appState.autoSwipe.status === 'paused') {
        appState.autoSwipe.enabled = true;
        autoSwipeLoop();
        //console.log('▶️ AutoSwipe repris');
        utils.showInfo("AutoSwipe repris");
    }
}

function setAutoSwipeDelay(newDelay) {
    if (newDelay >= CONFIG.AUTOSWIPE_MIN_DELAY && newDelay <= CONFIG.AUTOSWIPE_MAX_DELAY) {
        appState.autoSwipe.delay = newDelay;
        //console.log(`⏱️ Délai AutoSwipe mis à jour: ${newDelay/1000}s`);
        utils.showInfo(`Délai AutoSwipe: ${newDelay/1000}s`);
        return true;
    }
    return false;
}

function startAutoSwipe() {
    if (appState.playlist.length === 0) {
        utils.showError("Veuillez charger une playlist d'abord", null);
        return false;
    }
    
    if (appState.autoSwipe.status === 'running') {
        utils.showInfo("AutoSwipe déjà en cours");
        return false;
    }
    
    appState.autoSwipe.enabled = true;
    autoSwipeLoop();
    //console.log('🚀 AutoSwipe démarré manuellement');
    utils.showInfo("AutoSwipe démarré");
    return true;
}

function toggleAutoSwipe() {
    switch (appState.autoSwipe.status) {
        case 'running':
            stopAutoSwipe();
            break;
        case 'paused':
            resumeAutoSwipe();
            break;
        default:
            startAutoSwipe();
    }
}

// Device and player controls
function setPlayingDevice(deviceId) {
    if (!deviceId || !utils.ensurePlayerReady(appState.player)) {
        console.warn('⛔ Impossible de définir le périphérique: ID ou player non disponible');
        return false;
    }
    
    appState.deviceId = deviceId;
    //console.log('🔄 Périphérique de lecture changé:', deviceId);
    return true;
}

function togglePlayPause() {
    if (!utils.ensurePlayerReady(appState.player)) {
        return false;
    }
    
    appState.player.togglePlay().catch(error => {
        utils.showError("Erreur lors de la pause/lecture", error);
    });
    return true;
}

function updateSoundVolume(volume) {
    if (!utils.ensurePlayerReady(appState.player)) {
        return false;
    }
    
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
        console.warn('⛔ Volume invalide:', volume);
        return false;
    }
    
    appState.player.setVolume(volume).catch(error => {
        utils.showError("Erreur lors de la mise à jour du volume", error);
    });
    return true;
}

function clearPlaylist() {
    appState.playlist = [];
    appState.currentIndex = 0;
    appState.playlistHistory = [];
    
    updateHistoryPanel(appState.playlistHistory);
    
    const thumbnail = domElements.thumbnail;
    if (thumbnail) {
        thumbnail.src = 'https://placehold.co/300x300?text=No+Image';
    }
    
    //console.log('🗑️ Playlist et historique vidés');
}

// User playlists
async function getUserPlaylists() {
    try {
        const response = await fetch(`/api/me/playlists?token=${appState.token}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const apiPlaylists = await response.json();
        //console.log('📋 Playlists récupérées:', apiPlaylists.length);
        
        return apiPlaylists.map(playlist => ({
            id: playlist.id,
            name: playlist.name,
            image: playlist.image || 'https://placehold.co/300x300?text=No+Image'
        }));
        
    } catch (error) {
        console.error('[🔥] Erreur lors de la récupération des playlists:', error);
        utils.showError('Erreur lors de la récupération des playlists', error);
        return [];
    }
}
    
async function getUserData() {
    try {
        const response = await fetch(`/api/me?token=${appState.token}`);

        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('[🔥] Erreur lors de la récupération des données utilisateur:', error);
        utils.showError('Erreur lors de la récupération des données utilisateur', error);
        return null;
    }
}