// tests-complets-finaux.js - Tests finaux pour toutes les routes avec corrections
import request from 'supertest';
import app from '../src/server/index.js';

// Configuration des tests
const TEST_TOKEN = process.env.SPOTIFY_TEST_TOKEN || 'invalid_token';
const REAL_TOKEN = process.env.SPOTIFY_REAL_TOKEN; // Token réel pour tests avancés
const PUBLIC_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M'; // Top 50 Global (publique)
const PRIVATE_PLAYLIST_ID = '1BxfuPKGuaTgP6aM0c5QTn'; // Playlist d'un autre utilisateur
const TEST_TRACK_ID = '4Xxt4dfoCTd6AOfiXeTAwk';

let tests = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests++;
  console.log(`\n🧪 Test: ${name}`);
  
  return fn()
    .then(() => {
      passed++;
      console.log(`✅ PASS: ${name}`);
    })
    .catch(error => {
      failed++;
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Erreur: ${error.message}`);
    });
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toContain: (expectedArray) => {
      if (!expectedArray.includes(actual)) {
        throw new Error(`Expected [${expectedArray}] to contain ${actual}`);
      }
    },
    toHaveProperty: (prop) => {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property ${prop}`);
      }
    }
  };
}

console.log('🚀 TESTS COMPLETS FINAUX - TOUTES LES ROUTES DE L\'API BLINDTEST');
console.log('================================================================');

// 📱 Tests des routes statiques
console.log('\n📱 ==> ROUTES STATIQUES ET DÉTECTION MOBILE');

await test('GET / - page d\'accueil avec détection mobile', async () => {
  const res = await request(app).get('/');
  expect([200, 302]).toContain(res.statusCode);
});

await test('GET /mobile - page mobile', async () => {
  const res = await request(app).get('/mobile');
  expect(res.statusCode).toBe(200);
});

await test('GET /desktop - page desktop', async () => {
  const res = await request(app).get('/desktop');
  expect(res.statusCode).toBe(200);
});

await test('GET /test-detection - page de test de détection', async () => {
  const res = await request(app).get('/test-detection');
  expect(res.statusCode).toBe(200);
});

await test('GET /test-mobile - page de test mobile', async () => {
  const res = await request(app).get('/test-mobile');
  expect(res.statusCode).toBe(200);
});

// 🔐 Tests d'authentification Spotify
console.log('\n🔐 ==> AUTHENTIFICATION SPOTIFY');

await test('GET /login - redirection vers Spotify OAuth', async () => {
  const res = await request(app).get('/login');
  expect(res.statusCode).toBe(302);
  // Vérifier que la redirection contient l'URL Spotify
  if (!res.headers.location.includes('accounts.spotify.com')) {
    throw new Error('La redirection ne pointe pas vers Spotify');
  }
});

await test('GET /callback - sans code => 400', async () => {
  const res = await request(app).get('/callback');
  expect(res.statusCode).toBe(400);
});

// 🔎 Tests des routes GET de l'API Spotify
console.log('\n🔎 ==> ROUTES GET API SPOTIFY');

await test('GET /api/me/playlists - sans token => 400', async () => {
  const res = await request(app).get('/api/me/playlists');
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('Token requis');
});

await test('GET /api/me/playlists - avec token invalide => 401', async () => {
  const res = await request(app).get(`/api/me/playlists?token=invalid_token`);
  expect([401]).toContain(res.statusCode);
});

// 🎯 Tests spécifiques pour le PROBLÈME CORRIGÉ des playlists
console.log('\n🎯 ==> PROBLÈME CORRIGÉ: GESTION DES PLAYLISTS D\'AUTRES UTILISATEURS');

await test('GET /api/playlist/:id - sans token => 400', async () => {
  const res = await request(app).get(`/api/playlist/${PUBLIC_PLAYLIST_ID}`);
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('Token requis');
});

await test('GET /api/playlist/:id - token invalide => 401 (PAS 500)', async () => {
  const res = await request(app).get(`/api/playlist/${PUBLIC_PLAYLIST_ID}?token=invalid_token`);
  console.log(`   📊 Status reçu: ${res.statusCode}`);
  console.log(`   📄 Message: ${res.body?.error || 'N/A'}`);
  
  // CORRECTION: Maintenant le serveur retourne 401 au lieu de 500
  expect(res.statusCode).toBe(401);
  
  if (res.statusCode === 500) {
    throw new Error('❌ RÉGRESSION: Le serveur retourne encore 500 au lieu de 401');
  }
});

await test('GET /api/playlist/:id - playlist d\'autre utilisateur avec token invalide', async () => {
  const res = await request(app).get(`/api/playlist/${PRIVATE_PLAYLIST_ID}?token=invalid_token`);
  console.log(`   📊 Status reçu: ${res.statusCode}`);
  console.log(`   📄 Message: ${res.body?.error || 'N/A'}`);
  
  // CORRECTION: Maintenant le serveur retourne 401 au lieu de 500
  expect([401, 403, 404]).toContain(res.statusCode);
  
  if (res.statusCode === 500) {
    throw new Error('❌ RÉGRESSION: Le serveur retourne encore 500');
  }
});

// Tests avec vrai token si disponible
if (REAL_TOKEN && REAL_TOKEN !== 'undefined') {
  console.log('\n🔑 ==> TESTS AVEC VRAI TOKEN SPOTIFY');
  
  await test('GET /api/me/playlists - avec vrai token => 200', async () => {
    const res = await request(app).get(`/api/me/playlists?token=${REAL_TOKEN}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  
  await test('GET /api/playlist/:id - playlist publique avec vrai token', async () => {
    const res = await request(app).get(`/api/playlist/${PUBLIC_PLAYLIST_ID}?token=${REAL_TOKEN}`);
    expect([200, 404]).toContain(res.statusCode);
  });
  
  await test('GET /api/playlist/:id - playlist privée autre utilisateur avec vrai token => 403', async () => {
    const res = await request(app).get(`/api/playlist/${PRIVATE_PLAYLIST_ID}?token=${REAL_TOKEN}`);
    console.log(`   📊 Status reçu: ${res.statusCode}`);
    
    // Avec un vrai token, on devrait obtenir 403 pour une playlist privée d'un autre utilisateur
    expect([403, 404]).toContain(res.statusCode);
    
    if (res.statusCode === 403) {
      console.log(`   ✅ Parfait: 403 Forbidden pour playlist privée d'autre utilisateur`);
    }
  });
} else {
  console.log('\n⚠️  Pas de vrai token Spotify - tests avancés ignorés');
  console.log('   Pour tester avec un vrai token: export SPOTIFY_REAL_TOKEN=your_token');
}

// Tests des autres routes API
await test('GET /api/me/player - sans token => 400', async () => {
  const res = await request(app).get('/api/me/player');
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('Token manquant');
});

await test('GET /api/tracks/:id - avec token invalide', async () => {
  const res = await request(app).get(`/api/tracks/${TEST_TRACK_ID}?token=invalid_token`);
  expect([401, 404]).toContain(res.statusCode);
});

await test('GET /api/me/player/devices - sans token => 400', async () => {
  const res = await request(app).get('/api/me/player/devices');
  expect(res.statusCode).toBe(400);
});

await test('GET /api/me - sans token => 400', async () => {
  const res = await request(app).get('/api/me');
  expect(res.statusCode).toBe(400);
});

// 📝 Tests des routes POST
console.log('\n📝 ==> ROUTES POST API');

await test('POST /api/check-song - données manquantes => 400', async () => {
  const res = await request(app).post('/api/check-song').send({});
  expect(res.statusCode).toBe(400);
});

await test('POST /api/check-song - données complètes => 200', async () => {
  const res = await request(app)
    .post('/api/check-song')
    .send({
      songName: 'Bohemian Rhapsody',
      currentTrack: { 
        name: 'Bohemian Rhapsody', 
        artists: [{ name: 'Queen' }] 
      }
    });
  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('match');
});

// 🎵 Tests des routes PUT
console.log('\n🎵 ==> ROUTES PUT API (CONTRÔLE LECTURE)');

await test('PUT /api/play - URIs manquants => 400', async () => {
  const res = await request(app)
    .put(`/api/play?device_id=test&token=invalid_token`)
    .send({});
  expect(res.statusCode).toBe(400);
});

await test('PUT /api/seek - avec paramètres', async () => {
  const res = await request(app)
    .put(`/api/seek?position_ms=30000&token=invalid_token`);
  expect([401, 403, 404]).toContain(res.statusCode);
});

// 📊 Résumé final
console.log('\n📊 ==> RÉSUMÉ FINAL DES TESTS');
console.log('========================================');
console.log(`Total des tests: ${tests}`);
console.log(`✅ Réussis: ${passed}`);
console.log(`❌ Échoués: ${failed}`);
console.log(`📈 Taux de réussite: ${Math.round(passed/tests*100)}%`);

console.log('\n🎯 ==> PROBLÈME PRINCIPAL IDENTIFIÉ ET CORRIGÉ:');
console.log('   ❌ AVANT: Erreurs 401/403 de Spotify transformées en 500');
console.log('   ✅ APRÈS: Codes d\'erreur corrects propagés (401/403/404)');
console.log('   📍 CAUSE: Mauvaise gestion d\'erreur dans getPlaylistTracks()');
console.log('   🔧 SOLUTION: Propagation des codes de statut Spotify');

console.log('\n💡 ==> AMÉLIORATION APPORTÉE:');
console.log('   • Meilleure gestion d\'erreur pour les playlists privées');
console.log('   • Messages d\'erreur plus clairs');
console.log('   • Codes de statut HTTP appropriés');
console.log('   • Distinction entre playlist privée vs token invalide');

if (failed === 0) {
  console.log('\n🎉 TOUS LES TESTS SONT PASSÉS - API CORRIGÉE !');
  process.exit(0);
} else {
  console.log('\n⚠️  Certains tests ont échoué - vérifiez les détails ci-dessus');
  process.exit(1);
}
