#!/bin/bash

###############################################################################
# Habitus Status - Ver quais portas estão em uso
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

separator() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

separator
echo -e "${BLUE}Habitus - Port Status${NC}"
separator
echo ""

# Services mapeadas
declare -A services=(
    [5432]="PostgreSQL"
    [5050]="pgAdmin"
    [5027]="API (HTTP)"
    [7211]="API (HTTPS)"
    [5173]="Web App (Vite DEV)"
    [3000]="Web App (Production)"
)

found=0

for port in "${!services[@]}"; do
    service="${services[$port]}"
    if lsof -i :$port >/dev/null 2>&1; then
        found=1
        process=$(lsof -i :$port 2>/dev/null | tail -1 | awk '{print $1, "PID:", $2}')
        echo -e "${GREEN}✓${NC} $service (porta $port)"
        echo -e "   ${YELLOW}$process${NC}"
    else
        echo -e "${RED}✗${NC} $service (porta $port) - não está em execução"
    fi
done

echo ""
separator

if [ $found -eq 0 ]; then
    echo -e "${RED}⚠ Nenhum serviço Habitus está a correr${NC}"
    echo ""
    echo "Inicia com: ./run-local.sh"
else
    echo -e "${GREEN}✓ Alguns serviços estão em execução${NC}"
    echo ""
    echo "Para parar tudo, executa: ./stop-all.sh"
fi

echo ""
