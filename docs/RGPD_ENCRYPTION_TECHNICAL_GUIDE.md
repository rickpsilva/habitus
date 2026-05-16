# Guia Tecnico de Encriptacao RGPD

## Objetivo

Este guia descreve a arquitetura tecnica de protecao de dados sensiveis no Habitus, os padroes de implementacao e as regras de operacao para conformidade RGPD.

## Escopo de dados sensiveis

Categorias protegidas no backend:

- Identificadores fiscais: NIF/TaxId
- Dados bancarios: IBAN
- Contactos sensiveis: telefone
- Moradas e campos de endereco
- Segredos de integracao (ex: chaves privadas de pagamento)

## Primitivas de seguranca

- Servico principal: `IEncryptionService` / `EncryptionService`
- Algoritmo: AES-256-GCM
- Chave: `EncryptionKey` (32 bytes), fornecida por Key Vault/variavel de ambiente em producao
- Persistencia: campos paralelos `*Encrypted` no modelo de dados

## Padrao de persistencia recomendado

Padrao obrigatorio para campos sensiveis:

1. Escrever sempre em `*Encrypted`.
2. Limpar coluna legacy plaintext apos escrita valida.
3. Em leitura, preferir `*Encrypted`.
4. Fallback para coluna legacy apenas durante janela de migracao.

Configuracao de fallback:

- `Rgpd:AllowLegacyPlaintextFallback` (default `true`)
- `RGPD_ALLOW_LEGACY_PLAINTEXT_FALLBACK` (override por ambiente)

## Padrao para updates parciais

Quando o request nao envia determinado campo sensivel:

- valor omitido (`null`): preservar valor encriptado existente
- valor vazio/branco: limpar valor encriptado e legacy
- valor preenchido: encriptar novo valor e limpar legacy

Este padrao evita perda acidental de dados encriptados em updates parciais.

## Migracao historica e operacao assincorna

Componente de migracao historica:

- `HistoricalEncryptionBackfillService`
- `HistoricalEncryptionBackfillHostedService`

Operacao manual em producao (Manager):

- `GET /api/maintenance/rgpd-migration/status`
- `POST /api/maintenance/rgpd-migration/run`
- `POST /api/maintenance/rgpd-migration/audit`

Fluxo operacional:

1. Endpoint enfileira run (`Running`) e retorna imediatamente.
2. Worker em background processa por `runId`.
3. Resultado e contadores sao persistidos em `RgpdMigrationRuns`.
4. Frontend de manutencao acompanha estado via polling.

## Checklist tecnico por incremento

Para qualquer novo campo sensivel:

1. Adicionar coluna `*Encrypted` no entity e mapping EF.
2. Criar migration de schema (deterministica e revista).
3. Atualizar service com padrao encrypted-first + cleanup.
4. Garantir update parcial seguro (preservacao quando omitido).
5. Adicionar/ajustar testes unitarios e, quando relevante, integracao.
6. Atualizar documentacao RGPD.

## Validacao recomendada

- Testes unitarios do service alterado
- Testes de regressao para caminho legacy/fallback
- Scripts SQL de validacao RGPD em `scripts/sql/`
- Auditoria operacional via endpoint `status`

## Requisitos de producao

- Nunca versionar `EncryptionKey` real no repositorio.
- Gerir segredo apenas via Key Vault ou variaveis seguras.
- Monitorizar runs RGPD (`Running`, `Completed`, `Failed`).
- Desativar fallback legacy apos confirmacao de contadores residuais a zero.

## Nao objetivos

- Este guia nao substitui politicas legais de retencao/eliminacao.
- Este guia nao cobre todos os controlos de seguranca da plataforma (ver `docs/SECURITY_AUDIT.md`).
