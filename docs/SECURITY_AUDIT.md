# Auditoria de Segurança - Habitus

Data: Abril 2026  
Escopo: API, faturação, pagamentos, multi-condomínio  
Risco Global: Médio

---

## Sumário Executivo

Esta auditoria foi revista após a implementação do módulo de faturação, exportação SAF-T, encriptação de dados sensíveis e integração Stripe.

O ficheiro anterior estava desatualizado em pontos críticos: indicava ausência de rate limiting e de encriptação de NIF, mas ambos já estão implementados.

Estado atual:

| Aspeto | Estado | Risco | Nota |
|---|---|---|---|
| Autenticação JWT | Implementado | Baixo | Assinatura, issuer, audience e lifetime validados |
| Autorização RBAC | Implementado | Médio | Regras por role e por condomínio; falta trilho de auditoria forte |
| Validação de input | Implementado para faturação | Médio | FluentValidation ativo; cobertura ainda não é transversal a toda a API |
| Rate limiting | Implementado | Baixo | `AspNetCoreRateLimit` ativo em middleware |
| Encriptação de PII | Implementado em NIF/IBAN | Médio | Bom avanço; ainda convém rever outros segredos/configs |
| Operação RGPD em produção | Implementado com fila assíncrona | Baixo/Médio | Execução de backfill/audit via queue+worker e tracking de runs |
| PDF e blob access | Implementado | Médio | URLs devem ser revistas conforme política de acesso do storage |
| Webhook Stripe | Implementado | Médio | Assinatura validada; falta observabilidade/auditoria mais forte |
| Logging de segurança | Parcial | Médio | Há logs técnicos; falta auditoria funcional persistente |
| SQL Injection | Protegido | Baixo | EF Core/LINQ |
| XSS | Parcialmente mitigado | Médio | Frontend React ajuda, mas continua a exigir validação e escaping de conteúdo renderizado |

---

## Já Resolvido

### 1. Encriptação de NIF e outros dados sensíveis

Estado: Resolvido

Foi introduzido `IEncryptionService` com implementação `EncryptionService`, e os dados sensíveis passaram a ser armazenados em campos `*Encrypted`.

Cobertura confirmada:
- `Invoice.CustomerTaxIdEncrypted`
- `Condominium.TaxIdEncrypted`
- `Condominium.PaymentIbanEncrypted`

Impacto:
- Redução material do risco RGPD associado a fuga de base de dados
- NIF deixa de circular em plaintext na persistência principal

Observação:
- O ambiente de desenvolvimento ainda usa uma chave configurada localmente em `appsettings.Development.json`; isto é aceitável para dev, mas não para produção.

### 2. Rate limiting

Estado: Resolvido

`AspNetCoreRateLimit` está configurado em `Program.cs` e ativado com `app.UseIpRateLimiting()`.

Impacto:
- Mitiga brute-force básico
- Mitiga scraping agressivo e alguns cenários DoS de baixa complexidade

### 3. Validação de pedidos de faturação

Estado: Resolvido no módulo de billing

Foram adicionados validadores FluentValidation para pedidos críticos de faturas, incluindo:
- `MarkInvoicePaidRequestValidator`
- `CancelInvoiceRequestValidator`

Impacto:
- Reduz payloads inválidos
- Restringe tamanho e formato de texto em campos críticos

Limite atual:
- A cobertura de validação ainda deve ser expandida para o resto da API.

### 4. Stripe webhook verification

Estado: Resolvido

O endpoint de webhook Stripe valida a assinatura HMAC através do SDK oficial antes de processar o evento.

Impacto:
- Evita callbacks forjados triviais
- Garante que apenas eventos Stripe válidos podem auto-marcar faturas como pagas

### 5. Operação assíncrona da migração RGPD

Estado: Resolvido

A execução de migração/auditoria RGPD foi convertida para fluxo assíncrono em background.

Cobertura confirmada:
- Endpoints de manutenção para `Manager`: `status`, `run`, `audit`
- `POST run/audit` retorna rápido e enfileira a operação
- Worker dedicado processa os runs e persiste estado em `RgpdMigrationRuns`
- Painel de manutenção acompanha execução por polling

Impacto:
- Reduz risco de timeout HTTP em operações longas
- Melhora rastreabilidade operacional (estado, contadores, erro)
- Diminui risco de intervenções manuais durante janelas de migração

---

## Riscos Abertos

### 1. Auditoria funcional insuficiente

Risco: Médio

Os logs atuais são adequados para troubleshooting, mas não para auditoria forte.

Faltam registos persistentes para operações como:
- quem marcou uma fatura como paga
- quem cancelou uma fatura
- quem iniciou uma sessão de pagamento
- que webhook alterou estado e com que referência externa

Recomendação:
- introduzir `AuditLog` persistido em base de dados ou sink dedicado
- incluir `UserId`, `Role`, `CondominiumId`, `InvoiceId`, ação, timestamp e origem

### 2. HSTS e headers de segurança HTTP

Risco: Médio

`UseHttpsRedirection()` está ativo, mas não há evidência de HSTS e de headers adicionais de endurecimento.

Recomendação:
- ativar `UseHsts()` em produção
- adicionar headers como:
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `X-Frame-Options` ou CSP equivalente

### 3. Gestão de segredos em produção

Risco: Médio/Alto

Em desenvolvimento existem segredos e connection strings em ficheiros locais, o que é aceitável apenas em contexto dev.

Para produção:
- `Stripe:SecretKey`
- `Stripe:WebhookSecret`
- `EncryptionKey`
- connection strings

devem vir de variáveis de ambiente ou secret manager.

### 4. URLs de documentos/PDF

Risco: Médio

O sistema devolve URL do PDF armazenado. O risco depende de como o storage está configurado:
- se o container/blob for público, há exposição por link direto
- se usar SAS/token temporário, o risco baixa bastante

Recomendação:
- confirmar política do storage
- preferir URLs temporárias ou proxy autenticado para documentos sensíveis

### 5. Refresh tokens ausentes

Risco: Médio

O JWT tem expiração configurável, mas não há mecanismo de refresh token robusto identificado nesta revisão.

Impacto:
- pior UX ou sessões mais longas do que o desejável
- menor controlo fino sobre revogação de sessão

---

## Avaliação do Stripe

### Pontos Fortes

- SDK oficial usado no backend
- Assinatura do webhook validada
- `PaymentSessionId` persistido na fatura para correlação
- Ambiente de desenvolvimento desacoplado via `MockPaymentGatewayService`

### Pontos a endurecer

- Persistir auditoria do webhook e referência externa
- Garantir idempotência explícita para reentregas do Stripe
- Rever comportamento em caso de falha parcial após pagamento confirmado

Observação:
- O código atual devolve `200 OK` em cenários de erro de processamento para evitar retries excessivos. Isto reduz ruído operacional, mas desloca a reconciliação para observabilidade manual. Convém avaliar se o comportamento desejado é retry controlado ou fila de compensação.

---

## Avaliação de Go-Live

### Apto para continuar desenvolvimento interno

Sim.

### Apto para staging controlado

Sim, desde que:
- segredos reais não estejam em ficheiros versionados
- Stripe use chaves de teste
- storage de PDFs não esteja público sem controlo

### Apto para produção sem ações adicionais

Ainda não.

Itens mínimos antes de produção:
1. Ativar HSTS e headers de segurança.
2. Confirmar gestão de segredos por environment/secret manager.
3. Implementar auditoria persistente para ações críticas.
4. Rever exposição dos PDFs/blob URLs.
5. Confirmar estratégia de idempotência e reconciliação de webhooks Stripe.

---

## Checklist Antes de Produção

- [x] JWT com validação de assinatura e lifetime
- [x] RBAC por role e âmbito de condomínio
- [x] Rate limiting ativo
- [x] NIF encriptado em faturação
- [x] FluentValidation no módulo de billing
- [x] Webhook Stripe com verificação de assinatura
- [x] Operação RGPD assíncrona com tracking de execução
- [ ] Audit log persistente para operações críticas
- [ ] HSTS ativo em produção
- [ ] Security headers revistos
- [ ] Segredos fora de ficheiros versionados em produção
- [ ] Estratégia segura para acesso a PDFs/documentos
- [ ] Plano de reconciliação para falhas de webhook/pagamento

---

## Conclusão

O estado de segurança melhorou de forma relevante nesta iteração. Os dois problemas mais graves apontados na versão anterior da auditoria, ausência de rate limiting e NIF em plaintext, já não se verificam.

O foco agora deixa de ser correção básica de exposição imediata e passa a ser endurecimento operacional para produção: auditoria, headers HTTP, segredos e governança do fluxo Stripe/PDF.

