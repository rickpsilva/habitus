#!/bin/bash

###############################################################################
# Habitus Local Development Runner
# Script para executar a aplicação localmente com o melhor processo
###############################################################################

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório raiz do projeto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$PROJECT_ROOT/src/Habitus.Api"
WEB_DIR="$PROJECT_ROOT/src/habitus-web"

###############################################################################
# Funções Utilitárias
###############################################################################

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

###############################################################################
# Verificação de Prerequisites
###############################################################################

check_prerequisites() {
    separator
    log_info "Verificando prerequisites..."
    separator

    local missing=()

    # Verificar .NET 8
    if ! command -v dotnet &> /dev/null; then
        missing+=(".NET 8 SDK")
    else
        DOTNET_VERSION=$(dotnet --version | cut -d. -f1)
        if [ "$DOTNET_VERSION" -lt 8 ]; then
            missing+=(".NET 8 SDK (versão atual: $DOTNET_VERSION)")
        else
            log_success ".NET 8 SDK encontrado ($(dotnet --version))"
        fi
    fi

    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        missing+=("Docker")
    else
        log_success "Docker encontrado ($(docker --version))"
    fi

    # Verificar Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_warning "Docker Compose não encontrado em 'docker compose', tentando 'docker-compose'..."
        if ! command -v docker-compose &> /dev/null; then
            missing+=("Docker Compose")
        else
            log_success "Docker Compose encontrado (versão clássica)"
        fi
    else
        log_success "Docker Compose encontrado ($(docker compose version))"
    fi

    # Verificar dotnet-ef
    if ! dotnet tool list -g | grep -q "dotnet-ef"; then
        log_warning "dotnet-ef não está instalado globalmente"
        log_info "Instalando dotnet-ef..."
        if dotnet tool install --global dotnet-ef 2>/dev/null; then
            log_success "dotnet-ef instalado com sucesso"
        else
            missing+=("dotnet-ef (ferramenta Entity Framework Core)")
        fi
    else
        log_success "dotnet-ef encontrado"
    fi

    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        missing+=("Node.js")
    else
        log_success "Node.js encontrado ($(node --version))"
    fi

    # Verificar npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    else
        log_success "npm encontrado ($(npm --version))"
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo ""
        log_error "Programas obrigatórios não encontrados:"
        for item in "${missing[@]}"; do
            echo -e "${RED}  • $item${NC}"
        done
        echo ""
        log_info "Instala os programas em falta e tenta novamente."
        exit 1
    fi

    echo ""
}

###############################################################################
# Funções de Operação
###############################################################################

start_database() {
    separator
    log_info "Iniciando base de dados PostgreSQL..."
    separator

    cd "$PROJECT_ROOT"

    # Verifica se o container PostgreSQL já está em execução
    if docker ps | grep -q "habitus-postgres"; then
        log_warning "PostgreSQL já está em execução"
    else
        if docker ps -a | grep -q "habitus-postgres"; then
            log_info "Iniciando container PostgreSQL existente..."
            docker compose up postgres -d
        else
            log_info "Criar e iniciando novo container PostgreSQL..."
            docker compose up postgres -d
        fi
        sleep 3
        log_success "PostgreSQL iniciado com sucesso"
    fi

    echo ""
}

stop_database() {
    separator
    log_info "Parando base de dados PostgreSQL..."
    separator

    cd "$PROJECT_ROOT"
    docker compose down
    log_success "PostgreSQL parado"
    echo ""
}

restore_dependencies() {
    separator
    log_info "Restaurando dependências NuGet..."
    separator

    cd "$API_DIR"
    dotnet restore
    log_success "Dependências restauradas"
    echo ""
}

apply_migrations() {
    separator
    log_info "Aplicando migrações da base de dados..."
    separator

    cd "$API_DIR"

    # Aguarda que o PostgreSQL esteja pronto
    log_info "Aguardando PostgreSQL estar pronto..."
    sleep 2

    dotnet ef database update || {
        log_error "Erro ao aplicar migrações. Tentando novamente em 2 segundos..."
        sleep 2
        dotnet ef database update
    }

    log_success "Migrações aplicadas"
    echo ""
}

run_api() {
    separator
    log_info "Iniciando API Habitus..."
    separator

    cd "$API_DIR"

    log_success "API iniciada! 🚀"
    echo ""
    log_info "Endereços disponíveis:"
    echo -e "${GREEN}  • API (HTTP):  http://localhost:5027${NC}"
    echo -e "${GREEN}  • API (HTTPS): https://localhost:7211${NC}"
    echo -e "${GREEN}  • Swagger:     http://localhost:5027/swagger${NC}"
    echo ""
    log_info "Pressiona Ctrl+C para parar a aplicação"
    echo ""

    dotnet run
}

run_tests() {
    separator
    log_info "Executando testes..."
    separator

    cd "$PROJECT_ROOT"
    dotnet test src/Habitus.slnx
    log_success "Testes concluídos"
    echo ""
}

reset_database() {
    separator
    log_warning "Isto vai APAGAR toda a base de dados!"
    separator

    read -p "Tem a certeza? (s/n): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Ss]$ ]]; then
        cd "$PROJECT_ROOT"
        log_info "Apagando volume e container..."
        docker compose down -v
        log_success "Base de dados resetada"
        echo ""
    else
        log_warning "Operação cancelada"
        echo ""
    fi
}

build_project() {
    separator
    log_info "Compilando projeto..."
    separator

    cd "$PROJECT_ROOT"
    dotnet build src/Habitus.slnx
    log_success "Projeto compilado com sucesso"
    echo ""
}

install_web_dependencies() {
    separator
    log_info "Instalando dependências Node.js (Web App)..."
    separator

    cd "$WEB_DIR"
    npm install
    log_success "Dependências da Web App instaladas"
    echo ""
}

run_web() {
    separator
    log_info "Iniciando Web App (React + Vite)..."
    separator

    cd "$WEB_DIR"

    log_success "Web App iniciada! 🚀"
    echo ""
    log_info "Endereços disponíveis:"
    echo -e "${GREEN}  • Web App: http://localhost:5173${NC}"
    echo ""
    log_info "Pressiona Ctrl+C para parar a aplicação"
    echo ""

    npm run dev
}

build_web() {
    separator
    log_info "Compilando Web App..."
    separator

    cd "$WEB_DIR"
    npm run build
    log_success "Web App compilada com sucesso"
    echo ""
}

show_menu() {
    separator
    echo -e "${BLUE}Habitus - Local Development Runner${NC}"
    separator
    echo "Opções:"
    echo -e "  ${GREEN}1${NC}) Executar tudo (DB + API + Web)"
    echo -e "  ${GREEN}2${NC}) Apenas API (BD já em execução)"
    echo -e "  ${GREEN}3${NC}) Apenas Web App"
    echo -e "  ${GREEN}4${NC}) Apenas BD"
    echo -e "  ${GREEN}5${NC}) Parar base de dados"
    echo -e "  ${GREEN}6${NC}) Executar testes"
    echo -e "  ${GREEN}7${NC}) Compilar projeto (.NET)"
    echo -e "  ${GREEN}8${NC}) Compilar Web App"
    echo -e "  ${GREEN}9${NC}) Reset base de dados (apagar dados)"
    echo -e "  ${GREEN}0${NC}) Sair"
    separator
}

###############################################################################
# Main
###############################################################################

main() {
    # Se tiver argumentos, executa modo não-interativo
    if [ $# -gt 0 ]; then
        case "$1" in
            run)
                check_prerequisites
                start_database
                restore_dependencies
                apply_migrations
                install_web_dependencies
                ;;
            run-all)
                check_prerequisites
                start_database
                restore_dependencies
                apply_migrations
                install_web_dependencies
                log_info "Iniciando API e Web App em paralelo..."
                log_info "Pressiona Ctrl+C para parar tudo"
                # Inicia ambas em background, depois traz para foreground
                (cd "$API_DIR" && dotnet run) &
                API_PID=$!
                sleep 2
                (cd "$WEB_DIR" && npm run dev) &
                WEB_PID=$!
                wait
                ;;
            start-db)
                check_prerequisites
                start_database
                ;;
            stop-db)
                stop_database
                ;;
            api)
                restore_dependencies
                apply_migrations
                run_api
                ;;
            web)
                install_web_dependencies
                run_web
                ;;
            test)
                check_prerequisites
                run_tests
                ;;
            build)
                check_prerequisites
                build_project
                ;;
            build-web)
                install_web_dependencies
                build_web
                ;;
            reset-db)
                reset_database
                ;;
            *)
                echo "Uso: $0 [run|run-all|start-db|stop-db|api|web|test|build|build-web|reset-db]"
                exit 1
                ;;
        esac
    else
        # Modo interativo
        check_prerequisites

        while true; do
            show_menu
            read -p "Escolhe uma opção: " choice

            case $choice in
                1)
                    echo ""
                    start_database
                    restore_dependencies
                    apply_migrations
                    install_web_dependencies
                    log_info "Iniciando API e Web App em paralelo..."
                    log_info "Pressiona Ctrl+C para parar tudo"
                    echo ""
                    (cd "$API_DIR" && dotnet run) &
                    API_PID=$!
                    sleep 2
                    (cd "$WEB_DIR" && npm run dev) &
                    WEB_PID=$!
                    wait
                    ;;
                2)
                    echo ""
                    restore_dependencies
                    apply_migrations
                    run_api
                    ;;
                3)
                    echo ""
                    install_web_dependencies
                    run_web
                    ;;
                4)
                    echo ""
                    start_database
                    ;;
                5)
                    echo ""
                    stop_database
                    ;;
                6)
                    echo ""
                    run_tests
                    ;;
                7)
                    echo ""
                    build_project
                    ;;
                8)
                    echo ""
                    install_web_dependencies
                    build_web
                    ;;
                9)
                    echo ""
                    reset_database
                    ;;
                0)
                    log_info "Adeus! 👋"
                    exit 0
                    ;;
                *)
                    log_error "Opção inválida"
                    echo ""
                    ;;
            esac
        done
    fi
}

# Executa main
main "$@"
