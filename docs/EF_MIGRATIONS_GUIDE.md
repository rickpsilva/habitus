# Guia EF Core Migrations - Habitus

## Configuração Importante

O DbContext está localizado em `Habitus.Infrastructure`, portanto todas as migrações devem especificar:
- `--project`: O projeto Infrastructure (onde está o DbContext)
- `--startup-project`: O projeto Api (para carregar configurações)

## Comandos Principais

### Criar uma nova migração

```bash
cd /home/rick/workspace/habitus

dotnet ef migrations add NomeDaMigracao \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj
```

### Aplicar migrações à base de dados

```bash
cd /home/rick/workspace/habitus

dotnet ef database update \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj
```

### Reverter para uma migração específica

```bash
cd /home/rick/workspace/habitus

dotnet ef database update NomeDaMigracaoAnterior \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj
```

### Remover a última migração (se ainda não aplicada)

```bash
cd /home/rick/workspace/habitus

dotnet ef migrations remove \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj
```

### Ver lista de migrações

```bash
cd /home/rick/workspace/habitus

dotnet ef migrations list \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj
```

### Gerar script SQL de uma migração

```bash
cd /home/rick/workspace/habitus

dotnet ef migrations script \
  --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj \
  --startup-project src/Habitus.Api/Habitus.Api.csproj \
  --output migration.sql
```

## Verificar Base de Dados PostgreSQL

### Listar tabelas
```bash
docker exec habitus-postgres-1 psql -U habitus -d habitus -c "\dt"
```

### Ver estrutura de uma tabela
```bash
docker exec habitus-postgres-1 psql -U habitus -d habitus -c "\d Users"
```

### Executar query SQL
```bash
docker exec habitus-postgres-1 psql -U habitus -d habitus -c "SELECT * FROM \"Users\";"
```

### Aceder ao psql interativo
```bash
docker exec -it habitus-postgres-1 psql -U habitus -d habitus
```

## Iniciar PostgreSQL

```bash
cd /home/rick/workspace/habitus
docker compose up -d postgres
```

## Parar PostgreSQL

```bash
cd /home/rick/workspace/habitus
docker compose down
```

## Troubleshooting

### Erro: "doesn't match your migrations assembly"

**Problema:** Tentou criar migração sem especificar os projetos corretos.

**Solução:** Sempre use `--project` e `--startup-project` como mostrado acima.

### Erro: "Connection refused" ou "Failed to connect"

**Problema:** PostgreSQL não está a correr.

**Solução:**
```bash
cd /home/rick/workspace/habitus
docker compose up -d postgres
sleep 5  # Aguardar PostgreSQL iniciar
```

### Warning: "Photos' is a collection with value converter but no value comparer"

**Resolvido em:** `Habitus.Infrastructure/Data/HabitusDbContext.cs` - Adicionado `ValueComparer` para a propriedade `Photos`.

## Migrações Aplicadas

- ✅ `20260225012511_InitialCreate`
- ✅ `20260225012925_SeedDefaultBuildingAndUnit`
- ✅ `20260225090338_AddPermillageToUnit`
- ✅ `20260227220749_AddPasswordResetTokenToResident`
- ✅ `20260228090634_MultiCondominiumSupport` - **Nova arquitetura multi-condomínio**

## Notas Importantes

1. **Sempre execute comandos a partir da raiz do projeto** (`/home/rick/workspace/habitus`)
2. **Sempre especifique ambos os projetos** (--project e --startup-project)
3. **O PostgreSQL tem de estar a correr** antes de aplicar migrações
4. **As migrações estão em** `src/Habitus.Infrastructure/Migrations/`
5. **Backup antes de migrações importantes:**
   ```bash
   docker exec habitus-postgres-1 pg_dump -U habitus habitus > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

## Configuração do DbContext

O DbContext está configurado para usar o assembly `Habitus.Infrastructure` para migrações:

```csharp
// src/Habitus.Infrastructure/DependencyInjection.cs
services.AddDbContext<HabitusDbContext>(options =>
    options.UseNpgsql(connectionString, 
        b => b.MigrationsAssembly("Habitus.Infrastructure")));
```

Isto garante que todas as migrações são criadas no projeto correto.
