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

# Detectar se estamos dentro de um container Docker
IN_CONTAINER=false
if [ -f "/.dockerenv" ]; then
    IN_CONTAINER=true
    DB_HOST="host.docker.internal"
    echo -e "${YELLOW}⚠ A correr dentro de um container Docker — PostgreSQL deve estar ativo no host.${NC}"
else
    DB_HOST="localhost"
fi

# Para todos os serviços primeiro para garantir um arranque limpo
echo -e "${BLUE}0. Parando serviços existentes...${NC}"
cd "$PROJECT_ROOT"
if [ "$IN_CONTAINER" = false ]; then
    ./run-local.sh stop-all >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Serviços parados${NC}"
else
    echo -e "${YELLOW}⚠ Dentro de container: a ignorar stop-all (sem acesso ao Docker socket)${NC}"
fi
echo ""

# Inicia BD e pgAdmin
echo -e "${BLUE}1. Iniciando PostgreSQL e pgAdmin...${NC}"
cd "$PROJECT_ROOT"
if [ "$IN_CONTAINER" = false ]; then
    docker compose up postgres pgadmin -d >/dev/null 2>&1 || true
    sleep 3
    echo -e "${GREEN}✓ PostgreSQL e pgAdmin estão em execução${NC}"
else
    echo -e "${YELLOW}⚠ Dentro de container: a ignorar 'docker compose up' (sem Docker socket).${NC}"
    echo -e "${YELLOW}  Garante que o PostgreSQL está a correr no host antes de continuar.${NC}"
    echo -e "${YELLOW}  No host: cd /path/to/habitus && docker compose up postgres pgadmin -d${NC}"
    # Aguarda que o postgres esteja acessível
    echo -e "${BLUE}  Aguardando PostgreSQL em $DB_HOST:5432...${NC}"
    for i in $(seq 1 15); do
        if (echo > /dev/tcp/"$DB_HOST"/5432) 2>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL acessível em $DB_HOST:5432${NC}"
            break
        fi
        if [ "$i" -eq 15 ]; then
            echo -e "${RED}✗ PostgreSQL não acessível em $DB_HOST:5432 após 15s.${NC}"
            echo -e "${RED}  Inicia o PostgreSQL no host e tenta novamente.${NC}"
            exit 1
        fi
        sleep 1
    done
fi
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
DB_CONN="Host=$DB_HOST;Port=5432;Database=habitus;Username=habitus;Password=habitus"

if [ ! -d "$INFRA_DIR/Migrations" ]; then
    echo -e "${BLUE}ℹ Criando migração inicial...${NC}"
    dotnet ef migrations add InitialCreate --project "$INFRA_DIR" --startup-project "$API_DIR" >/dev/null 2>&1
fi

# Aplica as migrations
if ! dotnet ef database update --project "$INFRA_DIR" --startup-project "$API_DIR" --connection "$DB_CONN"; then
    echo -e "${RED}Tentando novamente em 2 segundos...${NC}"
    sleep 2
    dotnet ef database update --project "$INFRA_DIR" --startup-project "$API_DIR" --connection "$DB_CONN"
fi
echo -e "${GREEN}✓ Migrações aplicadas${NC}"
echo ""

# Restaura dependências Node.js
echo -e "${BLUE}4. Instalando dependências Node.js (Web App)...${NC}"
cd "$WEB_DIR"
if ! npm install --legacy-peer-deps --silent; then
    echo -e "${RED}✗ Erro ao instalar dependências Node.js${NC}"
    exit 1
fi
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
echo "Credenciais utilizador default da aplicação:"
echo -e "  ${GREEN}• Nome:     Default User${NC}"
echo -e "  ${GREEN}• Email:    default_user@habitus.com${NC}"
echo -e "  ${GREEN}• Password: admin.1234${NC}"
echo ""
echo "Pressiona Ctrl+C para parar tudo"
echo ""

# Inicia API em background (bind em 0.0.0.0 para ser acessível do host)
cd "$API_DIR"
dotnet run --urls "http://0.0.0.0:5027" &
API_PID=$!

# Aguarda um pouco e inicia Web (--host expõe ao host)
sleep 2
cd "$WEB_DIR"
npm run dev -- --host &
WEB_PID=$!

# Aguarda ambas
wait
