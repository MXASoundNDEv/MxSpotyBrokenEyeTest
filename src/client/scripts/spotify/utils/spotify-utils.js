// spotify/utils/spotify-utils.js - Utility functions for Spotify Player
'use strict';

/**
 * Utility functions for the Spotify Player application
 */
export const utils = {
    /**
     * Parse URL hash parameters
     */
    parseUrlHash: () => Object.fromEntries(new URLSearchParams(window.location.hash.slice(1))),

    /**
     * Parse URL search parameters
     */
    parseUrlParams: () => Object.fromEntries(new URLSearchParams(window.location.search)),

    /**
     * Get Spotify token from various sources (URL, localStorage, sessionStorage)
     */
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

    /**
     * Get user options from localStorage
     */
    getUserOptions: () => {
        try {
            const options = JSON.parse(localStorage.getItem('userOptions') || '{}');
            return options.Optionlist || {};
        } catch (error) {
            console.warn('⚠️ Erreur lors du parsing des options utilisateur:', error);
            return {};
        }
    },

    /**
     * Reveal track information (image and title/artist)
     */
    revealTrackInfo: (track, duration = 5000) => {
        if (!track) return Promise.resolve();

        return new Promise((resolve) => {
            // Support both simplified playlist track format and full Spotify API format
            const trackName = track.name || track.title || 'Titre inconnu';
            const trackImage = track.album?.images?.[0]?.url || track.image || 'https://placehold.co/300x300?text=No+Image';

            // Gérer les différents formats d'artistes
            let trackArtists;
            if (Array.isArray(track.artists)) {
                // Format Spotify API : tableau d'objets avec propriété 'name'
                trackArtists = track.artists.map(a => a.name).join(', ');
            } else if (typeof track.artists === 'string') {
                // Format playlist simplifié : chaîne directe
                trackArtists = track.artists;
            } else {
                // Fallback vers track.artist ou valeur par défaut
                trackArtists = track.artist || 'Artiste inconnu';
            }

            console.log('🎭 Révélation des informations de la piste:', trackName);
            console.log('🎭 Artistes:', trackArtists);            // Elements to update
            const thumbnail = document.getElementById('thumbnail');
            const songTitle = document.getElementById('songTitle');
            const songArtist = document.getElementById('songArtist');
            const albumOverlay = document.querySelector('.album-overlay');

            if (thumbnail && trackImage) {
                // Add reveal animation class
                thumbnail.classList.add('revealing');
                thumbnail.src = trackImage;
            }

            if (songTitle) {
                songTitle.classList.add('revealing');
                // Utiliser innerHTML pour séparer l'emoji du texte avec des spans
                songTitle.innerHTML = `<span class="song-emoji">🎵</span> <span class="song-text">${trackName}</span>`;
            }

            if (songArtist) {
                songArtist.classList.add('revealing');
                // Utiliser innerHTML pour séparer l'emoji du texte avec des spans
                songArtist.innerHTML = `<span class="song-emoji">🎤</span> <span class="song-text">${trackArtists}</span>`;
            }

            // Hide mystery overlay
            if (albumOverlay) {
                albumOverlay.style.opacity = '0';
                albumOverlay.style.transition = 'opacity 0.3s ease';
            }

            // Show reveal notification
            if (typeof showPopup === 'function') {
                showPopup({
                    text: `🎭 Révélation: ${trackName} - ${trackArtists}`,
                    type: "info",
                    duration: Math.min(duration, 3000)
                });
            }

            // Restore mystery state after duration
            setTimeout(() => {
                if (thumbnail) {
                    thumbnail.classList.remove('revealing');
                    thumbnail.src = 'https://i.scdn.co/image/ab67616d00001e029c11e6241d59940a0157c75a'; // Default mystery image
                }

                if (songTitle) {
                    songTitle.classList.remove('revealing');
                    songTitle.innerHTML = '<span class="song-emoji">🎵</span> <span class="song-text">Chanson mystère</span>';
                }

                if (songArtist) {
                    songArtist.classList.remove('revealing');
                    songArtist.innerHTML = '<span class="song-emoji">🎤</span> <span class="song-text">Artiste mystère</span>';
                }

                if (albumOverlay) {
                    albumOverlay.style.opacity = '1';
                }

                console.log('🎭 Fin de la révélation');
                resolve();
            }, duration);
        });
    },

    /**
     * Show error popup
     */
    showError: (message, error = null) => {
        console.error('❌', message, error);
        if (typeof showPopup === 'function') {
            showPopup({
                text: message,
                type: "error",
                duration: 3000
            });
        }
    },

    /**
     * Show info popup
     */
    showInfo: (message, duration = 2000) => {
        if (typeof showPopup === 'function') {
            showPopup({
                text: message,
                type: "info",
                duration
            });
        }
    },

    /**
     * Ensure player is ready for operations
     */
    ensurePlayerReady: (player) => {
        if (!player) {
            utils.showError("Player non initialisé");
            return false;
        }
        return true;
    },

    /**
     * Update token in app state and localStorage
     */
    updateToken: (newToken, appState) => {
        if (newToken && newToken !== appState.token) {
            appState.token = newToken;
            localStorage.setItem('spotify_access_token', newToken);
            console.log('🔄 Token Spotify mis à jour');
            return true;
        }
        return false;
    },

    /**
     * Validate Spotify token
     */
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

    /**
     * Refresh Spotify token using refresh token
     */
    refreshToken: async (appState = null) => {
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

            // Mettre à jour l'état de l'application si fourni
            if (appState) {
                appState.token = data.access_token;
            }

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
