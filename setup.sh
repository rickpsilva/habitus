#!/bin/bash

###############################################################################
# Habitus Setup - Install all required tools
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

separator
log_info "Habitus Setup - Instalando ferramentas necessárias"
separator
echo ""

# Verificar .NET SDK
log_info "Verificando .NET 8 SDK..."
if ! command -v dotnet &> /dev/null; then
    log_error ".NET 8 SDK não encontrado"
    log_info "Descarrega em: https://dotnet.microsoft.com/download/dotnet/8.0"
    exit 1
else
    DOTNET_VERSION=$(dotnet --version | cut -d. -f1)
    if [ "$DOTNET_VERSION" -lt 8 ]; then
        log_error ".NET 8 SDK requerido (tens versão $DOTNET_VERSION)"
        log_info "Descarrega em: https://dotnet.microsoft.com/download/dotnet/8.0"
        exit 1
    fi
    log_success ".NET $(dotnet --version) encontrado"
fi
echo ""

# Instalar dotnet-ef
log_info "Verificando dotnet-ef (Entity Framework Core CLI)..."
if dotnet tool list -g | grep -q "dotnet-ef"; then
    log_success "dotnet-ef já está instalado"
    dotnet ef --version
else
    log_warning "dotnet-ef não está instalado"
    log_info "Instalando dotnet-ef globalmente..."

    if dotnet tool install --global dotnet-ef; then
        log_success "dotnet-ef instalado com sucesso"
        dotnet ef --version
    else
        log_error "Falha ao instalar dotnet-ef"
        exit 1
    fi
fi
echo ""

# Verificar Docker
log_info "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    log_error "Docker não encontrado"
    log_info "Descarrega em: https://www.docker.com/"
    exit 1
else
    log_success "$(docker --version) encontrado"
fi
echo ""

# Verificar Docker Compose
log_info "Verificando Docker Compose..."
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose não encontrado"
    log_info "Descarrega em: https://www.docker.com/"
    exit 1
else
    if command -v docker compose &> /dev/null; then
        log_success "Docker Compose encontrado (integrado no Docker)"
    else
        log_success "Docker Compose encontrado (versão clássica)"
    fi
fi
echo ""

# Resumo
separator
log_success "Setup completo! Todas as ferramentas estão instaladas."
separator
echo ""
log_info "Próximos passos:"
echo -e "  ${GREEN}1. ./quick-start.sh${NC}     # Para iniciar tudo"
echo -e "  ${GREEN}2. ./run-local.sh${NC}       # Para menu interativo"
echo ""
