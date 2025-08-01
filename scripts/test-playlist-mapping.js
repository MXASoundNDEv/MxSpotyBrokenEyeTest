/**
 * Test pour vérifier la correction de l'erreur "Cannot read properties of null (reading '0')"
 * Ce script simule différents scénarios de données Spotify problématiques
 */

console.log('🧪 Test de robustesse pour le mapping des playlists\n');

// Simulation des données Spotify problématiques
const testData = {
    // Cas 1: Playlist avec images null
    playlistWithNullImages: {
        id: 'test1',
        name: 'Playlist avec images null',
        images: null
    },
    
    // Cas 2: Playlist avec images undefined
    playlistWithUndefinedImages: {
        id: 'test2',
        name: 'Playlist avec images undefined',
        images: undefined
    },
    
    // Cas 3: Playlist avec tableau images vide
    playlistWithEmptyImages: {
        id: 'test3',
        name: 'Playlist avec images vides',
        images: []
    },
    
    // Cas 4: Playlist avec images valides
    playlistWithValidImages: {
        id: 'test4',
        name: 'Playlist avec images valides',
        images: [
            { url: 'https://example.com/image1.jpg' },
            { url: 'https://example.com/image2.jpg' }
        ]
    },
    
    // Cas 5: Playlist incomplète (sans id ou nom)
    playlistIncomplete: {
        name: 'Playlist sans ID',
        images: [{ url: 'https://example.com/image.jpg' }]
    },
    
    // Cas 6: Playlist null/undefined
    playlistNull: null,
    playlistUndefined: undefined
};

// Fonction de mapping sécurisée (notre correction)
function mapPlaylistSafely(p) {
    if (!p || !p.id || !p.name) {
        return null; // Sera filtré
    }
    
    return {
        id: p.id,
        name: p.name,
        image: (p.images && Array.isArray(p.images) && p.images.length > 0) ? p.images[0].url : null
    };
}

// Fonction de mapping dangereuse (ancienne version)
function mapPlaylistUnsafely(p) {
    return {
        id: p.id,
        name: p.name,
        image: p.images[0]?.url || null // ❌ ERREUR: p.images peut être null
    };
}

// Tests
function runTests() {
    const testCases = Object.values(testData);
    
    console.log('📋 Test de la fonction sécurisée:');
    testCases.forEach((playlist, index) => {
        try {
            const result = mapPlaylistSafely(playlist);
            console.log(`  ✅ Test ${index + 1}: ${result ? `${result.name} (image: ${result.image ? 'OUI' : 'NON'})` : 'FILTRÉ'}`);
        } catch (error) {
            console.log(`  ❌ Test ${index + 1}: ERREUR - ${error.message}`);
        }
    });
    
    console.log('\n📋 Test de la fonction dangereuse (pour comparaison):');
    testCases.forEach((playlist, index) => {
        try {
            const result = mapPlaylistUnsafely(playlist);
            console.log(`  ✅ Test ${index + 1}: ${result.name} (image: ${result.image ? 'OUI' : 'NON'})`);
        } catch (error) {
            console.log(`  ❌ Test ${index + 1}: ERREUR - ${error.message}`);
        }
    });
}

// Test de la logique complète
function testCompleteLogic() {
    console.log('\n🔄 Test de la logique complète avec filtre:');
    
    const mockSpotifyResponse = {
        items: Object.values(testData)
    };
    
    // Simulation de notre logique serveur corrigée
    if (!mockSpotifyResponse.items || !Array.isArray(mockSpotifyResponse.items)) {
        console.log('⚠️ Aucune playlist trouvée ou format inattendu');
        return [];
    }
    
    const playlists = mockSpotifyResponse.items
        .filter(p => p && p.id && p.name) // Filtrer les playlists invalides
        .map(p => ({
            id: p.id,
            name: p.name,
            image: (p.images && Array.isArray(p.images) && p.images.length > 0) ? p.images[0].url : null
        }));
    
    console.log(`📊 Résultat: ${playlists.length} playlists valides sur ${mockSpotifyResponse.items.length} total`);
    playlists.forEach((playlist, index) => {
        console.log(`  ${index + 1}. ${playlist.name} ${playlist.image ? '🖼️' : '📄'}`);
    });
    
    return playlists;
}

// Exécuter tous les tests
runTests();
testCompleteLogic();

console.log('\n✅ Tests terminés - La correction devrait résoudre l\'erreur "Cannot read properties of null"');

// Export pour utilisation dans d'autres contextes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mapPlaylistSafely, testData, testCompleteLogic };
}
