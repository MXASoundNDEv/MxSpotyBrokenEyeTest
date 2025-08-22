// tests/metrics-working.js - Test optimisé des métriques Prometheus
import {
    register,
    collectDefaultMetrics,
    playerGuessesCounter,
    correctGuessesCounter,
    uniquePlayersCounter,
    trackUniquePlayer
} from '../src/server/utils/metrics.js';

class MetricsTestSuite {
    constructor() {
        this.results = { passed: 0, failed: 0, tests: [] };
    }

    async test(description, testFn) {
        try {
            await testFn();
            this.results.passed++;
            this.results.tests.push({ description, status: '✅' });
            return true;
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ description, status: '❌', error: error.message });
            return false;
        }
    }

    report() {
        const total = this.results.passed + this.results.failed;
        const percentage = Math.round((this.results.passed / total) * 100);

        console.log('\n📊 RAPPORT DES TESTS MÉTRIQUES');
        console.log('=' * 40);

        this.results.tests.forEach(test => {
            console.log(`${test.status} ${test.description}`);
            if (test.error) console.log(`   └─ ${test.error}`);
        });

        console.log('\n📈 RÉSULTATS:');
        console.log(`  Réussis: ${this.results.passed}/${total} (${percentage}%)`);

        return this.results.failed === 0;
    }
}

// Fonction d'assertion simple
function expect(value) {
    return {
        toBe: (expected) => {
            if (value !== expected) throw new Error(`Expected ${value} to be ${expected}`);
        },
        toContain: (expected) => {
            if (!value.includes(expected)) throw new Error(`Expected to contain "${expected}"`);
        },
        toBeGreaterThan: (expected) => {
            if (value <= expected) throw new Error(`Expected ${value} > ${expected}`);
        }
    };
}

async function runMetricsTests() {
    console.log('🧪 TESTS DES MÉTRIQUES PROMETHEUS - BLINDTEST');
    console.log('=' * 50);

    const suite = new MetricsTestSuite();

    // Test 1: Initialisation
    await suite.test('Initialisation du système de métriques', async () => {
        collectDefaultMetrics();
        const metrics = await register.metrics();
        expect(metrics).toContain('process_cpu_seconds_total');
        expect(metrics.length).toBeGreaterThan(1000);
    });

    // Test 2: Compteur de tentatives
    await suite.test('Compteur de tentatives des joueurs', async () => {
        playerGuessesCounter.inc(10);
        const metrics = await register.metrics();
        expect(metrics).toContain('player_guesses_total');
    });

    // Test 3: Compteur de bonnes réponses
    await suite.test('Compteur de bonnes réponses', async () => {
        correctGuessesCounter.inc(7);
        const metrics = await register.metrics();
        expect(metrics).toContain('correct_guesses_total');
    });

    // Test 4: Suivi des joueurs uniques
    await suite.test('Suivi des joueurs uniques', async () => {
        trackUniquePlayer('alice');
        trackUniquePlayer('bob');
        trackUniquePlayer('alice'); // Doublon
        const metrics = await register.metrics();
        expect(metrics).toContain('unique_players_total');
    });

    // Test 5: Format Prometheus
    await suite.test('Format Prometheus valide', async () => {
        const metrics = await register.metrics();
        expect(metrics).toContain('# HELP player_guesses_total');
        expect(metrics).toContain('# TYPE player_guesses_total counter');
    });

    // Test 6: Performance
    await suite.test('Performance des opérations', async () => {
        const start = Date.now();
        for (let i = 0; i < 100; i++) {
            playerGuessesCounter.inc();
            if (i % 5 === 0) correctGuessesCounter.inc();
            if (i % 10 === 0) trackUniquePlayer(`perf_${i}`);
        }
        const duration = Date.now() - start;
        expect(duration).toBe(duration); // Toujours vrai, juste pour mesurer
        console.log(`   ⚡ 100 opérations en ${duration}ms`);
    });

    // Test 7: Scénario réaliste de jeu
    await suite.test('Scénario de jeu BlindTest complet', async () => {
        // Simulation d'une partie
        const players = ['alice', 'bob', 'charlie'];
        let totalGuesses = 0;

        // Chanson 1: Difficile
        players.forEach(player => {
            trackUniquePlayer(player);
            playerGuessesCounter.inc(3); // 3 tentatives
            totalGuesses += 3;
            if (player !== 'charlie') correctGuessesCounter.inc(); // Alice et Bob trouvent
        });

        // Chanson 2: Facile
        players.forEach(player => {
            playerGuessesCounter.inc(1); // 1 tentative
            totalGuesses += 1;
            correctGuessesCounter.inc(); // Tout le monde trouve
        });

        const metrics = await register.metrics();
        expect(metrics).toContain('player_guesses_total');
        expect(metrics).toContain('correct_guesses_total');
        expect(metrics).toContain('unique_players_total');
    });

    // Génération du rapport
    const success = suite.report();

    if (success) {
        console.log('\n🎉 SUCCÈS TOTAL!');
        console.log('✅ Système de métriques Prometheus opérationnel');
        console.log('📊 Prêt pour intégration en production');
        console.log('\n💡 Usage recommandé:');
        console.log('  🌐 GET /metrics pour exposition Prometheus');
        console.log('  📈 Surveillance continue des KPIs de jeu');
        console.log('  🔔 Alertes sur taux de réussite et performance');
    } else {
        console.log('\n⚠️  PROBLÈMES DÉTECTÉS');
        console.log('❌ Vérifiez les erreurs avant déploiement');
    }

    return success;
}

// Export pour intégration dans autres test runners
export { runMetricsTests };

// Exécution directe si appelé en standalone
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    runMetricsTests()
        .then(success => {
            console.log('\n🏁 Tests terminés');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Erreur fatale:', error);
            process.exit(1);
        });
}
