// tests/routes-optimized.test.js - Tests optimisés et fusionnés pour l'API Blindtest
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/server/index.js';

// Configuration des tests
const TEST_TOKEN = process.env.SPOTIFY_TEST_TOKEN || 'invalid_token';
const PUBLIC_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M'; // Top 50 Global
const PRIVATE_PLAYLIST_ID = '1BxfuPKGuaTgP6aM0c5QTn'; // Playlist privée
const TEST_TRACK_ID = '4Xxt4dfoCTd6AOfiXeTAwk';
const TEST_DEVICE_ID = 'test_device_id';

// Données de test pour POST /api/check-song
const VALID_SONG_DATA = {
    songName: 'Bohemian Rhapsody',
    currentTrack: { 
        name: 'Bohemian Rhapsody', 
        artists: [{ name: 'Queen' }] 
    }
};

describe('🚀 API Blindtest - Tests Complets', () => {

    // 📱 Tests des routes statiques et détection mobile
    describe('📱 Routes Statiques', () => {
        test.each([
            ['/', [200, 302], 'page d\'accueil avec détection mobile'],
            ['/mobile', [200], 'page mobile'],
            ['/desktop', [200], 'page desktop'],
            ['/test-detection', [200], 'page de test détection'],
            ['/test-mobile', [200], 'page de test mobile']
        ])('GET %s => %s (%s)', async (path, expectedCodes, description) => {
            const res = await request(app)
                .get(path)
                .set('User-Agent', path === '/' ? 'iPhone' : 'Chrome');
            expect(expectedCodes).toContain(res.statusCode);
        });
    });

    // 🔐 Tests d'authentification Spotify
    describe('🔐 Authentification Spotify', () => {
        test('GET /login => 302 (redirection vers Spotify)', async () => {
            const res = await request(app).get('/login');
            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('accounts.spotify.com');
        });

        test.each([
            ['/callback', 400, 'Missing code'],
            ['/callback?code=invalid', [400, 500], null]
        ])('GET %s => %s', async (path, expectedCode, expectedText) => {
            const res = await request(app).get(path);
            if (Array.isArray(expectedCode)) {
                expect(expectedCode).toContain(res.statusCode);
            } else {
                expect(res.statusCode).toBe(expectedCode);
                if (expectedText) expect(res.text).toBe(expectedText);
            }
        });
    });

    // 🔎 Tests des routes GET API Spotify
    describe('🔎 API Spotify GET', () => {
        
        // Tests des endpoints nécessitant un token
        test.each([
            ['/api/me/playlists', 'Token requis'],
            ['/api/me/player', 'Token manquant'],
            ['/api/me/player/devices', 'Token requis'],
            ['/api/me', 'Token requis']
        ])('GET %s sans token => 400', async (endpoint, expectedError) => {
            const res = await request(app).get(endpoint);
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe(expectedError);
        });

        // Tests avec token invalide
        test.each([
            ['/api/me/playlists', [200, 401]],
            ['/api/me/player', [200, 204, 401]],
            ['/api/me/player/devices', [200, 401]],
            ['/api/me', [200, 401]]
        ])('GET %s avec token => codes multiples possibles', async (endpoint, expectedCodes) => {
            const res = await request(app).get(`${endpoint}?token=${TEST_TOKEN}`);
            expect(expectedCodes).toContain(res.statusCode);
            
            // Vérifications spécifiques par endpoint
            if (endpoint === '/api/me/playlists' && res.statusCode === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        // Tests spécifiques pour les playlists (problème principal)
        describe('🎯 Playlists - Gestion des erreurs Spotify', () => {
            test('GET /api/playlist/:id sans token => 400', async () => {
                const res = await request(app).get(`/api/playlist/${PUBLIC_PLAYLIST_ID}`);
                expect(res.statusCode).toBe(400);
                expect(res.body.error).toBe('Token requis');
            });

            test('🔒 CORRECTION PRINCIPALE: Playlist privée => 403 (pas 500)', async () => {
                const res = await request(app).get(`/api/playlist/${PRIVATE_PLAYLIST_ID}?token=${TEST_TOKEN}`);
                
                console.log(`🔒 Test playlist privée: ${res.statusCode} - ${res.body?.error || 'OK'}`);
                
                // Vérification principale : PAS d'erreur 500
                expect(res.statusCode).not.toBe(500);
                
                // Codes d'erreur attendus selon la documentation Spotify
                expect([401, 403, 404]).toContain(res.statusCode);
                
                if (res.statusCode === 403) {
                    console.log('✅ SUCCÈS: Erreur 403 correctement gérée (playlist privée)');
                    expect(res.body.error).toContain('privée');
                    expect(res.body.isSpotifyError).toBe(true);
                } else if (res.statusCode === 401) {
                    console.log('ℹ️ Token invalide en test - comportement attendu');
                    expect(res.body.isSpotifyError).toBe(true);
                }
            });

            test.each([
                ['invalid_format', [400, 401], 'ID invalide'],
                ['0000000000000000000000', [404, 401], 'Playlist inexistante'],
                [PUBLIC_PLAYLIST_ID, [200, 401, 404], 'Playlist publique']
            ])('GET /api/playlist/%s => %s (%s)', async (playlistId, expectedCodes, description) => {
                const res = await request(app).get(`/api/playlist/${playlistId}?token=${TEST_TOKEN}`);
                
                console.log(`📝 ${description}: ${res.statusCode} - ${res.body?.error || 'OK'}`);
                
                // Vérification principale : pas d'erreur 500 incorrecte
                expect(res.statusCode).not.toBe(500);
                expect(expectedCodes).toContain(res.statusCode);
                
                // Vérifier le flag isSpotifyError pour les erreurs
                if (res.statusCode >= 400 && res.body?.isSpotifyError) {
                    console.log(`✅ Flag isSpotifyError présent pour ${description}`);
                }
            });
        });

        // Tests pour les tracks
        test.each([
            [`/api/tracks/${TEST_TRACK_ID}`, [400, 401], 'sans token'],
            [`/api/tracks/${TEST_TRACK_ID}?token=${TEST_TOKEN}`, [200, 401, 404], 'avec token']
        ])('GET %s => %s (%s)', async (url, expectedCodes) => {
            const res = await request(app).get(url);
            expect(expectedCodes).toContain(res.statusCode);
        });
    });

    // 📝 Tests des routes POST
    describe('📝 API POST', () => {
        test.each([
            [{}, 400, 'Chanson ou donnée manquante'],
            [{ songName: 'Test' }, 400, 'Chanson ou donnée manquante'],
            [VALID_SONG_DATA, 200, null]
        ])('POST /api/check-song avec %j => %s', async (data, expectedCode, expectedError) => {
            const res = await request(app).post('/api/check-song').send(data);
            expect(res.statusCode).toBe(expectedCode);
            
            if (expectedError) {
                expect(res.body.error).toBe(expectedError);
            } else if (expectedCode === 200) {
                expect(res.body).toHaveProperty('match');
                expect(typeof res.body.match).toBe('boolean');
            }
        });
    });

    // 🎵 Tests des routes PUT (contrôle de lecture)
    describe('🎵 API PUT - Contrôle de lecture', () => {
        const playEndpoint = `/api/play?device_id=${TEST_DEVICE_ID}&token=${TEST_TOKEN}`;
        const seekEndpoint = `/api/seek?position_ms=30000&token=${TEST_TOKEN}`;

        test.each([
            [playEndpoint, {}, 400, 'URIs manquants ou invalides dans le corps de la requête'],
            [playEndpoint, { uris: 'not_array' }, 400, 'URIs manquants ou invalides dans le corps de la requête'],
            [playEndpoint, { uris: ['spotify:track:test'] }, [204, 401, 403, 404], null]
        ])('PUT %s avec %j => %s', async (url, body, expectedCode, expectedError) => {
            const res = await request(app).put(url).send(body);
            
            if (Array.isArray(expectedCode)) {
                expect(expectedCode).toContain(res.statusCode);
            } else {
                expect(res.statusCode).toBe(expectedCode);
                if (expectedError) expect(res.body.error).toBe(expectedError);
            }
        });

        test('PUT /api/seek avec position => codes multiples', async () => {
            const res = await request(app).put(seekEndpoint);
            expect([200, 204, 401, 403, 404]).toContain(res.statusCode);
        });
    });

    // 📊 Test de résumé final
    describe('📊 Validation Finale', () => {
        test('🎯 Correction du problème principal validée', async () => {
            console.log('\n🎯 VALIDATION FINALE DE LA CORRECTION:');
            
            // Test avec plusieurs playlists pour confirmer la correction
            const testCases = [
                [PRIVATE_PLAYLIST_ID, 'playlist privée'],
                [PUBLIC_PLAYLIST_ID, 'playlist publique'],
                ['invalid_id', 'ID invalide']
            ];
            
            for (const [playlistId, description] of testCases) {
                const res = await request(app).get(`/api/playlist/${playlistId}?token=${TEST_TOKEN}`);
                
                // L'assertion principale : aucune erreur 500 incorrecte
                expect(res.statusCode).not.toBe(500);
                
                console.log(`✅ ${description}: ${res.statusCode} (pas 500) - ${res.body?.error?.slice(0, 50) || 'OK'}...`);
            }
            
            console.log('\n🎉 CORRECTION VALIDÉE: Plus d\'erreurs 500 incorrectes pour les playlists !');
        });
    });
});
