#!/usr/bin/env node
/**
 * 🔒 Script de vérification de sécurité MxSpoty BlindTest
 * Vérifie les vulnérabilités et les bonnes pratiques de sécurité
 */

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

class SecurityChecker {
    constructor() {
        this.issues = [];
        this.warnings = [];
    }

    // Vérifier les fichiers sensibles
    checkSensitiveFiles() {
        console.log('🔍 Vérification des fichiers sensibles...');

        const sensitiveFiles = [
            '.env',
            '.env.local',
            '.env.production',
            'config/secrets.json',
            'private.key',
            'certificate.pem'
        ];

        sensitiveFiles.forEach(file => {
            if (existsSync(file)) {
                this.warnings.push(`⚠️  Fichier sensible détecté: ${file}`);
            }
        });
    }

    // Vérifier les secrets hardcodés
    checkHardcodedSecrets() {
        console.log('🔍 Vérification des secrets hardcodés...');

        const patterns = [
            /client_secret\s*[=:]\s*['"][^'"]{10,}['"]/gi,
            /api[_-]?key\s*[=:]\s*['"][^'"]{10,}['"]/gi,
            /password\s*[=:]\s*['"][^'"]+['"]/gi,
            /token\s*[=:]\s*['"][^'"]{20,}['"]/gi
        ];

        const filesToCheck = [
            'src/server/index.js',
            'src/client/scripts/SpotifyV3.js'
        ];

        filesToCheck.forEach(file => {
            if (existsSync(file)) {
                const content = readFileSync(file, 'utf8');
                patterns.forEach((pattern, index) => {
                    const matches = content.match(pattern);
                    if (matches) {
                        this.issues.push(`❌ Potentiel secret hardcodé dans ${file}: ${matches[0].substring(0, 50)}...`);
                    }
                });
            }
        });
    }

    // Vérifier les en-têtes de sécurité
    checkSecurityHeaders() {
        console.log('🔍 Vérification des en-têtes de sécurité...');

        const serverFile = 'src/server/index.js';
        if (existsSync(serverFile)) {
            const content = readFileSync(serverFile, 'utf8');

            const securityHeaders = [
                'helmet',
                'Content-Security-Policy',
                'X-Frame-Options',
                'X-Content-Type-Options'
            ];

            securityHeaders.forEach(header => {
                if (!content.includes(header)) {
                    this.warnings.push(`⚠️  En-tête de sécurité manquant: ${header}`);
                }
            });
        }
    }

    // Vérifier les dépendances
    checkDependencies() {
        console.log('🔍 Vérification des dépendances...');

        if (existsSync('package.json')) {
            const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

            // Vérifier les versions spécifiques
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            Object.entries(deps).forEach(([name, version]) => {
                if (version.includes('*') || version.includes('^') && !version.match(/^\^[\d.]+$/)) {
                    this.warnings.push(`⚠️  Version de dépendance imprécise: ${name}@${version}`);
                }
            });
        }
    }

    // Générer le rapport
    generateReport() {
        console.log('\n📋 Rapport de sécurité');
        console.log('========================\n');

        if (this.issues.length === 0 && this.warnings.length === 0) {
            console.log('✅ Aucun problème de sécurité détecté!');
            return 0;
        }

        if (this.issues.length > 0) {
            console.log('❌ PROBLÈMES CRITIQUES:');
            this.issues.forEach(issue => console.log(`  ${issue}`));
            console.log('');
        }

        if (this.warnings.length > 0) {
            console.log('⚠️  AVERTISSEMENTS:');
            this.warnings.forEach(warning => console.log(`  ${warning}`));
            console.log('');
        }

        console.log(`📊 Résumé: ${this.issues.length} problème(s), ${this.warnings.length} avertissement(s)`);

        return this.issues.length > 0 ? 1 : 0;
    }

    // Exécuter toutes les vérifications
    run() {
        console.log('🔒 MxSpoty BlindTest - Vérification de sécurité\n');

        this.checkSensitiveFiles();
        this.checkHardcodedSecrets();
        this.checkSecurityHeaders();
        this.checkDependencies();

        return this.generateReport();
    }
}

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    const checker = new SecurityChecker();
    const exitCode = checker.run();
    process.exit(exitCode);
}

export default SecurityChecker;
