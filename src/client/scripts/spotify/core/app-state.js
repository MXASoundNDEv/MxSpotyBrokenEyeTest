// spotify/core/app-state.js - Application state management
'use strict';

import { utils } from '../utils/spotify-utils.js';
import { CONFIG } from '../config/spotify-config.js';

/**
 * Application state management
 */
export class AppState {
    constructor() {
        this.token = utils.getSpotifyToken();
        this.player = null;
        this.deviceId = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.playlistHistory = [];
        
        // AutoSwipe state
        this.autoSwipe = {
            enabled: utils.getUserOptions().AutoSwipeEnabled || true,
            delay: (utils.getUserOptions().songtime || 10) * 1000,
            abortController: null,
            status: 'stopped', // 'running', 'paused', 'stopped'
            progressElement: null,
            timeRemaining: 0
        };
        
        // Settings
        this.maxSongs = utils.getUserOptions().PlaylistMaxSongs || CONFIG.DEFAULT_MAX_SONGS;
    }

    /**
     * Reset playlist and history
     */
    clearPlaylist() {
        this.playlist = [];
        this.currentIndex = 0;
        this.playlistHistory = [];
    }

    /**
     * Update discovered status for a track
     */
    updateDiscoveredStatus(trackIndex, discovered) {
        let needsUpdate = false;
        
        if (this.playlist[trackIndex]) {
            this.playlist[trackIndex].discovered = discovered;
            needsUpdate = true;
        }
        if (this.playlistHistory[trackIndex]) {
            this.playlistHistory[trackIndex].discovered = discovered;
            this.playlistHistory[trackIndex].played = true; // Marquer comme jouée quand découverte
            needsUpdate = true;
        }
        
        return needsUpdate;
    }

    /**
     * Mark track as played
     */
    markTrackAsPlayed(trackIndex) {
        if (this.playlistHistory[trackIndex]) {
            this.playlistHistory[trackIndex].played = true;
            return true;
        }
        return false;
    }

    /**
     * Get current track
     */
    getCurrentTrack() {
        return this.playlist[this.currentIndex] || null;
    }

    /**
     * Move to next track
     */
    nextTrack() {
        const currentTrack = this.getCurrentTrack();
        
        // Marquer la chanson actuelle comme jouée
        if (currentTrack && this.playlistHistory[this.currentIndex]) {
            this.playlistHistory[this.currentIndex].discovered = currentTrack.discovered || false;
            this.playlistHistory[this.currentIndex].played = true;
        }

        this.currentIndex++;
        return this.currentIndex < this.playlist.length;
    }

    /**
     * Check if at end of playlist
     */
    isAtEnd() {
        return this.currentIndex >= this.playlist.length;
    }

    /**
     * Get playlist progress
     */
    getProgress() {
        return {
            current: this.currentIndex + 1,
            total: this.playlist.length,
            percentage: this.playlist.length > 0 ? (this.currentIndex / this.playlist.length) * 100 : 0
        };
    }
}

// Export singleton instance
export const appState = new AppState();
