// compatibility-bridge.js - Bridge for non-module scripts
'use strict';

/**
 * This file provides backward compatibility for non-module scripts
 * It waits for the modular SpotifyApp to be ready and then exposes global functions
 */

(function() {
    let spotifyApp = null;
    let isInitialized = false;

    // Function to wait for spotify app to be available
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
                }, 50); // Check every 50ms
            }
        });
    }

    // Initialize global functions
    async function initializeGlobalFunctions() {
        if (isInitialized) return;
        
        console.log('🔗 Initialisation du bridge de compatibilité...');
        
        try {
            spotifyApp = await waitForSpotifyApp();
            
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
            window.getCurrentTrackData = () => spotifyApp.getCurrentTrackData();
            window.getTrackIDData = (id) => spotifyApp.getTrackIDData(id);

            // Access to app state and utils
            window.appState = spotifyApp.getAppState();
            window.utils = spotifyApp.getUtils();
            window.domElements = spotifyApp.getDomElements();

            // Debug functions
            window.debugMarkCurrentAsPlayed = () => spotifyApp.debugMarkCurrentAsPlayed();
            window.debugShowHistory = () => spotifyApp.debugShowHistory();
            
            isInitialized = true;
            console.log('✅ Bridge de compatibilité initialisé');
            
            // Trigger custom event to notify other scripts
            window.dispatchEvent(new CustomEvent('spotifyCompatibilityReady', {
                detail: { spotifyApp }
            }));
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du bridge:', error);
        }
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGlobalFunctions);
    } else {
        // DOM is already ready
        initializeGlobalFunctions();
    }

    // Also try to initialize periodically in case the module loads later
    const initInterval = setInterval(() => {
        if (window.spotifyApp && !isInitialized) {
            initializeGlobalFunctions();
            clearInterval(initInterval);
        }
    }, 100);

    // Stop trying after 10 seconds
    setTimeout(() => {
        clearInterval(initInterval);
        if (!isInitialized) {
            console.warn('⚠️ Timeout lors de l\'initialisation du bridge de compatibilité');
        }
    }, 10000);

})();
