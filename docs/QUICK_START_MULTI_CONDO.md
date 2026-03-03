# Quick Start - Multi-Condominium Setup

## 🚀 Setup Rápido (5 minutos)

### 1. Aplicar Migração da Base de Dados

```bash
cd /home/rick/workspace/habitus/src/Habitus.Api

# Criar a migração
dotnet ef migrations add MultiCondominiumSupport

# Aplicar à base de dados
dotnet ef database update
```

### 2. Iniciar a Aplicação

```bash
cd /home/rick/workspace/habitus
docker compose up -d postgres  # Se ainda não estiver a correr
dotnet run --project src/Habitus.Api/Habitus.Api.csproj
```

### 3. Criar o Primeiro Manager (Super Admin)

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ricardo Silva",
    "email": "rick@habitus.com",
    "password": "Manager2024!",
    "phone": "+351912345678",
    "role": "Manager"
  }'
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "rick@habitus.com",
  "name": "Ricardo Silva",
  "role": "Manager",
  "condominiumId": null,
  "unitId": null,
  "accessibleCondominiums": []
}
```

**Guarde o token JWT retornado!**

### 4. Criar o Primeiro Condomínio

```bash
# Substitua SEU_TOKEN_JWT pelo token recebido acima
curl -X POST http://localhost:5000/api/condominiums \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "name": "Condomínio Vista Mar",
    "address": "Rua das Flores, 123, Lisboa",
    "taxId": "501234567"
  }'
```

**Resposta esperada:**
```json
{
  "id": "guid-do-condominio",
  "name": "Condomínio Vista Mar",
  "address": "Rua das Flores, 123, Lisboa",
  "taxId": "501234567",
  "createdAt": "2026-02-28T...",
  "isActive": true,
  "totalUnits": 0,
  "totalUsers": 0
}
```

**Guarde o `id` do condomínio!**

### 5. Criar um Admin para o Condomínio

```bash
# Substitua:
# - SEU_TOKEN_JWT pelo token do Manager
# - GUID_DO_CONDOMINIO pelo ID do condomínio criado
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "name": "Maria Admin",
    "email": "maria.admin@vistamar.com",
    "password": "Admin2024!",
    "phone": "+351923456789",
    "role": "Admin",
    "condominiumId": "GUID_DO_CONDOMINIO"
  }'
```

### 6. Criar uma Fração (Unit)

```bash
# Criar via UnitsController (endpoint existente)
curl -X POST http://localhost:5000/api/units \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "buildingId": "GUID_DO_CONDOMINIO",
    "number": "1A",
    "floor": 1,
    "type": "Apartment",
    "permillage": 25.5
  }'
```

**Guarde o `id` da fração!**

### 7. Criar um Residente

```bash
# Substitua GUID_DA_FRACAO pelo ID da fração criada
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "name": "João Residente",
    "email": "joao.residente@vistamar.com",
    "password": "Resident2024!",
    "phone": "+351934567890",
    "role": "Resident",
    "condominiumId": "GUID_DO_CONDOMINIO",
    "unitId": "GUID_DA_FRACAO"
  }'
```

## ✅ Verificação

### Swagger UI
Abra o navegador: http://localhost:5000/swagger

### Testar Login do Admin
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.admin@vistamar.com",
    "password": "Admin2024!"
  }'
```

### Listar Utilizadores do Condomínio (como Admin)
```bash
curl -X GET "http://localhost:5000/api/users/condominium/GUID_DO_CONDOMINIO" \
  -H "Authorization: Bearer TOKEN_DO_ADMIN"
```

### Listar Todos os Condomínios (como Manager)
```bash
curl -X GET http://localhost:5000/api/condominiums \
  -H "Authorization: Bearer TOKEN_DO_MANAGER"
```

## 🎯 Cenários de Teste

### Cenário 1: Manager cria múltiplos condomínios
```bash
# Criar Condomínio 2
curl -X POST http://localhost:5000/api/condominiums \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_MANAGER" \
  -d '{
    "name": "Condomínio Jardim Central",
    "address": "Avenida da República, 456, Porto",
    "taxId": "502345678"
  }'
```

### Cenário 2: Admin tenta criar Manager (deve falhar)
```bash
# Isto deve retornar 403 Forbidden
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{
    "name": "Tentativa Manager",
    "email": "test@test.com",
    "password": "Test2024!",
    "phone": "+351900000000",
    "role": "Manager"
  }'
```

### Cenário 3: Admin tenta aceder a outro condomínio (deve falhar)
```bash
# Admin do Condomínio A tenta ver users do Condomínio B
# Isto deve retornar 403 Forbidden
curl -X GET "http://localhost:5000/api/users/condominium/OUTRO_CONDOMINIO_ID" \
  -H "Authorization: Bearer TOKEN_ADMIN_CONDO_A"
```

## 📋 Checklist de Verificação

- [ ] Migração aplicada com sucesso
- [ ] Manager criado e consegue fazer login
- [ ] Condomínio criado
- [ ] Admin do condomínio criado e consegue fazer login
- [ ] Admin consegue criar utilizadores no seu condomínio
- [ ] Admin NÃO consegue criar Managers
- [ ] Admin NÃO consegue aceder a outros condomínios
- [ ] Residente criado com fração atribuída
- [ ] Manager consegue listar todos os condomínios
- [ ] Swagger mostra todos os novos endpoints

## 🐛 Troubleshooting

### Erro: "Connection string not configured"
```bash
# Verificar appsettings.json ou variável de ambiente
export ConnectionStrings__DefaultConnection="Host=localhost;Database=habitus;Username=postgres;Password=postgres"
```

### Erro: "Table doesn't exist"
```bash
# Aplicar migração novamente
cd src/Habitus.Api
dotnet ef database update
```

### Erro: 401 Unauthorized
- Verificar se o token JWT está correto
- Verificar se o token não expirou (tempo padrão: configurado no appsettings)
- Incluir `Bearer ` antes do token no header Authorization

### Erro: 403 Forbidden
- Verificar se o utilizador tem o role correcto
- Verificar se está a tentar aceder a recursos do seu condomínio
- Admins só podem aceder ao seu condomínio

## 📚 Documentação Adicional

- **Guia Completo de Migração**: [docs/MULTI_CONDOMINIUM_MIGRATION.md](MULTI_CONDOMINIUM_MIGRATION.md)
- **Resumo de Implementação**: [docs/IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **README Principal**: [../README.md](../README.md)

## 🎉 Sucesso!

Se todos os passos funcionaram, a sua plataforma Habitus está pronta para gestão multi-condomínio!

**Próximo passo:** Implemente a interface frontend para gerir os condomínios visualmente.
