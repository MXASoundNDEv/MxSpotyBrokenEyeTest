// spotify/api/spotify-api.js - Spotify API functions
'use strict';

/**
 * Spotify API functions
 */
export class SpotifyAPI {
    constructor(getToken) {
        this.getToken = getToken;
    }

    /**
     * Get current track data from Spotify
     */
    async getCurrentTrackData() {
        const token = this.getToken();
        const res = await fetch(`/api/me/player?token=${token}`);
        
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

    /**
     * Get track data by ID
     */
    async getTrackIDData(id) {
        try {
            const token = this.getToken();
            const res = await fetch(`/api/tracks/${id}?token=${token}`);
            return await res.json();
        } catch (error) {
            console.error('❌ Erreur récupération track ID :', error);
            return null;
        }
    }

    /**
     * Start playback of a track
     */
    async startTrackPlayback(track, deviceId) {
        const token = this.getToken();
        await fetch(`/api/play?device_id=${deviceId}&token=${token}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [track.uri] })
        });
    }

    /**
     * Seek to a specific position in the track
     */
    async seekToPosition(positionMs) {
        const token = this.getToken();
        await fetch(`/api/seek?position_ms=${Math.floor(positionMs)}&token=${token}`, {
            method: 'PUT'
        });
    }

    /**
     * Load playlist from API
     */
    async loadPlaylistData(id) {
        const token = this.getToken();
        const res = await fetch(`/api/playlist/${id}?token=${token}`);
        const data = await res.json();
        return data;
    }

    /**
     * Get user playlists
     */
    async getUserPlaylists() {
        try {
            console.log('[📋] Récupération des playlists utilisateur...');
            const token = this.getToken();
            const response = await fetch(`/api/me/playlists?token=${token}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                
                // Si le token est expiré, rediriger vers la connexion
                if (response.status === 401 || errorData.needsReauth) {
                    console.warn('[⚠️] Token expiré, redirection vers la connexion...');
                    throw new Error('SESSION_EXPIRED');
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
            
            if (error.message === 'SESSION_EXPIRED') {
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
            
            throw error;
        }
    }
        
    /**
     * Get user data
     */
    async getUserData() {
        try {
            const token = this.getToken();
            const response = await fetch(`/api/me?token=${token}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('[🔥] Erreur lors de la récupération des données utilisateur:', error);
            throw error;
        }
    }

    /**
     * Update track UI data
     */
    async updateTrackUI() {
        try {
            const trackData = await this.getCurrentTrackData();
            
            if (trackData && trackData.item) {
                // Mettre à jour l'interface utilisateur si les fonctions existent
                if (typeof updateUI === 'function') {
                    updateUI(trackData.item);
                }
                
                if (typeof updateTrackInfo === 'function') {
                    updateTrackInfo(trackData.item);
                }
            }
        } catch (error) {
            console.error('❌ Erreur mise à jour UI:', error);
        }
    }
}
