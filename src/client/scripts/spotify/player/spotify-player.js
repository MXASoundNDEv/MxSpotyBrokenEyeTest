// spotify/player/spotify-player.js - Spotify Player management
'use strict';

import { CONFIG } from '../config/spotify-config.js';
import { utils } from '../utils/spotify-utils.js';
import { SpotifyAPI } from '../api/spotify-api.js';

/**
 * Spotify Player Manager
 */
export class SpotifyPlayer {
    constructor(appState, uiUtils) {
        this.appState = appState;
        this.uiUtils = uiUtils;
        this.api = new SpotifyAPI(() => this.appState.token);
    }

    /**
     * Initialize Spotify Player
     */
    async initPlayer() {
        console.log('🔄 Initialisation du Spotify Player...');
        
        // Afficher la modal de chargement pour l'initialisation du player
        const loadingSteps = [
            'Initialisation du SDK Spotify...',
            'Connexion au lecteur...',
            'Configuration du périphérique...'
        ];
        
        const loader = this.uiUtils?.showLoadingModal('Connexion à Spotify...', loadingSteps);
        
        try {
            // Set up the callback for when SDK is ready
            window.onSpotifyWebPlaybackSDKReady = () => {
                this._createPlayer(loader);
            };

            // If SDK is already loaded, call the callback immediately
            if (window.Spotify) {
                window.onSpotifyWebPlaybackSDKReady();
            }
            
        } catch (error) {
            if (this.uiUtils?.hideLoadingModal) {
                this.uiUtils.hideLoadingModal();
            }
            utils.showError('Erreur lors de l\'initialisation du player Spotify', error);
        }
    }

    /**
     * Create Spotify Web Playback SDK player
     */
    _createPlayer(loader) {
        if (loader) loader.completeStep(0);
        if (loader) loader.updateMessage('Création du lecteur Spotify...');
        
        this.appState.player = new Spotify.Player({
            name: CONFIG.PLAYER_NAME,
            getOAuthToken: cb => cb(this.appState.token),
            volume: CONFIG.DEFAULT_VOLUME
        });

        this._setupPlayerListeners(loader);
        this.appState.player.connect();
    }

    /**
     * Setup player event listeners
     */
    _setupPlayerListeners(loader) {
        this.appState.player.addListener('ready', ({ device_id }) => {
            if (loader) loader.completeStep(1);
            if (loader) loader.updateMessage('Configuration du périphérique...');
            
            this.appState.deviceId = device_id;
            if (loader) loader.completeStep(2);
            
            // Petite pause pour montrer que l'initialisation est terminée
            setTimeout(() => {
                if (this.uiUtils?.hideLoadingModal) {
                    this.uiUtils.hideLoadingModal();
                }
                this._initUI();
            }, 300);
            
            console.log('✅ SDK Ready. Device ID:', device_id);
            this.appState.player.activateElement().catch(err => 
                console.warn('Activation requise par l\'utilisateur:', err)
            );
        });

        this.appState.player.addListener('not_ready', ({ device_id }) => {
            console.warn('❌ SDK Not Ready. Device ID:', device_id);
            if (this.uiUtils?.hideLoadingModal) {
                this.uiUtils.hideLoadingModal();
            }
            if (typeof showPopup === 'function') {
                showPopup({
                    text: "SDK Not Ready. Veuillez vérifier votre connexion.",
                    type: "error",
                    position: "top-middle",
                    duration: 5000
                });
            }
        });

        // Error listeners avec gestion améliorée
        const errorTypes = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
        errorTypes.forEach(type => 
            this.appState.player.addListener(type, error => {
                console.error(`${type}:`, error);
                if (this.uiUtils?.hideLoadingModal) {
                    this.uiUtils.hideLoadingModal();
                }
                
                // Gestion spéciale pour les erreurs d'authentification
                if (type === 'authentication_error') {
                    console.warn('🔐 Erreur d\'authentification détectée');
                    
                    // Nettoyer les tokens expirés
                    localStorage.removeItem('spotify_access_token');
                    localStorage.removeItem('spotify_token_expiry');
                    sessionStorage.removeItem('spotify_access_token');
                    
                    if (typeof showPopup === 'function') {
                        showPopup({
                            text: "Session Spotify expirée. Reconnexion nécessaire...",
                            type: "warning",
                            position: "center",
                            duration: 5000
                        });
                    }
                    
                    // Redirection après 3 secondes
                    setTimeout(() => {
                        console.log('🔄 Redirection vers /login...');
                        window.location.href = '/login';
                    }, 3000);
                    
                    return;
                }
                
                if (typeof showPopup === 'function') {
                    showPopup({
                        text: `Erreur Spotify: ${type.replace('_', ' ')}`,
                        type: "error",
                        position: "center",
                        duration: 5000
                    });
                }
            })
        );
    }

    /**
     * Initialize UI elements
     */
    _initUI() {
        if (typeof initUI === 'function') {
            initUI();
        }
    }

    /**
     * Play a track
     */
    async playTrack(track) {
        if (!track?.uri || !utils.ensurePlayerReady(this.appState.player)) {
            console.warn('⛔ Impossible de jouer : URI ou player non disponible');
            return;
        }

        try {
            // Start playback
            await this.api.startTrackPlayback(track, this.appState.deviceId);
            utils.showInfo('Lecture en cours...');
            
            // Wait for track to load
            await new Promise(resolve => setTimeout(resolve, CONFIG.TRACK_LOAD_DELAY));
            
            // Seek to random position
            await this._seekToRandomPosition();
            
            // Update UI
            if (typeof updateTrackUI === 'function') {
                await updateTrackUI();
            } else {
                await this.api.updateTrackUI();
            }
            
            console.log(`🎵 Début de lecture de la chanson ${this.appState.currentIndex + 1}`);
            
        } catch (error) {
            utils.showError('Erreur lecture piste Spotify', error);
        }
    }

    /**
     * Seek to random position in track
     */
    async _seekToRandomPosition() {
        const state = await this.appState.player.getCurrentState();
        const duration = state?.track_window?.current_track?.duration_ms || 0;
        
        if (duration > 0) {
            const middle = duration / 2;
            const offset = (Math.random() * CONFIG.SEEK_OFFSET_RANGE) - (CONFIG.SEEK_OFFSET_RANGE / 2);
            const seekTo = Math.max(0, Math.min(middle + offset, duration - CONFIG.SEEK_OFFSET_RANGE));
            
            await this.api.seekToPosition(seekTo);
        }
    }

    /**
     * Navigate to next track
     */
    nextTrack() {
        const hasNext = this.appState.nextTrack();
        
        // Mettre à jour l'historique immédiatement pour afficher les chansons jouées
        if (this.uiUtils?.updateHistoryPanel) {
            this.uiUtils.updateHistoryPanel(this.appState.playlistHistory);
        }
        
        if (!hasNext) {
            console.log('🏁 Fin de la playlist atteinte');
            utils.showInfo("Fin de la playlist atteinte", 3000);
            return false;
        }

        // Play next track
        const nextTrack = this.appState.getCurrentTrack();
        if (nextTrack) {
            this.playTrack(nextTrack);
            console.log(`🎵 Piste ${this.appState.currentIndex}/${this.appState.playlist.length}: ${nextTrack.title}`);
        }

        return true;
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (!utils.ensurePlayerReady(this.appState.player)) {
            return false;
        }
        
        this.appState.player.togglePlay().catch(error => {
            utils.showError("Erreur lors de la pause/lecture", error);
        });
        return true;
    }

    /**
     * Update sound volume
     */
    updateSoundVolume(volume) {
        if (!utils.ensurePlayerReady(this.appState.player)) {
            return false;
        }
        
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
            console.warn('⛔ Volume invalide:', volume);
            return false;
        }
        
        this.appState.player.setVolume(volume).catch(error => {
            utils.showError("Erreur lors de la mise à jour du volume", error);
        });
        return true;
    }

    /**
     * Set playing device
     */
    setPlayingDevice(deviceId) {
        if (!deviceId || !utils.ensurePlayerReady(this.appState.player)) {
            console.warn('⛔ Impossible de définir le périphérique: ID ou player non disponible');
            return false;
        }
        
        this.appState.deviceId = deviceId;
        console.log('🔄 Périphérique de lecture changé:', deviceId);
        return true;
    }
}
