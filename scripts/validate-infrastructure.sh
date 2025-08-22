#!/bin/bash
# 🧪 Script de validation complète de l'infrastructure MxSpoty BlindTest
# Teste tous les composants : système, conteneurs, application, monitoring, backups

set -e

# Configuration
PROJECT_DIR="/opt/mxspoty-blindtest"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
TEST_LOG="/tmp/mxspoty_validation_$(date +%Y%m%d_%H%M%S).log"
ERRORS=0
WARNINGS=0
TESTS_TOTAL=0
TESTS_PASSED=0

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging amélioré
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] $1" | tee -a "$TEST_LOG"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[✅ PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_warning() { log "${YELLOW}[⚠️  WARN]${NC} $1"; ((WARNINGS++)); }
log_error() { log "${RED}[❌ FAIL]${NC} $1"; ((ERRORS++)); }
log_test() { log "${PURPLE}[TEST]${NC} $1"; ((TESTS_TOTAL++)); }
log_section() { log "${CYAN}[====]${NC} $1"; }

# Test d'une commande avec résultat
test_command() {
    local description=$1
    local command=$2
    local expected_pattern=${3:-""}
    
    log_test "$description"
    
    if output=$(eval "$command" 2>&1); then
        if [ -n "$expected_pattern" ]; then
            if echo "$output" | grep -q "$expected_pattern"; then
                log_success "$description - Pattern trouvé: $expected_pattern"
            else
                log_error "$description - Pattern non trouvé: $expected_pattern"
                echo "Output: $output" >> "$TEST_LOG"
            fi
        else
            log_success "$description"
        fi
    else
        log_error "$description - Commande échouée"
        echo "Error: $output" >> "$TEST_LOG"
    fi
}

# Test d'un service HTTP
test_http_endpoint() {
    local description=$1
    local url=$2
    local expected_code=${3:-200}
    local timeout=${4:-10}
    
    log_test "$description"
    
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")
    
    if [[ "$http_code" =~ ^$expected_code ]]; then
        log_success "$description - HTTP $http_code"
    else
        log_error "$description - HTTP $http_code (attendu: $expected_code)"
    fi
}

# Test de la version Ubuntu
test_ubuntu_version() {
    log_section "TESTS SYSTÈME UBUNTU"
    
    test_command "Version Ubuntu 24.04" "lsb_release -rs" "24.04"
    test_command "Architecture x64" "uname -m" "x86_64"
    test_command "Kernel récent" "uname -r" ""
    test_command "Uptime système" "uptime" "up"
}

# Test des dépendances système
test_system_dependencies() {
    log_section "TESTS DÉPENDANCES SYSTÈME"
    
    # Outils système essentiels
    local tools=("curl" "wget" "git" "htop" "tree" "jq" "ufw" "nginx" "systemctl" "journalctl")
    
    for tool in "${tools[@]}"; do
        test_command "Outil $tool disponible" "command -v $tool" "$tool"
    done
    
    # Versions spécifiques importantes
    test_command "Node.js version 20.x" "node --version" "v20"
    test_command "npm disponible" "npm --version" ""
    test_command "Podman version 4.x+" "podman --version" "podman version 4"
}

# Test de la configuration Podman
test_podman_config() {
    log_section "TESTS CONFIGURATION PODMAN"
    
    test_command "Podman fonctionnel" "podman info --format json" "version"
    test_command "Support rootless" "podman info --format json" "rootless.*true"
    test_command "Storage configuré" "podman info --format json" "graphRoot"
    
    # Test des sous-UID/GID pour rootless
    if [ -f "/etc/subuid" ] && [ -f "/etc/subgid" ]; then
        test_command "Sous-UID configurés" "grep -q '^[^:]*:[0-9]*:' /etc/subuid" ""
        test_command "Sous-GID configurés" "grep -q '^[^:]*:[0-9]*:' /etc/subgid" ""
    else
        log_error "Fichiers /etc/subuid ou /etc/subgid manquants"
    fi
    
    # Test de création d'un conteneur de test
    log_test "Création conteneur de test"
    if podman run --rm alpine:latest echo "test" >/dev/null 2>&1; then
        log_success "Conteneur de test - Alpine Linux"
    else
        log_error "Impossible de créer un conteneur de test"
    fi
}

# Test des conteneurs de l'application
test_application_containers() {
    log_section "TESTS CONTENEURS APPLICATION"
    
    # Vérification des pods
    test_command "Pod mxspoty existe" "podman pod ls --format '{{.Name}}'" "mxspoty"
    
    # Vérification des conteneurs
    local containers=$(podman ps --format "{{.Names}}" 2>/dev/null | grep -E "mxspoty|blindtest" || true)
    
    if [ -n "$containers" ]; then
        echo "$containers" | while read -r container; do
            if [ -n "$container" ]; then
                test_command "Conteneur $container en cours d'exécution" "podman ps --filter name=$container --format '{{.Status}}'" "Up"
                
                # Test des logs (pas d'erreur critique récente)
                log_test "Logs du conteneur $container"
                local error_count=$(podman logs --since="1h" "$container" 2>/dev/null | grep -i "error\|exception\|fatal" | wc -l || echo "0")
                if [ "$error_count" -lt 5 ]; then
                    log_success "Conteneur $container - Peu d'erreurs récentes ($error_count)"
                else
                    log_warning "Conteneur $container - Nombreuses erreurs récentes ($error_count)"
                fi
            fi
        done
    else
        log_warning "Aucun conteneur MxSpoty trouvé"
    fi
}

# Test de l'application web
test_web_application() {
    log_section "TESTS APPLICATION WEB"
    
    # Endpoints principaux
    test_http_endpoint "Page d'accueil" "http://localhost:3000/" 200
    test_http_endpoint "Health check" "http://localhost:3000/health" 200
    test_http_endpoint "API playlists" "http://localhost:3000/api/playlists" 200 5
    test_http_endpoint "API devices" "http://localhost:3000/api/devices" 200 5
    
    # Test du temps de réponse
    log_test "Temps de réponse application"
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:3000/health" 2>/dev/null | awk '{print int($1*1000)}' || echo "9999")
    
    if [ "$response_time" -lt 2000 ]; then
        log_success "Temps de réponse excellent: ${response_time}ms"
    elif [ "$response_time" -lt 5000 ]; then
        log_warning "Temps de réponse acceptable: ${response_time}ms"
    else
        log_error "Temps de réponse trop élevé: ${response_time}ms"
    fi
    
    # Test de la configuration Spotify
    log_test "Configuration Spotify"
    if [ -f "$PROJECT_DIR/.env" ]; then
        if grep -q "SPOTIFY_CLIENT_ID=" "$PROJECT_DIR/.env" && grep -q "SPOTIFY_CLIENT_SECRET=" "$PROJECT_DIR/.env"; then
            log_success "Variables Spotify configurées dans .env"
        else
            log_warning "Variables Spotify manquantes dans .env"
        fi
    else
        log_warning "Fichier .env non trouvé"
    fi
}

# Test de Nginx et du reverse proxy
test_nginx_proxy() {
    log_section "TESTS NGINX REVERSE PROXY"
    
    test_command "Service Nginx actif" "systemctl is-active nginx" "active"
    test_command "Service Nginx enabled" "systemctl is-enabled nginx" "enabled"
    test_command "Configuration Nginx valide" "nginx -t" "successful"
    
    # Test des endpoints via Nginx
    test_http_endpoint "Nginx port 80" "http://localhost/" 200
    
    # Vérification des fichiers de configuration
    if [ -f "/etc/nginx/sites-available/mxspoty-blindtest" ]; then
        log_success "Configuration Nginx personnalisée trouvée"
    else
        log_warning "Configuration Nginx par défaut utilisée"
    fi
    
    # Test SSL si configuré
    if [ -f "/etc/letsencrypt/live/$(hostname)/fullchain.pem" ]; then
        test_http_endpoint "HTTPS SSL" "https://localhost/" 200
        log_success "Certificats SSL trouvés"
    else
        log_warning "Certificats SSL non configurés"
    fi
}

# Test des services système
test_system_services() {
    log_section "TESTS SERVICES SYSTÈME"
    
    local services=("nginx" "cron" "systemd-journald" "ufw")
    
    for service in "${services[@]}"; do
        test_command "Service $service" "systemctl is-active $service" "active"
    done
    
    # Service spécifique à l'application
    if systemctl list-units --type=service | grep -q "mxspoty-blindtest"; then
        test_command "Service mxspoty-blindtest" "systemctl is-active mxspoty-blindtest" "active"
    else
        log_warning "Service mxspoty-blindtest non installé"
    fi
    
    # Test du pare-feu
    test_command "UFW firewall actif" "ufw status" "active"
}

# Test du système de monitoring
test_monitoring_system() {
    log_section "TESTS SYSTÈME DE MONITORING"
    
    # Script de monitoring
    if [ -x "$SCRIPTS_DIR/monitoring.sh" ]; then
        test_command "Script monitoring exécutable" "ls -l $SCRIPTS_DIR/monitoring.sh" "-rwxr-xr-x"
        
        log_test "Exécution du monitoring"
        if "$SCRIPTS_DIR/monitoring.sh" check >/dev/null 2>&1; then
            log_success "Script de monitoring fonctionnel"
        else
            log_error "Script de monitoring défaillant"
        fi
    else
        log_error "Script monitoring.sh non trouvé ou non exécutable"
    fi
    
    # Prometheus si installé
    if systemctl list-units --type=service | grep -q "prometheus"; then
        test_http_endpoint "Prometheus metrics" "http://localhost:9090" 200
        log_success "Prometheus configuré"
    else
        log_warning "Prometheus non installé"
    fi
    
    # Rapport HTML de monitoring
    if [ -f "/var/www/html/monitoring-report.html" ]; then
        log_success "Rapport HTML de monitoring disponible"
    else
        log_warning "Rapport HTML de monitoring non généré"
    fi
}

# Test du système de sauvegarde
test_backup_system() {
    log_section "TESTS SYSTÈME DE SAUVEGARDE"
    
    # Script de sauvegarde
    if [ -x "$SCRIPTS_DIR/backup-system.sh" ]; then
        test_command "Script backup exécutable" "ls -l $SCRIPTS_DIR/backup-system.sh" "-rwxr-xr-x"
        
        log_test "Test du script de sauvegarde"
        if "$SCRIPTS_DIR/backup-system.sh" --help >/dev/null 2>&1; then
            log_success "Script de sauvegarde fonctionnel"
        else
            log_error "Script de sauvegarde défaillant"
        fi
    else
        log_error "Script backup-system.sh non trouvé"
    fi
    
    # Répertoire de sauvegarde
    local backup_dir="/var/backups/mxspoty-blindtest"
    if [ -d "$backup_dir" ]; then
        log_success "Répertoire de sauvegarde existant"
        
        # Vérification de l'espace disponible
        local available_space=$(df "$backup_dir" | tail -1 | awk '{print $4}')
        local available_gb=$((available_space / 1024 / 1024))
        
        if [ "$available_gb" -gt 5 ]; then
            log_success "Espace disque suffisant: ${available_gb}GB"
        else
            log_warning "Espace disque faible: ${available_gb}GB"
        fi
    else
        log_warning "Répertoire de sauvegarde non créé"
    fi
    
    # Configuration logrotate
    if [ -f "/etc/logrotate.d/mxspoty-blindtest" ]; then
        log_success "Configuration logrotate installée"
    else
        log_warning "Configuration logrotate manquante"
    fi
}

# Test des tâches automatisées
test_automated_tasks() {
    log_section "TESTS TÂCHES AUTOMATISÉES"
    
    # Vérification du crontab
    log_test "Crontab root configuré"
    local cron_tasks=$(crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l)
    if [ "$cron_tasks" -gt 0 ]; then
        log_success "Crontab configuré avec $cron_tasks tâches"
    else
        log_warning "Aucune tâche cron configurée"
    fi
    
    # Services timer systemd
    log_test "Timers systemd"
    local timer_count=$(systemctl list-timers --no-pager 2>/dev/null | grep -i mxspoty | wc -l)
    if [ "$timer_count" -gt 0 ]; then
        log_success "Timers systemd configurés ($timer_count)"
    else
        log_warning "Aucun timer systemd mxspoty configuré"
    fi
    
    # Script de configuration cron
    if [ -x "$SCRIPTS_DIR/setup-cron.sh" ]; then
        log_success "Script setup-cron disponible"
    else
        log_warning "Script setup-cron manquant"
    fi
}

# Test de sécurité basique
test_basic_security() {
    log_section "TESTS SÉCURITÉ DE BASE"
    
    # Pare-feu
    test_command "Pare-feu UFW actif" "ufw status" "active"
    
    # Permissions critiques
    log_test "Permissions du projet"
    local bad_permissions=$(find "$PROJECT_DIR" -type f -perm -o+w 2>/dev/null | wc -l)
    if [ "$bad_permissions" -eq 0 ]; then
        log_success "Permissions fichiers sécurisées"
    else
        log_warning "$bad_permissions fichiers avec permissions trop ouvertes"
    fi
    
    # Configuration SSH (si présente)
    if [ -f "/etc/ssh/sshd_config" ]; then
        if grep -q "PermitRootLogin no" /etc/ssh/sshd_config; then
            log_success "SSH root login désactivé"
        else
            log_warning "SSH root login peut être activé"
        fi
    fi
    
    # Fail2Ban
    if systemctl is-active fail2ban >/dev/null 2>&1; then
        log_success "Fail2Ban actif"
    else
        log_warning "Fail2Ban non configuré"
    fi
}

# Test de performance basique
test_basic_performance() {
    log_section "TESTS PERFORMANCE DE BASE"
    
    # Utilisation des ressources
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print int(100 - $1)}')
    log_test "Utilisation CPU: ${cpu_usage}%"
    if [ "$cpu_usage" -lt 50 ]; then
        log_success "CPU Usage normal: ${cpu_usage}%"
    elif [ "$cpu_usage" -lt 80 ]; then
        log_warning "CPU Usage modéré: ${cpu_usage}%"
    else
        log_error "CPU Usage élevé: ${cpu_usage}%"
    fi
    
    # Mémoire
    local memory_info=$(free | grep Mem)
    local memory_used=$(echo $memory_info | awk '{print $3}')
    local memory_total=$(echo $memory_info | awk '{print $2}')
    local memory_percent=$((memory_used * 100 / memory_total))
    
    log_test "Utilisation mémoire: ${memory_percent}%"
    if [ "$memory_percent" -lt 60 ]; then
        log_success "Mémoire usage normal: ${memory_percent}%"
    elif [ "$memory_percent" -lt 80 ]; then
        log_warning "Mémoire usage modéré: ${memory_percent}%"
    else
        log_error "Mémoire usage élevé: ${memory_percent}%"
    fi
    
    # Espace disque
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    log_test "Utilisation disque: ${disk_usage}%"
    if [ "$disk_usage" -lt 70 ]; then
        log_success "Espace disque suffisant: ${disk_usage}%"
    elif [ "$disk_usage" -lt 85 ]; then
        log_warning "Espace disque modéré: ${disk_usage}%"
    else
        log_error "Espace disque faible: ${disk_usage}%"
    fi
}

# Test de connectivité réseau
test_network_connectivity() {
    log_section "TESTS CONNECTIVITÉ RÉSEAU"
    
    # DNS
    test_command "Résolution DNS" "nslookup google.com" "Address:"
    
    # Connectivité Internet
    test_command "Ping Internet" "ping -c 3 8.8.8.8" "3 received"
    
    # API Spotify
    log_test "Connectivité API Spotify"
    if curl -s --connect-timeout 10 "https://api.spotify.com/v1" >/dev/null; then
        log_success "API Spotify accessible"
    else
        log_warning "API Spotify non accessible (normal sans token)"
    fi
    
    # Ports locaux
    local ports=("80" "443" "3000")
    for port in "${ports[@]}"; do
        log_test "Port $port ouvert"
        if netstat -tuln | grep -q ":$port "; then
            log_success "Port $port ouvert"
        else
            if [ "$port" == "3000" ]; then
                log_error "Port $port fermé (critique)"
            else
                log_warning "Port $port fermé"
            fi
        fi
    done
}

# Génération du rapport final
generate_final_report() {
    log_section "RAPPORT FINAL DE VALIDATION"
    echo ""
    
    # Statistiques
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    
    log_info "📊 STATISTIQUES DE VALIDATION"
    log_info "Tests exécutés: $TESTS_TOTAL"
    log_info "Tests réussis: $TESTS_PASSED"
    log_info "Avertissements: $WARNINGS"
    log_info "Erreurs: $ERRORS"
    log_info "Taux de réussite: ${success_rate}%"
    echo ""
    
    # Statut global
    if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -le 5 ]; then
        log_success "🎉 VALIDATION COMPLÈTE RÉUSSIE"
        log_info "✅ Infrastructure prête pour la production"
        log_info "✅ Toutes les vérifications critiques passées"
        log_info "⚠️  $WARNINGS avertissement(s) mineur(s) détecté(s)"
    elif [ "$ERRORS" -le 3 ] && [ "$WARNINGS" -le 10 ]; then
        log_warning "⚠️ VALIDATION PARTIELLEMENT RÉUSSIE"
        log_info "🔶 Infrastructure fonctionnelle avec quelques problèmes mineurs"
        log_info "❌ $ERRORS erreur(s) à corriger"
        log_info "⚠️  $WARNINGS avertissement(s) à considérer"
        log_info "📋 Vérifiez le log complet: $TEST_LOG"
    else
        log_error "❌ VALIDATION ÉCHOUÉE"
        log_info "🚨 Infrastructure non prête pour la production"
        log_info "❌ $ERRORS erreur(s) critique(s) détectée(s)"
        log_info "⚠️  $WARNINGS avertissement(s) détecté(s)"
        log_info "📋 Consultez le log détaillé: $TEST_LOG"
    fi
    
    echo ""
    log_info "📋 Log complet sauvegardé dans: $TEST_LOG"
    log_info "🔍 Commandes de diagnostic utiles:"
    log_info "   • Monitoring: ./scripts/monitoring.sh check"
    log_info "   • Status conteneurs: podman ps -a"
    log_info "   • Logs application: podman logs mxspoty-app"
    log_info "   • Statut services: systemctl status nginx mxspoty-blindtest"
    
    # Code de sortie
    if [ "$ERRORS" -eq 0 ]; then
        exit 0
    elif [ "$ERRORS" -le 3 ]; then
        exit 1
    else
        exit 2
    fi
}

# Fonction principale
main() {
    echo "🧪 VALIDATION INFRASTRUCTURE MXSPOTY BLINDTEST"
    echo "================================================"
    echo ""
    log_info "Début de la validation complète..."
    log_info "Log détaillé: $TEST_LOG"
    echo ""
    
    # Exécution de tous les tests
    test_ubuntu_version
    test_system_dependencies
    test_podman_config
    test_application_containers
    test_web_application
    test_nginx_proxy
    test_system_services
    test_monitoring_system
    test_backup_system
    test_automated_tasks
    test_basic_security
    test_basic_performance
    test_network_connectivity
    
    # Rapport final
    generate_final_report
}

# Gestion des signaux
trap 'log_error "Validation interrompue"; exit 130' INT TERM

# Vérification des prérequis de base
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Répertoire du projet non trouvé: $PROJECT_DIR"
    echo "💡 Clonez d'abord le projet: git clone <repo> $PROJECT_DIR"
    exit 1
fi

# Exécution
case "${1:-}" in
    --help)
        echo "🧪 Script de validation infrastructure MxSpoty BlindTest"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help     Afficher cette aide"
        echo "  (aucune)   Exécuter la validation complète"
        echo ""
        echo "Le script teste:"
        echo "  • Configuration système Ubuntu 24.04"
        echo "  • Installation et configuration Podman"
        echo "  • Conteneurs et application web"
        echo "  • Services système (Nginx, monitoring, backups)"
        echo "  • Sécurité et performance de base"
        echo "  • Connectivité réseau"
        echo ""
        echo "Codes de sortie:"
        echo "  0 = Validation complète réussie"
        echo "  1 = Validation partiellement réussie (problèmes mineurs)"
        echo "  2 = Validation échouée (problèmes critiques)"
        ;;
    *)
        main "$@"
        ;;
esac
