#!/bin/bash

###############################################################################
# Habitus Stop All Services
# Script para parar todos os serviços do Habitus (Docker + Processos)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

separator() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# Diretório raiz do projeto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

###############################################################################
# Funções
###############################################################################

kill_port() {
    local port=$1
    local service=$2
    
    # Encontra todos os processos na porta
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        log_warning "$service (porta $port): Nenhum processo encontrado"
    else
        log_info "Matando $service (porta $port) - PIDs: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        log_success "$service (porta $port) parado"
    fi
}

stop_docker_containers() {
    separator
    log_info "Parando containers Docker..."
    separator
    
    cd "$PROJECT_ROOT"
    
    # Para todos os containers deste projeto
    if docker compose ps --services | grep -q .; then
        docker compose down 2>/dev/null || true
        log_success "Containers Docker parados"
    else
        log_warning "Nenhum container ativo"
    fi
    
    echo ""
}

kill_all_ports() {
    separator
    log_info "Matando processos nas portas específicas..."
    separator
    
    kill_port 5432 "PostgreSQL"
    kill_port 5050 "pgAdmin"
    kill_port 5027 "API (HTTP)"
    kill_port 7211 "API (HTTPS)"
    kill_port 5173 "Web App (Vite)"
    kill_port 3000 "Web App"
    
    echo ""
}

show_listening_ports() {
    separator
    log_info "Verificando portas em uso..."
    separator
    
    local ports=(5432 5050 5027 7211 5173 3000)
    local found=0
    
    for port in "${ports[@]}"; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            local process_info=$(lsof -i :$port 2>/dev/null | tail -1)
            echo -e "${YELLOW}Porta $port: $process_info${NC}"
            found=1
        fi
    done
    
    if [ $found -eq 0 ]; then
        log_success "Nenhuma porta em uso"
    fi
    
    echo ""
}

###############################################################################
# Main
###############################################################################

main() {
    separator
    echo -e "${BLUE}Habitus - Stop All Services${NC}"
    separator
    echo ""
    
    # Mostrar portas em uso
    show_listening_ports
    
    # Parar containers Docker
    stop_docker_containers
    
    # Matar processos nas portas
    kill_all_ports
    
    # Verificar se alguma porta ainda está em uso
    separator
    log_info "Verificação final..."
    separator
    
    local ports=(5432 5050 5027 7211 5173 3000)
    local still_running=0
    
    for port in "${ports[@]}"; do
        if lsof -ti :$port >/dev/null 2>&1; then
            still_running=1
            log_warning "Porta $port ainda está em uso"
        fi
    done
    
    if [ $still_running -eq 0 ]; then
        log_success "Todos os serviços foram parados com sucesso! ✓"
    else
        log_error "Algumas portas ainda estão em uso. Tenta executar este script novamente."
        echo ""
        log_info "Para forçar ainda mais, executa:"
        echo "  sudo killall -9 dotnet"
        echo "  sudo killall -9 node"
    fi
    
    echo ""
}

main
