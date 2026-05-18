# Runbook RGPD: Deploy e Rollback

## Objetivo

Executar alteracoes RGPD em producao com risco controlado, incluindo migracao historica, verificacao pos-deploy e rollback operacional.

## Pre-requisitos

- Janela de manutencao aprovada
- Backup recente da base de dados
- `EncryptionKey` valida no ambiente
- Equipa com acesso Manager ao modulo de manutencao
- Observabilidade ativa (logs API + DB)

## Plano de deploy (forward)

### Execucao scriptada (recomendado)

Para reduzir erro humano, usar o script unico comentado:

- `scripts/rgpd-release-runbook.sh`

Fluxo recomendado:

1. Dry-run (valida comandos e pre-requisitos sem executar alteracoes):
   - `./scripts/rgpd-release-runbook.sh --api-base-url https://api.seu-dominio.pt --api-bearer-token "$TOKEN_MANAGER" --database-url "$DATABASE_URL" --dry-run`
2. Execucao real:
   - `./scripts/rgpd-release-runbook.sh --api-base-url https://api.seu-dominio.pt --api-bearer-token "$TOKEN_MANAGER" --database-url "$DATABASE_URL"`

Flags uteis:

- `--skip-tests`
- `--skip-migrations`
- `--skip-healthcheck`
- `--skip-api-maintenance`
- `--skip-sql-validation`

O script gera artefactos em `/tmp/habitus-rgpd` (ou `RGPD_LOG_DIR`) para auditoria.

### 1. Preparacao

1. Validar branch/release e changelog RGPD.
2. Confirmar segredos e variaveis:
   - `EncryptionKey`
   - `Rgpd:EnableHistoricalBackfill`
   - `Rgpd:AllowLegacyPlaintextFallback`
3. Executar backup antes de aplicar migrations.

### 2. Aplicacao

1. Deploy da aplicacao (API/frontend).
2. Aplicar migrations EF:
   - `dotnet ef database update --project src/Habitus.Infrastructure/Habitus.Infrastructure.csproj --startup-project src/Habitus.Api/Habitus.Api.csproj`
3. Confirmar healthcheck API (`/health`).

### 3. Operacao RGPD apos deploy

1. Executar baseline:
   - `POST /api/maintenance/rgpd-migration/audit`
2. Executar backfill:
   - `POST /api/maintenance/rgpd-migration/run`
3. Acompanhar:
   - `GET /api/maintenance/rgpd-migration/status`
4. Validar que `remaining` tende a zero e run termina em `Completed`.

### 4. Criterios de sucesso

- API e frontend disponiveis
- Runs RGPD sem estado `Failed`
- Contadores residuais em queda consistente
- Sem regressao funcional nos fluxos principais

## Validacao pos-deploy

Checklist minimo:

- Login e autorizacao por role operacionais
- Leitura/escrita de dados sensiveis sem regressao
- Painel Manutencao > Migracao RGPD funcional
- Query de validacao SQL sem crescimento de plaintext residual

## Plano de rollback

### Gatilhos para rollback

- Falhas repetidas em runs RGPD (`Failed`) sem recuperacao rapida
- Erros de desencriptacao em fluxos criticos
- Degradacao operacional relevante (timeouts, indisponibilidade)

### Estrategia de rollback (ordem)

1. Congelar novas operacoes RGPD manuais.
2. Manter `Rgpd:AllowLegacyPlaintextFallback=true` para continuidade de leitura.
3. Reverter release da aplicacao para versao estavel anterior.
4. Se necessario, restaurar base de dados a partir do backup da janela.
5. Revalidar healthcheck e fluxos criticos.

### Nota sobre migrations

- Evitar rollback destrutivo de schema em quente quando houver risco de perda de dados.
- Preferir rollback de aplicacao + fallback legacy + restauracao controlada de backup quando necessario.

## Plano de recuperacao apos incidente

1. Recolher evidencias: logs, runId, erro, timestamp.
2. Identificar causa raiz (configuracao, chave, dados legacy, bug de codigo).
3. Corrigir em ambiente de staging.
4. Reexecutar deploy com checklist completa.

## Responsabilidades

- Engenharia: deploy, migrations, monitorizacao tecnica
- Produto/Operacoes: aprovacao da janela e comunicacao
- Responsavel de seguranca/dados: validacao final de conformidade
