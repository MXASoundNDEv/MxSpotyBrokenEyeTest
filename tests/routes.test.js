// test/get_routes.test.js
import request from 'supertest';
import app from '../server/index.js';

const TEST_TOKEN = process.env.SPOTIFY_TEST_TOKEN || 'invalid_token';
const TEST_PLAYLIST_ID = '0SlNXJQl40w7hxVjNj9yib';
const TEST_TRACK_ID = '4Xxt4dfoCTd6AOfiXeTAwk';

// Test suite for Spotify API routes
describe('🔎 GET Routes Spotify API', () => {

    test('GET /api/me/playlists - sans token => 400', async () => {
        const res = await request(app).get('/api/me/playlists');
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Token requis');
    });

    test('GET /api/me/playlists - avec token => 200 ou 401', async () => {
        const res = await request(app).get(`/api/me/playlists?token=${TEST_TOKEN}`);
        expect([200, 401]).toContain(res.statusCode);
    });

    test('GET /api/playlist/:id - sans token => 400', async () => {
        const res = await request(app).get(`/api/playlist/${TEST_PLAYLIST_ID}`);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Token requis');
    });

    test('GET /api/playlist/:id - avec token => 200 ou 401', async () => {
        const res = await request(app).get(`/api/playlist/${TEST_PLAYLIST_ID}?token=${TEST_TOKEN}`);
        expect([200, 401, 404]).toContain(res.statusCode);
    });

    test('GET /api/me/player - sans token => 400', async () => {
        const res = await request(app).get('/api/me/player');
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Token manquant');
    });

    test('GET /api/me/player - avec token => 200/204/401', async () => {
        const res = await request(app).get(`/api/me/player?token=${TEST_TOKEN}`);
        expect([200, 204, 401]).toContain(res.statusCode);
    });

    test('GET /api/tracks/:id - avec token => 200/401/404', async () => {
        const res = await request(app).get(`/api/tracks/${TEST_TRACK_ID}?token=${TEST_TOKEN}`);
        expect([200, 401, 404]).toContain(res.statusCode);
    });
});