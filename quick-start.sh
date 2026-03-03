#!/bin/bash

###############################################################################
# Habitus Quick Start
# Script rápido para iniciar: BD + API + Web em um comando
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$PROJECT_ROOT/src/Habitus.Api"
WEB_DIR="$PROJECT_ROOT/src/habitus-web"

echo -e "${BLUE}🚀 Habitus Quick Start${NC}"
echo ""

# Para todos os serviços primeiro para garantir um arranque limpo
echo -e "${BLUE}0. Parando serviços existentes...${NC}"
cd "$PROJECT_ROOT"
./run-local.sh stop-all >/dev/null 2>&1 || true
echo -e "${GREEN}✓ Serviços parados${NC}"
echo ""

# Inicia BD e pgAdmin
echo -e "${BLUE}1. Iniciando PostgreSQL e pgAdmin...${NC}"
cd "$PROJECT_ROOT"
docker compose up postgres pgadmin -d >/dev/null 2>&1 || true
sleep 3
echo -e "${GREEN}✓ PostgreSQL e pgAdmin estão em execução${NC}"
echo ""

# Restaura dependências .NET
echo -e "${BLUE}2. Restaurando dependências .NET...${NC}"
cd "$API_DIR"
dotnet restore >/dev/null 2>&1
echo -e "${GREEN}✓ Dependências .NET restauradas${NC}"
echo ""

# Migrações BD
echo -e "${BLUE}3. Criando e aplicando migrações...${NC}"

# Verifica se há migrations folder, se não cria a inicial
INFRA_DIR="$PROJECT_ROOT/src/Habitus.Infrastructure"
if [ ! -d "$INFRA_DIR/Migrations" ]; then
    echo -e "${BLUE}ℹ Criando migração inicial...${NC}"
    dotnet ef migrations add InitialCreate --project "$INFRA_DIR" >/dev/null 2>&1
fi

# Aplica as migrations
if ! dotnet ef database update; then
    echo -e "${RED}Tentando novamente em 2 segundos...${NC}"
    sleep 2
    dotnet ef database update
fi
echo -e "${GREEN}✓ Migrações aplicadas${NC}"
echo ""

# Restaura dependências Node.js
echo -e "${BLUE}4. Instalando dependências Node.js (Web App)...${NC}"
cd "$WEB_DIR"
npm install >/dev/null 2>&1
echo -e "${GREEN}✓ Dependências Node.js instaladas${NC}"
echo ""

# Inicia ambas
echo -e "${BLUE}5. Iniciando API e Web App em paralelo...${NC}"
echo ""
echo -e "${GREEN}✓ Aplicações iniciadas! 🚀${NC}"
echo ""
echo "Endereços disponíveis:"
echo -e "  ${GREEN}• PostgreSQL:  localhost:5432${NC}"
echo -e "  ${GREEN}• pgAdmin:     http://localhost:5050${NC}"
echo -e "  ${GREEN}• API (HTTP):  http://localhost:5027${NC}"
echo -e "  ${GREEN}• API (HTTPS): https://localhost:7211${NC}"
echo -e "  ${GREEN}• Swagger:     http://localhost:5027/swagger${NC}"
echo -e "  ${GREEN}• Web App:     http://localhost:5173${NC}"
echo ""
echo "Credenciais pgAdmin:"
echo -e "  ${GREEN}• Email:    admin@habitus.com${NC}"
echo -e "  ${GREEN}• Password: admin${NC}"
echo ""
echo "Pressiona Ctrl+C para parar tudo"
echo ""

# Inicia API em background
cd "$API_DIR"
dotnet run &
API_PID=$!

# Aguarda um pouco e inicia Web
sleep 2
cd "$WEB_DIR"
npm run dev &
WEB_PID=$!

# Aguarda ambas
wait
