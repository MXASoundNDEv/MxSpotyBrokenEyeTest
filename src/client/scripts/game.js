const songInput = document.getElementById('songName') || document.getElementById('mobileSongName');
const OptionsDiv = document.getElementById('OptionsDivBtn');
const PlayerDiv = document.getElementById('PlayerDivBtn');
const PlaylistDiv = document.getElementById('PlaylistDivBtn');

async function initUI() {
    //console.log('Token detecte, initialisation de l\'interface...');

    // Afficher la modal de chargement avec les étapes
    const loadingSteps = [
        'Chargement des options utilisateur...',
        'Connexion au profil Spotify...',
        'Récupération des playlists...',
        'Initialisation de l\'interface...'
    ];
    
    const loader = showLoadingModal('Initialisation de Spotify Blind Test...', loadingSteps);

    try {
        // Étape 1: Charger les options
        loader.completeStep(0);
        loadUserOptions();
        
        // Étape 2: Charger le profil utilisateur
        loader.updateMessage('Chargement du profil utilisateur...');
        await loadUserProfile();
        loader.completeStep(1);
        
        // Étape 2.5: Vérifier la validité du token
        loader.updateMessage('Vérification des permissions...');
        const isTokenValid = await utils.validateToken(appState.token);
        if (!isTokenValid) {
            hideLoadingModal();
            showPopup({
                text: 'Session expirée. Redirection vers la connexion...',
                type: 'warn',
                position: 'center'
            });
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            return;
        }
        
        // Étape 3: Récupérer les playlists
        loader.updateMessage('Récupération de vos playlists...');
        const playlists = await getUserPlaylists();
        loader.completeStep(2);
        
        // Vérifier si nous avons des playlists
        if (!playlists || playlists.length === 0) {
            hideLoadingModal();
            showPopup({
                text: 'Aucune playlist trouvée. Veuillez créer des playlists dans Spotify ou vérifier vos permissions.',
                type: 'error',
                position: 'center'
            });
            return;
        }
        
        // Étape 4: Finaliser l'initialisation
        loader.updateMessage('Finalisation...');
        loader.completeStep(3);
        
        // Petite pause pour que l'utilisateur voie que tout est terminé
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Cacher la modal de chargement
        hideLoadingModal();
        
        // Afficher le sélecteur de playlist
        console.log('[📋] Playlists disponibles:', playlists.length);
        showPlaylistSelectorModal(playlists, selected => {
            if (!selected.length) {
                showPopup({
                    text: 'Aucune playlist selectionnee',
                    type: 'warn',
                    position: 'top-right'
                });
                return;
            }
            loadPlaylist(selected[0].id);
        });
    } catch (error) {
        console.error('❌ Erreur pendant l\'initialisation:', error);
        hideLoadingModal();
        showPopup({
            text: 'Erreur lors de l\'initialisation. Veuillez recharger la page.',
            type: 'error',
            position: 'center',
            duration: 5000
        });
    }
}

async function updateTrackUI() {
    const data = await getCurrentTrackData();
    const imageUrl = data?.image || 'https://placehold.co/300x300?text=No+Image';
    
    // Update current track image
    if (appState.playlist[appState.currentIndex]) {
        appState.playlist[appState.currentIndex].image = imageUrl;
    }
    
    // Update thumbnail
    const thumbnail = domElements.thumbnail;
    if (thumbnail) {
        thumbnail.src = imageUrl;
        thumbnail.style.filter = 'blur(1.5rem)';
    }
    
    // Reset song info display
    hideSongInfo();
}

function showSongInfo(trackData) {
    const songTitle = document.getElementById('songTitle');
    const songArtist = document.getElementById('songArtist');
    
    if (songTitle && trackData) {
        songTitle.textContent = `🎵 ${trackData.name}`;
        songTitle.classList.add('revealed');
    }
    
    if (songArtist && trackData) {
        songArtist.textContent = `🎤 ${trackData.artists?.map(a => a.name).join(', ') || 'Artiste inconnu'}`;
        songArtist.classList.add('revealed');
    }
}

function hideSongInfo() {
    const songTitle = document.getElementById('songTitle');
    const songArtist = document.getElementById('songArtist');
    
    if (songTitle) {
        songTitle.textContent = '🎵 Chanson mystère';
        songTitle.classList.remove('revealed');
    }
    
    if (songArtist) {
        songArtist.textContent = '🎤 Artiste mystère';
        songArtist.classList.remove('revealed');
    }
}

songInput?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        const songName = songInput.value.trim();
        //console.log('Verification de la chanson : %s', songName);
        if (!songName) return;

        const currentTrack = await getCurrentTrackData();
        if (!currentTrack) return;

        // Appel au serveur pour vérifier la correspondance
        const res = await fetch('/api/check-song', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                songName,
                currentTrack
            })
        });

        const { match } = await res.json();

        if (match) {
            // Remove blur effect and show song info
            const thumbnail = domElements.thumbnail;
            if (thumbnail) {
                thumbnail.style.filter = 'none';
            }
            
            // Show the song name and artist
            showSongInfo(currentTrack);
            
            // Mark current track as discovered using the sync function
            updateDiscoveredStatus(appState.currentIndex, true);
            
            // AutoSwipe continue même quand la chanson est découverte
            // (suppression de l'arrêt automatique de l'autoswipe)
            
            showPopup({
                text: `🎉 Correct ! La chanson est : ${currentTrack.name}`,
                type: 'success',
                position: 'top-right',
                duration: 2500,
                needValidate: false,
                btnText: 'Next',
                onValidate: () => {
                    //console.log("Next Track !");
                    songInput.value = '';
                    nextTrack();
                }
            });
        } else {
            showPopup({
                text: `Incorrect ! Essayez encore...`,
                type: 'error',
                position: 'top-right',
                duration: 4000,
                needValidate: false
            });
        }

        songInput.value = '';
    }
});

function updateHistoryPanel(playlistHistory = []) {
    //console.log('Mise a jour du panneau de l\'historique des chansons', playlistHistory);
    const historyGrid = document.getElementById('historyGrid');
    if (!historyGrid) return;

    // Vérification pour éviter les appels multiples simultanés
    if (updateHistoryPanel.isUpdating) {
        //console.log('⚠️ Mise à jour de l\'historique déjà en cours, annulation...');
        return;
    }
    updateHistoryPanel.isUpdating = true;

    // Vider l'historique
    historyGrid.innerHTML = '';

    // Mettre à jour les statistiques
    const discoveredCount = playlistHistory.filter(track => track.discovered).length;
    const totalCount = playlistHistory.length;
    
    const discoveredCountEl = document.getElementById('discoveredCount');
    const totalCountEl = document.getElementById('totalCount');
    
    if (discoveredCountEl) discoveredCountEl.textContent = discoveredCount;
    if (totalCountEl) totalCountEl.textContent = totalCount;

    // Ajoute les chansons qui ont été jouées dans l'historique
    playlistHistory.forEach((track, index) => {
        // Ne créer des éléments que pour les chansons qui ont été jouées (discovered ou passées)
        if (!track.discovered && !track.played) return;
        
        const item = document.createElement('div');
        item.className = track.discovered ? 'history-item discovered' : 'history-item missed';
        
        // Créer l'image
        const img = document.createElement('img');
        img.src = track.image || 'https://placehold.co/64x64?text=No+Image';
        img.alt = `${track.title || 'Titre inconnu'} - ${track.artist || 'Artiste inconnu'}`;
        
        // Ajouter un badge selon le statut
        if (track.discovered) {
            const badge = document.createElement('div');
            badge.className = 'discovered-badge';
            badge.innerHTML = '✅';
            item.appendChild(badge);
        } else {
            const badge = document.createElement('div');
            badge.className = 'missed-badge';
            badge.innerHTML = '❌';
            item.appendChild(badge);
        }
        
        item.appendChild(img);
        historyGrid.appendChild(item);
    });

    // Marquer la fin de la mise à jour
    updateHistoryPanel.isUpdating = false;
}

async function loadUserProfile() {
    try {
        console.log('🔄 Chargement du profil utilisateur...');
        const userData = await getUserData();
        
        if (userData) {
            console.log('👤 Données utilisateur reçues:', {
                name: userData.display_name,
                hasImages: userData.images && userData.images.length > 0,
                country: userData.country
            });
            
            // Mettre à jour l'avatar du joueur
            const playerAvatar = document.getElementById('playerAvatar');
            if (playerAvatar) {
                if (userData.images && userData.images.length > 0) {
                    playerAvatar.src = userData.images[0].url;
                    playerAvatar.alt = userData.display_name || 'Profil utilisateur';
                    console.log('🖼️ Avatar mis à jour');
                } else {
                    // Garder l'image par défaut si pas d'image de profil
                    console.log('ℹ️ Aucune image de profil trouvée, conservation de l\'avatar par défaut');
                }
            }
            
            // Mettre à jour le nom du joueur
            const playerName = document.getElementById('playerName');
            if (playerName && userData.display_name) {
                playerName.textContent = userData.display_name;
                console.log('📝 Nom du joueur mis à jour:', userData.display_name);
            }
            
            // Mettre à jour le statut avec le pays si disponible
            const playerStatus = document.getElementById('playerStatus');
            if (playerStatus && userData.country) {
                playerStatus.textContent = `🌍 ${userData.country}`;
            }
            
            console.log('✅ Profil utilisateur chargé avec succès');
        } else {
            console.warn('⚠️ Aucune donnée utilisateur reçue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement du profil utilisateur:', error);
        // Ne pas afficher de popup d'erreur pour ne pas gêner l'utilisateur
        // L'avatar et le nom par défaut resteront affichés
    }
}

function initUserOptions() {
    // Vérifier si les options utilisateur existent déjà
    const savedOptions = localStorage.getItem('userOptions');
    if (savedOptions) {
        loadUserOptions();
        return
    }else {
        // Initialiser les options utilisateur avec des valeurs par défaut
        const defaultOptions = {
            SongTime: 10,
            MaxPlaylistSongs: 100,
            AutoSwipeEnabled: true,
            RandomSong: true
        };
        localStorage.setItem('userOptions', JSON.stringify(defaultOptions));
        console.log('🔧 Options utilisateur initialisées avec des valeurs par défaut:', defaultOptions);
    }
}

function loadUserOptions() {
    const saved = localStorage.getItem('userOptions');
    //console.log('Chargement des options utilisateur :', saved);
    if (!saved) return;

    try {
        const options = JSON.parse(saved);
        //console.log('Options parsées:', options);
        
        // Update appState with the correct property names
        if (typeof options.SongTime === 'number') {
            appState.autoSwipe.delay = options.SongTime * 1000;
            console.log('⏱️ Temps de chanson mis à jour:', options.SongTime + 's');
        }
        if (typeof options.MaxPlaylistSongs === 'number') {
            appState.maxSongs = options.MaxPlaylistSongs;
            console.log('📊 Nombre max de chansons mis à jour:', options.MaxPlaylistSongs);
        } else if (typeof options.PlaylistMaxSongs === 'number') {
            appState.maxSongs = options.PlaylistMaxSongs;
            console.log('📊 Nombre max de chansons mis à jour:', options.PlaylistMaxSongs);
        }
        if (typeof options.AutoSwipeEnabled === 'boolean') {
            appState.autoSwipe.enabled = options.AutoSwipeEnabled;
            console.log('🔄 AutoSwipe activé:', options.AutoSwipeEnabled);
        }
        if (typeof options.RandomSong === 'boolean') {
            console.log('🎲 Mélange aléatoire:', options.RandomSong ? 'activé' : 'désactivé');
        }
        
        // Log de résumé des options chargées
        console.log('📋 Options chargées:', {
            songTime: options.SongTime,
            maxSongs: options.MaxPlaylistSongs || options.PlaylistMaxSongs,
            autoSwipe: options.AutoSwipeEnabled,
            randomSong: options.RandomSong
        });
    } catch (e) {
        console.error("Erreur de chargement des options utilisateur :", e);
    }
}

function NotImplemented() {
    showPopup({
        text: 'Cette fonctionnalite n\'est pas encore implementee.',
        type: 'warn',
        position: 'top-right',
        duration: 2000,
        needValidate: false
    });
}

async function getDevices() {
    try {
        const response = await fetch(`/api/me/player/devices?token=${appState.token}`);
        if (!response.ok) {
            //console.error('Erreur lors de la recuperation des appareils:', response.statusText);
            return [];
        }
        const data = await response.json();
        return data;
    } catch (err) {
        //console.error('Erreur serveur /api/me/player/devices:', err);
        return [];
    }
}

OptionsDiv.addEventListener('click', async () => {
    //console.log('Options clicked');
    const devices = await getDevices();
    //console.log('Devices:', devices);
    ShowOptionsModal(devices, options => {
        //console.log('Options selected:', options);
        localStorage.setItem('userOptions', JSON.stringify(options.Optionlist));

        // Reload user options to apply them immediately
        loadUserOptions();

        // Use the correct path for device selection
        if (options.Optionlist && options.Optionlist.PlayingDevice) {
            setPlayingDevice(options.Optionlist.PlayingDevice.id);
        }
    });
});

PlayerDiv.addEventListener('click', () => {
    NotImplemented();
});

PlaylistDiv.addEventListener('click', async () => {
    //console.log('Playlist clicked');
    const playlists = await getUserPlaylists();
    //console.log('Playlists:', playlists);
    showPlaylistSelectorModal(playlists, selected => {
        if (!selected.length) {
            showPopup({
                text: 'Aucune playlist selectionnee',
                type: 'warn',
                position: 'top-right'
            });
            return;
        }
        loadPlaylist(selected[0].id);
    });
});

// Ajouter un event listener pour le bouton autoswipe
document.getElementById('autoswipe').addEventListener('click', () => {
    toggleAutoSwipe();
    updateAutoSwipeButton();
});

// Fonction pour mettre à jour l'apparence du bouton autoswipe
function updateAutoSwipeButton() {
    const autoswipeBtn = document.getElementById('autoswipe');
    const autoswipeStatus = document.getElementById('autoswipeStatus');
    
    if (!autoswipeBtn || !autoswipeStatus) return;
    
    autoswipeBtn.classList.remove('running');
    
    switch (appState.autoSwipe.status) {
        case 'running':
            autoswipeBtn.classList.add('running');
            autoswipeStatus.textContent = '⏸️';
            break;
        case 'paused':
            autoswipeStatus.textContent = '▶️';
            break;
        default:
            autoswipeStatus.textContent = '⏸️';
    }
}

// Appeler cette fonction quand l'état d'autoswipe change
window.updateAutoSwipeButton = updateAutoSwipeButton;

// Mobile compatibility functions
function initMobileCompatibility() {
    console.log('🎯 Initialisation de la compatibilité mobile...');
    
    // Fonction globale pour vérifier les réponses (compatible mobile)
    window.checkGuess = async function(guess) {
        if (!guess || !guess.trim()) return false;
        
        const currentTrack = await getCurrentTrackData();
        if (!currentTrack) return false;

        try {
            const res = await fetch('/api/check-song', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songName: guess.trim(),
                    currentTrack
                })
            });

            const { match } = await res.json();

            if (match) {
                // Show song info
                showSongInfo(currentTrack);
                
                // Update discovered status
                updateDiscoveredStatus(appState.currentIndex, true);
                
                // Update mobile interface if available
                if (window.mobileAPI) {
                    window.mobileAPI.updateSong({
                        thumbnail: currentTrack.image,
                        title: currentTrack.name,
                        artist: currentTrack.artists?.map(a => a.name).join(', '),
                        showTitle: true,
                        showArtist: true
                    });
                }
                
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur vérification chanson:', error);
            return false;
        }
    };
    
    // Fonction globale pour chanson suivante (compatible mobile)
    window.nextSong = function() {
        nextTrack();
    };
}
