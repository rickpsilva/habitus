# 📋 Guia de Acesso - Habitus

## 🚀 Iniciando os Serviços

### Opção 1: Quick Start (Mais rápido)
```bash
./quick-start.sh
```
Inicia tudo automaticamente: PostgreSQL, pgAdmin, API e Web App.

### Opção 2: Menu Interativo
```bash
./run-local.sh
```
Menu com várias opções de inicialização.

---

## 🌐 Endereços de Acesso

| Serviço | URL | Notas |
|---------|-----|-------|
| **Web App** | http://localhost:5173 | Desenvolvimento (Vite) |
| **Web App** | http://localhost:3000 | Produção |
| **API (HTTP)** | http://localhost:5027 | |
| **API (HTTPS)** | https://localhost:7211 | |
| **Swagger** | http://localhost:5027/swagger | Documentação da API |
| **pgAdmin** | http://localhost:5050 | Gerenciador de BD |
| **PostgreSQL** | localhost:5432 | Conexão direta |

---

## 🔐 Credenciais

### pgAdmin
- **Email:** `admin@habitus.com`
- **Senha:** `admin`

### PostgreSQL
- **Utilizador:** `habitus`
- **Senha:** `habitus`
- **Base de Dados:** `habitus`

### Admin User (criado via script)
```bash
./run-local.sh
# Opção 9: Criar Admin User
```

---

## 🛑 Parando os Serviços

### Parar Tudo
```bash
./stop-all.sh
```
Fecha todos os containers Docker e mata processos nas portas.

### Ver Status
```bash
./status.sh
```
Mostra quais serviços estão a correr.

---

## 🐧 WSL2 + Windows

Se estás a usar WSL2, os serviços funcionam normalmente em `localhost` no Windows:
- Postgres: `localhost:5432`
- pgAdmin: `localhost:5050`
- API: `localhost:5027`
- Web: `localhost:3000` ou `localhost:5173`

**Nenhuma configuração adicional necessária!** ✅

---

## 📚 Outros Comandos Úteis

```bash
# Menu interativo
./run-local.sh

# Comandos diretos
./run-local.sh run-all        # BD + API + Web
./run-local.sh start-db       # Apenas BD
./run-local.sh stop-db        # Parar BD
./run-local.sh api            # Apenas API
./run-local.sh web            # Apenas Web
./run-local.sh test           # Executar testes
./run-local.sh build          # Compilar projeto
./run-local.sh build-web      # Compilar Web App
./run-local.sh create-admin   # Criar utilizador Admin
./run-local.sh reset-db       # Apagar BD (cuidado!)
./run-local.sh status         # Ver portas em uso
./run-local.sh stop-all       # Parar tudo
```

---

## ❓ Troubleshooting

### pgAdmin não conecta
- Verifica se PostgreSQL está a rodar: `docker compose ps`
- Verifica os logs: `docker compose logs pgadmin`

### Porta em uso
```bash
./status.sh          # Ver quais portas estão ocupadas
./stop-all.sh        # Forçar parada de tudo
```

### Problema com migrações
```bash
./run-local.sh reset-db    # Apagar BD e recomeçar
```

---

**Para mais ajuda, consulta os scripts ou o README principal.**
