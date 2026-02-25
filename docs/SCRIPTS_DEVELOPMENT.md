# Scripts de Desenvolvimento Local

Ferramenta automatizada para executar localmente toda a stack Habitus (BD + API + Web App).

## 📋 Prerequisites

- **.NET 8 SDK** - [Descarregar](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Docker & Docker Compose** - [Descarregar](https://www.docker.com/)
- **Node.js & npm** - [Descarregar](https://nodejs.org/) (para React + Vite Web App)
- **dotnet-ef** - Entity Framework Core CLI (instalado automaticamente)

## 🚀 Setup Inicial

### Primeira vez? Executa o setup:

```bash
./setup.sh
```

Isto verifica e instala todas as ferramentas necessárias (especialmente `dotnet-ef`).

---

## 🚀 Quick Start (Mais Rápido)

Para iniciar tudo em um comando (BD + API + Web App):

```bash
./quick-start.sh
```

Isto:
1. ✓ Inicia PostgreSQL
2. ✓ Restaura dependências .NET
3. ✓ Cria e aplica migrações (incluindo dados iniciais)
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
9) Criar Admin User
10) Reset base de dados (apagar dados)
0) Sair
```

### Modo direto (sem menu):

```bash
# Tudo junto (DB + API + Web)
./run-local.sh run

# Prepara tudo e inicia ambas em paralelo
./run-local.sh run-all

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

# Criar Admin User (API deve estar a rodar)
./run-local.sh create-admin

# Reset BD (apagar dados)
./run-local.sh reset-db
```

---

## 🔧 Configuração

### Credenciais PostgreSQL (Padrão)
```
Host:     localhost (ou "postgres" no Docker)
Username: habitus
Password: habitus
Database: habitus
Port:     5432
```

### Tokens JWT (Desenvolvimento)
```
Secret:    habitus-super-secret-key-for-development-only
Issuer:    habitus
Audience:  habitus-users
Expiry:    60 minutos
```

### Web App (React + Vite)

- **Framework**: React 19 + Vite 7
- **Linguagem**: TypeScript
- **Estilos**: Tailwind CSS 4
- **HTTP Client**: Axios
- **Routing**: React Router v7
- **Porta**: http://localhost:5173

### Variáveis de Ambiente (Opcional)

Para usar serviços Azure, define as variáveis de ambiente:

```bash
export AzureStorage__ConnectionString="your-connection-string"
export AzureCommunication__ConnectionString="your-connection-string"
export AzureTranslation__Key="your-key"
```

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

## 📚 Usando a API

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

Visita http://localhost:5027/swagger para explorar todos os endpoints.

---

## 👤 Criar Admin User

Depois da aplicação estar em execução, podes criar um utilizador admin facilmente:

### Via Script (Recomendado)

```bash
# Menu interativo
./run-local.sh
# Escolhe a opção 9: "Criar Admin User"

# Ou diretamente
./run-local.sh create-admin
```

O script vai pedir:
- **Nome** (default: Admin User)
- **Email** (default: admin@habitus.com)
- **Telefone** (default: +351912345678)
- **Password** (não é mostrada enquanto escreves)
- **Unit ID** (default: 00000000-0000-0000-0000-000000000001 — já existe de forma automática)

Depois mostra as credenciais para fazer login.

**Nota:** O Unit ID padrão é criado automaticamente durante as migrações da base de dados (seeding). Podes usar os valores padrão sem problemas!

### Via Swagger (Manual)

1. Acede a http://localhost:5027/swagger
2. Procura `POST /api/auth/register`
3. Clica em "Try it out"
4. Preenche com:

```json
{
  "name": "Admin User",
  "email": "admin@habitus.com",
  "phone": "+351912345678",
  "password": "AdminPassword123!",
  "unitId": "00000000-0000-0000-0000-000000000001",
  "role": "Admin"
}
```

5. Clica "Execute"

### Fazer Login

```bash
curl -X POST http://localhost:5027/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@habitus.com",
    "password": "AdminPassword123!"
  }'
```

Resposta com token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "email": "admin@habitus.com",
  "name": "Admin User",
  "role": "Admin"
}
```

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

Isto significa que `dotnet-ef` não está instalado.

**Solução:**

```bash
# Instala a ferramenta Entity Framework Core globalmente
dotnet tool install --global dotnet-ef

# Ou se já tens, atualiza
dotnet tool update --global dotnet-ef

# Verifica a instalação
dotnet ef --version
```

Depois tenta novamente:
```bash
./quick-start.sh
```

Ou executa o setup automaticamente:
```bash
./setup.sh
```

### Porta já em uso

Se a porta 5027 já está em uso:

```bash
# Encontra o processo
lsof -i :5027

# Ou modifica em src/Habitus.Api/Properties/launchSettings.json
```

### PostgreSQL não consegue conectar

```bash
# Verifica se container está em execução
docker ps

# Reinicia tudo
./run-local.sh reset-db
./run-local.sh run
```

### Erro de migrações

```bash
# Aguarda que PostgreSQL fique pronto
sleep 5
dotnet ef database update
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
└── run-local.sh               # Menu interativo
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

**Certifica-te que:**
1. API está a rodar em `localhost:5027`
2. Web App consegue fazer requests (CORS configurado)
3. O token JWT é enviado nos headers

---

Qualquer questão, abre uma issue no repositório! 🙌
