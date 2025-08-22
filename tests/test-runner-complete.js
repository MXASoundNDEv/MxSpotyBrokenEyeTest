// tests/test-runner-complete.js - Runner de tests unifié et optimisé
import { runMetricsTests } from './metrics-working.js';
import { execSync } from 'child_process';
import fs from 'fs';

const COLORS = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m'
};

function log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
}

class TestRunner {
    constructor() {
        this.testSuites = [];
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            suites: []
        };
    }

    addSuite(name, testFunction, required = true) {
        this.testSuites.push({ name, testFunction, required });
    }

    async runAllTests() {
        log('\n🧪 RUNNER DE TESTS UNIFIÉ - BLINDTEST', COLORS.BOLD + COLORS.CYAN);
        log('=' * 60, COLORS.CYAN);
        log(`📅 ${new Date().toLocaleString('fr-FR')}`, COLORS.BLUE);
        log(`📁 ${process.cwd()}`, COLORS.BLUE);
        log('=' * 60, COLORS.CYAN);

        for (const suite of this.testSuites) {
            await this.runSuite(suite);
        }

        this.generateReport();
        return this.results.failed === 0;
    }

    async runSuite(suite) {
        log(`\n🔄 ${suite.name}`, COLORS.YELLOW);
        log('-' * 40, COLORS.YELLOW);

        const startTime = Date.now();

        try {
            const success = await suite.testFunction();
            const duration = Date.now() - startTime;

            if (success) {
                log(`✅ ${suite.name} - RÉUSSI (${duration}ms)`, COLORS.GREEN);
                this.results.passed++;
                this.results.suites.push({ name: suite.name, success: true, duration });
            } else {
                log(`❌ ${suite.name} - ÉCHEC (${duration}ms)`, COLORS.RED);
                this.results.failed++;
                this.results.suites.push({ name: suite.name, success: false, duration });
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            log(`💥 ${suite.name} - ERREUR (${duration}ms)`, COLORS.RED);
            log(`   └─ ${error.message}`, COLORS.RED);
            this.results.failed++;
            this.results.suites.push({ name: suite.name, success: false, duration, error: error.message });
        }

        this.results.total++;
    }

    generateReport() {
        log('\n📊 RAPPORT FINAL', COLORS.BOLD + COLORS.CYAN);
        log('=' * 50, COLORS.CYAN);

        this.results.suites.forEach(suite => {
            const status = suite.success ? '✅' : '❌';
            const color = suite.success ? COLORS.GREEN : COLORS.RED;
            log(`  ${status} ${suite.name} (${suite.duration}ms)`, color);
            if (suite.error) log(`     └─ ${suite.error}`, COLORS.RED);
        });

        const successRate = Math.round((this.results.passed / this.results.total) * 100);

        log('\n📈 STATISTIQUES:', COLORS.BLUE);
        log(`  Total: ${this.results.total}`, COLORS.BLUE);
        log(`  Réussis: ${this.results.passed}`, COLORS.GREEN);
        log(`  Échoués: ${this.results.failed}`, COLORS.RED);
        log(`  Taux de réussite: ${successRate}%`, COLORS.YELLOW);

        // Sauvegarde du rapport JSON
        this.saveJsonReport();

        if (this.results.failed === 0) {
            log('\n🎉 TOUS LES TESTS SONT PASSÉS!', COLORS.BOLD + COLORS.GREEN);
            log('✅ Application prête pour déploiement', COLORS.GREEN);
        } else {
            log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ', COLORS.BOLD + COLORS.RED);
            log('❌ Vérifiez les erreurs avant déploiement', COLORS.RED);
        }
    }

    saveJsonReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                success_rate: Math.round((this.results.passed / this.results.total) * 100)
            },
            suites: this.results.suites,
            environment: {
                node_version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };

        try {
            fs.writeFileSync('tests/test-results.json', JSON.stringify(report, null, 2));
            log('\n💾 Rapport sauvegardé: tests/test-results.json', COLORS.CYAN);
        } catch (error) {
            log(`⚠️  Erreur sauvegarde rapport: ${error.message}`, COLORS.YELLOW);
        }
    }
}

// Fonction pour tester les routes API (existant)
async function testApiRoutes() {
    try {
        // Utiliser le test runner existant qui fonctionne
        const result = execSync('node tests/test-runner-basic.js', {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000
        });

        // Vérifier si les tests ont réussi
        return !result.includes('ÉCHEC') && !result.includes('❌');
    } catch (error) {
        console.error('Erreur tests API:', error.message);
        return false;
    }
}

// Configuration des tests
async function main() {
    const runner = new TestRunner();

    // Suite 1: Tests de métriques Prometheus
    runner.addSuite('📊 Métriques Prometheus', runMetricsTests, true);

    // Suite 2: Tests API Routes (si pas en mode metrics-only)
    if (!process.argv.includes('--metrics-only')) {
        runner.addSuite('🌐 Routes API', testApiRoutes, true);
    }

    const success = await runner.runAllTests();
    process.exit(success ? 0 : 1);
}

// Export pour usage externe
export { TestRunner, main as runCompleteTests };

// Exécution directe
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(error => {
        console.error('💥 Erreur fatale:', error);
        process.exit(1);
    });
}
