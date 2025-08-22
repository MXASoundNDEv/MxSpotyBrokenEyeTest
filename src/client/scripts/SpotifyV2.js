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
    
    parseUrlParams: () => Object.fromEntries(new URLSearchParams(window.location.search)),
    
    getSpotifyToken: () => {
        // Chercher le token dans plusieurs endroits
        const hashParams = utils.parseUrlHash();
        const urlParams = utils.parseUrlParams();
        const storedToken = localStorage.getItem('spotify_access_token');
        const sessionToken = sessionStorage.getItem('spotify_access_token');
        const tokenExpiry = localStorage.getItem('spotify_token_expiry');
        
        // Vérifier si le token stocké est expiré
        if (storedToken && tokenExpiry) {
            const now = Date.now();
            if (now > parseInt(tokenExpiry)) {
                console.warn('🔐 Token Spotify expiré, nettoyage...');
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_token_expiry');
                sessionStorage.removeItem('spotify_access_token');
                return null;
            }
        }
        
        // Priorité : URL hash > URL params > localStorage > sessionStorage
        const token = hashParams.access_token || 
                     urlParams.access_token || 
                     storedToken || 
                     sessionToken;
        
        // Sauvegarder le token s'il est trouvé et pas déjà stocké
        if (token && token !== storedToken) {
            localStorage.setItem('spotify_access_token', token);
            
            // Sauvegarder aussi le refresh token s'il est fourni
            if (hashParams.refresh_token || urlParams.refresh_token) {
                const refreshToken = hashParams.refresh_token || urlParams.refresh_token;
                localStorage.setItem('spotify_refresh_token', refreshToken);
                console.log('🔄 Refresh token sauvegardé');
            }
            
            // Calculer l'expiration (3600 secondes par défaut pour Spotify)
            const expiresIn = hashParams.expires_in || urlParams.expires_in || 3600;
            const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
            localStorage.setItem('spotify_token_expiry', expiryTime.toString());
            
            console.log('🔐 Token Spotify sauvegardé avec expiration:', new Date(expiryTime));
        }
        
        return token;
    },
    
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
    },
    
    updateToken: (newToken) => {
        if (newToken && newToken !== appState.token) {
            appState.token = newToken;
            localStorage.setItem('spotify_access_token', newToken);
            console.log('🔄 Token Spotify mis à jour');
            return true;
        }
        return false;
    },
    
    // Nouvelle fonction pour tester la validité du token
    validateToken: async (token) => {
        if (!token) return false;
        
        try {
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                console.log('✅ Token Spotify valide');
                return true;
            } else if (response.status === 401) {
                console.warn('🔐 Token Spotify invalide/expiré, tentative de rafraîchissement...');
                
                // Essayer de rafraîchir le token automatiquement
                const refreshed = await utils.refreshToken();
                if (refreshed) {
                    console.log('✅ Token rafraîchi avec succès');
                    return true;
                } else {
                    console.warn('❌ Impossible de rafraîchir le token');
                    // Nettoyer le token invalide
                    localStorage.removeItem('spotify_access_token');
                    localStorage.removeItem('spotify_token_expiry');
                    sessionStorage.removeItem('spotify_access_token');
                    return false;
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de la validation du token:', error);
            return false;
        }
        
        return false;
    },

    // Fonction pour rafraîchir automatiquement le token
    refreshToken: async () => {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) {
            console.warn('[⚠️] Pas de refresh token disponible');
            return false;
        }

        try {
            console.log('[🔄] Tentative de rafraîchissement du token...');
            
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Sauvegarder le nouveau token
            localStorage.setItem('spotify_access_token', data.access_token);
            const expiryTime = Date.now() + (parseInt(data.expires_in) * 1000);
            localStorage.setItem('spotify_token_expiry', expiryTime.toString());
            
            // Mettre à jour le refresh token s'il a changé
            if (data.refresh_token) {
                localStorage.setItem('spotify_refresh_token', data.refresh_token);
            }
            
            // Mettre à jour l'état de l'application
            appState.token = data.access_token;
            
            console.log('[✅] Token rafraîchi avec succès');
            return true;
            
        } catch (error) {
            console.error('[❌] Erreur lors du rafraîchissement du token:', error);
            
            // Nettoyer les tokens invalides
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_refresh_token');
            localStorage.removeItem('spotify_token_expiry');
            
            return false;
        }
    }
};

// Application state
const appState = {
    token: utils.getSpotifyToken(),
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
    
    // Vérification de la validité du token avant l'initialisation
    if (appState.token) {
        // Vérifier que le token n'est pas expiré
        const tokenExpiry = localStorage.getItem('spotify_token_expiry');
        if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
            console.warn('🔐 Token Spotify expiré au chargement');
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_token_expiry');
            appState.token = null;
        }
    }
    
    if (appState.token) {
        console.log('🎵 Initialisation avec token valide');
        
        // Nettoyer l'URL des tokens pour la sécurité
        if (window.location.hash.includes('access_token')) {
            console.log('🧹 Nettoyage de l\'URL des tokens');
            history.replaceState(null, null, window.location.pathname);
        }
        
        initPlayer();
    } else {
        console.warn('❌ Aucune connexion Spotify valide détectée');
        SpotifyconnectModal();
    }
});

// Player initialization
async function initPlayer() {
    //console.log('🔄 Initialisation du Spotify Player...');
    
    // Afficher la modal de chargement pour l'initialisation du player
    const loadingSteps = [
        'Initialisation du SDK Spotify...',
        'Connexion au lecteur...',
        'Configuration du périphérique...'
    ];
    
    const loader = showLoadingModal('Connexion à Spotify...', loadingSteps);
    
    try {
        window.onSpotifyWebPlaybackSDKReady = () => {
            loader.completeStep(0);
            loader.updateMessage('Création du lecteur Spotify...');
            
            appState.player = new Spotify.Player({
                name: CONFIG.PLAYER_NAME,
                getOAuthToken: cb => cb(appState.token),
                volume: CONFIG.DEFAULT_VOLUME
            });

            appState.player.addListener('ready', ({ device_id }) => {
                loader.completeStep(1);
                loader.updateMessage('Configuration du périphérique...');
                
                appState.deviceId = device_id;
                loader.completeStep(2);
                
                // Petite pause pour montrer que l'initialisation est terminée
                setTimeout(() => {
                    hideLoadingModal();
                    initUI();
                }, 300);
                
                //console.log('✅ SDK Ready. Device ID:', device_id);
                appState.player.activateElement().catch(err => 
                    console.warn('Activation requise par l\'utilisateur:', err)
                );
            });

            appState.player.addListener('not_ready', ({ device_id }) => {
                console.warn('❌ SDK Not Ready. Device ID:', device_id);
                hideLoadingModal();
                showPopup({
                    text: "SDK Not Ready. Veuillez vérifier votre connexion.",
                    type: "error",
                    position: "top-middle",
                    duration: 5000
                });
            });

            // Error listeners avec gestion améliorée
            const errorTypes = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
            errorTypes.forEach(type => 
                appState.player.addListener(type, error => {
                    console.error(`${type}:`, error);
                    hideLoadingModal();
                    
                    // Gestion spéciale pour les erreurs d'authentification
                    if (type === 'authentication_error') {
                        console.warn('🔐 Erreur d\'authentification détectée');
                        
                        // Nettoyer les tokens expirés
                        localStorage.removeItem('spotify_access_token');
                        localStorage.removeItem('spotify_token_expiry');
                        sessionStorage.removeItem('spotify_access_token');
                        
                        showPopup({
                            text: "Session Spotify expirée. Reconnexion nécessaire...",
                            type: "warning",
                            position: "center",
                            duration: 5000
                        });
                        
                        // Redirection après 3 secondes
                        setTimeout(() => {
                            console.log('🔄 Redirection vers /login...');
                            window.location.href = '/login';
                        }, 3000);
                        
                        return;
                    }
                    
                    showPopup({
                        text: `Erreur Spotify: ${type.replace('_', ' ')}`,
                        type: "error",
                        position: "center",
                        duration: 5000
                    });
                })
            );

            appState.player.connect();
        };
    } catch (error) {
        hideLoadingModal();
        utils.showError('Erreur lors de l\'initialisation du player Spotify', error);
    }
}

// Playlist management
async function loadPlaylist(id) {
    clearPlaylist();
    
    // Protection du layout desktop pendant le chargement
    if (window.ensureDesktopLayout && typeof window.ensureDesktopLayout === 'function') {
        window.ensureDesktopLayout();
    } else if (window.innerWidth > 768 && !document.body.classList.contains('mobile-optimized')) {
        document.body.classList.add('force-desktop-mode');
        document.body.classList.remove('mobile-optimized');
        console.log('🖥️ Layout desktop protégé pendant le chargement');
    }
    
    if (!id || !appState.token) {
        console.warn('⛔ ID de playlist ou token manquant');
        return;
    }
    
    // Afficher la modal de chargement pour le chargement de la playlist
    const loadingSteps = [
        'Récupération de la playlist...',
        'Traitement des chansons...',
        'Chargement des détails...',
        'Finalisation...'
    ];
    
    const loader = showLoadingModal('Chargement de la playlist...', loadingSteps);
    
    // Arrêter l'autoswipe précédent s'il est en cours
    if (appState.autoSwipe.status === 'running') {
        stopAutoSwipe();
    }
    
    try {
        // Étape 1: Récupérer la playlist
        const res = await fetch(`/api/playlist/${id}?token=${appState.token}`);
        const data = await res.json();
        loader.completeStep(0);
        
        // Étape 2: Traitement des options
        loader.updateMessage('Traitement des options de playlist...');
        
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
        
        loader.completeStep(1);
        
        appState.playlist = processedPlaylist;
        appState.currentIndex = 0;
        
        // Étape 3: Chargement des détails des chansons
        loader.updateMessage('Chargement des détails des chansons...');
        
        // Créer l'historique complet avec toutes les chansons de la playlist
        // Récupérer les données détaillées pour chaque track
        const playlistHistoryPromises = appState.playlist.map(async (track, index) => {
            try {
                // Mettre à jour le message pour montrer le progrès
                if (index % 5 === 0) { // Mise à jour tous les 5 éléments pour éviter trop de updates
                    loader.updateMessage(`Chargement des détails... (${index + 1}/${appState.playlist.length})`);
                }
                
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
        loader.completeStep(2);
        
        // Étape 4: Finalisation
        loader.updateMessage('Finalisation du chargement...');
        
        // Mettre à jour l'affichage de l'historique
        updateHistoryPanel(appState.playlistHistory);
        
        console.log(`✅ Playlist chargée: ${appState.playlist.length} chansons (mélangée: ${shouldShuffle})`);
        
        loader.completeStep(3);
        
        // Petite pause pour montrer que le chargement est terminé
        await new Promise(resolve => setTimeout(resolve, 500));
        hideLoadingModal();
        
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
        hideLoadingModal();
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
    
    // Initialiser l'interface AutoSwipe
    const existingContainer = document.getElementById('autoswipeProgressContainer');
    if (existingContainer) {
        existingContainer.style.display = 'block';
    }
    
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
    // Priorité 1: Utiliser l'élément HTML existant
    const existingContainer = document.getElementById('autoswipeProgressContainer');
    const existingProgressFill = document.getElementById('autoswipeProgressFill');
    const existingTimeRemaining = document.getElementById('autoswipeTimeRemaining');
    // Détecter le mode mobile (plus de redirection vers /mobile)
    const isMobile = window.innerWidth <= 768 || 
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (existingContainer && existingProgressFill && existingTimeRemaining) {
        // Utiliser l'interface HTML existante
        const { delay: totalDelay, timeRemaining } = appState.autoSwipe;
        const percentage = Math.max(0, (totalDelay - timeRemaining) / totalDelay * 100);
        const timeLeft = Math.ceil(timeRemaining / 1000);
        

        // Mettre à jour la progression
        existingProgressFill.style.width = `${percentage}%`;
        existingTimeRemaining.textContent = `${timeLeft}s`;
        
        return; // Sortir ici, ne pas créer de popup
    }
    
    // Priorité 2: Interface desktop (si pas d'éléments HTML existants)
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
    // Vérifier d'abord si l'interface HTML existe déjà
    const existingContainer = document.getElementById('autoswipeProgressContainer');
    if (existingContainer) {
        //console.log('📱 Interface AutoSwipe HTML existante détectée');
        return;
    }
    
    // Détecter le mode mobile (plus de redirection vers /mobile)
    const isMobile = window.innerWidth <= 768 || 
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        //console.log('📱 Interface mobile détectée, pas de popup AutoSwipe');
        return;
    }
    
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
    // Nettoyer l'interface HTML existante
    const existingContainer = document.getElementById('autoswipeProgressContainer');
    if (existingContainer) {
        existingContainer.style.display = 'none';
        
        const existingProgressFill = document.getElementById('autoswipeProgressFill');
        const existingTimeRemaining = document.getElementById('autoswipeTimeRemaining');
        
        if (existingProgressFill) existingProgressFill.style.width = '0%';
        if (existingTimeRemaining) existingTimeRemaining.textContent = '10s';
    }
    
    // Nettoyer la popup desktop
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
        console.log('[📋] Récupération des playlists utilisateur...');
        const response = await fetch(`/api/me/playlists?token=${appState.token}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            
            // Si le token est expiré, rediriger vers la connexion
            if (response.status === 401 || errorData.needsReauth) {
                console.warn('[⚠️] Token expiré, redirection vers la connexion...');
                utils.showError('Session expirée', 'Veuillez vous reconnecter');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                return [];
            }
            
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
        const apiPlaylists = await response.json();
        console.log('[✅] Playlists récupérées avec succès:', apiPlaylists.length);
        
        return apiPlaylists.map(playlist => ({
            id: playlist.id,
            name: playlist.name,
            image: playlist.image || 'https://placehold.co/300x300?text=No+Image'
        }));
        
    } catch (error) {
        console.error('[🔥] Erreur lors de la récupération des playlists:', error);
        utils.showError('Erreur lors de la récupération des playlists', error.message || error);
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

// Fonctions globales pour l'interface mobile
window.updateSpotifyToken = (token) => {
    return utils.updateToken(token);
};

window.initializeSpotify = () => {
    const token = utils.getSpotifyToken();
    if (token) {
        appState.token = token;
        initPlayer();
        return true;
    }
    return false;
};

window.getAppState = () => appState;