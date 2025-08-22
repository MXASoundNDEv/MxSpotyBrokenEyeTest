#!/usr/bin/env node
/**
 * 🔧 Script d'optimisation build MxSpoty BlindTest
 * Optimise les assets et prépare le build pour la production
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BuildOptimizer {
    constructor() {
        this.buildDir = path.join(process.cwd(), 'dist');
        this.optimizations = [];
    }

    // Créer le dossier de build
    createBuildDir() {
        if (!existsSync(this.buildDir)) {
            mkdirSync(this.buildDir, { recursive: true });
            console.log('📁 Dossier dist créé');
        }
    }

    // Minifier le CSS
    minifyCSS() {
        console.log('🎨 Minification CSS...');

        const cssFile = 'src/client/styles/style-responsive.css';
        if (existsSync(cssFile)) {
            let css = readFileSync(cssFile, 'utf8');

            // Minification basique
            css = css
                .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer les commentaires
                .replace(/\s+/g, ' ') // Réduire les espaces
                .replace(/;\s*}/g, '}') // Supprimer les ; avant }
                .replace(/\s*{\s*/g, '{') // Nettoyer les accolades
                .replace(/;\s*/g, ';') // Nettoyer les ;
                .trim();

            const outputFile = path.join(this.buildDir, 'style.min.css');
            writeFileSync(outputFile, css);

            const originalSize = readFileSync(cssFile).length;
            const minifiedSize = css.length;
            const savings = Math.round(((originalSize - minifiedSize) / originalSize) * 100);

            this.optimizations.push({
                file: 'CSS',
                originalSize,
                minifiedSize,
                savings: `${savings}%`
            });
        }
    }

    // Optimiser les fichiers JavaScript
    optimizeJS() {
        console.log('⚡ Optimisation JavaScript...');

        const jsFiles = [
            'src/client/scripts/SpotifyV3.js',
            'src/client/scripts/game.js',
            'src/client/scripts/Popup.js'
        ];

        jsFiles.forEach(jsFile => {
            if (existsSync(jsFile)) {
                let js = readFileSync(jsFile, 'utf8');

                // Optimisations basiques
                js = js
                    .replace(/\/\/.*$/gm, '') // Supprimer commentaires //
                    .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer commentaires /* */
                    .replace(/console\.log\([^)]*\);?/g, '') // Supprimer console.log
                    .replace(/\s+/g, ' ') // Réduire espaces multiples
                    .replace(/;\s*}/g, '}') // Nettoyer avant }
                    .trim();

                const fileName = path.basename(jsFile, '.js') + '.min.js';
                const outputFile = path.join(this.buildDir, fileName);
                writeFileSync(outputFile, js);

                const originalSize = readFileSync(jsFile).length;
                const minifiedSize = js.length;
                const savings = Math.round(((originalSize - minifiedSize) / originalSize) * 100);

                this.optimizations.push({
                    file: path.basename(jsFile),
                    originalSize,
                    minifiedSize,
                    savings: `${savings}%`
                });
            }
        });
    }

    // Générer les hashes des fichiers pour le cache busting
    generateHashes() {
        console.log('🔐 Génération des hashes...');

        const hashMap = {};
        const files = [
            'dist/style.min.css',
            'dist/SpotifyV3.min.js',
            'dist/game.min.js',
            'dist/Popup.min.js'
        ];

        files.forEach(file => {
            if (existsSync(file)) {
                const content = readFileSync(file);
                const hash = createHash('md5').update(content).digest('hex').substring(0, 8);
                const baseName = path.basename(file, path.extname(file));
                const ext = path.extname(file);

                hashMap[path.basename(file)] = `${baseName}.${hash}${ext}`;
            }
        });

        writeFileSync(path.join(this.buildDir, 'asset-manifest.json'), JSON.stringify(hashMap, null, 2));

        this.optimizations.push({
            file: 'Asset Manifest',
            description: `${Object.keys(hashMap).length} fichiers hashés`
        });
    }

    // Copier les fichiers essentiels
    copyEssentialFiles() {
        console.log('📋 Copie des fichiers essentiels...');

        const filesToCopy = [
            { from: 'package.json', to: 'package.json' },
            { from: 'Dockerfile', to: 'Dockerfile' },
            { from: 'nginx.conf', to: 'nginx.conf' }
        ];

        filesToCopy.forEach(({ from, to }) => {
            if (existsSync(from)) {
                copyFileSync(from, path.join(this.buildDir, to));
            }
        });
    }

    // Générer le rapport d'optimisation
    generateReport() {
        console.log('\n📊 Rapport d\'optimisation');
        console.log('============================\n');

        if (this.optimizations.length === 0) {
            console.log('ℹ️  Aucune optimisation effectuée');
            return;
        }

        this.optimizations.forEach(opt => {
            console.log(`✅ ${opt.file}`);
            if (opt.originalSize && opt.minifiedSize) {
                console.log(`   📦 Taille originale: ${this.formatBytes(opt.originalSize)}`);
                console.log(`   🗜️  Taille minifiée: ${this.formatBytes(opt.minifiedSize)}`);
                console.log(`   💾 Économie: ${opt.savings}`);
            }
            if (opt.description) {
                console.log(`   ℹ️  ${opt.description}`);
            }
            console.log('');
        });

        const totalOriginal = this.optimizations
            .filter(o => o.originalSize)
            .reduce((sum, o) => sum + o.originalSize, 0);

        const totalMinified = this.optimizations
            .filter(o => o.minifiedSize)
            .reduce((sum, o) => sum + o.minifiedSize, 0);

        if (totalOriginal > 0) {
            const totalSavings = Math.round(((totalOriginal - totalMinified) / totalOriginal) * 100);
            console.log(`📊 TOTAL: ${this.formatBytes(totalOriginal)} → ${this.formatBytes(totalMinified)} (${totalSavings}% d'économie)`);
        }
    }

    // Formater les bytes
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Exécuter toutes les optimisations
    run() {
        console.log('🔧 MxSpoty BlindTest - Optimisation Build\n');

        try {
            this.createBuildDir();
            this.minifyCSS();
            this.optimizeJS();
            this.generateHashes();
            this.copyEssentialFiles();
            this.generateReport();

            console.log('\n✅ Build optimisé avec succès!');
            console.log(`📁 Fichiers générés dans: ${this.buildDir}`);

            return 0;
        } catch (error) {
            console.error('\n❌ Erreur lors de l\'optimisation:', error.message);
            return 1;
        }
    }
}

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    const optimizer = new BuildOptimizer();
    const exitCode = optimizer.run();
    process.exit(exitCode);
}

export default BuildOptimizer;
