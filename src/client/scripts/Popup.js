let popup = null;

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
    popup.style.top = position.includes('top') ? '20px' : '';
    popup.style.bottom = position.includes('bottom') ? '20px' : '';
    popup.style.left = position.includes('left') ? '20px' : '';
    popup.style.right = position.includes('right') ? '20px' : '';
    if (position === 'center') {
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
    } else if (position === 'middle-left') {
        popup.style.top = '50%';
        popup.style.left = '20px';
        popup.style.transform = 'translateY(-50%)';
    } else if (position === 'middle-right') {
        popup.style.top = '50%';
        popup.style.right = '20px';
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
    }else if (typeof onValidate === 'function') {
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

function showModal({
    title = 'Titre',
    content = null,
    onConfirm = null,
    onCancel = null,
    disablebuttons = false,
    disablecancel = false,
    disableconfirm = false
}) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 1000;
    overlay.id = `modal-${title.replace(/\s+/g, '-')}`;

    const modal = document.createElement('div');
    modal.style.background = 'var(--panel)';
    modal.style.borderRadius = 'var(--round)';
    modal.style.padding = '20px';
    modal.style.minWidth = '320px';
    modal.style.maxWidth = '90vw';
    modal.style.color = 'var(--text)';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';

    const titleEl = document.createElement('h2');
    titleEl.style.marginBottom = '10px';
    titleEl.innerText = title;
    modal.appendChild(titleEl);

    const contentEl = document.createElement('div');
    contentEl.style.marginBottom = '20px';

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
    if (!disablebuttons) {
        const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.justifyContent = 'flex-end';
            btnContainer.style.gap = '10px';
        if (!disablecancel) {
            const cancelBtn = document.createElement('button');
                cancelBtn.innerText = 'Annuler';
                cancelBtn.style.padding = '8px 12px';
                cancelBtn.style.border = 'none';
                cancelBtn.style.borderRadius = '6px';
                cancelBtn.style.background = '#999';
                cancelBtn.style.color = 'white';
                cancelBtn.onclick = () => {
                    if (onCancel) onCancel();
                    document.body.removeChild(overlay);
                };
                btnContainer.appendChild(cancelBtn);

        }
        if (!disableconfirm) {
            const confirmBtn = document.createElement('button');
                confirmBtn.innerText = 'Valider';
                confirmBtn.style.padding = '8px 12px';
                confirmBtn.style.border = 'none';
                confirmBtn.style.borderRadius = '6px';
                confirmBtn.style.background = 'var(--soft)';
                confirmBtn.style.color = 'white';
                confirmBtn.onclick = () => {
                    if (onConfirm) onConfirm();
                    document.body.removeChild(overlay);
                };
                btnContainer.appendChild(confirmBtn);
        }
        modal.appendChild(btnContainer);
    }
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function SpotifyconnectModal() {
    const loginSpotifyBtn = document.createElement('button');
    loginSpotifyBtn.id = 'login';
    loginSpotifyBtn.innerText = 'Se connecter';
    loginSpotifyBtn.style.padding = '10px 20px';
    loginSpotifyBtn.style.border = 'none';
    loginSpotifyBtn.style.borderRadius = '4px';
    loginSpotifyBtn.style.background = 'var(--soft)';
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
    disablebuttons: true
    });
}

function showPlaylistSelectorModal(playlists = [], onConfirm) {
    const selected = new Set();
    console.log('📋 Playlists disponibles:', playlists);
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    wrapper.style.gap = '10px';
    wrapper.style.maxHeight = '400px';
    wrapper.style.overflowY = 'auto';
    wrapper.style.marginBottom = '15px';

    playlists.forEach(pl => {
        const card = document.createElement('div');
        card.style.border = '2px solid transparent';
        card.style.borderRadius = '10px';
        card.style.background = '#2a2a50';
        card.style.padding = '5px';
        card.style.cursor = 'pointer';
        card.style.textAlign = 'center';
        card.style.transition = '0.2s';

        const img = document.createElement('img');
        img.src = pl.image;
        img.style.width = '100%';
        img.style.borderRadius = '8px';

        const title = document.createElement('div');
        title.innerText = pl.name;
        title.style.fontSize = '0.9rem';
        title.style.marginTop = '5px';
        title.style.color = '#f0f0ff';

        card.appendChild(img);
        card.appendChild(title);
        wrapper.appendChild(card);

        card.onclick = () => {
            if (selected.has(pl.id)) {
                selected.delete(pl.id);
                card.style.borderColor = 'transparent';
                card.style.background = '#2a2a50';
            } else {
                selected.add(pl.id);
                card.style.borderColor = '#7e57c2';
                card.style.background = '#3a3a70';
            }
        };
    });

    showModal({
        title: 'Choisis tes playlists',
        content: wrapper,
        onConfirm: () => {
            const chosen = playlists.filter(pl => selected.has(pl.id));
            if (typeof onConfirm === 'function') onConfirm(chosen);
        },
        disablecancel: true
    });
}

function ShowOptionsModal(Devices=[], onConfirm) {
    // Utiliser la fonction utilitaire sécurisée pour récupérer les options
    let userOptions;
    if (typeof utils !== 'undefined' && utils.getUserOptions) {
        userOptions = utils.getUserOptions();
    } else {
        // Fallback sécurisé si utils n'est pas disponible
        console.warn('⚠️ utils.getUserOptions non disponible, utilisation du fallback');
        try {
            const stored = localStorage.getItem('userOptions');
            userOptions = stored ? JSON.parse(stored).Optionlist || {} : {};
        } catch (error) {
            console.warn('⚠️ Erreur lors du parsing des options:', error);
            userOptions = {};
        }
    }
    
    console.log('🔧 Chargement des options utilisateur:', userOptions);
    
    // Valeurs par défaut si les options ne sont pas définies
    let SongTime = userOptions.SongTime || 10; // seconds
    let PlayingDevice = null;
    let RandomSong = userOptions.RandomSong !== undefined ? userOptions.RandomSong : true;
    let PlaylistMaxSongs = userOptions.PlaylistMaxSongs || userOptions.MaxPlaylistSongs || 100;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '15px';

    // Temps d'écoute
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

    // Nombre maximum de chansons dans la playlist
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

    // Choix du périphérique
    const deviceContainer = document.createElement('div');
    const deviceLabel = document.createElement('label');
    deviceLabel.innerText = 'Périphérique de lecture :';
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
        console.log('Device option added:', dev.name);
        console.log('Current Playing Device:', dev.id);

    });

    deviceContainer.appendChild(deviceLabel);
    deviceContainer.appendChild(deviceSelect);

    // Lecture aléatoire
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

    // Ajouter tout dans le wrapper
    wrapper.appendChild(playlistContainer);
    wrapper.appendChild(timeContainer);
    wrapper.appendChild(deviceContainer);
    wrapper.appendChild(randomContainer);

    // Afficher la modal avec les boutons
    showModal({
        title: 'Options',
        content: wrapper,
        onConfirm: () => {
            SongTime = parseInt(songTimeInput.value) ;
            const selectedId = deviceSelect.value;
            PlayingDevice = Devices.find(dev => dev.id === selectedId) || null;
            RandomSong = randomToggle.checked;
            PlaylistMaxSongs = parseInt(playlistInput.value) || 10;
            if (typeof onConfirm === 'function') onConfirm({
                Optionlist: {
                    SongTime,
                    PlayingDevice,
                    RandomSong,
                    PlaylistMaxSongs
                }
            });
        }
    });
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
    modal.style.background = 'var(--panel, #1a1a2e)';
    modal.style.borderRadius = '15px';
    modal.style.padding = '30px';
    modal.style.minWidth = '350px';
    modal.style.maxWidth = '90vw';
    modal.style.color = 'var(--text, #ffffff)';
    modal.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'center';
    modal.style.border = '2px solid var(--soft, #4a4a6a)';

    // Titre
    const title = document.createElement('h2');
    title.style.marginBottom = '20px';
    title.style.color = 'var(--text, #ffffff)';
    title.style.fontSize = '1.5rem';
    title.innerHTML = '🎵 Spotify Blind Test';
    modal.appendChild(title);

    // Message principal
    const messageEl = document.createElement('div');
    messageEl.id = 'loading-message';
    messageEl.style.fontSize = '1.1rem';
    messageEl.style.marginBottom = '25px';
    messageEl.style.color = 'var(--text-secondary, #cccccc)';
    messageEl.textContent = message;
    modal.appendChild(messageEl);

    // Spinner animé
    const spinner = document.createElement('div');
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '4px solid rgba(255, 255, 255, 0.1)';
    spinner.style.borderTop = '4px solid var(--soft, #4a4a6a)';
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

