// client/SpotifyV2.js - Refactored Spotify Player - Main Entry Point
'use strict';

// Import all modules
import { CONFIG } from './spotify/config/spotify-config.js';
import { utils } from './spotify/utils/spotify-utils.js';
import { appState } from './spotify/core/app-state.js';
import { domElements, uiUtils } from './spotify/ui/dom-manager.js';
import { SpotifyAPI } from './spotify/api/spotify-api.js';
import { SpotifyPlayer } from './spotify/player/spotify-player.js';
import { PlaylistManager } from './spotify/managers/playlist-manager.js';
import { AutoSwipe } from './spotify/features/autoswipe.js';

/**
 * Main Spotify Application Class
 */
class SpotifyApp {
    constructor() {
        this.appState = appState;
        this.utils = utils;
        this.uiUtils = uiUtils;
        this.domElements = domElements;

        // Initialize managers
        this.api = new SpotifyAPI(() => this.appState.token);
        this.player = new SpotifyPlayer(this.appState, this.uiUtils);
        this.playlistManager = new PlaylistManager(this.appState, this.uiUtils);
        this.autoSwipe = new AutoSwipe(this.appState, this.player, this.uiUtils);

        // Bind methods for global access
        this._bindGlobalMethods();

        // Initialize on DOM ready
        this._initializeOnDOMReady();
    }

    /**
     * Bind methods for global access (backward compatibility)
     */
    _bindGlobalMethods() {
        // Global functions for external scripts
        window.updateSpotifyToken = (token) => {
            return this.utils.updateToken(token, this.appState);
        };

        window.initializeSpotify = () => {
            const token = this.utils.getSpotifyToken();
            if (token) {
                this.appState.token = token;
                this.player.initPlayer();
                return true;
            }
            return false;
        };

        window.getAppState = () => this.appState;

        // Export main functions for external access
        window.spotifyApp = {
            // Player controls
            playTrack: (track) => this.player.playTrack(track),
            nextTrack: () => this.player.nextTrack(),
            togglePlayPause: () => this.player.togglePlayPause(),
            updateSoundVolume: (volume) => this.player.updateSoundVolume(volume),
            setPlayingDevice: (deviceId) => this.player.setPlayingDevice(deviceId),

            // Playlist management
            loadPlaylist: async (id) => {
                const firstTrack = await this.playlistManager.loadPlaylist(id);
                await this.handlePlaylistLoaded(firstTrack);
                return firstTrack;
            },
            clearPlaylist: () => this.playlistManager.clearPlaylist(),
            getUserPlaylists: () => this.playlistManager.getUserPlaylists(),
            getUserData: () => this.playlistManager.getUserData(),

            // AutoSwipe controls
            startAutoSwipe: () => this.autoSwipe.startAutoSwipe(),
            stopAutoSwipe: () => this.autoSwipe.stopAutoSwipe(),
            pauseAutoSwipe: () => this.autoSwipe.pauseAutoSwipe(),
            resumeAutoSwipe: () => this.autoSwipe.resumeAutoSwipe(),
            toggleAutoSwipe: () => this.autoSwipe.toggleAutoSwipe(),
            setAutoSwipeDelay: (delay) => this.autoSwipe.setAutoSwipeDelay(delay),

            // RevealAtEnd controls
            revealCurrentTrack: (duration, forceReveal = false) => {
                const currentTrack = this.appState.getCurrentTrack();
                if (currentTrack) {
                    // Si forceReveal est true (usage manuel) ou si la chanson n'est pas découverte
                    if (forceReveal || !currentTrack.discovered) {
                        return this.utils.revealTrackInfo(currentTrack, duration);
                    } else {
                        console.log('🎭 Chanson déjà découverte, révélation ignorée');
                        return Promise.resolve();
                    }
                }
                return Promise.resolve();
            },

            // API functions
            getCurrentTrackData: () => this.api.getCurrentTrackData(),
            getTrackIDData: (id) => this.api.getTrackIDData(id),

            // Utility functions
            updateDiscoveredStatus: (trackIndex, discovered) => {
                this.playlistManager.updateDiscoveredStatus(trackIndex, discovered);
            },
            markTrackAsPlayed: (trackIndex) => {
                this.playlistManager.markTrackAsPlayed(trackIndex);
            },

            // Access to core objects
            getAppState: () => this.appState,
            getUtils: () => this.utils,
            getDomElements: () => this.domElements,

            // Debug functions
            debugMarkCurrentAsPlayed: () => {
                this.playlistManager.markTrackAsPlayed(this.appState.currentIndex);
            },
            debugShowHistory: () => {
                console.log('Historique complet:', this.appState.playlistHistory);
            }
        };

        // Legacy function exports for backward compatibility
        window.loadPlaylist = (id) => this.playlistManager.loadPlaylist(id);
        window.nextTrack = () => this.player.nextTrack();
        window.playTrack = (track) => this.player.playTrack(track);
        window.clearPlaylist = () => this.playlistManager.clearPlaylist();
        window.startAutoSwipe = () => this.autoSwipe.startAutoSwipe();
        window.stopAutoSwipe = () => this.autoSwipe.stopAutoSwipe();
        window.toggleAutoSwipe = () => this.autoSwipe.toggleAutoSwipe();
        window.setAutoSwipeDelay = (delay) => this.autoSwipe.setAutoSwipeDelay(delay);
        window.updateDiscoveredStatus = (trackIndex, discovered) => {
            this.playlistManager.updateDiscoveredStatus(trackIndex, discovered);
        };
        window.getUserPlaylists = () => this.playlistManager.getUserPlaylists();
        window.getUserData = () => this.playlistManager.getUserData();
        window.togglePlayPause = () => this.player.togglePlayPause();
        window.updateSoundVolume = (volume) => this.player.updateSoundVolume(volume);
        window.setPlayingDevice = (deviceId) => this.player.setPlayingDevice(deviceId);

        // RevealAtEnd functions
        window.revealCurrentTrack = (duration, forceReveal = false) => {
            const currentTrack = this.appState.getCurrentTrack();
            if (currentTrack) {
                // Si forceReveal est true (usage manuel) ou si la chanson n'est pas découverte
                if (forceReveal || !currentTrack.discovered) {
                    return this.utils.revealTrackInfo(currentTrack, duration);
                } else {
                    console.log('🎭 Chanson déjà découverte, révélation ignorée');
                    return Promise.resolve();
                }
            }
            return Promise.resolve();
        };

        // Debug functions
        window.debugMarkCurrentAsPlayed = () => {
            this.playlistManager.markTrackAsPlayed(this.appState.currentIndex);
        };
        window.debugShowHistory = () => {
            console.log('Historique complet:', this.appState.playlistHistory);
        };
    }

    /**
     * Initialize on DOM ready
     */
    _initializeOnDOMReady() {
        addEventListener('DOMContentLoaded', () => {
            // Protection contre l'initialisation multiple
            if (window.spotifyAppInitialized) {
                console.log('⚠️ Application Spotify déjà initialisée');
                return;
            }
            window.spotifyAppInitialized = true;

            this._validateAndInitialize();
        });
    }

    /**
     * Validate token and initialize
     */
    async _validateAndInitialize() {
        // Vérification de la validité du token avant l'initialisation
        if (this.appState.token) {
            // Vérifier que le token n'est pas expiré
            const tokenExpiry = localStorage.getItem('spotify_token_expiry');
            if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
                console.warn('🔐 Token expiré, tentative de rafraîchissement...');
                const refreshed = await this.utils.refreshToken(this.appState);
                if (!refreshed) {
                    this.appState.token = null;
                }
            }
        }

        if (this.appState.token) {
            console.log('🎵 Initialisation avec token valide');

            // Nettoyer l'URL des tokens pour la sécurité
            if (window.location.hash.includes('access_token')) {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            }

            await this.player.initPlayer();
        } else {
            console.warn('❌ Aucune connexion Spotify valide détectée');
            if (typeof SpotifyconnectModal === 'function') {
                SpotifyconnectModal();
            }
        }
    }

    /**
     * Handle automatic playlist loading and AutoSwipe start
     */
    async handlePlaylistLoaded(firstTrack) {
        if (firstTrack) {
            await this.player.playTrack(firstTrack);

            // Redémarrer l'autoswipe si activé
            if (this.appState.autoSwipe.enabled) {
                setTimeout(() => {
                    this.autoSwipe.autoSwipeLoop();
                }, CONFIG.TRACK_LOAD_DELAY);
            }
        }
    }
}

// Initialize the application
const spotifyApp = new SpotifyApp();

// Export for ES modules
export default spotifyApp;
export { CONFIG, utils, appState, domElements, uiUtils };
