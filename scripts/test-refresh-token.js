/**
 * Script de test pour la fonctionnalité de rafraîchissement du token
 */

console.log('🧪 Test de la fonctionnalité de rafraîchissement du token');

// Test 1: Vérification de la route refresh-token
async function testRefreshTokenRoute() {
    console.log('\n📋 Test 1: Route /api/refresh-token');
    
    try {
        const response = await fetch('http://localhost:3000/api/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: 'test_token' })
        });
        
        if (response.status === 400) {
            console.log('✅ Route accessible - erreur attendue pour token invalide');
        } else {
            console.log('📊 Status:', response.status);
            const data = await response.json();
            console.log('📊 Response:', data);
        }
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
    }
}

// Test 2: Vérification de la route playlists avec un token invalide
async function testPlaylistsWithInvalidToken() {
    console.log('\n📋 Test 2: Route /api/me/playlists avec token invalide');
    
    try {
        const response = await fetch('http://localhost:3000/api/me/playlists?token=invalid_token');
        
        console.log('📊 Status:', response.status);
        const data = await response.json();
        console.log('📊 Response:', data);
        
        if (response.status === 401 && data.needsReauth) {
            console.log('✅ Gestion d\'erreur token invalide fonctionnelle');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
    }
}

// Test 3: Vérification de la route playlists sans token
async function testPlaylistsWithoutToken() {
    console.log('\n📋 Test 3: Route /api/me/playlists sans token');
    
    try {
        const response = await fetch('http://localhost:3000/api/me/playlists');
        
        console.log('📊 Status:', response.status);
        const data = await response.json();
        console.log('📊 Response:', data);
        
        if (response.status === 400 && data.error === 'Token requis') {
            console.log('✅ Validation token manquant fonctionnelle');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
    }
}

// Exécuter tous les tests
async function runAllTests() {
    console.log('🚀 Début des tests...\n');
    
    await testRefreshTokenRoute();
    await testPlaylistsWithInvalidToken();
    await testPlaylistsWithoutToken();
    
    console.log('\n✅ Tests terminés');
}

// Vérifier si nous sommes dans Node.js ou dans le navigateur
if (typeof window === 'undefined') {
    // Node.js - utiliser dynamic import pour fetch
    import('node-fetch').then(({ default: fetch }) => {
        globalThis.fetch = fetch;
        runAllTests();
    }).catch(() => {
        console.log('⚠️ node-fetch non disponible, utilisez ce script dans le navigateur');
    });
} else {
    // Navigateur
    runAllTests();
}
