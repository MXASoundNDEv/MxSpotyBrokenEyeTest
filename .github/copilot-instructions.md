
# Copilot Instructions - MxSpoty BlindTest

## Project Architecture

This is a **Spotify-powered blind test game** with a modular ES6 architecture. The app plays track previews, challenges users to guess songs, and includes features like AutoSwipe, RevealAtEnd, and device selection.

### Core Structure
```
src/
├── server/index.js           # Express server with CSP, CORS, Spotify OAuth
├── client/
    ├── pages/index.html      # Main responsive UI
    ├── scripts/
        ├── SpotifyV3.js      # Main entry point, exports window.spotifyApp
        ├── Popup.js          # Modal system with lock queue (await showModal())  
        ├── game.js           # Game logic, track matching with Levenshtein
        └── spotify/          # Modular architecture
            ├── core/app-state.js        # Singleton state manager
            ├── api/spotify-api.js       # All Spotify API calls  
            ├── player/spotify-player.js # Web Playback SDK wrapper
            ├── managers/playlist-manager.js # Playlist loading/processing
            └── features/autoswipe.js    # Auto-skip with progress bar
```

## Key Patterns

### 1. **ES6 Module System** (`"type": "module"` in package.json)
- All imports use ES6 syntax: `import { CONFIG } from './spotify/config/spotify-config.js'`
- Backward compatibility via global window functions: `window.spotifyApp.loadPlaylist()`
- SpotifyV3.js acts as main coordinator, instantiates all managers

### 2. **Modal Lock System** (Popup.js)
```javascript
// Always await modals to prevent conflicts
const result = await showModal({
    title: 'Options',
    content: wrapper,
    priority: true  // Skip queue for critical modals
});

// Check modal state
if (isModalLocked()) await waitForModalUnlock();
```

### 3. **State Management Pattern**
- `app-state.js` exports singleton `appState` with reactive updates
- Track discovery status: `appState.updateDiscoveredStatus(index, discovered)`
- AutoSwipe state: `appState.autoSwipe.{enabled, delay, status}`

### 4. **Spotify Integration Architecture**
- OAuth flow: `/login` → `/callback` → token storage in localStorage
- Web Playback SDK initialization in `spotify-player.js`
- API calls in `spotify-api.js` with token injection via closure
- Device management for remote playback control

## Development Workflows

### Testing (Two-Tier CI/CD)
```bash
npm test              # Optimized test runner (12 tests if secrets available)
npm run test:basic    # No secrets required (13 tests, always runs)
npm run test:jest     # Detailed Jest output
```

**GitHub Actions Strategy**: Basic tests always run, full API tests only with Spotify secrets.

### Local Development
```bash
npm run dev           # Starts Express server on PORT=3000
# Configure .env with SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI
```

### Production Deployment
Uses **Podman** (not Docker Compose) via `scripts/deploy-production.sh`:
```bash
./scripts/deploy-production.sh --rebuild        # Quick app rebuild  
./scripts/deploy-production.sh --redeploy=nginx # Nginx only
./scripts/deploy-production.sh --repaire       # Health check & repair
```

## Critical Technical Details

### Content Security Policy
Production mode enforces strict CSP with nonces. **Never use inline onclick handlers** - always use `addEventListener()`.

### RevealAtEnd Feature Pattern
```javascript
// In AutoSwipe loop, check user options before next track
const userOptions = utils.getUserOptions();
if (userOptions.RevealAtEnd) {
    await utils.revealTrackInfo(currentTrack, userOptions.RevealDuration);
}
```

### Responsive Design Strategy
- Single HTML file with CSS Grid/Flexbox for mobile/desktop
- JavaScript mobile detection: `window.innerWidth <= 768`  
- CSS variables for theming: `--neon-cyan`, `--glass-bg-medium`

### Track Matching Algorithm  
Uses Levenshtein distance in `server/utils/Levenshtein.js` for fuzzy song matching. Strips special characters, handles accents.

## File Naming Conventions
- `SpotifyV3.js` (main entry point, V3 indicates current modular version)
- Modal functions: `showModal()`, `ShowOptionsModal()`, `ShowDeviceList()`  
- Feature classes: `AutoSwipe`, `PlaylistManager`, `SpotifyPlayer`
- Utility exports: `utils`, `domElements`, `uiUtils`

## Integration Points
- **Spotify Web Playback SDK**: Loaded via script tag, initialized in `spotify-player.js`
- **OAuth Flow**: Express routes `/login`, `/callback`, `/refresh-token` 
- **API Endpoints**: `/api/playlists`, `/api/devices`, `/health` (Docker healthcheck)
- **CSS Framework**: Custom responsive system with CSS variables, no external frameworks

When adding features, follow the modular pattern: create classes in appropriate `/spotify/` subdirs, export to SpotifyV3.js, maintain backward compatibility via global functions.
