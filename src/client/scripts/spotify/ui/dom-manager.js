// spotify/ui/dom-manager.js - DOM element management and UI utilities
'use strict';

/**
 * DOM element cache with lazy loading
 */
export const domElements = {
    get playlistSelect() {
        return this._playlistSelect || (this._playlistSelect = document.getElementById('playlistSelect'));
    },
    
    get thumbnail() {
        return this._thumbnail || (this._thumbnail = document.getElementById('thumbnail'));
    },

    get autoswipeProgressContainer() {
        return document.getElementById('autoswipeProgressContainer');
    },

    get autoswipeProgressFill() {
        return document.getElementById('autoswipeProgressFill');
    },

    get autoswipeTimeRemaining() {
        return document.getElementById('autoswipeTimeRemaining');
    }
};

/**
 * UI utility functions
 */
export const uiUtils = {
    /**
     * Clear thumbnail image
     */
    clearThumbnail() {
        const thumbnail = domElements.thumbnail;
        if (thumbnail) {
            thumbnail.src = 'https://placehold.co/300x300?text=No+Image';
        }
    },

    /**
     * Update thumbnail image
     */
    updateThumbnail(imageUrl) {
        const thumbnail = domElements.thumbnail;
        if (thumbnail && imageUrl) {
            thumbnail.src = imageUrl;
        }
    },

    /**
     * Detect if mobile device
     */
    isMobile() {
        return window.innerWidth <= 768 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Ensure desktop layout is preserved
     */
    ensureDesktopLayout() {
        if (window.ensureDesktopLayout && typeof window.ensureDesktopLayout === 'function') {
            window.ensureDesktopLayout();
        } else if (window.innerWidth > 768 && !document.body.classList.contains('mobile-optimized')) {
            // Protection basique du layout desktop
            document.body.classList.remove('mobile-layout');
        }
    },

    /**
     * Update history panel if function exists
     */
    updateHistoryPanel(playlistHistory) {
        if (typeof updateHistoryPanel === 'function') {
            updateHistoryPanel(playlistHistory);
        }
    },

    /**
     * Show loading modal if function exists
     */
    showLoadingModal(message, steps) {
        if (typeof showLoadingModal === 'function') {
            return showLoadingModal(message, steps);
        }
        return null;
    },

    /**
     * Hide loading modal if function exists
     */
    hideLoadingModal() {
        if (typeof hideLoadingModal === 'function') {
            hideLoadingModal();
        }
    }
};
