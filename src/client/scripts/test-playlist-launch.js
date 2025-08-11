// Test rapide pour vérifier le lancement automatique des playlists
// À exécuter dans la console du navigateur après chargement de l'application

console.log('🧪 Test de lancement de playlist...');

// Attendre que Spotify soit prêt
function waitForSpotify() {
    return new Promise((resolve) => {
        const checkReady = () => {
            if (window.spotifyApp && window.spotifyApp.getAppState) {
                console.log('✅ SpotifyApp détecté');
                resolve();
            } else {
                console.log('⏳ Attente de SpotifyApp...');
                setTimeout(checkReady, 1000);
            }
        };
        checkReady();
    });
}

// Test principal
async function testPlaylistLaunch() {
    try {
        await waitForSpotify();
        
        const appState = window.spotifyApp.getAppState();
        console.log('📊 État de l\'application:', {
            tokenPresent: !!appState.token,
            playerReady: !!appState.player,
            deviceId: appState.deviceId,
            playlistLoaded: appState.playlist.length > 0,
            currentIndex: appState.currentIndex
        });
        
        // Test de récupération des playlists
        console.log('📋 Test de récupération des playlists...');
        const playlists = await window.spotifyApp.getUserPlaylists();
        console.log(`✅ ${playlists.length} playlists récupérées`);
        
        if (playlists.length > 0) {
            console.log('🎵 Test de chargement de la première playlist...');
            const firstPlaylist = playlists[0];
            console.log('Chargement de:', firstPlaylist.name);
            
            // Test du chargement
            await window.spotifyApp.loadPlaylist(firstPlaylist.id);
            
            // Vérifier si la track se lance
            setTimeout(() => {
                const newState = window.spotifyApp.getAppState();
                console.log('🔍 État après chargement:', {
                    playlistSize: newState.playlist.length,
                    currentIndex: newState.currentIndex,
                    firstTrack: newState.playlist[0]?.title || 'Non défini'
                });
                
                if (newState.playlist.length > 0) {
                    console.log('✅ Test réussi ! Playlist chargée et track prête');
                } else {
                    console.log('❌ Échec : Playlist vide après chargement');
                }
            }, 2000);
        } else {
            console.log('⚠️ Aucune playlist disponible pour le test');
        }
        
    } catch (error) {
        console.error('❌ Erreur dans le test:', error);
    }
}

// Lancer le test automatiquement
setTimeout(testPlaylistLaunch, 2000);

// Export pour usage manuel
window.testPlaylistLaunch = testPlaylistLaunch;
console.log('🛠️ Test disponible. Lancez manuellement avec: testPlaylistLaunch()');
