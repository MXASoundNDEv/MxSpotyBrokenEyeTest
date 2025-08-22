let popup = null;
let modalLock = false; // Lock pour éviter les modales simultanées
let modalQueue = []; // Queue pour les modales en attente

function showPopup({
    text,
    type = 'info',
    position = 'top-right',
    duration = 3000,
    needValidate = false,
    btnText = 'OK',
    onValidate = null
}) {
    const popup = document.createElement('div');
    popup.className = `popup ${type}`;

    // Positionnement
    popup.style.position = 'fixed';
    popup.style.zIndex = 'var(--z-popup, 1000)';
    popup.style.padding = 'var(--space-md)';
    popup.style.borderRadius = 'var(--radius-md)';
    popup.style.maxWidth = '400px';
    popup.style.wordWrap = 'break-word';

    popup.style.top = position.includes('top') ? 'var(--space-xl)' : '';
    popup.style.bottom = position.includes('bottom') ? 'var(--space-xl)' : '';
    popup.style.left = position.includes('left') ? 'var(--space-xl)' : '';
    popup.style.right = position.includes('right') ? 'var(--space-xl)' : '';
    if (position === 'center') {
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
    } else if (position === 'middle-left') {
        popup.style.top = '50%';
        popup.style.left = 'var(--space-xl)';
        popup.style.transform = 'translateY(-50%)';
    } else if (position === 'middle-right') {
        popup.style.top = '50%';
        popup.style.right = 'var(--space-xl)';
        popup.style.transform = 'translateY(-50%)';
    } else if (position === 'middle-top') {
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -100%)';
    } else if (position === 'middle-bottom') {
        popup.style.bottom = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, 100%)';
    }

    popup.innerText = text;

    if (needValidate && typeof onValidate === 'function') {
        const btn = document.createElement('button');
        btn.innerText = btnText;
        btn.onclick = () => {
            onValidate();
            popup.remove();
        };
        popup.appendChild(btn);
    } else if (typeof onValidate === 'function') {
        const btn = document.createElement('button');
        btn.innerText = btnText;
        btn.onclick = () => {
            onValidate();
            popup.remove();
        };
        popup.appendChild(btn);
        setTimeout(() => popup.classList.remove('show'), duration);
    } else {
        setTimeout(() => popup.classList.remove('show'), duration);
    }

    if (!popup) return; // Prevents showing popup if no text is provided
    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));
    setTimeout(() => {
        if (!needValidate) popup.remove();
    }, duration + 500);
}

async function showModal({
    title = 'Titre',
    content = null,
    onConfirm = null,
    onCancel = null,
    disablebuttons = false,
    disablecancel = false,
    disableconfirm = false,
    priority = false // Priorité pour ignorer le lock
}) {
    return new Promise((resolve, reject) => {
        const modalRequest = {
            title,
            content,
            onConfirm,
            onCancel,
            disablebuttons,
            disablecancel,
            disableconfirm,
            priority,
            resolve,
            reject
        };

        // Si une modale est déjà ouverte et pas de priorité, ajouter à la queue
        if (modalLock && !priority) {
            console.log(`⏳ Modale "${title}" ajoutée à la queue`);
            modalQueue.push(modalRequest);
            showModalQueueIndicator(); // Afficher l'indicateur
            return;
        }

        // Si priorité et qu'une modale est ouverte, fermer la modale actuelle
        if (priority && modalLock) {
            console.log(`🚨 Modale prioritaire "${title}" - fermeture de la modale actuelle`);
            const currentModal = document.querySelector('[id^="modal-"]');
            if (currentModal) {
                document.body.removeChild(currentModal);
                modalLock = false;
            }
        }

        _createModal(modalRequest);
    });
}

function _createModal(modalRequest) {
    const {
        title,
        content,
        onConfirm,
        onCancel,
        disablebuttons,
        disablecancel,
        disableconfirm,
        resolve,
        reject
    } = modalRequest;

    // Verrouiller les nouvelles modales
    modalLock = true;
    console.log(`🔒 Modale "${title}" verrouillée`);

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 'var(--z-modal)';
    overlay.id = `modal-${title.replace(/\s+/g, '-')}`;

    const modal = document.createElement('div');
    modal.style.background = 'var(--primary-surface)';
    modal.style.borderRadius = 'var(--radius-lg)';
    modal.style.padding = 'var(--space-xl)';
    modal.style.minWidth = '320px';
    modal.style.maxWidth = '90vw';
    modal.style.color = 'var(--primary-text)';
    modal.style.boxShadow = 'var(--shadow-xl)';

    const titleEl = document.createElement('h2');
    titleEl.style.marginBottom = 'var(--space-md)';
    titleEl.innerText = title;
    modal.appendChild(titleEl);

    const contentEl = document.createElement('div');
    contentEl.style.marginBottom = 'var(--space-xl)';

    if (typeof content === 'string') {
        contentEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        contentEl.appendChild(content);
    } else if (Array.isArray(content)) {
        content.forEach(el => {
            if (typeof el === 'string') {
                const p = document.createElement('p');
                p.innerHTML = el;
                contentEl.appendChild(p);
            } else if (el instanceof HTMLElement) {
                contentEl.appendChild(el);
            }
        });
    }

    modal.appendChild(contentEl);

    // Fonction de fermeture avec déverrouillage
    const closeModal = (result = null) => {
        try {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        } catch (error) {
            console.warn('Erreur lors de la fermeture de la modale:', error);
        }

        // Déverrouiller et traiter la queue
        modalLock = false;
        console.log(`🔓 Modale "${title}" déverrouillée`);

        // Résoudre la promesse
        if (resolve) resolve(result);

        // Traiter la prochaine modale dans la queue
        _processModalQueue();
    };

    if (!disablebuttons) {
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = 'var(--space-md)';

        if (!disablecancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Annuler';
            cancelBtn.style.padding = 'var(--space-sm) var(--space-md)';
            cancelBtn.style.border = 'none';
            cancelBtn.style.borderRadius = 'var(--radius-sm)';
            cancelBtn.style.background = 'var(--muted-text)';
            cancelBtn.style.color = 'white';
            cancelBtn.onclick = () => {
                if (onCancel) onCancel();
                closeModal('cancel');
            };
            btnContainer.appendChild(cancelBtn);
        }

        if (!disableconfirm) {
            const confirmBtn = document.createElement('button');
            confirmBtn.innerText = 'Valider';
            confirmBtn.style.padding = 'var(--space-sm) var(--space-md)';
            confirmBtn.style.border = 'none';
            confirmBtn.style.borderRadius = 'var(--radius-sm)';
            confirmBtn.style.background = 'var(--primary-accent)';
            confirmBtn.style.color = 'white';
            confirmBtn.onclick = () => {
                if (onConfirm) onConfirm();
                closeModal('confirm');
            };
            btnContainer.appendChild(confirmBtn);
        }

        modal.appendChild(btnContainer);
    }

    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            if (onCancel) onCancel();
            closeModal('escape');
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Traiter la queue des modales
function _processModalQueue() {
    if (modalQueue.length > 0 && !modalLock) {
        const nextModal = modalQueue.shift();
        console.log(`▶️ Traitement de la modale suivante: "${nextModal.title}"`);

        // Mettre à jour l'indicateur
        if (modalQueue.length > 0) {
            showModalQueueIndicator();
        } else {
            hideModalQueueIndicator();
        }

        setTimeout(() => _createModal(nextModal), 100); // Petit délai pour éviter les conflits
    } else if (modalQueue.length === 0) {
        hideModalQueueIndicator();
    }
}

// Afficher un indicateur visuel de la queue des modales
function showModalQueueIndicator() {
    const existingIndicator = document.getElementById('modal-queue-indicator');
    if (existingIndicator) {
        existingIndicator.textContent = `🕒 ${modalQueue.length} modale(s) en attente`;
        return;
    }

    if (modalQueue.length === 0) return;

    const indicator = document.createElement('div');
    indicator.id = 'modal-queue-indicator';
    indicator.className = 'modal-queue-indicator';
    indicator.textContent = `🕒 ${modalQueue.length} modale(s) en attente`;

    document.body.appendChild(indicator);

    // Auto-masquer après 3 secondes
    setTimeout(() => {
        if (document.body.contains(indicator)) {
            document.body.removeChild(indicator);
        }
    }, 3000);
}

// Masquer l'indicateur de queue
function hideModalQueueIndicator() {
    const indicator = document.getElementById('modal-queue-indicator');
    if (indicator && document.body.contains(indicator)) {
        document.body.removeChild(indicator);
    }
}

// Exemple d'utilisation des nouvelles fonctionnalités
async function exampleModalUsage() {
    try {
        // Attendre qu'aucune modale ne soit active
        await waitForModalUnlock();

        // Afficher une modale importante
        const result = await showModal({
            title: 'Confirmation',
            content: 'Voulez-vous continuer ?',
            priority: true
        });

        console.log('Résultat de la modale:', result);
    } catch (error) {
        console.error('Erreur avec la modale:', error);
    }
}

function SpotifyconnectModal() {
    const loginSpotifyBtn = document.createElement('button');
    loginSpotifyBtn.id = 'login';
    loginSpotifyBtn.innerText = 'Se connecter';
    loginSpotifyBtn.style.padding = 'var(--space-md) var(--space-xl)';
    loginSpotifyBtn.style.border = 'none';
    loginSpotifyBtn.style.borderRadius = 'var(--radius-sm)';
    loginSpotifyBtn.style.background = 'var(--primary-accent)';
    loginSpotifyBtn.style.color = 'white';
    //center the button
    loginSpotifyBtn.style.display = 'block';
    loginSpotifyBtn.style.margin = '0 auto';
    loginSpotifyBtn.onclick = () => {
        //close modal if it exists
        BienvenueModal = document.getElementById(`modal-Bienvenue`);
        if (BienvenueModal) {
            window.location = '/login';
            initPlayer();
            document.body.removeChild(BienvenueModal);
        }
    };

    showModal({
        title: 'Bienvenue',
        content: [
            'Connecte-toi à ton compte Spotify pour jouer !',
            'Il te faut un compte Spotify Premium pour utiliser cette fonctionnalité.',
            loginSpotifyBtn
        ],
        disablebuttons: true,
        priority: true // Priorité haute pour la connexion Spotify
    });
}

async function showPlaylistSelectorModal(playlists = [], onConfirm) {
    const selected = new Set();
    console.log('📋 Playlists disponibles:', playlists);
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    wrapper.style.gap = 'var(--space-md)';
    wrapper.style.maxHeight = '400px';
    wrapper.style.overflowY = 'auto';
    wrapper.style.marginBottom = 'var(--space-lg)';

    playlists.forEach(pl => {
        const card = document.createElement('div');
        card.style.border = '2px solid transparent';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.background = 'var(--primary-surface)';
        card.style.padding = 'var(--space-sm)';
        card.style.cursor = 'pointer';
        card.style.textAlign = 'center';
        card.style.transition = 'var(--transition-normal)';

        const img = document.createElement('img');
        img.src = pl.image;
        img.style.width = '100%';
        img.style.borderRadius = 'var(--radius-sm)';

        const title = document.createElement('div');
        title.innerText = pl.name;
        title.style.fontSize = 'var(--font-size-sm)';
        title.style.marginTop = 'var(--space-sm)';
        title.style.color = 'var(--primary-text)';

        card.appendChild(img);
        card.appendChild(title);
        wrapper.appendChild(card);

        card.onclick = () => {
            if (selected.has(pl.id)) {
                selected.delete(pl.id);
                card.style.borderColor = 'transparent';
                card.style.background = 'var(--primary-surface)';
            } else {
                selected.add(pl.id);
                card.style.borderColor = 'var(--primary-accent-light)';
                card.style.background = 'var(--primary-surface-hover)';
            }
        };
    });

    const result = await showModal({
        title: 'Choisis tes playlists',
        content: wrapper,
        onConfirm: () => {
            const chosen = playlists.filter(pl => selected.has(pl.id));
            if (typeof onConfirm === 'function') onConfirm(chosen);
        },
        disablecancel: true
    });

    return result;
}

async function ShowOptionsModal(Devices = [], onConfirm) {
    let userOptions;

    // Debug: vérifier le contenu de localStorage
    const storedData = localStorage.getItem('userOptions');
    console.log('🔍 Données brutes localStorage:', storedData);

    if (typeof utils !== 'undefined' && utils.getUserOptions) {
        userOptions = utils.getUserOptions();
        console.log('🔍 Options via utils.getUserOptions():', userOptions);
    } else {
        try {
            const stored = localStorage.getItem('userOptions');
            const parsedData = stored ? JSON.parse(stored) : {};
            console.log('🔍 Données parsées:', parsedData);
            userOptions = parsedData.Optionlist || {};
            console.log('🔍 Options finales extraites:', userOptions);
        } catch (error) {
            console.warn('🔍 Erreur parsing localStorage:', error);
            userOptions = {};
        }
    }

    let SongTime = userOptions.SongTime || 10;
    let PlayingDevice = null;
    let RandomSong = userOptions.RandomSong !== undefined ? userOptions.RandomSong : true;
    let PlaylistMaxSongs = userOptions.PlaylistMaxSongs || userOptions.MaxPlaylistSongs || 100;
    let RevealAtEnd = userOptions.RevealAtEnd !== undefined ? userOptions.RevealAtEnd : true;
    let RevealDuration = userOptions.RevealDuration || 5000; // 5 seconds by default
    let RevealOnlyUndiscovered = userOptions.RevealOnlyUndiscovered !== undefined ? userOptions.RevealOnlyUndiscovered : true; // true by default

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '15px';

    const timeContainer = document.createElement('div');
    const timeLabel = document.createElement('label');
    timeLabel.innerText = 'Temps d’écoute (sec) :';
    timeLabel.style.marginBottom = '5px';
    const songTimeInput = document.createElement('input');
    songTimeInput.type = 'number';
    songTimeInput.value = SongTime;
    songTimeInput.style.padding = '8px';
    songTimeInput.style.borderRadius = '8px';
    songTimeInput.style.border = 'none';
    songTimeInput.style.background = '#2a2a50';
    songTimeInput.style.color = 'white';
    timeContainer.appendChild(timeLabel);
    timeContainer.appendChild(songTimeInput);

    const playlistContainer = document.createElement('div');
    const playlistLabel = document.createElement('label');
    playlistLabel.innerText = 'Nombre maximum de chansons dans la playlist :';
    playlistLabel.style.marginBottom = '5px';
    const playlistInput = document.createElement('input');
    playlistInput.type = 'number';
    playlistInput.value = PlaylistMaxSongs;
    playlistInput.style.padding = '8px';
    playlistInput.style.borderRadius = '8px';
    playlistInput.style.border = 'none';
    playlistInput.style.background = '#2a2a50';
    playlistInput.style.color = 'white';
    playlistContainer.appendChild(playlistLabel);
    playlistContainer.appendChild(playlistInput);

    const deviceContainer = document.createElement('div');
    const deviceLabel = document.createElement('label');
    deviceLabel.innerText = 'Périphérique de lecture par défaut :';
    deviceLabel.style.marginBottom = '5px';
    const deviceSelect = document.createElement('select');
    deviceSelect.style.padding = '8px';
    deviceSelect.style.borderRadius = '8px';
    deviceSelect.style.border = 'none';
    deviceSelect.style.background = '#2a2a50';
    deviceSelect.style.color = 'white';
    deviceSelect.style.width = '100%';

    Devices.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.id;
        opt.text = dev.name;
        if (PlayingDevice && PlayingDevice.id === dev.id) opt.selected = true;
        deviceSelect.appendChild(opt);
    });

    deviceContainer.appendChild(deviceLabel);
    deviceContainer.appendChild(deviceSelect);

    const randomContainer = document.createElement('div');
    randomContainer.style.display = 'flex';
    randomContainer.style.alignItems = 'center';
    randomContainer.style.gap = '10px';
    const randomLabel = document.createElement('label');
    randomLabel.innerText = 'Lecture aléatoire :';
    const randomToggle = document.createElement('input');
    randomToggle.type = 'checkbox';
    randomToggle.checked = RandomSong;
    randomToggle.style.transform = 'scale(1.5)';
    randomContainer.appendChild(randomLabel);
    randomContainer.appendChild(randomToggle);

    // RevealAtEnd option
    const revealAtEndContainer = document.createElement('div');
    revealAtEndContainer.style.display = 'flex';
    revealAtEndContainer.style.alignItems = 'center';
    revealAtEndContainer.style.gap = '10px';
    const revealAtEndLabel = document.createElement('label');
    revealAtEndLabel.innerText = 'Révéler à la fin du timer :';
    const revealAtEndToggle = document.createElement('input');
    revealAtEndToggle.type = 'checkbox';
    revealAtEndToggle.checked = RevealAtEnd;
    revealAtEndToggle.style.transform = 'scale(1.5)';
    revealAtEndContainer.appendChild(revealAtEndLabel);
    revealAtEndContainer.appendChild(revealAtEndToggle);

    // RevealDuration option
    const revealDurationContainer = document.createElement('div');
    const revealDurationLabel = document.createElement('label');
    revealDurationLabel.innerText = 'Durée de révélation (sec) :';
    revealDurationLabel.style.marginBottom = '5px';
    const revealDurationInput = document.createElement('input');
    revealDurationInput.type = 'number';
    revealDurationInput.min = '1';
    revealDurationInput.max = '30';
    revealDurationInput.value = Math.round((RevealDuration || 5000) / 1000); // Convert ms to seconds
    revealDurationInput.style.padding = '8px';
    revealDurationInput.style.borderRadius = '8px';
    revealDurationInput.style.border = 'none';
    revealDurationInput.style.background = '#2a2a50';
    revealDurationInput.style.color = 'white';
    revealDurationContainer.appendChild(revealDurationLabel);
    revealDurationContainer.appendChild(revealDurationInput);

    // RevealOnlyUndiscovered option
    const revealModeContainer = document.createElement('div');
    const revealModeLabel = document.createElement('label');
    revealModeLabel.innerText = 'Révéler uniquement les chansons non découvertes :';
    revealModeLabel.style.marginBottom = '5px';
    const revealModeToggle = document.createElement('input');
    revealModeToggle.type = 'checkbox';
    revealModeToggle.checked = RevealOnlyUndiscovered;
    revealModeToggle.style.transform = 'scale(1.5)';
    revealModeContainer.style.display = 'flex';
    revealModeContainer.style.alignItems = 'center';
    revealModeContainer.style.gap = '10px';
    revealModeContainer.appendChild(revealModeLabel);
    revealModeContainer.appendChild(revealModeToggle);

    // Toggle reveal mode visibility based on RevealAtEnd
    const toggleRevealModeVisibility = () => {
        revealModeContainer.style.display = revealAtEndToggle.checked ? 'flex' : 'none';
    };

    // Toggle reveal duration visibility based on RevealAtEnd
    const toggleRevealDurationVisibility = () => {
        revealDurationContainer.style.display = revealAtEndToggle.checked ? 'block' : 'none';
    };

    revealAtEndToggle.addEventListener('change', () => {
        toggleRevealDurationVisibility();
        toggleRevealModeVisibility();
    });

    toggleRevealDurationVisibility(); // Initial state
    toggleRevealModeVisibility(); // Initial state

    wrapper.appendChild(playlistContainer);
    wrapper.appendChild(timeContainer);
    wrapper.appendChild(deviceContainer);
    wrapper.appendChild(randomContainer);
    wrapper.appendChild(revealAtEndContainer);
    wrapper.appendChild(revealDurationContainer);
    wrapper.appendChild(revealModeContainer);

    const result = await showModal({
        title: 'Options',
        content: wrapper,
        onConfirm: () => {
            const newOptions = {
                SongTime: parseInt(songTimeInput.value),
                PlayingDevice: Devices.find(dev => dev.id === deviceSelect.value) || null,
                RandomSong: randomToggle.checked,
                PlaylistMaxSongs: parseInt(playlistInput.value) || 10,
                RevealAtEnd: revealAtEndToggle.checked,
                RevealDuration: parseInt(revealDurationInput.value) * 1000, // Convert seconds to milliseconds
                RevealOnlyUndiscovered: revealModeToggle.checked
            };

            console.log('🔧 Nouvelles options:', newOptions);
            console.log('🔧 Options sauvegardées actuellement:', userOptions);

            // Save all options (simplification de la logique)
            const savedOptions = { ...userOptions, ...newOptions };

            try {
                localStorage.setItem('userOptions', JSON.stringify({ Optionlist: savedOptions }));
                console.log('✅ Options sauvegardées avec succès:', savedOptions);
            } catch (e) {
                console.warn('❌ Erreur lors de la sauvegarde des options:', e);
            }

            if (typeof onConfirm === 'function') onConfirm({ Optionlist: savedOptions });
        }
    });

    return result;
}

async function ShowDeviceList(Devices = [], onSelect) {
    const selected = new Set();
    console.log('🔊 Périphériques disponibles:', Devices);

    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    wrapper.style.gap = 'var(--space-md)';
    wrapper.style.maxHeight = '400px';
    wrapper.style.overflowY = 'auto';
    wrapper.style.marginBottom = 'var(--space-lg)';

    Devices.forEach(device => {
        const card = document.createElement('div');
        card.style.border = '2px solid transparent';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.background = 'var(--primary-surface)';
        card.style.padding = 'var(--space-md)';
        card.style.cursor = 'pointer';
        card.style.textAlign = 'center';
        card.style.transition = 'var(--transition-normal)';
        card.style.position = 'relative';

        // Icône du périphérique selon le type
        const icon = document.createElement('div');
        icon.style.fontSize = '2.5rem';
        icon.style.marginBottom = 'var(--space-sm)';

        const deviceIcons = {
            'Computer': '💻',
            'computer': '💻',
            'Smartphone': '📱',
            'smartphone': '📱',
            'Speaker': '🔊',
            'speaker': '🔊',
            'TV': '📺',
            'tv': '📺',
            'STB': '📺', // Set-top box (Freebox)
            'stb': '📺',
            'Game_Console': '🎮',
            'game_console': '🎮',
            'Cast_Audio': '📻',
            'cast_audio': '📻',
            'Cast_Video': '📽️',
            'cast_video': '📽️',
            'Automobile': '🚗',
            'automobile': '🚗',
            'unknown': '🎵'
        };

        icon.textContent = deviceIcons[device.type] || deviceIcons['unknown'];
        card.appendChild(icon);

        // Nom du périphérique
        const name = document.createElement('div');
        name.innerText = device.name || 'Périphérique sans nom';
        name.style.fontSize = 'var(--font-size-base)';
        name.style.fontWeight = 'var(--font-weight-medium)';
        name.style.marginBottom = 'var(--space-xs)';
        name.style.color = 'var(--primary-text)';
        card.appendChild(name);

        // Type du périphérique
        const type = document.createElement('div');
        const deviceType = device.type ? device.type.replace('_', ' ') : 'Inconnu';
        type.innerText = deviceType.toUpperCase();
        type.style.fontSize = 'var(--font-size-sm)';
        type.style.color = 'var(--secondary-text)';
        type.style.marginBottom = 'var(--space-xs)';
        card.appendChild(type);

        // Volume si supporté
        if (device.supports_volume && device.volume_percent !== undefined && device.volume_percent !== null) {
            const volume = document.createElement('div');
            volume.innerText = `Volume: ${device.volume_percent}%`;
            volume.style.fontSize = 'var(--font-size-sm)';
            volume.style.color = 'var(--muted-text)';
            card.appendChild(volume);
        }

        // Badge "Actif" si c'est le périphérique actuel
        if (device.is_active) {
            const activeBadge = document.createElement('div');
            activeBadge.innerText = 'ACTIF';
            activeBadge.style.position = 'absolute';
            activeBadge.style.top = 'var(--space-xs)';
            activeBadge.style.right = 'var(--space-xs)';
            activeBadge.style.background = 'var(--success-color)';
            activeBadge.style.color = 'white';
            activeBadge.style.fontSize = 'var(--font-size-xs)';
            activeBadge.style.padding = '2px 6px';
            activeBadge.style.borderRadius = 'var(--radius-sm)';
            activeBadge.style.fontWeight = 'var(--font-weight-bold)';
            card.appendChild(activeBadge);
        }

        wrapper.appendChild(card);

        card.onclick = () => {
            // Désélectionner tous les autres périphériques (sélection unique)
            document.querySelectorAll('.device-card-selected').forEach(el => {
                el.style.borderColor = 'transparent';
                el.style.background = 'var(--primary-surface)';
                el.classList.remove('device-card-selected');
            });

            // Vider la sélection précédente
            selected.clear();

            // Sélectionner le périphérique actuel
            selected.add(device.id);
            card.style.borderColor = 'var(--primary-accent-light)';
            card.style.background = 'var(--primary-surface-hover)';
            card.classList.add('device-card-selected');
        };

        // Sélectionner automatiquement le périphérique actif s'il y en a un
        if (device.is_active) {
            selected.add(device.id);
            card.style.borderColor = 'var(--primary-accent-light)';
            card.style.background = 'var(--primary-surface-hover)';
            card.classList.add('device-card-selected');
        }
    });

    const result = await showModal({
        title: 'Choisis ton périphérique',
        content: wrapper,
        onConfirm: () => {
            const chosen = Devices.find(device => selected.has(device.id));
            if (typeof onSelect === 'function') onSelect(chosen);
        },
        disablecancel: false
    });

    return result;
}

// Modal de chargement
let loadingModal = null;

function showLoadingModal(message = 'Chargement en cours...', steps = []) {
    // Éviter les doublons
    if (loadingModal) {
        hideLoadingModal();
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.id = 'loading-modal-overlay';

    const modal = document.createElement('div');
    modal.style.background = 'var(--background, #1a1a2e)';
    modal.style.borderRadius = '15px';
    modal.style.padding = '30px';
    modal.style.minWidth = '350px';
    modal.style.maxWidth = '90vw';
    modal.style.color = 'var(--primary-text, #ffffff)';
    modal.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'center';
    modal.style.border = '2px solid var(--glass-border, #4a4a6a)';

    // Titre
    const title = document.createElement('h2');
    title.style.marginBottom = '20px';
    title.style.color = 'var(--primary-text, #ffffff)';
    title.style.fontSize = '1.5rem';
    title.innerHTML = '🎵 Spotify Blind Test';
    modal.appendChild(title);

    // Message principal
    const messageEl = document.createElement('div');
    messageEl.id = 'loading-message';
    messageEl.style.fontSize = '1.1rem';
    messageEl.style.marginBottom = '25px';
    messageEl.style.color = 'var(--secondary-text, #cccccc)';
    messageEl.textContent = message;
    modal.appendChild(messageEl);

    // Spinner animé
    const spinner = document.createElement('div');
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '4px solid rgba(255, 255, 255, 0.1)';
    spinner.style.borderTop = '4px solid var(--glass-border, #4a4a6a)';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    spinner.style.margin = '0 auto 20px auto';
    modal.appendChild(spinner);

    // Ajouter l'animation CSS pour le spinner
    if (!document.getElementById('loading-spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-spinner-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Liste des étapes si fournie
    if (steps.length > 0) {
        const stepsList = document.createElement('div');
        stepsList.id = 'loading-steps';
        stepsList.style.textAlign = 'left';
        stepsList.style.marginTop = '15px';
        stepsList.style.padding = '15px';
        stepsList.style.background = 'rgba(255, 255, 255, 0.05)';
        stepsList.style.borderRadius = '8px';
        stepsList.style.fontSize = '0.9rem';

        steps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.id = `loading-step-${index}`;
            stepEl.style.marginBottom = '8px';
            stepEl.style.display = 'flex';
            stepEl.style.alignItems = 'center';
            stepEl.style.opacity = '0.5';
            stepEl.innerHTML = `
                <span class="step-icon" style="margin-right: 10px; width: 20px;">⏳</span>
                <span class="step-text">${step}</span>
            `;
            stepsList.appendChild(stepEl);
        });

        modal.appendChild(stepsList);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    loadingModal = overlay;

    return {
        updateMessage: (newMessage) => {
            const msgEl = document.getElementById('loading-message');
            if (msgEl) msgEl.textContent = newMessage;
        },
        completeStep: (stepIndex) => {
            const stepEl = document.getElementById(`loading-step-${stepIndex}`);
            if (stepEl) {
                stepEl.style.opacity = '1';
                const icon = stepEl.querySelector('.step-icon');
                if (icon) icon.textContent = '✅';
            }
        },
        updateStep: (stepIndex, newText) => {
            const stepEl = document.getElementById(`loading-step-${stepIndex}`);
            if (stepEl) {
                const textEl = stepEl.querySelector('.step-text');
                if (textEl) textEl.textContent = newText;
            }
        }
    };
}

function hideLoadingModal() {
    if (loadingModal) {
        document.body.removeChild(loadingModal);
        loadingModal = null;
    }
}

// Modal d'historique plein écran pour mobile
function showHistoryModal(historyData = []) {
    const isMobile = window.innerWidth <= 768;

    if (!isMobile) return; // Seulement sur mobile

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.zIndex = '9999';
    overlay.style.overflow = 'hidden';
    overlay.id = 'history-fullscreen-modal';

    // Header avec titre et bouton fermer
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '20px';
    header.style.borderBottom = '2px solid var(--neon-cyan)';
    header.style.background = 'var(--glass-bg-medium)';
    header.style.backdropFilter = 'blur(20px)';

    const title = document.createElement('h2');
    title.style.color = 'var(--neon-cyan)';
    title.style.fontSize = '1.5rem';
    title.style.fontWeight = 'var(--font-weight-bold)';
    title.style.margin = '0';
    title.innerHTML = '🎵 Historique';

    const closeBtn = document.createElement('button');
    closeBtn.style.background = 'var(--error-color)';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '40px';
    closeBtn.style.height = '40px';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.innerHTML = '✖';
    closeBtn.onclick = () => document.body.removeChild(overlay);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Contenu principal
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.padding = '20px';
    content.style.overflow = 'auto';
    content.style.background = 'var(--primary-bg)';

    // Statistiques
    const statsContainer = document.createElement('div');
    statsContainer.style.display = 'grid';
    statsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    statsContainer.style.gap = '15px';
    statsContainer.style.marginBottom = '25px';

    // Calculer les stats depuis les données d'historique
    const discovered = historyData.filter(item => item.discovered).length;
    const missed = historyData.filter(item => !item.discovered).length;
    const total = historyData.length;

    const stats = [
        { label: 'Découvertes', value: discovered, color: 'var(--success-color)' },
        { label: 'Manquées', value: missed, color: 'var(--error-color)' },
        { label: 'Total', value: total, color: 'var(--neon-cyan)' },
        { label: 'Précision', value: total > 0 ? Math.round((discovered / total) + 100) + '%' : '0%', color: 'var(--neon-magenta)' }
    ];

    stats.forEach(stat => {
        const statItem = document.createElement('div');
        statItem.style.background = 'var(--glass-bg-medium)';
        statItem.style.border = '2px solid var(--glass-border)';
        statItem.style.borderRadius = 'var(--radius-lg)';
        statItem.style.padding = '15px';
        statItem.style.textAlign = 'center';
        statItem.style.backdropFilter = 'blur(10px)';

        const statLabel = document.createElement('div');
        statLabel.style.fontSize = '12px';
        statLabel.style.color = 'var(--secondary-text)';
        statLabel.style.marginBottom = '8px';
        statLabel.style.textTransform = 'uppercase';
        statLabel.style.letterSpacing = '1px';
        statLabel.textContent = stat.label;

        const statValue = document.createElement('div');
        statValue.style.fontSize = '24px';
        statValue.style.fontWeight = 'var(--font-weight-bold)';
        statValue.style.color = stat.color;
        statValue.style.fontFamily = 'var(--font-family-mono)';
        statValue.textContent = stat.value;

        statItem.appendChild(statLabel);
        statItem.appendChild(statValue);
        statsContainer.appendChild(statItem);
    });

    content.appendChild(statsContainer);

    // Grille d'historique
    const historyGrid = document.createElement('div');
    historyGrid.style.display = 'grid';
    historyGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
    historyGrid.style.gap = '15px';
    historyGrid.style.padding = '10px';
    historyGrid.style.maxHeight = '60vh';
    historyGrid.style.overflow = 'auto';

    historyData.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.style.position = 'relative';
        historyItem.style.aspectRatio = '1';
        historyItem.style.borderRadius = 'var(--radius-md)';
        historyItem.style.overflow = 'hidden';
        historyItem.style.border = `3px solid ${item.discovered ? 'var(--neon-cyan)' : 'var(--error-color)'}`;
        historyItem.style.background = 'var(--glass-bg-light)';
        historyItem.style.transition = 'all var(--transition-normal)';
        historyItem.style.cursor = 'pointer';

        if (item.discovered) {
            historyItem.style.boxShadow = '0 0 20px var(--neon-cyan-glow)';
        }

        const img = document.createElement('img');
        if (item.image && item.discovered) {
            img.src = item.image;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.filter = 'brightness(1.1) saturate(1.2) contrast(1.1)';
        } else {
            // Image placeholder pour les chansons non découvertes
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.background = 'var(--glass-bg-medium)';
            img.style.display = 'flex';
            img.style.alignItems = 'center';
            img.style.justifyContent = 'center';
            img.innerHTML = '❓';
            img.style.fontSize = '24px';
            img.style.filter = 'grayscale(100%) brightness(0.5)';
        }

        // Badge
        const badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.top = '-8px';
        badge.style.right = '-8px';
        badge.style.width = '24px';
        badge.style.height = '24px';
        badge.style.borderRadius = '50%';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = 'var(--font-weight-bold)';
        badge.style.border = '2px solid var(--primary-bg)';
        badge.style.zIndex = '10';

        if (item.discovered) {
            badge.style.background = 'var(--success-color)';
            badge.style.color = 'white';
            badge.innerHTML = '✓';
            badge.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.6)';
        } else {
            badge.style.background = 'var(--error-color)';
            badge.style.color = 'white';
            badge.innerHTML = '✗';
            badge.style.boxShadow = '0 0 15px rgba(229, 57, 53, 0.6)';
        }

        // Effet hover
        historyItem.onmouseenter = () => {
            historyItem.style.transform = 'scale(1.1) translateY(-5px)';
            historyItem.style.zIndex = '100';
        };
        historyItem.onmouseleave = () => {
            historyItem.style.transform = 'scale(1) translateY(0)';
            historyItem.style.zIndex = 'auto';
        };

        // Information au clic
        historyItem.onclick = () => {
            if (item.discovered && (item.title || item.artist)) {
                alert(`🎵 ${item.title || 'Titre inconnu'}\n👨‍🎤 ${item.artist || 'Artiste inconnu'}`);
            }
        };

        historyItem.appendChild(img);
        historyItem.appendChild(badge);
        historyGrid.appendChild(historyItem);
    });

    content.appendChild(historyGrid);

    overlay.appendChild(header);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}