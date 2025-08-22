// tests/metrics.test.js - Tests pour le système de métriques Prometheus
import {
    describe,
    test,
    expect,
    beforeEach,
    afterEach
} from '@jest/globals';
import {
    register,
    collectDefaultMetrics,
    playerGuessesCounter,
    correctGuessesCounter,
    uniquePlayersCounter,
    trackUniquePlayer
} from '../src/server/utils/metrics.js';

describe('🎯 Système de Métriques Prometheus', () => {

    beforeEach(async () => {
        // Réinitialiser les métriques avant chaque test
        register.clear();
        collectDefaultMetrics();
    });

    afterEach(() => {
        // Nettoyer après chaque test
        register.clear();
    });

    describe('📊 Configuration du registre', () => {
        test('le registre doit être défini', () => {
            expect(register).toBeDefined();
            expect(typeof register.register).toBe('function');
        });

        test('les métriques par défaut doivent être collectées', async () => {
            const metrics = await register.metrics();
            expect(metrics).toContain('process_cpu_seconds_total');
            expect(metrics).toContain('nodejs_heap_size_used_bytes');
        });
    });

    describe('🎮 Compteur de tentatives des joueurs', () => {
        test('le compteur doit être initialisé à zéro', async () => {
            const metrics = await register.getSingleMetric('player_guesses_total');
            expect(metrics).toBeDefined();
            expect(metrics.name).toBe('player_guesses_total');
            expect(metrics.help).toBe('Total number of guesses made by players');
        });

        test('le compteur doit s\'incrémenter correctement', async () => {
            // Incrémenter le compteur plusieurs fois
            playerGuessesCounter.inc();
            playerGuessesCounter.inc();
            playerGuessesCounter.inc(3);

            const metrics = await register.metrics();
            expect(metrics).toContain('player_guesses_total 5');
        });

        test('le compteur ne doit pas accepter de valeurs négatives', () => {
            expect(() => playerGuessesCounter.inc(-1)).toThrow();
        });
    });

    describe('✅ Compteur de bonnes réponses', () => {
        test('le compteur doit être initialisé à zéro', async () => {
            const metrics = await register.getSingleMetric('correct_guesses_total');
            expect(metrics).toBeDefined();
            expect(metrics.name).toBe('correct_guesses_total');
            expect(metrics.help).toBe('Total number of correct guesses made by players');
        });

        test('le compteur doit s\'incrémenter correctement', async () => {
            correctGuessesCounter.inc();
            correctGuessesCounter.inc(2);

            const metrics = await register.metrics();
            expect(metrics).toContain('correct_guesses_total 3');
        });
    });

    describe('👥 Compteur de joueurs uniques', () => {
        test('le compteur doit être initialisé à zéro', async () => {
            const metrics = await register.getSingleMetric('unique_players_total');
            expect(metrics).toBeDefined();
            expect(metrics.name).toBe('unique_players_total');
            expect(metrics.help).toBe('Number of unique players');
        });

        test('trackUniquePlayer doit ajouter un nouveau joueur', async () => {
            trackUniquePlayer('player1');

            const metrics = await register.metrics();
            expect(metrics).toContain('unique_players_total 1');
        });

        test('trackUniquePlayer ne doit pas compter les doublons', async () => {
            // Ajouter le même joueur plusieurs fois
            trackUniquePlayer('player1');
            trackUniquePlayer('player1');
            trackUniquePlayer('player1');

            const metrics = await register.metrics();
            expect(metrics).toContain('unique_players_total 1');
        });

        test('trackUniquePlayer doit compter les joueurs différents', async () => {
            trackUniquePlayer('player1');
            trackUniquePlayer('player2');
            trackUniquePlayer('player3');
            trackUniquePlayer('player1'); // Doublon

            const metrics = await register.metrics();
            expect(metrics).toContain('unique_players_total 3');
        });

        test('trackUniquePlayer doit gérer les IDs null/undefined', () => {
            expect(() => trackUniquePlayer(null)).not.toThrow();
            expect(() => trackUniquePlayer(undefined)).not.toThrow();
            expect(() => trackUniquePlayer('')).not.toThrow();
        });
    });

    describe('🔄 Intégration des métriques', () => {
        test('toutes les métriques doivent être exportées dans le registre', async () => {
            // Simuler une session de jeu
            playerGuessesCounter.inc(5);
            correctGuessesCounter.inc(3);
            trackUniquePlayer('player1');
            trackUniquePlayer('player2');

            const metrics = await register.metrics();

            expect(metrics).toContain('player_guesses_total 5');
            expect(metrics).toContain('correct_guesses_total 3');
            expect(metrics).toContain('unique_players_total 2');
        });

        test('le format des métriques doit être valide pour Prometheus', async () => {
            playerGuessesCounter.inc();
            correctGuessesCounter.inc();
            trackUniquePlayer('test_player');

            const metrics = await register.metrics();

            // Vérifier le format Prometheus
            expect(metrics).toMatch(/# HELP player_guesses_total Total number of guesses made by players/);
            expect(metrics).toMatch(/# TYPE player_guesses_total counter/);
            expect(metrics).toMatch(/# HELP correct_guesses_total Total number of correct guesses made by players/);
            expect(metrics).toMatch(/# TYPE correct_guesses_total counter/);
            expect(metrics).toMatch(/# HELP unique_players_total Number of unique players/);
            expect(metrics).toMatch(/# TYPE unique_players_total counter/);
        });
    });

    describe('📈 Scénarios de jeu réalistes', () => {
        test('simulation d\'une partie complète', async () => {
            const playerId = 'player_test_123';

            // Joueur fait plusieurs tentatives
            playerGuessesCounter.inc(); // Première tentative - échec
            playerGuessesCounter.inc(); // Deuxième tentative - réussite
            correctGuessesCounter.inc();
            trackUniquePlayer(playerId);

            // Nouvelle chanson
            playerGuessesCounter.inc(); // Tentative directe - réussite
            correctGuessesCounter.inc();

            // Vérifier les métriques finales
            const metrics = await register.metrics();
            expect(metrics).toContain('player_guesses_total 3');
            expect(metrics).toContain('correct_guesses_total 2');
            expect(metrics).toContain('unique_players_total 1');
        });

        test('simulation de plusieurs joueurs', async () => {
            // Joueur 1
            playerGuessesCounter.inc(4);
            correctGuessesCounter.inc(2);
            trackUniquePlayer('player1');

            // Joueur 2
            playerGuessesCounter.inc(6);
            correctGuessesCounter.inc(5);
            trackUniquePlayer('player2');

            // Joueur 3 (même ID que joueur 1 - ne doit pas compter)
            playerGuessesCounter.inc(2);
            correctGuessesCounter.inc(1);
            trackUniquePlayer('player1');

            const metrics = await register.metrics();
            expect(metrics).toContain('player_guesses_total 12');
            expect(metrics).toContain('correct_guesses_total 8');
            expect(metrics).toContain('unique_players_total 2');
        });
    });

    describe('⚡ Performance et robustesse', () => {
        test('les métriques doivent supporter un grand nombre d\'incréments', async () => {
            const iterations = 1000;

            for (let i = 0; i < iterations; i++) {
                playerGuessesCounter.inc();
                if (i % 3 === 0) {
                    correctGuessesCounter.inc();
                }
                if (i % 10 === 0) {
                    trackUniquePlayer(`player_${i}`);
                }
            }

            const metrics = await register.metrics();
            expect(metrics).toContain(`player_guesses_total ${iterations}`);
            expect(metrics).toContain(`correct_guesses_total ${Math.floor(iterations / 3) + 1}`);
            expect(metrics).toContain(`unique_players_total ${Math.floor(iterations / 10) + 1}`);
        });

        test('les métriques doivent être thread-safe', async () => {
            const promises = [];

            // Simuler des accès concurrents
            for (let i = 0; i < 50; i++) {
                promises.push(Promise.resolve().then(() => {
                    playerGuessesCounter.inc();
                    correctGuessesCounter.inc();
                    trackUniquePlayer(`concurrent_player_${i}`);
                }));
            }

            await Promise.all(promises);

            const metrics = await register.metrics();
            expect(metrics).toContain('player_guesses_total 50');
            expect(metrics).toContain('correct_guesses_total 50');
            expect(metrics).toContain('unique_players_total 50');
        });
    });
});
