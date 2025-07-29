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
        if (!songName) {
            // currentDisplay.innerText = '🔍 Tapez le nom de la chanson...';
            return;
        }

        const currentTrack = await getCurrentTrack();
        if (!currentTrack) {
            // currentDisplay.innerText = '❌ Aucune chanson en cours de lecture';
            return;
        }

        console.log('🎵 check Chanson actuelle :', checkSongMatch(songName, currentTrack));
        if (checkSongMatch(songName, currentTrack)) {
            // currentDisplay.innerText = `✅ Correct ! La chanson est : ${currentTrack.name}`;\
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
            // currentDisplay.innerText = `❌ Incorrect ! Essayez encore...`;
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
