#!/usr/bin/env node
/**
 * ⚡ Tests de performance MxSpoty BlindTest
 * Vérifie les performances de l'API et du serveur
 */

import { performance } from 'perf_hooks';
import http from 'http';
import { URL } from 'url';

class PerformanceTest {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    // Effectuer une requête HTTP avec mesure du temps
    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const start = performance.now();

            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                ...options
            }, (res) => {
                const end = performance.now();
                const duration = end - start;

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        path,
                        duration,
                        statusCode: res.statusCode,
                        contentLength: data.length,
                        headers: res.headers
                    });
                });
            });

            req.on('error', reject);
            req.setTimeout(10000, () => reject(new Error('Timeout')));
            req.end();
        });
    }

    // Test de la page d'accueil
    async testHomePage() {
        console.log('🏠 Test page d\'accueil...');
        try {
            const result = await this.makeRequest('/');
            this.results.push({
                test: 'Page d\'accueil',
                ...result,
                success: result.statusCode === 200
            });
        } catch (error) {
            this.results.push({
                test: 'Page d\'accueil',
                error: error.message,
                success: false
            });
        }
    }

    // Test de l'endpoint health
    async testHealthEndpoint() {
        console.log('❤️  Test endpoint health...');
        try {
            const result = await this.makeRequest('/health');
            this.results.push({
                test: 'Health endpoint',
                ...result,
                success: result.statusCode === 200
            });
        } catch (error) {
            this.results.push({
                test: 'Health endpoint',
                error: error.message,
                success: false
            });
        }
    }

    // Test de charge basique
    async testLoadBasic() {
        console.log('⚡ Test de charge basique...');
        const concurrentRequests = 5;
        const requestsPerConcurrent = 10;

        const start = performance.now();

        const promises = [];
        for (let i = 0; i < concurrentRequests; i++) {
            const promise = this.runConcurrentRequests('/', requestsPerConcurrent);
            promises.push(promise);
        }

        try {
            const results = await Promise.all(promises);
            const end = performance.now();

            const totalRequests = concurrentRequests * requestsPerConcurrent;
            const totalDuration = end - start;
            const avgDuration = results.flat().reduce((sum, r) => sum + r.duration, 0) / totalRequests;
            const requestsPerSecond = (totalRequests / totalDuration) * 1000;

            this.results.push({
                test: 'Charge basique',
                totalRequests,
                totalDuration: Math.round(totalDuration),
                avgDuration: Math.round(avgDuration),
                requestsPerSecond: Math.round(requestsPerSecond),
                success: true
            });
        } catch (error) {
            this.results.push({
                test: 'Charge basique',
                error: error.message,
                success: false
            });
        }
    }

    // Exécuter des requêtes concurrentes
    async runConcurrentRequests(path, count) {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(this.makeRequest(path));
        }
        return Promise.all(promises);
    }

    // Test des assets statiques
    async testStaticAssets() {
        console.log('📁 Test assets statiques...');
        const assets = [
            '/client/styles/style-responsive.css',
            '/client/scripts/SpotifyV3.js'
        ];

        for (const asset of assets) {
            try {
                const result = await this.makeRequest(asset);
                this.results.push({
                    test: `Asset ${asset}`,
                    ...result,
                    success: result.statusCode === 200
                });
            } catch (error) {
                this.results.push({
                    test: `Asset ${asset}`,
                    error: error.message,
                    success: false
                });
            }
        }
    }

    // Générer le rapport
    generateReport() {
        console.log('\n📊 Rapport de performance');
        console.log('==========================\n');

        const successful = this.results.filter(r => r.success).length;
        const total = this.results.length;

        console.log(`✅ Tests réussis: ${successful}/${total}\n`);

        this.results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.test}`);
                if (result.duration) {
                    console.log(`   ⏱️  Temps de réponse: ${Math.round(result.duration)}ms`);
                }
                if (result.requestsPerSecond) {
                    console.log(`   🚀 Req/sec: ${result.requestsPerSecond}`);
                }
                if (result.contentLength) {
                    console.log(`   📦 Taille: ${result.contentLength} bytes`);
                }
            } else {
                console.log(`❌ ${result.test}`);
                if (result.error) {
                    console.log(`   ❌ Erreur: ${result.error}`);
                }
            }
            console.log('');
        });

        // Recommandations
        const slowRequests = this.results.filter(r => r.duration && r.duration > 1000);
        if (slowRequests.length > 0) {
            console.log('⚠️  RECOMMANDATIONS:');
            console.log(`   - ${slowRequests.length} requête(s) lente(s) détectée(s) (>1s)`);
            slowRequests.forEach(r => {
                console.log(`     • ${r.test}: ${Math.round(r.duration)}ms`);
            });
            console.log('');
        }

        return successful === total ? 0 : 1;
    }

    // Exécuter tous les tests
    async run() {
        console.log('⚡ MxSpoty BlindTest - Tests de Performance\n');

        try {
            await this.testHomePage();
            await this.testHealthEndpoint();
            await this.testStaticAssets();
            await this.testLoadBasic();
        } catch (error) {
            console.error('❌ Erreur lors des tests:', error.message);
            return 1;
        }

        return this.generateReport();
    }
}

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const perfTest = new PerformanceTest(baseUrl);

    perfTest.run().then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    });
}

export default PerformanceTest;
