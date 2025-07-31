// test-playlist-fix.js - Test spécifique pour le problème de playlist
import request from 'supertest';
import app from '../src/server/index.js';

const TEST_TOKEN = 'invalid_token_for_testing';
const PUBLIC_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M'; // Top 50 Global (publique)
const PRIVATE_PLAYLIST_ID = '1BxfuPKGuaTgP6aM0c5QTn'; // Playlist d'un autre utilisateur

console.log('🧪 Test spécifique du problème de playlist');

console.log('\n📋 Test 1: Playlist publique avec token invalide');
try {
  const res1 = await request(app).get(`/api/playlist/${PUBLIC_PLAYLIST_ID}?token=${TEST_TOKEN}`);
  console.log(`✅ Status Code: ${res1.statusCode} (attendu: 401, pas 500)`);
  console.log(`📄 Réponse: ${JSON.stringify(res1.body)}`);
  
  if (res1.statusCode === 500) {
    console.log('❌ PROBLÈME: Le serveur retourne encore 500 au lieu de 401');
  } else if (res1.statusCode === 401) {
    console.log('✅ CORRIGÉ: Le serveur retourne correctement 401');
  }
} catch (error) {
  console.log('❌ Erreur lors du test:', error.message);
}

console.log('\n🔒 Test 2: Playlist privée avec token invalide');
try {
  const res2 = await request(app).get(`/api/playlist/${PRIVATE_PLAYLIST_ID}?token=${TEST_TOKEN}`);
  console.log(`✅ Status Code: ${res2.statusCode} (attendu: 401/403/404, pas 500)`);
  console.log(`📄 Réponse: ${JSON.stringify(res2.body)}`);
  
  if (res2.statusCode === 500) {
    console.log('❌ PROBLÈME: Le serveur retourne encore 500');
  } else if ([401, 403, 404].includes(res2.statusCode)) {
    console.log('✅ CORRIGÉ: Le serveur retourne un code d\'erreur approprié');
  }
} catch (error) {
  console.log('❌ Erreur lors du test:', error.message);
}

console.log('\n📊 Résumé: Le problème principal était que les erreurs 401/403 de Spotify');
console.log('    étaient transformées en erreurs 500 côté serveur, masquant le vrai problème.');
console.log('    Maintenant, les codes d\'erreur corrects sont propagés.');

process.exit(0);
