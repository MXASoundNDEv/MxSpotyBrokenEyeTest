const songInput = document.getElementById('songName');
const OptionsDiv = document.getElementById('OptionsDivBtn');
const PlayerDiv = document.getElementById('PlayerDivBtn');
const AcceuilDiv = document.getElementById('AcceuilDivBtn');

function checkSongMatch(songName, currentSong) {
    if (!currentSong || !songName) return false;
    return isClose(songName, currentSong.name, 2) ||
        isClose(songName, currentSong.name.replace(/ - .*$/, ''), 2) ||
        isClose(songName, currentSong.name.replace(/ \(.+\)$/, ''), 2) ||
        isClose(songName, currentSong.name.replace(/ \[.+\]$/, ''), 2);
}

songInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        const songName = songInput.value.trim();
        console.log('🔍 Vérification de la chanson : %s', songName);
        if (!songName) return;

        const currentTrack = await getCurrentTrackData();
        if (!currentTrack) return;

        // Appel au serveur pour vérifier la correspondance
        const res = await fetch('/api/check-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songName, currentTrack })
        });

        const { match } = await res.json();

        if (match) {
            thumbnail.style.filter = 'none'; // Remove blur effect
            showPopup({
                text: `✅ Correct ! La chanson est : ${currentTrack.name}`,
                type: 'success',
                position: 'top-right',
                duration: 2500,
                needValidate: false,
                btnText: 'Next',
                onValidate: () => {
                    console.log("Next Track !");
                    songInput.value = '';
                    nextTrack();
                }
            });
        } else {
            showPopup({
                text: `❌ Incorrect ! Essayez encore...`,
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
    console.log('📝 Mise à jour du panneau de l\'historique des chansons', playlistHistory);
    const panel = document.querySelector('.left-panel');
    if (!panel) return;

    // Supprime tous les anciens éléments sauf le titre (h3)
    const oldItems = panel.querySelectorAll('.song-item');
    oldItems.forEach(el => el.remove());

    // Ajoute chaque chanson comme div
    playlistHistory.forEach(track => {
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerText = `🎵 ${track.title}`;
        panel.appendChild(item);
    });
}

function loadUserOptions() {
    const saved = localStorage.getItem('userOptions');
    if (!saved) return;

    try {
        const { SongTime: st, PlayingDeviceId, RandomSong: rs } = JSON.parse(saved);

        if (typeof st === 'number') SongTime = st;
        if (typeof rs === 'boolean') RandomSong = rs;
        if (Devices && Array.isArray(Devices) && PlayingDeviceId) {
            PlayingDevice = Devices.find(d => d.id === PlayingDeviceId) || null;
        }
    } catch (e) {
        console.error("Erreur de chargement des options utilisateur :", e);
    }
}

//Useless Apllication
function NotImplemented() {
    showPopup({
        text: 'Cette fonctionnalité n\'est pas encore implémentée.',
        type: 'warn',
        position: 'top-right',
        duration: 2000,
        needValidate: false
    });
}

OptionsDiv.addEventListener('click', () => {
    console.log('⚙️ Options clicked');
    ShowOptionsModal(Devices, options => {
        console.log('Options selected:', options);
        localStorage.setItem('userOptions', JSON.stringify(options));
    });
});
    
PlayerDiv.addEventListener('click', () => {NotImplemented();});
AcceuilDiv.addEventListener('click', () => {NotImplemented();});
