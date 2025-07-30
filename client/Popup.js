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



// showPopup({
//     text: "Chanson devinée avec succès !",
//     type: "success", // info, error, warn, success
//     position: "top-right", // top-left, top-right, bottom-left, bottom-right
//     duration: 4000, // en ms
//     needValidate: true,
//     onValidate: () => {
//         console.log("Validé !");
//     }
// });


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

function showPlaylistSelector(playlists = [], onConfirm) {
    const selected = new Set();

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

// showPlaylistSelector();
