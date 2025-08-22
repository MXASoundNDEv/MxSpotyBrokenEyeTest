import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.js", "tests/**/*.js", "scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                localStorage: "readonly",
                sessionStorage: "readonly",
                fetch: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                AbortController: "readonly",
                DOMException: "readonly",
                CustomEvent: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                console: "readonly",
                alert: "readonly",
                getComputedStyle: "readonly",
                requestAnimationFrame: "readonly",
                HTMLElement: "readonly",
                addEventListener: "readonly",
                history: "readonly",

                // Node.js globals
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                global: "readonly",
                exports: "readonly",
                module: "readonly",
                require: "readonly",

                // Spotify SDK
                Spotify: "readonly",

                // App specific globals
                showPopup: "readonly",
                hidePopup: "readonly",
                showLoadingModal: "readonly",
                hideLoadingModal: "readonly",
                showModal: "readonly",
                hideModal: "readonly",
                updateTrackUI: "readonly",
                updateHistoryPanel: "readonly",
                getCurrentTrackData: "readonly",
                getUserPlaylists: "readonly",
                getUserData: "readonly",
                loadPlaylist: "readonly",
                nextTrack: "readonly",
                SpotifyconnectModal: "readonly",
                showPlaylistSelectorModal: "readonly",
                updateDiscoveredStatus: "readonly",
                SpotifyDebug: "readonly",
                appState: "readonly",
                domElements: "readonly",
                currentGame: "readonly",
                showHistoryModal: "readonly",
                initUI: "readonly",
                ShowOptionsModal: "readonly",
                ShowDeviceList: "readonly",
                setPlayingDevice: "readonly",
                toggleAutoSwipe: "readonly",
                togglePlayPause: "readonly",
                updateSoundVolume: "readonly",
                pauseAutoSwipe: "readonly",
                setAutoSwipeDelay: "readonly",
                initMobileCompatibility: "readonly",
                utils: "readonly",
                isMobile: "readonly",
                BienvenueModal: "readonly",
                initPlayer: "readonly",
                waitForModalUnlock: "readonly",
                updateUI: "readonly",
                updateTrackInfo: "readonly"
            }
        },
        rules: {
            // Règles relaxées pour ce projet existant
            "no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],
            "no-console": ["warn", { "allow": ["warn", "error", "info"] }],
            "no-debugger": "warn",
            "no-alert": "warn",

            // Style de code (relaxé pour migration progressive)
            "indent": "off", // Trop de conflits existants
            "quotes": "off", // Trop de conflits existants  
            "semi": "off", // Trop de conflits existants

            // Bonnes pratiques importantes
            "eqeqeq": "warn",
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",

            // ES6+ 
            "prefer-const": "warn",
            "no-var": "warn"
        }
    },
    {
        files: ["tests/**/*.js"],
        rules: {
            "no-console": "off", // Permettre console.log dans les tests
            "no-unused-vars": "off" // Plus flexible dans les tests
        }
    },
    {
        files: ["src/client/**/*.js"],
        rules: {
            "no-console": "off", // Console.log OK côté client pour debug
            "no-alert": "off" // Alert parfois nécessaire côté client
        }
    },
    prettierConfig
];
