// Spotify Debug Utilities
'use strict';

/**
 * Utilitaires de debug pour les problèmes Spotify
 */
window.SpotifyDebug = {
    
    /**
     * Affiche l'état actuel de l'authentification Spotify
     */
    checkAuth: () => {
        console.log('🔍 === DIAGNOSTIC SPOTIFY ===');
        
        // Vérifier les tokens
        const hashToken = new URLSearchParams(window.location.hash.slice(1)).get('access_token');
        const paramToken = new URLSearchParams(window.location.search).get('access_token');
        const localToken = localStorage.getItem('spotify_access_token');
        const sessionToken = sessionStorage.getItem('spotify_access_token');
        const tokenExpiry = localStorage.getItem('spotify_token_expiry');
        
        console.log('Hash Token:', hashToken ? '✅ Présent' : '❌ Absent');
        console.log('Param Token:', paramToken ? '✅ Présent' : '❌ Absent');
        console.log('Local Token:', localToken ? '✅ Présent' : '❌ Absent');
        console.log('Session Token:', sessionToken ? '✅ Présent' : '❌ Absent');
        
        if (tokenExpiry) {
            const expiry = new Date(parseInt(tokenExpiry));
            const now = new Date();
            const isExpired = now > expiry;
            console.log('Token Expiry:', expiry.toLocaleString());
            console.log('Status:', isExpired ? '❌ Expiré' : '✅ Valide');
            console.log('Temps restant:', isExpired ? 'Expiré' : Math.round((expiry - now) / 1000 / 60) + ' minutes');
        }
        
        // Vérifier l'état du player
        if (window.appState && window.appState.player) {
            console.log('Player:', window.appState.player ? '✅ Initialisé' : '❌ Non initialisé');
            console.log('Device ID:', window.appState.deviceId || '❌ Aucun');
        }
        
        console.log('🔍 === FIN DIAGNOSTIC ===');
    },
    
    /**
     * Nettoie tous les tokens Spotify
     */
    clearTokens: () => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expiry');
        sessionStorage.removeItem('spotify_access_token');
        console.log('🧹 Tous les tokens Spotify ont été supprimés');
    },
    
    /**
     * Force la reconnexion Spotify
     */
    forceReconnect: () => {
        SpotifyDebug.clearTokens();
        console.log('🔄 Redirection vers /login...');
        window.location.href = '/login';
    },
    
    /**
     * Teste la validité du token actuel
     */
    testToken: async () => {
        const token = localStorage.getItem('spotify_access_token');
        if (!token) {
            console.log('❌ Aucun token à tester');
            return false;
        }
        
        try {
            console.log('🔍 Test du token en cours...');
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Token valide pour:', data.display_name);
                console.log('👤 User ID:', data.id);
                console.log('🎵 Spotify Premium:', data.product === 'premium' ? 'Oui' : 'Non');
                return true;
            } else {
                console.log('❌ Token invalide:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur lors du test:', error);
            return false;
        }
    },
    
    /**
     * Affiche les informations de scope
     */
    checkScopes: () => {
        console.log('🔑 Scopes VALIDES pour Web Playback SDK:');
        console.log('- streaming ✅ (INCLUT Web Playback SDK)');
        console.log('- user-read-email ✅');
        console.log('- user-read-private ✅');
        console.log('- user-read-playback-state ✅');
        console.log('- user-modify-playback-state ✅');
        
        console.log('\n❌ Scopes INVALIDES (à éviter):');
        console.log('- web-playback ❌ (N\'EXISTE PAS!)');
        
        console.log('\n💡 Si vous avez des erreurs "Illegal scope":');
        console.log('1. Vérifiez que "web-playback" n\'est PAS dans la liste');
        console.log('2. Le scope "streaming" suffit pour Web Playback SDK');
        console.log('3. Reconnectez-vous pour obtenir les bonnes permissions');
        console.log('4. Utilisez SpotifyDebug.forceReconnect()');
    },
    
    /**
     * Guide de dépannage
     */
    troubleshoot: () => {
        console.log('🛠️ === GUIDE DE DÉPANNAGE ===');
        console.log('');
        console.log('Problème: Erreurs 401 Unauthorized');
        console.log('Solutions:');
        console.log('1. SpotifyDebug.checkAuth() - Vérifier l\'état');
        console.log('2. SpotifyDebug.testToken() - Tester le token');
        console.log('3. SpotifyDebug.forceReconnect() - Forcer reconnexion');
        console.log('');
        console.log('Problème: Web Playback SDK fails');
        console.log('Solutions:');
        console.log('1. SpotifyDebug.checkScopes() - Vérifier permissions');
        console.log('2. Vérifier Spotify Premium actif');
        console.log('3. Redémarrer le navigateur');
        console.log('');
        console.log('💡 Commandes utiles:');
        console.log('- window.testResponsive() - Test responsive');
        console.log('- SpotifyDebug.checkAuth() - Diagnostic complet');
        console.log('🛠️ === FIN GUIDE ===');
    }
};

// Auto-diagnostic au chargement si debug activé
if (localStorage.getItem('spotify_debug') === 'true') {
    setTimeout(() => {
        console.log('🔍 Debug Spotify activé - Diagnostic automatique:');
        SpotifyDebug.checkAuth();
    }, 2000);
}

// Message d'aide
console.log('🛠️ SpotifyDebug disponible! Tapez SpotifyDebug.troubleshoot() pour l\'aide');
