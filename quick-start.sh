#!/bin/bash

###############################################################################
# Habitus Quick Start
# Script rápido para iniciar: BD + API em um comando
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$PROJECT_ROOT/src/Habitus.Api"

echo -e "${BLUE}🚀 Habitus Quick Start${NC}"
echo ""

# Inicia BD
echo -e "${BLUE}1. Iniciando PostgreSQL...${NC}"
cd "$PROJECT_ROOT"
docker compose up postgres -d >/dev/null 2>&1 || true
sleep 2
echo -e "${GREEN}✓ PostgreSQL está em execução${NC}"
echo ""

# Restaura dependências
echo -e "${BLUE}2. Restaurando dependências...${NC}"
cd "$API_DIR"
dotnet restore >/dev/null 2>&1
echo -e "${GREEN}✓ Dependências restauradas${NC}"
echo ""

# Migrações
echo -e "${BLUE}3. Aplicando migrações...${NC}"
dotnet ef database update >/dev/null 2>&1 || sleep 2 && dotnet ef database update >/dev/null 2>&1
echo -e "${GREEN}✓ Migrações aplicadas${NC}"
echo ""

# Inicia API
echo -e "${BLUE}4. Iniciando API...${NC}"
echo ""
echo -e "${GREEN}✓ API iniciada! 🚀${NC}"
echo ""
echo "Endereços disponíveis:"
echo -e "  ${GREEN}• API (HTTP):  http://localhost:5027${NC}"
echo -e "  ${GREEN}• API (HTTPS): https://localhost:7211${NC}"
echo -e "  ${GREEN}• Swagger:     http://localhost:5027/swagger${NC}"
echo ""
echo "Pressiona Ctrl+C para parar"
echo ""

dotnet run
