// Mobile-specific JavaScript adaptations
class MobileInterface {
    constructor() {
        this.autoswipeInterval = null;
        this.autoswipeActive = false;
        this.autoswipeTimeLeft = 10;
        this.historyItems = [];
        this.isInitialized = false;
        
        this.initializeElements();
        this.bindEvents();
        this.setupMobileOptimizations();
        this.integrateWithExistingSystem();
    }

    integrateWithExistingSystem() {
        // Attendre que le système principal soit chargé
        const checkSystemReady = () => {
            if (window.spotifyPlayer && window.appState) {
                this.onSystemReady();
            } else {
                setTimeout(checkSystemReady, 100);
            }
        };
        checkSystemReady();
    }

    onSystemReady() {
        console.log('🎯 Mobile: Système principal détecté, intégration...');
        this.isInitialized = true;
        
        // Écouter les changements d'état
        if (window.appState) {
            this.syncWithAppState();
            
            // Observer les changements de l'état principal
            setInterval(() => {
                this.syncWithAppState();
            }, 1000);
        }
        
        // Connecter aux fonctions existantes
        this.connectToExistingFunctions();
    }

    syncWithAppState() {
        if (!window.appState || !this.isInitialized) return;
        
        const state = window.appState;
        const currentTrack = state.playlist && state.playlist[state.currentIndex];
        
        if (currentTrack && currentTrack !== this.lastSyncedTrack) {
            this.updateSongInfo({
                thumbnail: currentTrack.image || 'https://i.scdn.co/image/ab67616d00001e029c11e6241d59940a0157c75a',
                title: currentTrack.name || 'Chanson mystère',
                artist: currentTrack.artists?.map(a => a.name).join(', ') || 'Artiste mystère',
                showTitle: state.showSongInfo || false,
                showArtist: state.showSongInfo || false
            });
            this.lastSyncedTrack = currentTrack;
        }
        
        // Sync AutoSwipe state with main system
        if (state.autoSwipe) {
            const isMainAutoSwipeRunning = state.autoSwipe.status === 'running';
            const isMobileAutoSwipeRunning = this.autoswipeActive;
            
            if (isMainAutoSwipeRunning && !isMobileAutoSwipeRunning) {
                // Sync mobile autoswipe with main system timing
                const mainTimeRemaining = state.autoSwipe.timeRemaining / 1000;
                if (mainTimeRemaining > 0) {
                    this.autoswipeTimeLeft = mainTimeRemaining;
                    this.startAutoswipe();
                }
            } else if (!isMainAutoSwipeRunning && isMobileAutoSwipeRunning) {
                this.stopAutoswipe();
            }
        }
        
        // Sync history
        if (state.playlistHistory && state.playlistHistory.length > 0) {
            this.syncHistoryWithMainSystem(state.playlistHistory);
        }
        
        // Sync player info et charger les données utilisateur
        if (state.userProfile) {
            this.updatePlayerInfo({
                name: state.userProfile.display_name || 'Utilisateur',
                avatar: state.userProfile.images?.[0]?.url
            });
        } else {
            // Charger les données utilisateur si pas encore disponibles
            this.loadUserProfile();
        }
    }

    async loadUserProfile() {
        if (!window.getUserData || typeof window.getUserData !== 'function') return;
        
        try {
            const userData = await window.getUserData();
            if (userData) {
                this.updatePlayerInfo({
                    name: userData.display_name || 'Utilisateur',
                    avatar: userData.images?.[0]?.url
                });
                
                // Mettre à jour l'indicateur de connexion
                const indicator = document.getElementById('accountIndicator');
                if (indicator) {
                    indicator.textContent = '🟢';
                }
            }
        } catch (error) {
            console.error('❌ Erreur chargement profil mobile:', error);
        }
    }

    syncHistoryWithMainSystem(mainHistory) {
        // Synchroniser l'historique mobile avec le système principal
        const playedSongs = mainHistory.filter(track => track.played || track.discovered);
        
        // Mettre à jour historyItems avec les données du système principal
        this.historyItems = playedSongs.map(track => ({
            id: track.index || Date.now() + Math.random(),
            thumbnail: track.image || 'https://placehold.co/300x300?text=No+Image',
            title: track.title || 'Titre inconnu',
            artist: track.artist || 'Artiste inconnu',
            discovered: track.discovered || false
        }));
        
        this.updateHistoryDisplay();
        this.updateStats();
    }

    connectToExistingFunctions() {
        // Remplacer les fonctions globales pour mobile
        const originalCheckGuess = window.checkGuess;
        const originalNextSong = window.nextSong;
        
        window.checkGuess = (guess) => {
            if (originalCheckGuess) {
                return originalCheckGuess(guess);
            } else if (window.spotifyPlayer && window.spotifyPlayer.checkSongMatch) {
                return window.spotifyPlayer.checkSongMatch(guess);
            }
        };
        
        window.nextSong = () => {
            if (originalNextSong) {
                return originalNextSong();
            } else if (window.spotifyPlayer && window.spotifyPlayer.nextSong) {
                return window.spotifyPlayer.nextSong();
            }
        };
    }

    initializeElements() {
        // Mobile elements - vérifier que chaque élément existe
        this.elements = {};
        
        const elementIds = [
            'mobileSongName', 'mobileThumbnail', 'mobileThumbnailContainer',
            'mobileSongTitle', 'mobileSongArtist', 'mobileHistoryGrid',
            'mobileDiscoveredCount', 'mobileTotalCount', 'mobileOptionsBtn',
            'optionsModal', 'closeModal', 'autoswipe', 'autoswipeStatus',
            'autoswipeRing', 'autoswipeProgress', 'autoswipeLinearProgress', 'autoswipeTimer',
            'autoswipeTimeRemaining', 'autoswipePulse', 'mobilePlayerAvatar',
            'mobilePlayerName'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Mapping des IDs vers des noms plus courts
                const shortName = id.replace('mobile', '').replace(/([A-Z])/g, (match, p1) => 
                    p1.toLowerCase()).replace(/^./, str => str.toLowerCase());
                
                // Cas spéciaux
                if (id === 'mobileSongName') this.elements.songInput = element;
                else if (id === 'mobileThumbnail') this.elements.thumbnail = element;
                else if (id === 'mobileThumbnailContainer') this.elements.thumbnailContainer = element;
                else if (id === 'mobileSongTitle') this.elements.songTitle = element;
                else if (id === 'mobileSongArtist') this.elements.songArtist = element;
                else if (id === 'mobileHistoryGrid') this.elements.historyGrid = element;
                else if (id === 'mobileDiscoveredCount') this.elements.discoveredCount = element;
                else if (id === 'mobileTotalCount') this.elements.totalCount = element;
                else if (id === 'mobileOptionsBtn') this.elements.optionsBtn = element;
                else if (id === 'mobilePlayerAvatar') this.elements.playerAvatar = element;
                else if (id === 'mobilePlayerName') this.elements.playerName = element;
                else this.elements[shortName] = element;
            } else {
                console.warn(`❌ Élément mobile manquant: ${id}`);
            }
        });
        
        console.log('✅ Éléments mobile initialisés:', Object.keys(this.elements).length);
    }

    bindEvents() {
        // Input events
        if (this.elements.songInput) {
            this.elements.songInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.submitGuess();
                }
            });
        }

        // Thumbnail click for autoswipe toggle
        if (this.elements.thumbnailContainer) {
            this.elements.thumbnailContainer.addEventListener('click', () => {
                this.toggleAutoswipe();
                this.addHapticFeedback();
            });
        }

        // Options modal
        if (this.elements.optionsBtn) {
            this.elements.optionsBtn.addEventListener('click', () => {
                this.showOptionsModal();
                this.addHapticFeedback();
            });
        }

        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => {
                this.hideOptionsModal();
            });
        }

        if (this.elements.optionsModal) {
            this.elements.optionsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.optionsModal) {
                    this.hideOptionsModal();
                }
            });
        }

        // Autoswipe button in modal
        if (this.elements.autoswipe || this.elements.autoswipeBtn) {
            const btn = this.elements.autoswipe || this.elements.autoswipeBtn;
            btn.addEventListener('click', () => {
                this.toggleAutoswipe();
                this.addHapticFeedback();
            });
        }

        // Options buttons
        this.bindOptionButtons();

        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
        
        console.log('✅ Événements mobile liés');
    }

    bindOptionButtons() {
        // Playlist button
        const playlistBtn = document.getElementById('PlaylistDivBtn');
        if (playlistBtn) {
            playlistBtn.addEventListener('click', async () => {
                this.hideOptionsModal();
                if (window.getUserPlaylists && window.showPlaylistSelectorModal) {
                    const playlists = await window.getUserPlaylists();
                    window.showPlaylistSelectorModal(playlists, selected => {
                        if (!selected.length) return;
                        if (window.loadPlaylist) {
                            window.loadPlaylist(selected[0].id);
                        }
                    });
                } else {
                    this.showMessage('Fonction playlist non disponible', 'error');
                }
            });
        }

        // Options/Settings button
        const optionsBtn = document.getElementById('OptionsDivBtn');
        if (optionsBtn) {
            optionsBtn.addEventListener('click', async () => {
                this.hideOptionsModal();
                if (window.getDevices && window.ShowOptionsModal) {
                    const devices = await window.getDevices();
                    window.ShowOptionsModal(devices, options => {
                        if (options.Optionlist) {
                            localStorage.setItem('userOptions', JSON.stringify(options.Optionlist));
                            if (window.loadUserOptions) {
                                window.loadUserOptions();
                            }
                        }
                    });
                } else {
                    this.showMessage('Fonction options non disponible', 'error');
                }
            });
        }

        // Player button
        const playerBtn = document.getElementById('PlayerDivBtn');
        if (playerBtn) {
            playerBtn.addEventListener('click', () => {
                this.hideOptionsModal();
                this.showMessage('Fonction lecteur non encore implémentée', 'info');
            });
        }
    }

    setupMobileOptimizations() {
        // Adjust viewport for keyboard
        const viewport = document.querySelector('meta[name=viewport]');
        
        this.elements.songInput.addEventListener('focus', () => {
            // Ensure input is visible when keyboard appears
            setTimeout(() => {
                this.elements.songInput.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 300);
        });

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.adjustLayout();
            }, 500);
        });

        // Initial layout adjustment
        this.adjustLayout();
    }

    adjustLayout() {
        // Adjust grid columns based on screen width
        const historyGrid = this.elements.historyGrid;
        const screenWidth = window.innerWidth;
        
        if (screenWidth < 350) {
            historyGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        } else if (screenWidth < 400) {
            historyGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        } else {
            historyGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        }
    }

    addHapticFeedback() {
        // Add haptic feedback for supported devices
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    showOptionsModal() {
        if (this.elements.optionsModal) {
            this.elements.optionsModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    hideOptionsModal() {
        if (this.elements.optionsModal) {
            this.elements.optionsModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    toggleAutoswipe() {
        // Si le système principal est disponible, utiliser ses fonctions
        if (window.toggleAutoSwipe && typeof window.toggleAutoSwipe === 'function') {
            window.toggleAutoSwipe();
            return;
        }
        
        // Sinon, utiliser le système mobile local
        if (this.autoswipeActive) {
            this.stopAutoswipe();
        } else {
            this.startAutoswipe();
        }
    }

    startAutoswipe() {
        if (this.autoswipeActive) return;
        
        this.autoswipeActive = true;
        this.autoswipeTimeLeft = 10;
        
        // Update UI
        if (this.elements.autoswipeStatus) {
            this.elements.autoswipeStatus.textContent = '⏸️';
        }
        if (this.elements.autoswipeProgress) {
            this.elements.autoswipeProgress.classList.add('active', 'running');
            this.elements.autoswipeProgress.style.setProperty('--progress-angle', '0deg');
        }
        if (this.elements.autoswipeTimer) {
            this.elements.autoswipeTimer.style.display = 'block';
        }
        if (this.elements.autoswipePulse) {
            this.elements.autoswipePulse.classList.add('active');
        }
        
        // Start countdown
        this.updateAutoswipeProgress();
        this.autoswipeInterval = setInterval(() => {
            this.autoswipeTimeLeft -= 0.1;
            this.updateAutoswipeProgress();
            
            if (this.autoswipeTimeLeft <= 0) {
                this.executeAutoswipe();
            }
        }, 100);

        console.log('AutoSwipe démarré');
    }

    stopAutoswipe() {
        if (!this.autoswipeActive) return;
        
        this.autoswipeActive = false;
        
        // Clear interval
        if (this.autoswipeInterval) {
            clearInterval(this.autoswipeInterval);
            this.autoswipeInterval = null;
        }
        
        // Update UI
        if (this.elements.autoswipeStatus) {
            this.elements.autoswipeStatus.textContent = '▶️';
        }
        if (this.elements.autoswipeProgress) {
            this.elements.autoswipeProgress.classList.remove('active', 'running');
            this.elements.autoswipeProgress.style.setProperty('--progress-angle', '0deg');
        }
        if (this.elements.autoswipeTimer) {
            this.elements.autoswipeTimer.style.display = 'none';
        }
        if (this.elements.autoswipePulse) {
            this.elements.autoswipePulse.classList.remove('active');
        }
        
        console.log('AutoSwipe arrêté');
    }

    updateAutoswipeProgress() {
        const progressPercentage = ((10 - this.autoswipeTimeLeft) / 10);
        const progressAngle = progressPercentage * 360;
        
        console.log(`🔄 Progression autoswipe: ${Math.round(progressPercentage * 100)}% (${this.autoswipeTimeLeft}s restantes)`);
        
        // Barre de progression circulaire (existante)
        if (this.elements.autoswipeProgress) {
            this.elements.autoswipeProgress.style.setProperty('--progress-angle', `${progressAngle}deg`);
            
            const maskAngle = progressAngle;
            this.elements.autoswipeProgress.style.background = 
                `conic-gradient(from -90deg, var(--neon-cyan) 0deg, var(--neon-purple) ${maskAngle/4}deg, var(--neon-magenta) ${maskAngle/2}deg, var(--neon-cyan) ${maskAngle}deg, transparent ${maskAngle}deg)`;
        }
        
        // Barre de progression linéaire (nouvelle - plus simple)
        if (this.elements.autoswipeLinearProgress) {
            const linearBar = this.elements.autoswipeLinearProgress.querySelector('::before') || this.elements.autoswipeLinearProgress;
            this.elements.autoswipeLinearProgress.style.setProperty('--progress-width', `${progressPercentage * 100}%`);
            
            // Forcer la mise à jour avec un style direct
            const beforeElement = this.elements.autoswipeLinearProgress;
            beforeElement.style.background = `linear-gradient(90deg, 
                rgba(0, 255, 255, 0.1) 0%, 
                rgba(0, 255, 255, 0.8) ${progressPercentage * 100}%, 
                transparent ${progressPercentage * 100}%)`;
        }
        
        if (this.elements.autoswipeTimeRemaining) {
            this.elements.autoswipeTimeRemaining.textContent = `${Math.ceil(this.autoswipeTimeLeft)}s`;
        }
    }

    executeAutoswipe() {
        this.stopAutoswipe();
        
        // Add visual feedback
        this.elements.thumbnailContainer.style.transform = 'scale(0.9)';
        setTimeout(() => {
            this.elements.thumbnailContainer.style.transform = '';
        }, 200);
        
        // Trigger next song using existing system
        if (window.nextSong && typeof window.nextSong === 'function') {
            window.nextSong();
        } else if (window.spotifyPlayer && window.spotifyPlayer.nextSong) {
            window.spotifyPlayer.nextSong();
        }
        
        console.log('AutoSwipe exécuté');
    }

    submitGuess() {
        const guess = this.elements.songInput.value.trim();
        if (!guess) return;
        
        // Add visual feedback
        this.elements.songInput.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.elements.songInput.style.transform = '';
        }, 150);
        
        // Use existing system to check guess
        if (window.checkGuess && typeof window.checkGuess === 'function') {
            const result = window.checkGuess(guess);
            this.handleGuessResult(result, guess);
        } else if (window.spotifyPlayer && window.spotifyPlayer.checkSongMatch) {
            const result = window.spotifyPlayer.checkSongMatch(guess);
            this.handleGuessResult(result, guess);
        }
        
        this.addHapticFeedback();
    }

    handleGuessResult(result, guess) {
        if (result === true || (result && result.match)) {
            // Correct guess
            this.showMessage('Bravo ! Bonne réponse ! 🎉', 'success');
            
            // Update song info to show title/artist
            if (window.appState && window.appState.playlist && window.appState.currentIndex !== undefined) {
                const currentTrack = window.appState.playlist[window.appState.currentIndex];
                if (currentTrack) {
                    this.updateSongInfo({
                        thumbnail: currentTrack.image,
                        title: currentTrack.name,
                        artist: currentTrack.artists?.map(a => a.name).join(', '),
                        showTitle: true,
                        showArtist: true
                    });
                    
                    // Add to history as discovered
                    this.addToHistory({
                        thumbnail: currentTrack.image,
                        title: currentTrack.name,
                        artist: currentTrack.artists?.map(a => a.name).join(', ')
                    }, true);
                }
            }
            
            this.clearInput();
            
            // Auto next song after delay
            setTimeout(() => {
                if (window.nextSong) {
                    window.nextSong();
                }
            }, 3000);
            
        } else {
            // Wrong guess
            this.showMessage('Pas tout à fait... Essaie encore ! 🤔', 'error');
        }
    }

    addToHistory(songData, discovered = false) {
        const historyItem = {
            id: Date.now(),
            thumbnail: songData.thumbnail,
            title: songData.title,
            artist: songData.artist,
            discovered: discovered
        };
        
        this.historyItems.unshift(historyItem);
        
        // Limit history to 24 items (4 rows of 6)
        if (this.historyItems.length > 24) {
            this.historyItems = this.historyItems.slice(0, 24);
        }
        
        this.updateHistoryDisplay();
        this.updateStats();
    }

    updateHistoryDisplay() {
        this.elements.historyGrid.innerHTML = '';
        
        this.historyItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `history-item ${item.discovered ? 'discovered' : 'missed'}`;
            
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = `${item.title} - ${item.artist}`;
            
            itemElement.appendChild(img);
            this.elements.historyGrid.appendChild(itemElement);
        });
    }

    updateStats() {
        const discoveredCount = this.historyItems.filter(item => item.discovered).length;
        const totalCount = this.historyItems.length;
        
        this.elements.discoveredCount.textContent = discoveredCount;
        this.elements.totalCount.textContent = totalCount;
    }

    updateSongInfo(songData) {
        this.elements.thumbnail.src = songData.thumbnail;
        this.elements.songTitle.textContent = songData.showTitle ? songData.title : '🎵 Chanson mystère';
        this.elements.songArtist.textContent = songData.showArtist ? songData.artist : '🎤 Artiste mystère';
    }

    updatePlayerInfo(playerData) {
        if (playerData.avatar) {
            this.elements.playerAvatar.src = playerData.avatar;
        }
        if (playerData.name) {
            this.elements.playerName.textContent = playerData.name;
        }
    }

    clearInput() {
        this.elements.songInput.value = '';
    }

    focusInput() {
        this.elements.songInput.focus();
    }

    showMessage(message, type = 'info') {
        // Create a toast message
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: calc(var(--header-height) + var(--safe-area-top) + 20px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 61, 0.9);
            color: var(--text);
            padding: 12px 20px;
            border-radius: 25px;
            border: 1px solid ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--info)'};
            backdrop-filter: blur(10px);
            z-index: 1500;
            animation: toastSlideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Initialize mobile interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mobileInterface = new MobileInterface();
    
    // Add CSS for toast animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes toastSlideIn {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        
        @keyframes toastSlideOut {
            from {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            to {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
    `;
    document.head.appendChild(style);
});

// Integration functions for existing game logic
window.mobileAPI = {
    updateSong: (songData) => {
        if (window.mobileInterface) {
            window.mobileInterface.updateSongInfo(songData);
        }
    },
    
    addToHistory: (songData, discovered) => {
        if (window.mobileInterface) {
            window.mobileInterface.addToHistory(songData, discovered);
        }
    },
    
    updatePlayer: (playerData) => {
        if (window.mobileInterface) {
            window.mobileInterface.updatePlayerInfo(playerData);
        }
    },
    
    showMessage: (message, type) => {
        if (window.mobileInterface) {
            window.mobileInterface.showMessage(message, type);
        }
    },
    
    clearInput: () => {
        if (window.mobileInterface) {
            window.mobileInterface.clearInput();
        }
    },
    
    focusInput: () => {
        if (window.mobileInterface) {
            window.mobileInterface.focusInput();
        }
    }
};

// Test et debug de la barre de progression
window.testAutoswipeProgress = function() {
    console.log('🧪 Test de la barre de progression autoswipe...');
    
    const progressElement = document.getElementById('autoswipeProgress');
    const ringElement = document.getElementById('autoswipeRing');
    
    if (!progressElement) {
        console.error('❌ Élément autoswipeProgress non trouvé !');
        return;
    }
    
    if (!ringElement) {
        console.error('❌ Élément autoswipeRing non trouvé !');
        return;
    }
    
    console.log('✅ Éléments trouvés, test de visibilité...');
    
    // Test de visibilité forcée
    progressElement.style.opacity = '1';
    progressElement.classList.add('active', 'running');
    progressElement.style.setProperty('--progress-angle', '180deg');
    
    // Test progressif
    let angle = 0;
    const testInterval = setInterval(() => {
        angle += 10;
        progressElement.style.setProperty('--progress-angle', `${angle}deg`);
        console.log(`📊 Angle: ${angle}deg`);
        
        if (angle >= 360) {
            clearInterval(testInterval);
            progressElement.style.setProperty('--progress-angle', '0deg');
            console.log('✅ Test terminé - la barre devrait être visible !');
        }
    }, 100);
};

// Auto-test au chargement pour debug
setTimeout(() => {
    if (document.getElementById('autoswipeProgress')) {
        console.log('🎯 Barre de progression détectée - utiliser testAutoswipeProgress() pour tester');
        
        // Test automatique pour voir si la barre est visible
        const progressElement = document.getElementById('autoswipeProgress');
        progressElement.style.opacity = '0.7';
        progressElement.classList.add('running');
        
        console.log('🔍 Styles appliqués:', {
            opacity: progressElement.style.opacity,
            classes: progressElement.className
        });
    }
}, 2000);
