# Migração Multi-Condomínio - Guia de Implementação

## Resumo das Alterações

Esta migração implementa o suporte multi-condomínio na plataforma Habitus, separando a gestão de utilizadores e permitindo que Managers (HOI) controlem múltiplos condomínios.

## Principais Mudanças na Arquitectura

### 1. Nova Entidade: **User**
- Substitui a entidade `Resident` para autenticação
- Roles: `Manager`, `Admin`, `Resident`
- Managers: acesso a múltiplos condomínios (nível plataforma)
- Admins: acesso a um único condomínio (nível condomínio)
- Residents: acesso a uma unidade específica (nível unidade)

### 2. Nova Entidade: **Condominium**
- Renomeada/substitui `Building` para clareza
- Representa um condomínio individual
- Contém Units, Users, Documents, etc.

### 3. Nova Entidade: **UserCondominium**
- Tabela de junção many-to-many
- Permite que Managers acedam a múltiplos condomínios
- Controla permissões por condomínio

### 4. Permissões por Role

| Role | Permissões |
|------|------------|
| **Manager** | - Criar novos condomínios<br>- Criar/editar utilizadores em qualquer condomínio<br>- Criar/editar frações em qualquer condomínio<br>- Acesso total à plataforma |
| **Admin** | - Criar utilizadores no seu condomínio<br>- Criar/editar/eliminar frações no seu condomínio<br>- **NÃO** pode criar Managers<br>- **NÃO** requer uma fração atribuída |
| **Resident** | - Acesso standard de residente<br>- Leitura/criação limitada ao seu condomínio<br>- Requer uma fração atribuída |

## Passos para Aplicar a Migração

### 1. Backup da Base de Dados
```bash
pg_dump -h localhost -U postgres -d habitus > backup_pre_migration.sql
```

### 2. Criar a Migração EF Core

```bash
cd src/Habitus.Api
dotnet ef migrations add MultiCondominiumSupport
```

### 3. Aplicar a Migração

```bash
dotnet ef database update
```

### 4. Migração de Dados (Script SQL)

Execute o seguinte script para migrar os dados existentes:

```sql
-- 1. Migrar Buildings para Condominiums
INSERT INTO "Condominiums" ("Id", "Name", "Address", "TaxId", "CreatedAt", "IsActive")
SELECT "Id", "Name", "Address", "AdminEmail" as "TaxId", NOW(), true
FROM "Buildings";

-- 2. Migrar Residents para Users
INSERT INTO "Users" ("Id", "Name", "Email", "Phone", "PasswordHash", "PasswordResetToken", 
                     "PasswordResetTokenExpiry", "Role", "CreatedAt", "CondominiumId", "UnitId")
SELECT 
    r."Id",
    r."Name",
    r."Email",
    r."Phone",
    r."PasswordHash",
    r."PasswordResetToken",
    r."PasswordResetTokenExpiry",
    CASE 
        WHEN r."Role" = 'Admin' THEN 1  -- Admin
        WHEN r."Role" = 'Manager' THEN 0  -- Manager
        ELSE 2  -- Resident
    END,
    r."CreatedAt",
    u."CondominiumId",  -- Link to unit's condominium
    r."UnitId"
FROM "Residents" r
JOIN "Units" u ON u."Id" = r."UnitId";

-- 3. Criar relações UserCondominium para non-Managers
INSERT INTO "UserCondominiums" ("UserId", "CondominiumId", "GrantedAt", "CanManage")
SELECT 
    u."Id",
    u."CondominiumId",
    NOW(),
    CASE WHEN u."Role" = 1 THEN true ELSE false END  -- Admin = CanManage, others = false
FROM "Users" u
WHERE u."CondominiumId" IS NOT NULL AND u."Role" != 0;  -- Exclude Managers

-- 4. Atualizar FKs de BuildingId para CondominiumId (já foi feito nas entidades)
-- As tabelas já têm CondominiumId definido
```

## Novos Endpoints da API

### Users Management
- `GET /api/users` - Listar todos os utilizadores (Manager apenas)
- `GET /api/users/condominium/{id}` - Utilizadores por condomínio (Manager, Admin)
- `GET /api/users/{id}` - Obter utilizador por ID
- `POST /api/users` - Criar utilizador (Manager, Admin)
- `PUT /api/users/{id}` - Atualizar utilizador (Manager, Admin)
- `DELETE /api/users/{id}` - Eliminar utilizador (Manager, Admin)
- `POST /api/users/assign-condominium` - Atribuir Manager a condomínio (Manager apenas)

### Condominiums Management
- `GET /api/condominiums` - Listar todos os condomínios (Manager apenas)
- `GET /api/condominiums/{id}` - Obter condomínio por ID
- `POST /api/condominiums` - Criar condomínio (Manager apenas)
- `PUT /api/condominiums/{id}` - Atualizar condomínio (Manager, Admin do condomínio)
- `DELETE /api/condominiums/{id}` - Eliminar condomínio (Manager apenas)

## Autenticação JWT Atualizada

O token JWT agora inclui:
- `CondominiumId` - ID do condomínio principal do utilizador (null para Managers)
- `UnitId` - ID da fração (null para Admins e Managers)
- `Role` - Manager, Admin, ou Resident

## Exemplos de Uso

### 1. Criar um Manager (Super Admin)
```json
POST /api/auth/register
{
  "name": "João Manager",
  "email": "joao@manager.com",
  "password": "SecurePass123!",
  "phone": "+351912345678",
  "role": "Manager"
}
```

### 2. Criar um Novo Condomínio (Manager)
```json
POST /api/condominiums
{
  "name": "Condomínio Vista Mar",
  "address": "Rua das Flores, 123, Lisboa",
  "taxId": "501234567"
}
```

### 3. Criar um Admin para o Condomínio (Manager)
```json
POST /api/users
{
  "name": "Maria Admin",
  "email": "maria@vistamar.com",
  "password": "AdminPass123!",
  "phone": "+351923456789",
  "role": "Admin",
  "condominiumId": "guid-do-condominio"
}
```

### 4. Criar um Residente (Admin ou Manager)
```json
POST /api/users
{
  "name": "Carlos Residente",
  "email": "carlos@example.com",
  "password": "ResidentPass123!",
  "phone": "+351934567890",
  "role": "Resident",
  "condominiumId": "guid-do-condominio",
  "unitId": "guid-da-fracao"
}
```

## Entidades Deprecadas

As seguintes entidades estão marcadas como `[Obsolete]` e serão removidas numa versão futura:
- `Resident` - Use `User` instead
- `Building` - Use `Condominium` instead
- `ResidentRole` enum - Use `UserRole` instead

## Testes

Os testes unitários existentes em `Habitus.Tests` precisam ser atualizados para:
1. Usar `User` em vez de `Resident`
2. Usar `CondominiumId` em vez de `BuildingId`
3. Usar `UserRole` em vez de `ResidentRole`

## Verificação Pós-Migração

Execute as seguintes queries para verificar a migração:

```sql
-- Verificar Users criados
SELECT "Id", "Name", "Email", "Role", "CondominiumId", "UnitId" FROM "Users";

-- Verificar Condominiums
SELECT "Id", "Name", "Address", "IsActive" FROM "Condominiums";

-- Verificar relações UserCondominium
SELECT uc."UserId", u."Name", uc."CondominiumId", c."Name", uc."CanManage"
FROM "UserCondominiums" uc
JOIN "Users" u ON u."Id" = uc."UserId"
JOIN "Condominiums" c ON c."Id" = uc."CondominiumId";

-- Verificar Units atualizadas
SELECT "Id", "Number", "CondominiumId" FROM "Units" LIMIT 10;
```

## Rollback (Se Necessário)

Se precisar reverter a migração:

```bash
# Restaurar backup
psql -h localhost -U postgres -d habitus < backup_pre_migration.sql

# OU remover a migração EF
dotnet ef database update PreviousMigrationName
dotnet ef migrations remove
```

## Notas Importantes

1. **Managers não precisam de condomínio atribuído** - O campo `CondominiumId` é nullable para Managers
2. **Admins não precisam de fração atribuída** - O campo `UnitId` é nullable para Admins
3. **Retrocompatibilidade de API** - Os endpoints antigos continuam a funcionar com `buildingId` como parâmetro
4. **Autorização por JWT** - Todos os endpoints verificam o role e condomínio no token JWT

## Suporte

Para questões ou problemas durante a migração, consulte:
- Logs da aplicação em `/var/log/habitus/`
- Documentação da API em `/swagger`
- Código fonte em `src/Habitus.Domain/Entities/`
