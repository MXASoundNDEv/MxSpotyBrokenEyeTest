// spotify/compatibility/global-functions.js - Global functions for backward compatibility
'use strict';

/**
 * This file provides global functions for backward compatibility with existing scripts
 * It should be loaded after the main SpotifyV3.js module
 */

// Wait for the spotify app to be initialized
function waitForSpotifyApp() {
    return new Promise((resolve) => {
        if (window.spotifyApp) {
            resolve(window.spotifyApp);
        } else {
            const checkApp = setInterval(() => {
                if (window.spotifyApp) {
                    clearInterval(checkApp);
                    resolve(window.spotifyApp);
                }
            }, 100);
        }
    });
}

// Initialize global functions when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for spotify app to be available
    const spotifyApp = await waitForSpotifyApp();
    
    // Legacy function exports for backward compatibility
    window.loadPlaylist = (id) => spotifyApp.loadPlaylist(id);
    window.nextTrack = () => spotifyApp.nextTrack();
    window.playTrack = (track) => spotifyApp.playTrack(track);
    window.clearPlaylist = () => spotifyApp.clearPlaylist();
    window.startAutoSwipe = () => spotifyApp.startAutoSwipe();
    window.stopAutoSwipe = () => spotifyApp.stopAutoSwipe();
    window.toggleAutoSwipe = () => spotifyApp.toggleAutoSwipe();
    window.setAutoSwipeDelay = (delay) => spotifyApp.setAutoSwipeDelay(delay);
    window.updateDiscoveredStatus = (trackIndex, discovered) => {
        spotifyApp.updateDiscoveredStatus(trackIndex, discovered);
    };
    window.getUserPlaylists = () => spotifyApp.getUserPlaylists();
    window.getUserData = () => spotifyApp.getUserData();
    window.togglePlayPause = () => spotifyApp.togglePlayPause();
    window.updateSoundVolume = (volume) => spotifyApp.updateSoundVolume(volume);
    window.setPlayingDevice = (deviceId) => spotifyApp.setPlayingDevice(deviceId);

    // Debug functions
    window.debugMarkCurrentAsPlayed = () => spotifyApp.debugMarkCurrentAsPlayed();
    window.debugShowHistory = () => spotifyApp.debugShowHistory();
    
    console.log('✅ Fonctions globales de compatibilité chargées');
});
