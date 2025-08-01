// spotify/features/autoswipe.js - AutoSwipe functionality
'use strict';

import { CONFIG, PROGRESS_BAR_STYLES } from '../config/spotify-config.js';
import { utils } from '../utils/spotify-utils.js';

/**
 * AutoSwipe Feature Manager
 */
export class AutoSwipe {
    constructor(appState, playerManager, uiUtils) {
        this.appState = appState;
        this.playerManager = playerManager;
        this.uiUtils = uiUtils;
    }

    /**
     * Start AutoSwipe loop
     */
    async autoSwipeLoop() {
        if (this.appState.autoSwipe.status === 'running') {
            console.log('🔄 AutoSwipe déjà en cours');
            return;
        }
        
        this.appState.autoSwipe.abortController = new AbortController();
        const { signal } = this.appState.autoSwipe.abortController;
        this.appState.autoSwipe.status = 'running';
        
        // Initialiser l'interface AutoSwipe
        const existingContainer = document.getElementById('autoswipeProgressContainer');
        if (existingContainer) {
            existingContainer.style.display = 'block';
        }
        
        console.log('🚀 Démarrage de l\'AutoSwipe');
        
        try {
            while (this._shouldContinueAutoSwipe()) {
                // Update progress and wait
                this.appState.autoSwipe.timeRemaining = this.appState.autoSwipe.delay;
                this._updateAutoSwipeProgress();
                
                await this._delayWithProgress(this.appState.autoSwipe.delay, signal);
                
                // Check if autoswipe should continue
                if (!this.appState.autoSwipe.enabled || this.appState.autoSwipe.status !== 'running') {
                    break;
                }
                
                console.log(`⏭️ AutoSwipe: passage à la piste ${this.appState.currentIndex + 1}`);
                
                // Use player manager to go to next track
                const hasNext = this.playerManager.nextTrack();
                if (!hasNext) {
                    break;
                }
                
                // Small delay for track loading
                await this._delay(CONFIG.AUTOSWIPE_RESTART_DELAY, signal);
            }
            
            this._finishAutoSwipe();
            
        } catch (error) {
            this._handleAutoSwipeError(error);
        } finally {
            this._clearAutoSwipeProgress();
        }
    }

    /**
     * Check if AutoSwipe should continue
     */
    _shouldContinueAutoSwipe() {
        return this.appState.autoSwipe.enabled && 
               this.appState.currentIndex < Math.min(this.appState.playlist.length, this.appState.maxSongs);
    }

    /**
     * Finish AutoSwipe
     */
    _finishAutoSwipe() {
        this.appState.autoSwipe.status = 'stopped';
        console.log('✅ AutoSwipe terminé');
        
        if (typeof showPopup === 'function') {
            showPopup({
                text: "AutoSwipe terminé - Fin de la playlist",
                type: "success",
                duration: 3000
            });
        }
    }

    /**
     * Handle AutoSwipe errors
     */
    _handleAutoSwipeError(error) {
        this.appState.autoSwipe.status = 'stopped';
        
        if (error.name === 'AbortError') {
            console.log('🛑 AutoSwipe arrêté manuellement');
        } else {
            console.error('❌ Erreur dans AutoSwipe:', error);
            utils.showError("Erreur dans l'AutoSwipe", error);
        }
    }

    /**
     * Delay utility with signal support
     */
    _delay(ms, signal) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            }
        });
    }

    /**
     * Delay with progress updates
     */
    async _delayWithProgress(ms, signal) {
        const intervalTime = CONFIG.PROGRESS_UPDATE_INTERVAL;
        let elapsed = 0;
        
        while (elapsed < ms) {
            if (signal?.aborted) {
                throw new DOMException('Progression annulée', 'AbortError');
            }
            
            this.appState.autoSwipe.timeRemaining = ms - elapsed;
            this._updateAutoSwipeProgress();
            
            await this._delay(Math.min(intervalTime, ms - elapsed), signal);
            elapsed += intervalTime;
        }
    }

    /**
     * Update progress bar
     */
    _updateAutoSwipeProgress() {
        // Priorité 1: Utiliser l'élément HTML existant
        const existingContainer = document.getElementById('autoswipeProgressContainer');
        const existingProgressFill = document.getElementById('autoswipeProgressFill');
        const existingTimeRemaining = document.getElementById('autoswipeTimeRemaining');
        
        const isMobile = this.uiUtils?.isMobile() || (window.innerWidth <= 768);
        
        if (existingContainer && existingProgressFill && existingTimeRemaining) {
            // Utiliser l'interface HTML existante
            const { delay: totalDelay, timeRemaining } = this.appState.autoSwipe;
            const percentage = Math.max(0, (totalDelay - timeRemaining) / totalDelay * 100);
            const timeLeft = Math.ceil(timeRemaining / 1000);

            // Mettre à jour la progression
            existingProgressFill.style.width = `${percentage}%`;
            existingTimeRemaining.textContent = `${timeLeft}s`;
            
            return; // Sortir ici, ne pas créer de popup
        }
        
        // Priorité 2: Interface desktop (si pas d'éléments HTML existants)
        if (!this.appState.autoSwipe.progressElement) {
            this._createProgressBar();
        }
        
        const { delay: totalDelay, timeRemaining } = this.appState.autoSwipe;
        const percentage = Math.max(0, (totalDelay - timeRemaining) / totalDelay * 100);
        const timeLeft = Math.ceil(timeRemaining / 1000);
        
        if (this.appState.autoSwipe.progressElement) {
            this.appState.autoSwipe.progressElement.style.width = `${percentage}%`;
            
            const timeDisplay = document.getElementById('autoswipe-time-display');
            if (timeDisplay) {
                timeDisplay.textContent = `${timeLeft}s`;
            }
        }
    }

    /**
     * Create progress bar for desktop
     */
    _createProgressBar() {
        // Vérifier d'abord si l'interface HTML existe déjà
        const existingContainer = document.getElementById('autoswipeProgressContainer');
        if (existingContainer) {
            console.log('📱 Interface AutoSwipe HTML existante détectée');
            return;
        }
        
        const isMobile = this.uiUtils?.isMobile() || (window.innerWidth <= 768);
        
        if (isMobile) {
            console.log('📱 Interface mobile détectée, pas de popup AutoSwipe');
            return;
        }
        
        // Check if progress bar already exists
        let container = document.getElementById('autoswipe-progress-container');
        if (container) {
            console.log('⚠️ Barre de progression déjà existante, réutilisation...');
            return;
        }

        // Protection contre la création multiple simultanée
        if (this._createProgressBar.isCreating) {
            console.log('⚠️ Création de barre de progression déjà en cours...');
            return;
        }
        this._createProgressBar.isCreating = true;

        // Create container
        container = document.createElement('div');
        container.id = 'autoswipe-progress-container';
        container.style.cssText = PROGRESS_BAR_STYLES.container;

        // Create elements
        const elements = {
            label: this._createProgressLabel(),
            progressBackground: this._createProgressBackground(),
            timeDisplay: this._createTimeDisplay(),
            stopButton: this._createStopButton()
        };

        // Assemble components
        elements.progressBackground.appendChild(this.appState.autoSwipe.progressElement);
        Object.values(elements).forEach(el => container.appendChild(el));
        
        document.body.appendChild(container);
        
        // Marquer la fin de la création
        this._createProgressBar.isCreating = false;
    }

    /**
     * Create progress bar elements
     */
    _createProgressLabel() {
        const label = document.createElement('div');
        label.textContent = '🎵 AutoSwipe actif';
        label.style.marginBottom = '5px';
        return label;
    }

    _createProgressBackground() {
        const background = document.createElement('div');
        background.style.cssText = PROGRESS_BAR_STYLES.progressBackground;
        
        this.appState.autoSwipe.progressElement = document.createElement('div');
        this.appState.autoSwipe.progressElement.style.cssText = PROGRESS_BAR_STYLES.progressBar;
        
        return background;
    }

    _createTimeDisplay() {
        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'autoswipe-time-display';
        timeDisplay.style.textAlign = 'center';
        timeDisplay.textContent = '0s';
        return timeDisplay;
    }

    _createStopButton() {
        const stopButton = document.createElement('button');
        stopButton.textContent = '⏹️ Arrêter';
        stopButton.style.cssText = PROGRESS_BAR_STYLES.stopButton;
        stopButton.onclick = () => this.stopAutoSwipe();
        return stopButton;
    }

    /**
     * Clear progress bar
     */
    _clearAutoSwipeProgress() {
        // Nettoyer l'interface HTML existante
        const existingContainer = document.getElementById('autoswipeProgressContainer');
        if (existingContainer) {
            existingContainer.style.display = 'none';
            
            const existingProgressFill = document.getElementById('autoswipeProgressFill');
            const existingTimeRemaining = document.getElementById('autoswipeTimeRemaining');
            
            if (existingProgressFill) existingProgressFill.style.width = '0%';
            if (existingTimeRemaining) existingTimeRemaining.textContent = '10s';
        }
        
        // Nettoyer la popup desktop
        const container = document.getElementById('autoswipe-progress-container');
        if (container) {
            container.remove();
        }
        this.appState.autoSwipe.progressElement = null;
    }

    /**
     * Control functions
     */
    startAutoSwipe() {
        if (this.appState.playlist.length === 0) {
            utils.showError("Veuillez charger une playlist d'abord", null);
            return false;
        }
        
        if (this.appState.autoSwipe.status === 'running') {
            utils.showInfo("AutoSwipe déjà en cours");
            return false;
        }
        
        this.appState.autoSwipe.enabled = true;
        this.autoSwipeLoop();
        console.log('🚀 AutoSwipe démarré manuellement');
        utils.showInfo("AutoSwipe démarré");
        return true;
    }

    stopAutoSwipe() {
        this.appState.autoSwipe.enabled = false;
        this.appState.autoSwipe.status = 'stopped';
        
        if (this.appState.autoSwipe.abortController) {
            this.appState.autoSwipe.abortController.abort();
        }
        
        this._clearAutoSwipeProgress();
        console.log('🛑 AutoSwipe arrêté manuellement');
        utils.showInfo("AutoSwipe arrêté");
    }

    pauseAutoSwipe() {
        if (this.appState.autoSwipe.status === 'running') {
            this.appState.autoSwipe.status = 'paused';
            
            if (this.appState.autoSwipe.abortController) {
                this.appState.autoSwipe.abortController.abort();
            }
            
            console.log('⏸️ AutoSwipe mis en pause');
            utils.showInfo("AutoSwipe mis en pause");
        }
    }

    resumeAutoSwipe() {
        if (this.appState.autoSwipe.status === 'paused') {
            this.appState.autoSwipe.enabled = true;
            this.autoSwipeLoop();
            console.log('▶️ AutoSwipe repris');
            utils.showInfo("AutoSwipe repris");
        }
    }

    toggleAutoSwipe() {
        switch (this.appState.autoSwipe.status) {
            case 'running':
                this.stopAutoSwipe();
                break;
            case 'paused':
                this.resumeAutoSwipe();
                break;
            default:
                this.startAutoSwipe();
        }
    }

    setAutoSwipeDelay(newDelay) {
        if (newDelay >= CONFIG.AUTOSWIPE_MIN_DELAY && newDelay <= CONFIG.AUTOSWIPE_MAX_DELAY) {
            this.appState.autoSwipe.delay = newDelay;
            console.log(`⏱️ Délai AutoSwipe mis à jour: ${newDelay/1000}s`);
            utils.showInfo(`Délai AutoSwipe: ${newDelay/1000}s`);
            return true;
        }
        return false;
    }
}
