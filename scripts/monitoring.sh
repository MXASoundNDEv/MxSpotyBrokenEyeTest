#!/bin/bash
# 📊 Script de monitoring avancé pour MxSpoty BlindTest
# Surveillance de l'état du système, des conteneurs et de l'application

set -e

# Configuration
PROJECT_NAME="mxspoty-blindtest"
LOG_FILE="/var/log/mxspoty-monitoring.log"
METRICS_FILE="/var/log/mxspoty-metrics.json"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=90
ALERT_THRESHOLD_DISK=85
ALERT_THRESHOLD_RESPONSE_TIME=5000  # ms

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { log "${YELLOW}[WARNING]${NC} $1"; }
log_error() { log "${RED}[ERROR]${NC} $1"; }
log_metric() { log "${PURPLE}[METRIC]${NC} $1"; }

# Fonction pour envoyer des alertes (à personnaliser)
send_alert() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log de l'alerte
    log "${RED}[ALERT-${level}]${NC} $message"
    
    # Envoi par syslog
    logger -t "mxspoty-monitoring" -p user.${level} "$message"
    
    # Ici vous pourriez ajouter d'autres moyens d'alerte:
    # - Email avec sendmail
    # - Webhook Slack/Discord
    # - Notification push
    # - SMS via API
    
    # Exemple d'envoi par webhook (décommenter et configurer)
    # if [ -n "$WEBHOOK_URL" ]; then
    #     curl -s -X POST "$WEBHOOK_URL" \
    #          -H "Content-Type: application/json" \
    #          -d "{\"text\":\"🚨 $level: $message\", \"timestamp\":\"$timestamp\"}" \
    #          >/dev/null || true
    # fi
}

# Vérification de l'état du système
check_system_health() {
    log_info "🔍 Vérification de l'état du système..."
    
    local issues=0
    local metrics={}
    
    # CPU Usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    cpu_usage=${cpu_usage%.*}  # Supprime les décimales
    
    log_metric "CPU Usage: ${cpu_usage}%"
    
    if [ "${cpu_usage}" -gt "$ALERT_THRESHOLD_CPU" ]; then
        send_alert "warning" "CPU Usage élevé: ${cpu_usage}% (seuil: ${ALERT_THRESHOLD_CPU}%)"
        ((issues++))
    fi
    
    # Memory Usage
    local memory_info=$(free | grep Mem)
    local memory_total=$(echo $memory_info | awk '{print $2}')
    local memory_used=$(echo $memory_info | awk '{print $3}')
    local memory_percent=$((memory_used * 100 / memory_total))
    
    log_metric "Memory Usage: ${memory_percent}% (${memory_used}/${memory_total})"
    
    if [ "$memory_percent" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
        send_alert "warning" "Utilisation mémoire élevée: ${memory_percent}% (seuil: ${ALERT_THRESHOLD_MEMORY}%)"
        ((issues++))
    fi
    
    # Disk Usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    log_metric "Disk Usage: ${disk_usage}%"
    
    if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
        send_alert "warning" "Espace disque faible: ${disk_usage}% (seuil: ${ALERT_THRESHOLD_DISK}%)"
        ((issues++))
    fi
    
    # Load Average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    log_metric "Load Average: $load_avg"
    
    # Uptime
    local uptime_info=$(uptime -p)
    log_metric "System Uptime: $uptime_info"
    
    # Nombre de processus
    local process_count=$(ps aux | wc -l)
    log_metric "Active Processes: $process_count"
    
    return $issues
}

# Vérification des conteneurs Podman
check_containers() {
    log_info "🐋 Vérification des conteneurs Podman..."
    
    local issues=0
    
    if ! command -v podman &> /dev/null; then
        send_alert "error" "Podman n'est pas installé ou inaccessible"
        return 1
    fi
    
    # Vérification des pods
    local pod_status=$(podman pod ls --filter name=mxspoty --format "{{.Status}}" 2>/dev/null | head -1)
    
    if [ -n "$pod_status" ]; then
        log_metric "Pod mxspoty status: $pod_status"
        
        if [[ "$pod_status" != *"Running"* ]]; then
            send_alert "error" "Pod mxspoty n'est pas en cours d'exécution: $pod_status"
            ((issues++))
        fi
    else
        log_warning "Aucun pod mxspoty trouvé"
    fi
    
    # Vérification des conteneurs individuels
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local container_info=($line)
            local container_name=${container_info[0]}
            local container_status=${container_info[1]}
            
            log_metric "Container $container_name: $container_status"
            
            if [[ "$container_status" != "running" ]]; then
                send_alert "warning" "Container $container_name n'est pas en cours d'exécution: $container_status"
                ((issues++))
            fi
            
            # Statistiques du conteneur si en cours d'exécution
            if [[ "$container_status" == "running" ]]; then
                local stats=$(podman stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" "$container_name" 2>/dev/null || echo "N/A N/A")
                log_metric "Container $container_name stats: CPU: $(echo $stats | awk '{print $1}'), Memory: $(echo $stats | awk '{print $2}')"
            fi
        fi
    done < <(podman ps --format "{{.Names}} {{.Status}}" 2>/dev/null | grep -E "mxspoty|blindtest" || true)
    
    return $issues
}

# Vérification de l'application web
check_application() {
    log_info "🌐 Vérification de l'application web..."
    
    local issues=0
    local app_url="http://localhost:3000"
    local health_endpoint="$app_url/health"
    
    # Test de connectivité de base
    if curl -s --connect-timeout 10 "$health_endpoint" >/dev/null; then
        log_success "Application accessible sur $health_endpoint"
        
        # Mesure du temps de réponse
        local response_time=$(curl -o /dev/null -s -w "%{time_total}" "$health_endpoint" | awk '{print int($1*1000)}')
        log_metric "Response time: ${response_time}ms"
        
        if [ "$response_time" -gt "$ALERT_THRESHOLD_RESPONSE_TIME" ]; then
            send_alert "warning" "Temps de réponse élevé: ${response_time}ms (seuil: ${ALERT_THRESHOLD_RESPONSE_TIME}ms)"
            ((issues++))
        fi
        
        # Vérification du contenu de la réponse santé
        local health_response=$(curl -s "$health_endpoint" 2>/dev/null)
        if echo "$health_response" | grep -q "OK" || echo "$health_response" | grep -q "healthy"; then
            log_success "Health check: OK"
        else
            send_alert "warning" "Health check response inattendue: $health_response"
            ((issues++))
        fi
        
    else
        send_alert "error" "Application inaccessible sur $health_endpoint"
        ((issues++))
        
        # Vérification si le port est ouvert
        if netstat -tuln | grep -q ":3000 "; then
            log_info "Port 3000 ouvert mais application ne répond pas"
        else
            log_error "Port 3000 fermé"
        fi
    fi
    
    # Vérification des endpoints critiques
    local endpoints=("/api/playlists" "/api/devices" "/")
    
    for endpoint in "${endpoints[@]}"; do
        local full_url="$app_url$endpoint"
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$full_url" || echo "000")
        
        if [[ "$http_code" =~ ^[23] ]]; then
            log_metric "Endpoint $endpoint: HTTP $http_code ✅"
        else
            log_warning "Endpoint $endpoint: HTTP $http_code ❌"
            if [[ "$http_code" == "000" ]]; then
                ((issues++))
            fi
        fi
    done
    
    return $issues
}

# Vérification des services système
check_services() {
    log_info "⚙️ Vérification des services système..."
    
    local issues=0
    local services=("nginx" "mxspoty-blindtest")
    
    for service in "${services[@]}"; do
        local service_status=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
        local service_enabled=$(systemctl is-enabled "$service" 2>/dev/null || echo "disabled")
        
        log_metric "Service $service: $service_status ($service_enabled)"
        
        if [ "$service_status" != "active" ]; then
            send_alert "error" "Service $service n'est pas actif: $service_status"
            ((issues++))
        fi
        
        if [ "$service_enabled" != "enabled" ]; then
            log_warning "Service $service n'est pas activé au démarrage"
        fi
    done
    
    return $issues
}

# Vérification de la connectivité réseau
check_network() {
    log_info "🌐 Vérification de la connectivité réseau..."
    
    local issues=0
    
    # Test DNS
    if nslookup google.com >/dev/null 2>&1; then
        log_success "Résolution DNS: OK"
    else
        send_alert "error" "Problème de résolution DNS"
        ((issues++))
    fi
    
    # Test connectivité Internet
    if ping -c 3 8.8.8.8 >/dev/null 2>&1; then
        log_success "Connectivité Internet: OK"
    else
        send_alert "error" "Pas de connectivité Internet"
        ((issues++))
    fi
    
    # Test connectivité Spotify API (si configuré)
    if curl -s --connect-timeout 10 "https://api.spotify.com/v1" >/dev/null; then
        log_success "API Spotify accessible: OK"
    else
        log_warning "API Spotify non accessible (peut être normal sans token)"
    fi
    
    # Vérification des ports ouverts
    local ports=("80" "443" "3000")
    for port in "${ports[@]}"; do
        if netstat -tuln | grep -q ":$port "; then
            log_metric "Port $port: ouvert ✅"
        else
            log_warning "Port $port: fermé ❌"
            if [ "$port" == "3000" ]; then
                ((issues++))
            fi
        fi
    done
    
    return $issues
}

# Vérification des logs pour erreurs
check_logs() {
    log_info "📋 Vérification des logs récents..."
    
    local issues=0
    local time_window="1 hour ago"
    
    # Logs système critiques
    local error_count=$(journalctl --since "$time_window" -p err -q | wc -l)
    log_metric "Erreurs système (dernière heure): $error_count"
    
    if [ "$error_count" -gt 10 ]; then
        send_alert "warning" "Nombre élevé d'erreurs système: $error_count dans la dernière heure"
        ((issues++))
    fi
    
    # Logs de l'application si disponibles
    if [ -d "/var/log/mxspoty-blindtest" ]; then
        local app_errors=$(find /var/log/mxspoty-blindtest -name "*.log" -newermt "$time_window" -exec grep -i "error\|exception\|failed" {} \; 2>/dev/null | wc -l)
        log_metric "Erreurs application (dernière heure): $app_errors"
        
        if [ "$app_errors" -gt 5 ]; then
            send_alert "warning" "Erreurs application détectées: $app_errors dans la dernière heure"
            ((issues++))
        fi
    fi
    
    # Logs Nginx si disponibles
    if [ -f "/var/log/nginx/error.log" ]; then
        local nginx_errors=$(awk -v since="$(date -d "$time_window" "+%d/%b/%Y:%H:%M:%S")" '$4 >= "["since' /var/log/nginx/error.log 2>/dev/null | wc -l)
        log_metric "Erreurs Nginx (dernière heure): $nginx_errors"
        
        if [ "$nginx_errors" -gt 20 ]; then
            send_alert "warning" "Erreurs Nginx élevées: $nginx_errors dans la dernière heure"
            ((issues++))
        fi
    fi
    
    return $issues
}

# Collecte des métriques pour Prometheus (format exposition)
collect_metrics() {
    log_info "📊 Collecte des métriques..."
    
    local metrics_output="/var/lib/node_exporter/mxspoty_metrics.prom"
    mkdir -p "$(dirname "$metrics_output")"
    
    {
        echo "# HELP mxspoty_system_cpu_usage System CPU usage percentage"
        echo "# TYPE mxspoty_system_cpu_usage gauge"
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        echo "mxspoty_system_cpu_usage ${cpu_usage%.*}"
        
        echo "# HELP mxspoty_system_memory_usage System memory usage percentage"
        echo "# TYPE mxspoty_system_memory_usage gauge"
        local memory_info=$(free | grep Mem)
        local memory_total=$(echo $memory_info | awk '{print $2}')
        local memory_used=$(echo $memory_info | awk '{print $3}')
        local memory_percent=$((memory_used * 100 / memory_total))
        echo "mxspoty_system_memory_usage $memory_percent"
        
        echo "# HELP mxspoty_system_disk_usage System disk usage percentage"
        echo "# TYPE mxspoty_system_disk_usage gauge"
        local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
        echo "mxspoty_system_disk_usage $disk_usage"
        
        echo "# HELP mxspoty_app_response_time Application response time in milliseconds"
        echo "# TYPE mxspoty_app_response_time gauge"
        local response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:3000/health" 2>/dev/null | awk '{print int($1*1000)}' || echo "0")
        echo "mxspoty_app_response_time $response_time"
        
        echo "# HELP mxspoty_containers_running Number of running containers"
        echo "# TYPE mxspoty_containers_running gauge"
        local running_containers=$(podman ps -q 2>/dev/null | wc -l || echo "0")
        echo "mxspoty_containers_running $running_containers"
        
        echo "# HELP mxspoty_monitoring_last_check_timestamp Last monitoring check timestamp"
        echo "# TYPE mxspoty_monitoring_last_check_timestamp gauge"
        echo "mxspoty_monitoring_last_check_timestamp $(date +%s)"
        
    } > "$metrics_output"
    
    log_success "Métriques sauvegardées dans $metrics_output"
}

# Génération du rapport HTML
generate_report() {
    local total_issues=$1
    local report_file="/var/www/html/monitoring-report.html"
    
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MxSpoty BlindTest - Rapport de Monitoring</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }
        .status { padding: 15px; border-radius: 5px; margin: 10px 0; font-weight: bold; }
        .status.ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .metric { display: flex; justify-content: space-between; padding: 10px; margin: 5px 0; background: #f8f9fa; border-left: 4px solid #007bff; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; }
        .timestamp { text-align: center; margin-top: 20px; color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 MxSpoty BlindTest</h1>
            <h2>Rapport de Monitoring</h2>
        </div>
        
        <div class="status $([ $total_issues -eq 0 ] && echo "ok" || ([ $total_issues -lt 5 ] && echo "warning" || echo "error"))">
            État général: $([ $total_issues -eq 0 ] && echo "✅ Tout va bien" || echo "⚠️ $total_issues problème(s) détecté(s)")
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>💻 Système</h3>
                <div class="metric"><span>CPU Usage</span><span>$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')%</span></div>
                <div class="metric"><span>Memory Usage</span><span>$(free | grep Mem | awk '{printf "%.1f%%", $3*100/$2}') </span></div>
                <div class="metric"><span>Disk Usage</span><span>$(df / | tail -1 | awk '{print $5}')</span></div>
                <div class="metric"><span>Uptime</span><span>$(uptime -p)</span></div>
            </div>
            
            <div class="card">
                <h3>🐋 Conteneurs</h3>
                <div class="metric"><span>Conteneurs actifs</span><span>$(podman ps -q 2>/dev/null | wc -l || echo "0")</span></div>
                <div class="metric"><span>Images</span><span>$(podman images -q 2>/dev/null | wc -l || echo "0")</span></div>
                <div class="metric"><span>Pods</span><span>$(podman pod ls -q 2>/dev/null | wc -l || echo "0")</span></div>
            </div>
            
            <div class="card">
                <h3>🌐 Application</h3>
                <div class="metric"><span>Status HTTP</span><span>$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "N/A")</span></div>
                <div class="metric"><span>Temps de réponse</span><span>$(curl -o /dev/null -s -w "%{time_total}s" http://localhost:3000/health 2>/dev/null || echo "N/A")</span></div>
            </div>
            
            <div class="card">
                <h3>⚙️ Services</h3>
                <div class="metric"><span>Nginx</span><span>$(systemctl is-active nginx 2>/dev/null || echo "inactive")</span></div>
                <div class="metric"><span>MxSpoty Service</span><span>$(systemctl is-active mxspoty-blindtest 2>/dev/null || echo "inactive")</span></div>
            </div>
        </div>
        
        <div class="timestamp">
            Dernière mise à jour: $(date '+%Y-%m-%d %H:%M:%S')
        </div>
    </div>
</body>
</html>
EOF

    log_success "Rapport HTML généré: $report_file"
}

# Auto-réparation basique
auto_repair() {
    log_info "🔧 Tentative d'auto-réparation..."
    
    local repairs_made=0
    
    # Redémarrer les services en panne
    for service in "nginx" "mxspoty-blindtest"; do
        if ! systemctl is-active "$service" >/dev/null 2>&1; then
            log_info "Redémarrage du service $service..."
            systemctl restart "$service" && ((repairs_made++))
        fi
    done
    
    # Nettoyer les conteneurs en erreur
    local failed_containers=$(podman ps -a --filter "status=exited" --format "{{.Names}}" 2>/dev/null | grep -E "mxspoty|blindtest" || true)
    if [ -n "$failed_containers" ]; then
        echo "$failed_containers" | while read -r container; do
            log_info "Redémarrage du conteneur $container..."
            podman restart "$container" 2>/dev/null && ((repairs_made++)) || true
        done
    fi
    
    # Nettoyer l'espace disque si nécessaire
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 80 ]; then
        log_info "Nettoyage de l'espace disque..."
        
        # Nettoyage des logs anciens
        find /var/log -name "*.log" -mtime +7 -size +100M -delete 2>/dev/null || true
        
        # Nettoyage Docker/Podman
        podman system prune -f >/dev/null 2>&1 || true
        
        ((repairs_made++))
    fi
    
    log_info "Réparations effectuées: $repairs_made"
    return $repairs_made
}

# Fonction principale
main() {
    local mode=${1:-"check"}
    
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$METRICS_FILE")"
    
    case "$mode" in
        "check"|"")
            log_info "🚀 Début du monitoring complet..."
            
            local total_issues=0
            
            check_system_health && ((total_issues+=$?))
            check_containers && ((total_issues+=$?))  
            check_application && ((total_issues+=$?))
            check_services && ((total_issues+=$?))
            check_network && ((total_issues+=$?))
            check_logs && ((total_issues+=$?))
            
            collect_metrics
            generate_report "$total_issues"
            
            if [ "$total_issues" -eq 0 ]; then
                log_success "✅ Monitoring terminé - Aucun problème détecté"
            elif [ "$total_issues" -lt 5 ]; then
                log_warning "⚠️ Monitoring terminé - $total_issues problème(s) mineur(s) détecté(s)"
            else
                log_error "❌ Monitoring terminé - $total_issues problème(s) critique(s) détecté(s)"
                
                # Auto-réparation si activée
                if [ "${AUTO_REPAIR:-false}" == "true" ]; then
                    auto_repair
                fi
            fi
            
            exit "$total_issues"
            ;;
            
        "repair")
            log_info "🔧 Mode réparation..."
            auto_repair
            ;;
            
        "metrics")
            log_info "📊 Collecte des métriques uniquement..."
            collect_metrics
            ;;
            
        "report")
            log_info "📋 Génération du rapport uniquement..."
            generate_report 0
            ;;
            
        *)
            echo "📊 Script de monitoring MxSpoty BlindTest"
            echo ""
            echo "Usage: $0 [MODE]"
            echo ""
            echo "Modes:"
            echo "  check    Monitoring complet (défaut)"
            echo "  repair   Auto-réparation"
            echo "  metrics  Collecte des métriques seulement"
            echo "  report   Génération du rapport seulement"
            echo ""
            echo "Variables d'environnement:"
            echo "  AUTO_REPAIR=true    Active l'auto-réparation"
            echo "  WEBHOOK_URL=...     URL pour les alertes webhook"
            echo ""
            exit 1
            ;;
    esac
}

# Gestion des signaux
trap 'log_error "Monitoring interrompu"; exit 1' INT TERM

# Exécution
main "$@"
