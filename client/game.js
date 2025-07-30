const songInput = document.getElementById('songName');

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
