# Scripts de Desenvolvimento Local

Ferramenta automatizada para executar localmente toda a stack Habitus (BD + API + Web App).

## 📋 Prerequisites

- **.NET 8 SDK** - [Descarregar](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Docker & Docker Compose** - [Descarregar](https://www.docker.com/)
- **Node.js & npm** - [Descarregar](https://nodejs.org/) (para React + Vite)
- **dotnet-ef** - Entity Framework Core CLI (instalado automaticamente)

## 🚀 Setup Inicial (Primeira Vez)

```bash
./setup.sh
```

Verifica e instala todas as ferramentas necessárias.

---

## 🚀 Quick Start (Mais Rápido)

Para iniciar tudo em um comando (BD + API + Web App):

```bash
./quick-start.sh
```

Isto vai:
1. ✓ Inicia PostgreSQL
2. ✓ Restaura dependências .NET
3. ✓ Aplica migrações
4. ✓ Restaura dependências Node.js
5. ✓ Inicia API e Web App em paralelo

**Depois, acede a:**
- **API**: http://localhost:5027
- **Swagger**: http://localhost:5027/swagger
- **Web App**: http://localhost:5173

---

## 🛠️ Menu Completo (Mais Controlo)

Para um menu interativo com mais opções:

```bash
./run-local.sh
```

### Opções disponíveis:

```
1) Executar tudo (DB + API + Web)
2) Apenas API (BD já em execução)
3) Apenas Web App
4) Apenas BD
5) Parar base de dados
6) Executar testes
7) Compilar projeto (.NET)
8) Compilar Web App
9) Reset base de dados (apagar dados)
0) Sair
```

### Modo direto (sem menu):

```bash
# Tudo junto (DB + API + Web)
./run-local.sh run

# Inicia API e instala web deps
./run-local.sh run

# Apenas API (BD já em execução)
./run-local.sh api

# Apenas Web App
./run-local.sh web

# Apenas BD
./run-local.sh start-db

# Parar BD
./run-local.sh stop-db

# Executar testes
./run-local.sh test

# Compilar projeto .NET
./run-local.sh build

# Compilar Web App
./run-local.sh build-web

# Executar ambas em paralelo
./run-local.sh run-all

# Reset BD (apagar dados)
./run-local.sh reset-db
```

---

## 🔧 Configuração

### Credenciais PostgreSQL

```
Host:     localhost (ou "postgres" no Docker)
Username: habitus
Password: habitus
Database: habitus
Port:     5432
```

### API - Tokens JWT (Desenvolvimento)

```
Secret:    habitus-super-secret-key-for-development-only
Issuer:    habitus
Audience:  habitus-users
Expiry:    60 minutos
```

### Web App

- **Framework**: React 19 + Vite 7
- **Linguagem**: TypeScript
- **Estilos**: Tailwind CSS 4
- **HTTP Client**: Axios
- **Routing**: React Router v7

---

## 📍 Endereços

| Serviço | URL | Porta |
|---------|-----|-------|
| API (HTTP) | http://localhost:5027 | 5027 |
| API (HTTPS) | https://localhost:7211 | 7211 |
| Swagger | http://localhost:5027/swagger | 5027 |
| Web App | http://localhost:5173 | 5173 |
| PostgreSQL | localhost:5432 | 5432 |

---

## 📚 Usar a API

### 1. Obter Token JWT

```bash
curl -X POST http://localhost:5027/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "resident@habitus.com",
    "password": "Password123!"
  }'
```

### 2. Usar o Token

```bash
curl -X GET http://localhost:5027/api/residents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Documentação Interativa

Visita http://localhost:5027/swagger para explorar todos os endpoints da API.

---

## 🧪 Executar Testes

```bash
# Menu
./run-local.sh test

# Ou diretamente
dotnet test src/Habitus.slnx
```

---

## 🐛 Troubleshooting

### Erro: "could not execute because the specified command or file was not found" (dotnet-ef)

Significa que `dotnet-ef` não está instalado.

**Solução:**

```bash
dotnet tool install --global dotnet-ef
dotnet tool update --global dotnet-ef
dotnet ef --version
```

Depois tenta novamente:

```bash
./quick-start.sh
```

### Porta já em uso

Se a porta 5027 ou 5173 já está em uso:

```bash
# Encontra o processo
lsof -i :5027
lsof -i :5173

# Ou modifica em:
# API:     src/Habitus.Api/Properties/launchSettings.json
# Web App: src/habitus-web/vite.config.ts
```

### PostgreSQL não consegue conectar

```bash
# Verifica se container está em execução
docker ps

# Reinicia tudo
./run-local.sh reset-db
./run-local.sh run
```

### Erro com npm/Node.js

```bash
# Limpa cache npm
npm cache clean --force

# Reinstala dependências
cd src/habitus-web
rm -rf node_modules package-lock.json
npm install
```

### Web App não carrega

```bash
# Verifica se Vite está a rodar
curl http://localhost:5173

# Reinicia manualmente
cd src/habitus-web
npm run dev
```

---

## 📦 Estrutura do Projeto

```
habitus/
├── src/
│   ├── Habitus.Api/           # ASP.NET Core API
│   ├── Habitus.Application/   # Serviços, DTOs
│   ├── Habitus.Infrastructure/# BD, Repositórios, Azure
│   ├── Habitus.Domain/        # Entidades, Lógica Domínio
│   ├── habitus-web/           # React + Vite (Frontend)
│   └── Habitus.slnx           # Solution .NET
├── tests/
│   └── Habitus.Tests/         # Testes xUnit
├── docker-compose.yml         # Configuração Docker
├── setup.sh                   # Script setup
├── quick-start.sh             # Quick start (BD+API+Web)
├── run-local.sh               # Menu interativo
└── README.md
```

---

## ⚡ Dicas Rápidas

```bash
# Apenas build (sem executar)
./run-local.sh build
./run-local.sh build-web

# Resetar dados e começar do zero
./run-local.sh reset-db
./run-local.sh run

# Ver logs do PostgreSQL
docker logs habitus-postgres

# Parar tudo
./run-local.sh stop-db

# Verificar status
docker ps
npm list
dotnet --version
```

---

## 🌐 Integração Frontend-Backend

A Web App comunica com a API via HTTP requests em:

```typescript
// src/habitus-web/src/api/client.ts (ou similar)
const API_BASE_URL = 'http://localhost:5027/api';
```

**Certific-te que:**
1. API está a rodar em `localhost:5027`
2. Web App consegue fazer requests (CORS configurado)
3. O token JWT é enviado nos headers

---

## 📝 Variáveis de Ambiente (Opcional)

Para usar serviços Azure, define as variáveis de ambiente:

```bash
export AzureStorage__ConnectionString="your-connection-string"
export AzureCommunication__ConnectionString="your-connection-string"
export AzureTranslation__Key="your-key"
```

---

Qualquer questão, abre uma issue no repositório! 🙌
