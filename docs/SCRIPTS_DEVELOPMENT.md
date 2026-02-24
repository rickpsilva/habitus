# Scripts de Desenvolvimento Local

Este diretório contém scripts para facilitar a execução local da aplicação Habitus.

## 📋 Prerequisites

- **.NET 8 SDK** - [Descarregar](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Docker & Docker Compose** - [Descarregar](https://www.docker.com/)
- **dotnet-ef** - Entity Framework Core CLI (instalado automaticamente)

## 🚀 Setup Inicial

### Primeira vez? Executa o setup:

```bash
./setup.sh
```

Isto verifica e instala todas as ferramentas necessárias (especialmente `dotnet-ef`).

---

## 🚀 Quick Start (Mais Rápido)

Para iniciar tudo em um comando:

```bash
./quick-start.sh
```

Isto:
1. ✓ Inicia PostgreSQL
2. ✓ Restaura dependências
3. ✓ Aplica migrações
4. ✓ Inicia a API

**Depois, acede a:**
- API: http://localhost:5027
- Swagger: http://localhost:5027/swagger

---

## 🛠️ Menu Completo (Mais Controlo)

Para um menu interativo com mais opções:

```bash
./run-local.sh
```

### Opções disponíveis:

| Opção | Descrição |
|-------|-----------|
| **1** | Execução completa (BD + API) |
| **2** | Apenas API (BD já em execução) |
| **3** | Parar base de dados |
| **4** | Executar testes |
| **5** | Compilar projeto |
| **6** | Reset base de dados (apagar dados) |
| **0** | Sair |

### Modo direto (sem menu):

```bash
# Execução completa
./run-local.sh run

# Apenas inicia API (BD já em execução)
./run-local.sh api

# Parar BD
./run-local.sh stop-db

# Inicia apenas BD
./run-local.sh start-db

# Executar testes
./run-local.sh test

# Compilar projeto
./run-local.sh build

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

### Variáveis de Ambiente (Opcional)

Para usar serviços Azure, define as variáveis de ambiente:

```bash
export AzureStorage__ConnectionString="your-connection-string"
export AzureCommunication__ConnectionString="your-connection-string"
export AzureTranslation__Key="your-key"
```

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

---

## 📦 Estrutura do Projeto

```
habitus/
├── src/
│   ├── Habitus.Api/           # ASP.NET Core API
│   ├── Habitus.Application/   # Serviços e DTOs
│   ├── Habitus.Infrastructure/# BD, Repositórios, Azure
│   ├── Habitus.Domain/        # Entidades e lógica
│   └── Habitus.slnx           # Solution
├── tests/
│   └── Habitus.Tests/         # Testes xUnit
├── docker-compose.yml         # Configuração Docker
├── quick-start.sh            # Script rápido
└── run-local.sh              # Script com menu
```

---

## ⚡ Dicas Rápidas

```bash
# Apenas build (sem executar)
./run-local.sh build

# Resetar dados e começar do zero
./run-local.sh reset-db
./run-local.sh run

# Ver logs do PostgreSQL
docker logs habitus-postgres

# Parar tudo
./run-local.sh stop-db
```

---

Qualquer questão, abre uma issue no repositório! 🙌
