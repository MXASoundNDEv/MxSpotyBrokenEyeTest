@echo off
REM 🚀 Script de test complet du workflow CI/CD
echo.
echo ============================================
echo    MxSpoty BlindTest - Test Workflow CI/CD
echo ============================================
echo.

REM Configuration
set NODE_ENV=test
set PORT=3000

echo [1/6] 📦 Installation des dependances...
call npm install --prefer-offline --no-audit
if errorlevel 1 (
    echo ❌ Erreur lors de l'installation
    pause
    exit /b 1
)

echo.
echo [2/6] 🔍 Tests de qualite et securite...
call npm run security
call npm run lint

echo.
echo [3/6] 🧪 Tests unitaires...
call npm run test:basic
if errorlevel 1 (
    echo ❌ Tests unitaires echoues
    pause
    exit /b 1
)

echo.
echo [4/6] 🚀 Demarrage du serveur...
start /b npm run start
timeout /t 5 > nul

echo.
echo [5/6] ⚡ Tests de performance...
call npm run test:performance

echo.
echo [6/6] 🔧 Test de build...
call npm run build

echo.
echo ✅ Workflow de test termine avec succes!
echo.
echo 📊 Resultats disponibles dans:
echo   - coverage/ (couverture de code)
echo   - dist/ (build optimise)
echo   - performance-*.json (rapports performance)
echo.

REM Nettoyage
taskkill /f /im node.exe > nul 2>&1

echo Appuyez sur une touche pour fermer...
pause > nul
