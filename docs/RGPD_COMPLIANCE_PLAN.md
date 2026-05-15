# Plan: Conformidade RGPD - Encriptação de Dados Sensíveis

Implementar encriptação completa de dados pessoais e sensíveis no Habitus para conformidade com RGPD. Dados como email, telefone, moradas, NIF/Tax ID e IBANs devem ser encriptados em repouso na base de dados. A infraestrutura de encriptação (EncryptionService com AES-256-GCM e chave em Azure Key Vault) já existe, mas não está aplicada a todos os campos sensíveis.

## Steps

## Estado Atual de Execução (15-05-2026)

### Concluído
- Fase 0.1: Entidade `UserGdprConsent` criada e integrada no `DbContext`.
- Fase 0.2: Endpoint `PUT /api/users/me` implementado e frontend ajustado.
- Fase 0.3: Fluxo de pedido/aprovação de eliminação RGPD implementado com anonimização.
- Fase 0.4: TAB RGPD no perfil implementada e ligada aos endpoints reais (consentimento/export/eliminação).
- Fase 0.5: Middleware `GdprConsentMiddleware` implementado e registado no pipeline.
- Regras de visibilidade ajustadas: Manager não vê utilizadores de condomínio; Admin vê utilizadores do seu condomínio; notificações de eliminação só para Admins.
- Testes unitários adicionados e a passar: `GdprConsentTests`, `GdprErasureTests`, `GdprConsentMiddlewareTests`.
- Testes de integração de autorização GDPR adicionados e a passar: `UsersGdprAuthorizationIntegrationTests`.
- Testes de integração happy-path RGPD autenticado adicionados e a passar (consentimento, estado de consentimento, export de dados, pedido duplicado de eliminação).
- Aprovação de eliminação RGPD restrita a `Admin` no endpoint de API.
- Testes unitários de encriptação expandidos e a passar (`EncryptionServiceTests`).
- Testes unitários de mascaramento adicionados e a passar (`SensitiveDataMaskingTests`).
- Testes de encriptação em serviços adicionados e a passar (`CondominiumServiceEncryptionTests`, `InvoiceServiceEncryptionTests`, `InvoicePdfServiceEncryptionTests`).
- Scripts SQL de validação RGPD adicionados em `scripts/sql/`.
- Cobertura negativa adicionada e a passar para caminhos sem decrypt quando campos encriptados estão ausentes (`CondominiumServiceEncryptionTests`, `InvoiceServiceEncryptionTests`).
- Fluxo de `PaymentSettings` atualizado com encriptação/desencriptação de IBAN e encriptação de `CardSecretKey` (controller + service).
- Testes de `PaymentSettings` adicionados e a passar (unitários e integração HTTP end-to-end).

### Em curso
- Fases 1, 2, 3 e 4 (encriptação alargada e mascaramento por role em middleware/DTO).

### Pendente
- Fases 1, 2, 3 (encriptação alargada), 4 (mascaramento automático por role) e Fase 6.

### Progresso por Fase (Checklist)
- [x] Fase 0 - UI e Consentimento: **100%**
    - [x] Entidade de consentimento RGPD
    - [x] Endpoint `PUT /api/users/me`
    - [x] Fluxo de eliminação RGPD
    - [x] TAB RGPD no frontend
    - [x] Middleware de consentimento
- [ ] Fase 1 - Migração de dados históricos: **0%**
    - [ ] Migration helper e batch encryption
    - [ ] Migration de dados históricos
    - [ ] Testes de validação de migração
- [ ] Fase 2 - Campos encriptados em entidades: **10%**
    - [x] Base RGPD em `User` e `UserGdprConsent`
    - [ ] Restantes entidades com campos encriptados
    - [ ] Migration de schema de encriptação alargada
    - [ ] Índice único em `User.EmailHash`
- [ ] Fase 3 - Encriptação nos serviços: **35%**
    - [x] Fluxos RGPD no `UserService`
    - [ ] Encriptação/decriptação de phone/hash email no `UserService`
    - [ ] `SupplierService` completo
    - [ ] `CondominiumService` completo
    - [ ] `ReceiptService`, `PaymentService`, `InvoiceService`, `UsefulContact`
- [ ] Fase 4 - Mascaramento por role: **0%**
    - [ ] Atributo `SensitiveData`
    - [ ] Marcação de DTOs
    - [ ] Middleware de mascaramento
    - [ ] `DataMaskingHelper`
- [ ] Fase 5 - Testes e validação: **90%**
    - [x] Testes unitários RGPD (consentimento/eliminação/middleware)
    - [x] Testes de integração de autorização RGPD
    - [x] Testes de integração happy-path RGPD autenticado
    - [x] Testes de encriptação de serviços (amostra inicial + cenários negativos)
    - [x] Testes de mascaramento (helper)
    - [x] Scripts SQL de validação
- [ ] Fase 6 - Documentação e deploy: **5%**
    - [x] Plano RGPD atualizado com estado de execução
    - [ ] Guia técnico de encriptação
    - [ ] Atualizações em `EF_MIGRATIONS_GUIDE`, `SECURITY_AUDIT` e `README`
    - [ ] Plano de deploy + rollback validado

### Nota de alinhamento de política
- Aplicado: endpoint de aprovação de eliminação RGPD restrito a `Admin`.

**Fase 0: RGPD Compliance - UI e Consentimento** *(1-2 dias)* - *NOVA FASE PRIORITÁRIA*

1. **Criar entidade de consentimento RGPD** ✅
   - Criar `UserGdprConsent` entity com: UserId, ConsentedAt, IpAddress, AcceptedTerms, AcceptedPrivacyPolicy
   - Migration para adicionar tabela `UserGdprConsents`
   - Associação 1-to-1 com User (campo `User.GdprConsentedAt`)

2. **Criar endpoint para Residents atualizarem próprio perfil** ✅
   - **PROBLEMA ATUAL**: Endpoint `PUT /api/users/{id}` requer role `Manager,Admin` (linha 179 de UsersController.cs)
   - Residents recebem 403 ao tentar atualizar perfil próprio
   - **SOLUÇÃO**: Criar `PUT /api/users/me` (qualquer role autenticada pode atualizar próprio perfil)
   - Criar `UpdateMyProfileRequest` DTO (campos limitados: Name, Phone, Email - não pode mudar Role, CondominiumId)

3. **Criar endpoint para GDPR data erasure request** ✅
   - Criar `POST /api/users/me/gdpr-erasure` (qualquer utilizador pode pedir)
   - Marca user com `GdprErasureRequestedAt` timestamp
    - Envia notificação apenas para Admins do condomínio
    - Admin do condomínio deve aprovar (endpoint separado `POST /api/users/{id}/gdpr-erasure/approve`)
   - Quando aprovado: executa anonimização (conforme decisão de Soft Delete)

4. **Frontend - Nova TAB "RGPD" no Meu Perfil** ✅
   - Adicionar TAB em `habitus-web/src/pages/Profile.tsx` (ou similar)
   - Secção 1: Consentimento (checkbox "Aceito termos e condições", "Aceito política de privacidade")
   - Secção 2: Os Meus Dados (botão "Descarregar os meus dados" - JSON/PDF com todos dados do user)
   - Secção 3: Eliminação (botão vermelho "Solicitar eliminação dos meus dados" - requer confirmação)
   - Mostrar warning: "Se não aceitar os termos, não poderá usar o portal"

5. **Bloqueio de utilizador sem consentimento RGPD** ✅
   - Middleware verifica se user tem `GdprConsentedAt != null`
   - Se NULL: redireciona para página de consentimento obrigatória
   - Excepções: endpoints públicos (/auth/login, /auth/register, /gdpr/consent)
   - Após aceitar: guarda timestamp e permite acesso completo

**Fase 1: Migrar Dados Históricos Existentes** *(1-2 dias)*

1. Criar migration de dados SQL que encripta dados históricos já existentes nos campos antigos
   - Criar `MigrationHelper.cs` com lógica de leitura e encriptação em batch
   - Criar migration `[DATE]_MigrateHistoricalEncryptedData.cs` que:
     - Lê `Condominium.TaxId` → encripta → salva em `Condominium.TaxIdEncrypted`
     - Lê `Condominium.PaymentIban` → encripta → salva em `Condominium.PaymentIbanEncrypted`
     - Lê `Invoice.CustomerTaxId` → encripta → salva em `Invoice.CustomerTaxIdEncrypted`
     - Marca campos antigos como NULL após migração
   - Usar EncryptionService dentro da migration (via DI ou instanciação manual com chave configurada)
   
2. Criar testes de validação de migração de dados
   - Verificar que dados foram encriptados corretamente
   - Verificar que se conseguem descriptografar
   - Teste em ambiente local antes de produção

**Fase 2: Adicionar Campos Encriptados para Entidades Faltantes** *(1-2 dias)* - *parallel com Fase 1*

3. Atualizar Domain entities adicionando novos campos encriptados
   - `User.cs`: 
     - ❌ Email mantém plaintext (decisão final - performance)
     - ✅ Adicionar `EmailHash` (SHA256 para login)
     - ✅ Adicionar `PhoneEncrypted` 
     - ✅ Adicionar campos RGPD: `GdprConsentedAt`, `GdprErasureRequestedAt`, `IsDeleted`, `DeletedAt`, `DeletionReason`
   - `Supplier.cs`: adicionar `ContactEncrypted`, `PhoneEncrypted`, `AddressEncrypted` (Email fica plaintext - comercial)
   - `Condominium.cs`: adicionar `AddressEncrypted` (TaxIdEncrypted já existe)
   - `ReceiptTemplateSettings.cs`: adicionar `TaxIdEncrypted`, `EmailEncrypted`, `PhoneEncrypted`, `AddressEncrypted`, `PostalCodeEncrypted`, `LocalityEncrypted`
   - `PaymentSettings.cs`: adicionar `MbWayPhoneNumberEncrypted`
   - `UsefulContact.cs`: adicionar `PhoneEncrypted`
   - `Invoice.cs`: adicionar `CustomerAddressEncrypted` (complementar)
   - Criar: `UserGdprConsent.cs` - entity para consentimentos
   - Marcar campos antigos como `[Obsolete]` para deprecação gradual

4. Criar migration EF Core para adicionar colunas na base de dados
   - Migration: `[DATE]_AddEncryptionFieldsForAllSensitiveData.cs`
   - Adicionar todas as colunas novas (nullable inicialmente)
   - Atualizar configuração no `HabitusDbContext.cs` se necessário

5. Atualizar índices do banco de dados
   - ❌ NÃO remover índice de `User.Email` (fica em plaintext)
   - ✅ Adicionar índice único em `User.EmailHash` para login rápido e validação de duplicados
   - Documentar que email fica plaintext por motivos de performance (justificação RGPD válida)

**Fase 3: Implementar Encriptação/Descriptografia nos Services** *(2-3 dias)* - *depende de Fase 2*

6. Atualizar `UserService.cs`
   - CREATE: gerar EmailHash (SHA256), encriptar Phone antes de salvar (Email fica plaintext)
   - UPDATE: atualizar EmailHash se email mudou, encriptar Phone
   - READ: descriptografar Phone ao retornar
   - **NOVO**: `UpdateMyProfileAsync(userId, request)` - endpoint para Residents atualizarem próprio perfil
   - **NOVO**: `RequestGdprErasure(userId)` - marca para eliminação (GdprErasureRequestedAt)
   - **NOVO**: `ApproveGdprErasure(userId, managerId)` - executa anonimização
   - **NOVO**: `GetMyDataExport(userId)` - retorna JSON/PDF com todos os dados do user
   - Usar campos encriptados, manter campos antigos NULL

7. Criar/atualizar `SupplierService.cs`
   - CREATE: encriptar Contact, Email, Phone, Address
   - UPDATE: encriptar campos modificados
   - READ: descriptografar todos os campos sensíveis
   - Referenciar funções específicas: MapToDto, CreateAsync, UpdateAsync

8. Atualizar `CondominiumService.cs`
   - Já tem lógica parcial (linha 44-46), completar para todos os endpoints
   - CREATE: encriptar TaxId, PaymentIban, Address, Email
   - UPDATE: encriptar apenas campos modificados
   - READ: descriptografar ao retornar (já feito para TaxId)

9. Atualizar `ReceiptService.cs` / criar service se não existir
   - CREATE/UPDATE: encriptar TaxId, Email, Phone, Address, PostalCode, Locality
   - READ: descriptografar ao carregar template settings

10. Atualizar `PaymentService.cs`
    - CREATE/UPDATE: encriptar MbWayPhoneNumber, IBAN
    - READ: descriptografar payment settings

11. Atualizar `InvoiceService.cs`
    - Já parcialmente implementado (linhas 145-147, 334-337)
    - Completar CustomerAddress encryption/decryption
    - Garantir que todos os métodos usam campos encriptados

12. Criar service para `UsefulContact`
    - CREATE/UPDATE: encriptar Phone
    - READ: descriptografar Phone

**Fase 4: Proteger DTOs com Mascaramento de Dados** *(1-2 dias)* - *depende de Fase 3*

13. Criar sistema de atributos para dados sensíveis
    - Criar `src/Habitus.Application/Attributes/SensitiveDataAttribute.cs`
    - Suportar propriedade `MaskPattern` (ex: "****", "**** 1234")
    - Suportar propriedade `RequiresRole` (ex: "Manager" pode ver tudo)

14. Atualizar DTOs marcando campos sensíveis
    - `UserResponse.cs`: marcar Email, Phone como `[SensitiveData]`
    - `SupplierDto.cs`: marcar Email, Phone, Address, Contact
    - `CondominiumResponse.cs`: marcar Address, Email, TaxId
    - `InvoiceDto.cs`: marcar CustomerTaxId (já mascarado no service), CustomerAddress
    - `PaymentSettingsDto.cs`: marcar IBAN, Phone
    - `ReceiptTemplateSettingsDto.cs`: marcar TaxId, Email, Phone, Address

15. Criar middleware de mascaramento automático
    - Criar `src/Habitus.Api/Middleware/SensitiveDataMaskingMiddleware.cs`
    - Interceptar responses antes de serializar
    - Aplicar mascaramento baseado em atributos `[SensitiveData]`
    - Verificar role do utilizador (Manager vê tudo, Admin vê parcial, Resident vê mascarado)
    - Registrar no pipeline do ASP.NET Core

16. Implementar método de mascaramento reutilizável
    - Criar `src/Habitus.Application/Helpers/DataMaskingHelper.cs`
    - Métodos: `MaskEmail()`, `MaskPhone()`, `MaskTaxId()`, `MaskIban()`
    - Reutilizar no InvoiceService (já tem `MaskTaxId` linha 425)

**Fase 5: Testes e Validação** *(1-2 dias)* - *parallel após Fase 3*

17. Criar testes unitários de encriptação
    - Expandir `tests/Habitus.Tests/EncryptionServiceTests.cs`
    - Testar encriptação/descriptografia de campos vazios, nulls
    - Testar IsEncrypted() para backward compatibility

18. Criar testes de integração para cada entidade *(parcial - autorização RGPD já coberta)*
    - `EncryptionDataMigrationTests.cs`: validar que migration funcionou
    - `UserServiceEncryptionTests.cs`: POST user → verificar DB tem encriptado
    - `SupplierServiceEncryptionTests.cs`: POST/GET supplier com dados encriptados
    - `CondominiumServiceEncryptionTests.cs`: validar TaxId, IBAN encriptados
    - Usar `Habitus.Api.IntegrationTests/` como base

19. Criar testes de mascaramento de DTOs
    - `SensitiveDataMaskingTests.cs`
    - Testar que Admin vê dados mascarados
    - Testar que Manager vê dados completos
    - Testar que middleware intercepta corretamente

20. Criar scripts SQL de validação
    - Script para contar registos com dados plaintext vs encriptados
    - Script para validar que campos antigos estão NULL após migração
    - Script para verificar integridade (nenhum dado perdido)

**Fase 6: Documentação e Deploy** *(1 dia)* - *depende de todas as fases anteriores*

21. Criar documentação de conformidade RGPD
    - Criar `docs/RGPD_ENCRYPTION_GUIDE.md`
    - Documentar: que campos são encriptados, como funciona, key management
    - Documentar: como adicionar novos campos encriptados no futuro
    - Checklist de conformidade RGPD

22. Atualizar documentação existente
    - Atualizar `docs/EF_MIGRATIONS_GUIDE.md` com instruções de migrations de dados
    - Atualizar `docs/SECURITY_AUDIT.md` com melhorias de segurança
    - Adicionar ao `README.md` menção de conformidade RGPD

23. Criar plano de deploy
    - Step 1: Backup de base de dados
    - Step 2: Deploy migration Fase 1 (migração de dados históricos)
    - Step 3: Aguardar conclusão da migração (pode demorar se muitos registos)
    - Step 4: Deploy código com services atualizados (Fase 3)
    - Step 5: Deploy middleware e DTOs (Fase 4)
    - Step 6: Validar em produção com scripts SQL
    - Step 7: Rollback plan se algo falhar

24. Documentar rollback plan
    - Backup antes de começar é essencial
    - Migration down para reverter schema
    - Como restaurar dados se necessário
    - Contactos de emergência e escalation

## Relevant Files

**Domain Entities:**
- `src/Habitus.Domain/Entities/User.cs` - adicionar EmailEncrypted, PhoneEncrypted
- `src/Habitus.Domain/Entities/Supplier.cs` - adicionar 4 campos encriptados
- `src/Habitus.Domain/Entities/Condominium.cs` - já tem TaxIdEncrypted/PaymentIbanEncrypted, completar uso
- `src/Habitus.Domain/Entities/ReceiptTemplateSettings.cs` - adicionar 6 campos encriptados
- `src/Habitus.Domain/Entities/PaymentSettings.cs` - adicionar MbWayPhoneNumberEncrypted
- `src/Habitus.Domain/Entities/UsefulContact.cs` - adicionar PhoneEncrypted
- `src/Habitus.Domain/Entities/Invoice.cs` - adicionar CustomerAddressEncrypted

**Services (Application Layer):**
- `src/Habitus.Application/Services/UserService.cs` - implementar encriptação Email/Phone (funções: CreateUserAsync, UpdateUserAsync, MapToResponse)
- `src/Habitus.Application/Services/CondominiumService.cs` - completar encriptação TaxId/IBAN (funções: GetAllCondominiumsAsync linha 44-46, CreateCondominiumAsync)
- `src/Habitus.Application/Services/InvoiceService.cs` - completar CustomerAddress encryption (já tem CustomerTaxId parcial linhas 145-147, 334-337)
- Criar/atualizar: SupplierService, ReceiptService para encriptação automática
- `src/Habitus.Application/Services/PaymentService.cs` - encriptar IBAN e MbWay phone

**Infrastructure:**
- `src/Habitus.Infrastructure/Services/EncryptionService.cs` - serviço já pronto, reutilizar (métodos: Encrypt, Decrypt, IsEncrypted)
- `src/Habitus.Infrastructure/Data/HabitusDbContext.cs` - configurar novos campos e remover índices problemáticos
- Criar: `src/Habitus.Infrastructure/Migrations/MigrationHelper.cs` - lógica auxiliar para migration de dados
- Criar: `src/Habitus.Infrastructure/Migrations/[DATE]_MigrateHistoricalEncryptedData.cs`
- Criar: `src/Habitus.Infrastructure/Migrations/[DATE]_AddEncryptionFieldsForAllSensitiveData.cs`

**DTOs:**
- `src/Habitus.Application/DTOs/Users/UserResponse.cs` - marcar Email, Phone como sensitive
- `src/Habitus.Application/DTOs/Suppliers/SupplierDto.cs` - marcar Email, Phone, Address como sensitive
- `src/Habitus.Application/DTOs/Condominium/CondominiumDTOs.cs` - marcar Address, Email, TaxId
- `src/Habitus.Application/DTOs/Billing/InvoiceDtos.cs` - marcar CustomerTaxId, CustomerAddress
- `src/Habitus.Application/DTOs/Payments/PaymentSettingsDto.cs` - marcar IBAN, Phone
- `src/Habitus.Application/DTOs/Receipts/ReceiptTemplateSettingsDto.cs` - marcar todos sensíveis

**API Layer:**
- Atualizar: `src/Habitus.Api/Controllers/UsersController.cs` - adicionar endpoints `/me`, `/me/gdpr-erasure`
- Criar: `src/Habitus.Api/Middleware/SensitiveDataMaskingMiddleware.cs` - interceptar responses
- Criar: `src/Habitus.Api/Middleware/GdprConsentMiddleware.cs` - verificar consentimento obrigatório
- `src/Habitus.Api/Program.cs` - registrar middlewares no pipeline

**Helpers & Utilities:**
- Criar: `src/Habitus.Application/Attributes/SensitiveDataAttribute.cs` - marcar campos sensíveis
- Criar: `src/Habitus.Application/Helpers/DataMaskingHelper.cs` - métodos de mascaramento reutilizáveis

**Tests:**
- `tests/Habitus.Tests/EncryptionServiceTests.cs` - expandir testes unitários
- Criar: `tests/Habitus.Tests/EncryptionDataMigrationTests.cs`
- Criar: `tests/Habitus.Tests/UserServiceEncryptionTests.cs`
- Criar: `tests/Habitus.Tests/SupplierServiceEncryptionTests.cs`
- Criar: `tests/Habitus.Tests/SensitiveDataMaskingTests.cs`
- Criar: `tests/Habitus.Tests/GdprConsentTests.cs` - testar bloqueio sem consentimento
- Criar: `tests/Habitus.Tests/GdprErasureTests.cs` - testar anonimização
- `tests/Habitus.Api.IntegrationTests/` - adicionar testes end-to-end

**Frontend:**
- Atualizar: `src/habitus-web/src/pages/Profile.tsx` (ou similar) - adicionar TAB RGPD
- Criar: `src/habitus-web/src/pages/GdprConsent.tsx` - página de consentimento obrigatório
- Criar: `src/habitus-web/src/components/GdprConsentModal.tsx` - modal para primeiro login
- Atualizar: `src/habitus-web/src/api/users.ts` - adicionar endpoints `/me`, `/me/gdpr-erasure`

**Documentation:**
- Criar: `docs/RGPD_ENCRYPTION_GUIDE.md` - guia completo de conformidade
- Atualizar: `docs/EF_MIGRATIONS_GUIDE.md` - adicionar secção sobre data migrations
- Atualizar: `docs/SECURITY_AUDIT.md` - documentar melhorias de segurança
- Atualizar: `README.md` - mencionar conformidade RGPD

## Verification

**Validação de Migração de Dados:**
1. Rodar script SQL que verifica quantos registos em `Condominium` têm `TaxIdEncrypted` preenchido vs `TaxId` NULL
2. Rodar script SQL que verifica quantos registos em `Invoice` têm `CustomerTaxIdEncrypted` preenchido
3. Selecionar amostra de 10 registos e verificar manualmente que descriptografia funciona
4. Validar que nenhum dado foi perdido (count antes = count depois)

**Validação de Encriptação em Services:**
1. POST /api/users com email "test@example.com" → query na DB → verificar que `EmailEncrypted` contém base64, não plaintext
2. POST /api/suppliers com phone "912345678" → query na DB → verificar que `PhoneEncrypted` está encriptado
3. GET /api/users/{id} → verificar que response contém email descriptografado "test@example.com"
4. PUT /api/condominiums/{id} com TaxId "123456789" → verificar que `TaxIdEncrypted` foi atualizado

**Validação de Mascaramento em DTOs:**
1. Login como Admin → GET /api/suppliers → verificar que emails aparecem como "t***@example.com"
2. Login como Manager → GET /api/suppliers → verificar que emails aparecem completos
3. Login como Resident → GET /api/condominiums/{id} → verificar que TaxId aparece como "*****6789"
4. Verificar headers HTTP que não há dados sensíveis em logs (middleware funciona)

**Validação de Testes:**
1. `dotnet test tests/Habitus.Tests/EncryptionServiceTests.cs` → todos passam
2. `dotnet test tests/Habitus.Tests/EncryptionDataMigrationTests.cs` → validação de migration ok
3. `dotnet test tests/Habitus.Tests/SensitiveDataMaskingTests.cs` → mascaramento funciona por role
4. Rodar todos os testes de integração → sem regressões

**Validação RGPD Compliance:**
1. ✅ Todos os dados pessoais sensíveis (phone, taxId, address, iban) estão encriptados em repouso
2. ✅ Email mantém-se plaintext (justificação RGPD: performance crítica + proteção via access control)
3. ✅ Backups contêm dados encriptados (novos registos)
4. ✅ Logs não contêm dados sensíveis em plaintext
5. ✅ Responses para roles baixos têm dados mascarados
6. ✅ **Consentimento RGPD obrigatório antes de usar portal**
7. ✅ **Utilizador pode pedir eliminação dos dados (GDPR Article 17)**
8. ✅ **Utilizador pode descarregar os seus dados (GDPR Article 15 - direito de acesso)**
9. ✅ Documentação de conformidade está completa e disponível

**Rollback Validation:**
1. Testar rollback de migration em ambiente de staging
2. Verificar que dados voltam ao estado anterior sem perda
3. Documentar tempo necessário para rollback (importante para janela de manutenção)

## Decisions

**Arquitetura de Encriptação:**
- Usar EncryptionService existente com AES-256-GCM (decisão anterior mantida)
- Chave continua em Azure Key Vault para produção (já implementado)
- Campos antigos mantêm-se como `[Obsolete]` para compatibilidade durante transição, serão removidos em versão futura
- Novos campos encriptados têm sufixo "Encrypted" para clareza

**Estratégia de Migração:**
- Migração de dados históricos é separada de schema migration (duas migrations distintas)
- Migration de dados usa batches de 1000 registos por vez para não sobrecarregar DB
- Campos antigos ficam NULL após migração (não são removidos da DB ainda)
- Backward compatibility: EncryptionService.Decrypt() retorna plaintext se detectar que não está encriptado
- **Ambiente Local**: Usa `appsettings.Development.json` com chave de teste (não Key Vault)
- **Ambiente Produção**: Usa Azure Key Vault para chave de encriptação

**Email - Decisão Final:**
- Email mantém-se em **plaintext** (User.Email, Supplier.Email, Condominium.Email)
- Adicionar `User.EmailHash` (SHA256) para login rápido e validação de duplicados
- Justificação RGPD: Email não é tão sensível quanto TaxID/IBAN, proteção via access control suficiente
- Performance de login é crítica (hash lookup vs decrypt de todos registos)

**DTOs e Mascaramento:**
- Manager vê todos os dados (descriptografados)
- Admin vê dados mascarados do próprio condomínio
- Resident vê dados altamente mascarados
- Atributo `[SensitiveData]` é opt-in (campos não marcados não são mascarados)
- Mascaramento acontece no middleware (não no service), para centralizar lógica

**Índices e Performance:**
- `User.Email` perde índice único (não pode indexar campo encriptado)
- Alternativa: adicionar campo `User.EmailHash` (SHA256) com índice único para validação de duplicados
- Search por email descriptografado fica mais lento (acceptable trade-off para segurança)
- Considerar cache de dados descriptografados em memória (Redis) para melhorar performance em leituras frequentes

**Testes:**
- Todos os services com encriptação têm testes unitários
- Testes de integração verificam fluxo end-to-end (HTTP → DB → HTTP)
- Testes de migration rodam em DB de teste (não em produção)
- CI/CD pipeline valida que nenhum campo sensível vai plaintext para DB
- **NOVO**: Testes de consentimento RGPD (bloqueio sem consentimento, redirect)
- **NOVO**: Testes de GDPR erasure (anonimização funciona, auditoria criada)

**Deploy:**
- Deploy em fases (migration primeiro, código depois)
- Janela de manutenção necessária? Depende do volume de dados (migração pode demorar)
- Rollback plan documentado e testado em staging antes de produção
- Monitorização de erros de encriptação/descriptografia após deploy
- **Ambiente local**: Rodar migrations com connection string local antes de produção

## Further Considerations

**1. Performance - Cache de Dados Descriptografados (CONFIGURAÇÃO B1 SAFE MODE)**

**Contexto de Infraestrutura:**
- Azure App Service: B1 (1 core, 1.75 GB RAM)
- Workload: webapp (React) + webapi (.NET) na mesma máquina
- RAM disponível para cache: ~400-650 MB (após SO, runtime, apps)
- **Restrição de orçamento**: Sem Redis, sem upgrade imediato

**Decisão Final:**
- ✅ **Usar .NET MemoryCache COM RESTRIÇÕES CONSERVADORAS**
- ✅ TTL curto: 10-15 minutos (não horas)
- ✅ Limite: 100-150 items máximo
- ✅ Apenas dados encriptados críticos (Phone, TaxId) - alto custo decrypt
- ❌ NÃO cachear: listas, queries, documentos

**Configuração Segura:**
```csharp
// DependencyInjection.cs
services.AddMemoryCache(options =>
{
    options.SizeLimit = 100;              // Max 100 items
    options.CompactionPercentage = 0.30;  // Liberta 30% quando cheio
    options.ExpirationScanFrequency = TimeSpan.FromMinutes(3);
});

// UserService.cs - Exemplo de uso conservador
private readonly TimeSpan CACHE_TTL_SHORT = TimeSpan.FromMinutes(10);

public async Task<string> GetDecryptedPhoneWithCache(Guid userId)
{
    var cacheKey = $"phone_{userId}";
    
    if (!_cache.TryGetValue(cacheKey, out string phone))
    {
        var user = await _db.Users.FindAsync(userId);
        phone = _encryptionService.Decrypt(user.PhoneEncrypted);
        
        _cache.Set(cacheKey, phone, new MemoryCacheEntryOptions
        {
            Size = 1,
            SlidingExpiration = CACHE_TTL_SHORT,
            Priority = CacheItemPriority.Normal
        });
    }
    
    return phone;
}
```

**Monitorização Obrigatória:**
```csharp
// MemoryHealthCheck.cs - Adicionar ao health checks
public class MemoryHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context)
    {
        var memoryMB = GC.GetTotalMemory(false) / 1024 / 1024;
        
        if (memoryMB > 1200) // 1.2 GB = CRÍTICO em B1
            return Task.FromResult(HealthCheckResult.Unhealthy($"RAM alta: {memoryMB} MB"));
        
        if (memoryMB > 900) // WARNING
            return Task.FromResult(HealthCheckResult.Degraded($"RAM moderada: {memoryMB} MB"));
        
        return Task.FromResult(HealthCheckResult.Healthy($"RAM ok: {memoryMB} MB"));
    }
}

// Program.cs
builder.Services.AddHealthChecks().AddCheck<MemoryHealthCheck>("memory");
app.MapHealthChecks("/health");
```

**O Que Cachear (Prioridades):**
1. ✅ Dados descriptografados (Phone, TaxId) - alto custo
2. ✅ Configurações globais (SystemSettings) - raramente mudam
3. ✅ Condominium info para user logado - acedido frequentemente
4. ❌ Listas de users/suppliers/units - muito grande
5. ❌ Queries complexas - variáveis demais
6. ❌ Documentos - ocupam muito espaço

**Performance Esperada:**
- Decrypt sem cache: ~10-30ms por campo
- Decrypt com cache HIT: ~0.1ms
- Cache hit rate esperado: 60-80% (dados frequentes)
- **Melhoria: 5-10x em campos frequentes**

**Sinais de Alerta (Monitorizar no Azure):**
- ⚠️ CPU > 80% constante
- ⚠️ RAM > 1.4 GB constante → reduzir cache
- ⚠️ Response time > 2s → possível swap/paging
- ⚠️ App restarts frequentes → Out of Memory

**Plano de Contingência:**
- Se RAM > 1.4 GB: Reduzir SizeLimit para 50, TTL para 5 min
- Se performance inadequada: Avaliar upgrade B2 (~26€/mês, 3.5 GB RAM)
- Fallback seguro: Desativar cache, descriptografar sempre (funciona mas +20-30ms)

**Alternativa Futura (quando tiver orçamento):**
- Separar webapp (static hosting €0-5/mês) da API (liberta RAM)
- Ou upgrade para B2 (dobra RAM, muito mais confortável)

**2. Índices e Email - Decisão Final**
- ✅ **Opção ESCOLHIDA**: Email fica em PLAINTEXT (aceitável RGPD) + adicionar `User.EmailHash` (SHA256) para login super rápido
- Justificação RGPD: Email não é tão sensível quanto TaxID/IBAN, proteção via access control é suficiente
- Performance de login é crítica para UX
- Emails só visíveis para Managers (mascarados para outros roles)

**3. Auditoria - Logging de Acessos (SEM ORÇAMENTO PARA AZURE SENTINEL)**
- ✅ Implementar tabela `AuditLog` local: UserId, Timestamp, Action, TargetEntityId, IpAddress
- ✅ Logging em ficheiros locais (rotation diária) - **custo zero**
- ❌ Azure Sentinel: Requer orçamento (não disponível nesta fase)
- Alternativa futura: Application Insights (já incluído no App Service)

**4. Key Rotation - Política de Rotação de Chaves**
- ✅ **Política**: Rodar chave a cada **2-3 anos** (sem incidentes) ou **imediatamente** se suspeita de leak
- ✅ **Como**: Azure Key Vault com versionamento (v1, v2, v3) - suporta múltiplas versões ativas
- ✅ **Re-encriptação**: Background job processa 1000 registos/dia (gradual, sem downtime)
- EncryptionService detecta versão da chave no ciphertext e usa chave correta para decrypt
- Nova encriptação sempre usa versão mais recente da chave

**5. Dados Históricos - O que Fazer com Backups Antigos?**
- Backups antes da encriptação contêm dados em plaintext
- Opção A: Re-encriptar backups antigos (complexo, pode corromper backups)
- Opção B: Manter backups antigos mas com política de retenção mais curta (30 dias vs 1 ano)
- Opção C: Documentar que backups pré-[DATA] não são RGPD compliant e eventualmente eliminá-los

**6. Direito ao Esquecimento - RGPD Article 17**
- ✅ **Estratégia Híbrida ESCOLHIDA**:
  - DELETE normal: Soft delete (IsDeleted=true, recuperável por 30 dias)
  - DELETE RGPD: **Anonimização** (Name="DELETED USER", Email="deleted_guid@deleted.local", todos campos sensíveis=null)
  - Após 6 meses: Hard delete automático (retention period)
- Soft delete: Flag IsDeleted + timestamp + reason (mantém referential integrity)
- Hard delete: Remove permanentemente (apenas após anonimização + retention period)
- Anonimização cumpre RGPD (dados deixam de ser PII) e mantém integridade da DB
- Auditoria obrigatória: Tabela AuditLog regista todas as operações GDPR
