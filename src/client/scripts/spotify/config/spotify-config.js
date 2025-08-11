// spotify/config/spotify-config.js - Configuration constants for Spotify Player
'use strict';

/**
 * Configuration constants for the Spotify Player application
 */
export const CONFIG = {
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

/**
 * CSS styles for progress bar components
 */
export const PROGRESS_BAR_STYLES = {
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
