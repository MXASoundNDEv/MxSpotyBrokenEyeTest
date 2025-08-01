// spotify/managers/playlist-manager.js - Playlist management
'use strict';

import { CONFIG } from '../config/spotify-config.js';
import { utils } from '../utils/spotify-utils.js';
import { SpotifyAPI } from '../api/spotify-api.js';

/**
 * Playlist Manager
 */
export class PlaylistManager {
    constructor(appState, uiUtils) {
        this.appState = appState;
        this.uiUtils = uiUtils;
        this.api = new SpotifyAPI(() => this.appState.token);
    }

    /**
     * Load playlist from API
     */
    async loadPlaylist(id) {
        this.clearPlaylist();
        
        // Protection du layout desktop pendant le chargement
        if (this.uiUtils?.ensureDesktopLayout) {
            this.uiUtils.ensureDesktopLayout();
        }
        
        if (!id || !this.appState.token) {
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
        
        const loader = (typeof showLoadingModal === 'function') ? 
            showLoadingModal('Chargement de la playlist...', loadingSteps) : 
            this.uiUtils?.showLoadingModal('Chargement de la playlist...', loadingSteps);
        
        // Arrêter l'autoswipe précédent s'il est en cours
        if (this.appState.autoSwipe.status === 'running') {
            // L'autoswipe sera géré par le manager principal
            console.log('🛑 AutoSwipe en cours détecté, arrêt en cours...');
        }
        
        try {
            // Étape 1: Récupérer la playlist
            const data = await this.api.loadPlaylistData(id);
            if (loader) loader.completeStep(0);
            
            // Étape 2: Traitement des options
            if (loader) loader.updateMessage('Traitement des options de playlist...');
            
            // Récupérer les options utilisateur pour le mélange et le nombre max
            const userOptions = utils.getUserOptions();
            const shouldShuffle = userOptions.RandomSong || true;
            const maxSongs = userOptions.MaxPlaylistSongs || this.appState.maxSongs || CONFIG.DEFAULT_MAX_SONGS;
            
            console.log(`📊 Options: Mélange=${shouldShuffle}, MaxSongs=${maxSongs}, Playlist=${data.length} chansons`);
            
            // Mélanger la playlist si l'option est activée
            let processedPlaylist = [...data];
            if (shouldShuffle) {
                this._shuffleArray(processedPlaylist);
            }
            
            // Limiter au nombre maximum de chansons
            if (processedPlaylist.length > maxSongs) {
                processedPlaylist = processedPlaylist.slice(0, maxSongs);
                console.log(`✂️ Playlist limitée à ${maxSongs} chansons`);
            }
            
            if (loader) loader.completeStep(1);
            
            this.appState.playlist = processedPlaylist;
            this.appState.currentIndex = 0;
            
            // Étape 3: Chargement des détails des chansons
            if (loader) loader.updateMessage('Chargement des détails des chansons...');
            
            // Créer l'historique complet avec toutes les chansons de la playlist
            const playlistHistoryPromises = this.appState.playlist.map(async (track, index) => {
                try {
                    // Extraire l'ID Spotify de l'URI (spotify:track:ID)
                    const trackId = track.uri ? track.uri.split(':').pop() : track.id;
                    const trackData = await this.api.getTrackIDData(trackId);
                    
                    return {
                        uri: track.uri,
                        title: trackData?.name || track.title || 'Titre inconnu',
                        artist: trackData?.artists?.map(a => a.name).join(', ') || 
                               track.artist || 
                               (track.artists && Array.isArray(track.artists) ? track.artists.map(a => a.name).join(', ') : 'Artiste inconnu'),
                        image: trackData?.album?.images?.[0]?.url || 
                               track.image?.url || 
                               track.image || 
                               'https://placehold.co/300x300?text=No+Image',
                        discovered: false,
                        played: false,
                        index: index
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
            this.appState.playlistHistory = await Promise.all(playlistHistoryPromises);
            if (loader) loader.completeStep(2);
            
            // Étape 4: Finalisation
            if (loader) loader.updateMessage('Finalisation du chargement...');
            
            // Mettre à jour l'affichage de l'historique
            if (window.updateHistoryPanel && typeof window.updateHistoryPanel === 'function') {
                window.updateHistoryPanel(this.appState.playlistHistory);
            } else if (this.uiUtils?.updateHistoryPanel) {
                this.uiUtils.updateHistoryPanel(this.appState.playlistHistory);
            }
            
            console.log(`✅ Playlist chargée: ${this.appState.playlist.length} chansons (mélangée: ${shouldShuffle})`);
            
            if (loader) loader.completeStep(3);
            
            // Petite pause pour montrer que le chargement est terminé
            await new Promise(resolve => setTimeout(resolve, 500));
            if (typeof hideLoadingModal === 'function') {
                hideLoadingModal();
            } else if (this.uiUtils?.hideLoadingModal) {
                this.uiUtils.hideLoadingModal();
            }
            
            return this.appState.playlist[0] || null;
            
        } catch (error) {
            if (typeof hideLoadingModal === 'function') {
                hideLoadingModal();
            } else if (this.uiUtils?.hideLoadingModal) {
                this.uiUtils.hideLoadingModal();
            }
            utils.showError('Erreur lors du chargement de la playlist', error);
            throw error;
        }
    }

    /**
     * Clear current playlist
     */
    clearPlaylist() {
        this.appState.clearPlaylist();
        
        if (window.updateHistoryPanel && typeof window.updateHistoryPanel === 'function') {
            window.updateHistoryPanel(this.appState.playlistHistory);
        } else if (this.uiUtils?.updateHistoryPanel) {
            this.uiUtils.updateHistoryPanel(this.appState.playlistHistory);
        }
        
        if (this.uiUtils?.clearThumbnail) {
            this.uiUtils.clearThumbnail();
        }
        
        console.log('🗑️ Playlist et historique vidés');
    }

    /**
     * Get user playlists
     */
    async getUserPlaylists() {
        try {
            return await this.api.getUserPlaylists();
        } catch (error) {
            utils.showError('Erreur lors de la récupération des playlists', error.message || error);
            return [];
        }
    }

    /**
     * Get user data
     */
    async getUserData() {
        try {
            return await this.api.getUserData();
        } catch (error) {
            utils.showError('Erreur lors de la récupération des données utilisateur', error);
            return null;
        }
    }

    /**
     * Shuffle array in place
     */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Update discovered status for current track
     */
    updateDiscoveredStatus(trackIndex, discovered) {
        const needsUpdate = this.appState.updateDiscoveredStatus(trackIndex, discovered);
        
        // Mise à jour unique de l'historique seulement si nécessaire
        if (needsUpdate && this.uiUtils?.updateHistoryPanel) {
            // Utilisation d'un délai pour éviter les appels multiples rapides
            if (this.updateDiscoveredStatus.updateTimeout) {
                clearTimeout(this.updateDiscoveredStatus.updateTimeout);
            }
            this.updateDiscoveredStatus.updateTimeout = setTimeout(() => {
                this.uiUtils.updateHistoryPanel(this.appState.playlistHistory);
                this.updateDiscoveredStatus.updateTimeout = null;
            }, 50); 
        }
    }

    /**
     * Mark track as played
     */
    markTrackAsPlayed(trackIndex) {
        if (this.appState.markTrackAsPlayed(trackIndex)) {
            console.log(`🎵 Chanson ${trackIndex + 1} marquée comme jouée`);
            if (this.uiUtils?.updateHistoryPanel) {
                this.uiUtils.updateHistoryPanel(this.appState.playlistHistory);
            }
        }
    }
}
