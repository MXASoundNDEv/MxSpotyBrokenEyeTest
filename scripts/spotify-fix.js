#!/usr/bin/env node

/**
 * Script de diagnostic et correction automatique pour Spotify
 */

import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const COMMON_ISSUES = {
    PORT_MISMATCH: 'redirect_uri port mismatch',
    MISSING_ENV: 'missing environment variables',
    WRONG_PROTOCOL: 'http vs https mismatch'
};

function checkSpotifyConfig() {
    console.log('🔍 === DIAGNOSTIC SPOTIFY ===\n');
    
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
    const port = process.env.PORT || 3000;
    
    let issues = [];
    let fixes = [];
    
    // Vérifier les variables manquantes
    if (!client_id) {
        issues.push('❌ SPOTIFY_CLIENT_ID manquant');
        fixes.push('Ajoutez SPOTIFY_CLIENT_ID=votre_client_id dans .env');
    } else {
        console.log('✅ CLIENT_ID:', client_id);
    }
    
    if (!client_secret) {
        issues.push('❌ SPOTIFY_CLIENT_SECRET manquant');
        fixes.push('Ajoutez SPOTIFY_CLIENT_SECRET=votre_client_secret dans .env');
    } else {
        console.log('✅ CLIENT_SECRET: ***configuré***');
    }
    
    if (!redirect_uri) {
        issues.push('❌ SPOTIFY_REDIRECT_URI manquant');
        fixes.push(`Ajoutez SPOTIFY_REDIRECT_URI=http://localhost:${port}/callback dans .env`);
    } else {
        console.log('✅ REDIRECT_URI:', redirect_uri);
        
        // Vérifier la cohérence du port
        const expectedUri = `http://127.0.0.1:${port}/callback`;  // ✅ CORRECT selon Spotify
        if (redirect_uri !== expectedUri) {
            // Vérifier si c'est localhost (non autorisé par Spotify)
            if (redirect_uri.includes('localhost')) {
                issues.push(`❌ 'localhost' non autorisé par Spotify: ${redirect_uri}`);
                fixes.push(`Changez en SPOTIFY_REDIRECT_URI=${expectedUri} dans .env`);
            } else {
                issues.push(`⚠️ Port mismatch: ${redirect_uri} vs ${expectedUri}`);
                fixes.push(`Changez SPOTIFY_REDIRECT_URI=${expectedUri} dans .env`);
            }
        }
        
        // Vérifier le protocole et conformité Spotify
        if (redirect_uri.startsWith('https://localhost') || redirect_uri.includes('localhost')) {
            issues.push('❌ localhost non autorisé par Spotify - Utilisez 127.0.0.1');
            fixes.push('Selon la doc Spotify: utilisez http://127.0.0.1:PORT/callback');
        }
    }
    
    console.log('📊 RÉSULTATS:');
    console.log(`Port serveur: ${port}`);
    console.log(`URL actuelle: ${redirect_uri || 'Non définie'}`);
    console.log(`URL recommandée Spotify: http://127.0.0.1:${port}/callback`);
    
    if (issues.length === 0) {
        console.log('\n✅ Configuration semble correcte!');
        console.log('\n📚 NOTE IMPORTANTE:');
        console.log('Selon la documentation Spotify officielle:');
        console.log('- localhost N\'EST PAS autorisé comme redirect URI');
        console.log('- 127.0.0.1 est REQUIS pour les adresses de loopback');
        console.log('- Votre configuration est conforme aux exigences de sécurité');
        console.log('\n🎯 ÉTAPES SUIVANTES:');
        console.log('1. Vérifiez le dashboard Spotify (https://developer.spotify.com/dashboard)');
        console.log('2. Confirmez que l\'URL de redirection est exactement:', redirect_uri || `http://127.0.0.1:${port}/callback`);
        console.log('3. Redémarrez le serveur après modifications');
        console.log('4. Testez avec: http://localhost:' + port + '/spotify-debug');
    } else {
        console.log('\n❌ PROBLÈMES DÉTECTÉS:');
        issues.forEach(issue => console.log('  ' + issue));
        
        console.log('\n🔧 CORRECTIONS SUGGÉRÉES:');
        fixes.forEach(fix => console.log('  ' + fix));
        
        // Générer un fichier .env corrigé
        generateFixedEnv(port);
    }
}

function generateFixedEnv(port) {
    const currentEnv = fs.readFileSync('.env', 'utf8').split('\n');
    let fixedEnv = [];
    let hasRedirectUri = false;
    
    currentEnv.forEach(line => {
        if (line.startsWith('SPOTIFY_REDIRECT_URI=')) {
            fixedEnv.push(`SPOTIFY_REDIRECT_URI=http://127.0.0.1:${port}/callback`);  // ✅ Conforme Spotify
            hasRedirectUri = true;
        } else if (line.trim()) {
            fixedEnv.push(line);
        }
    });
    
    if (!hasRedirectUri) {
        fixedEnv.push(`SPOTIFY_REDIRECT_URI=http://127.0.0.1:${port}/callback`);  // ✅ Conforme Spotify
    }
    
    fs.writeFileSync('.env.fixed', fixedEnv.join('\n'));
    console.log('\n💾 Fichier .env.fixed généré avec les corrections');
    console.log('   Renommez-le en .env pour appliquer les corrections');
}

// Exécuter le diagnostic
checkSpotifyConfig();
