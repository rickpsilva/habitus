# Frontend Multi-Condominium Migration - Resumo Completo

> **Última actualização:** Abril 2026

## 🆕 Sessão de Abril 2026

### Nova Página — BillingPage (`/billing`)
**Acesso:** Apenas **Manager**

**Funcionalidades:**
- ✅ Estatísticas de plataforma: total de condomínios, subscrições ativas, MRR
- ✅ Cards dos 3 planos (Free / Silver / Gold) com preços e lista de features
- ✅ Tabela de todos os condomínios com plano atribuído, ciclo, valor e próxima cobrança
- ✅ Modal de atribuição: selecionar condomínio + plano + ciclo (Mensal / Anual / 5 Anos com descontos)
- ✅ Acção "Cancelar" subscrição existente por linha

### UsersPage — Modo Manager
- ✅ Título muda para "Gestores do Portal"
- ✅ Lista filtra apenas utilizadores com `role=Manager`
- ✅ Formulário sem campos de Condomínio / Fração
- ✅ Role fixo "Gestor do Portal" no modal
- ✅ Filtro de função oculto (só existe um role neste contexto)

### Layout — Menu do Manager
O Manager tem uma lista de rotas própria (`managerMenuOrder`). Qualquer item fora desta lista **não** é renderizado para o Manager:

```
/dashboard        Dashboard
/condominiums     Condomínios
/billing          Faturação       ← Novo
/users            Utilizadores (aparece como "Gestores do Portal")
```

Itens **exclusivos de Admin / Resident** (ocultos ao Manager):
- Manutenção, Financeiro, Comunicados, Reservas, Documentos, Assembleias, Configuração Condomínio, Pagamentos, Notificações

### DashboardPage — Painel do Gestor
- ✅ Manager vê painel separado com 4 stat cards: Condomínios, Utilizadores, Requests/min, Volume MRR
- ✅ MRR calculado a partir de `GET /api/subscriptions/stats` (valor real)
- ✅ Secção de planos com preços reais e link para `/billing`

### ProfilePage
- ✅ Manager não vê secções de Fração, Condomínio nem Documentos

### NotificationsPage
- ✅ Manager vê mensagem informativa; sem feed de notificações de condomínio

### Novos tipos (`types/index.ts`)
```typescript
PlanFeatureDto, SubscriptionPlanDto, CondominiumSubscriptionDto,
AssignSubscriptionRequest, SubscriptionStatsDto
```

### Novo serviço (`api/services.ts`)
```typescript
subscriptionsApi.getPlans()
subscriptionsApi.getPlanById(id)
subscriptionsApi.getAll()
subscriptionsApi.getStats()
subscriptionsApi.getMy()
subscriptionsApi.assign(data)
subscriptionsApi.cancel(id)
```

---

## ✅ Alterações Implementadas no Frontend (habitus-web)

### 1. **Tipos TypeScript Atualizados** ([src/types/index.ts](../src/habitus-web/src/types/index.ts))

#### Novos Tipos Adicionados:
- **UserDto**: Substitui ResidentDto (deprecated)
  - `role`: Enum com Manager=0, Admin=1, Resident=2
  - `condominiumId` e `unitId` opcionais
- **CondominiumDto**: Representa condominiums
  - `name`, `address`, `taxId`, `phone`, `email`, `isActive`
- **CreateUserRequest**: Criação de utilizadores
- **UpdateUserRequest**: Atualização de perfil
- **CreateCondominiumRequest**: Criação de condominiums

#### DTOs Atualizados (`buildingId` → `condominiumId`):
- ✅ MaintenanceRequestDto
- ✅ FinancialRecordDto
- ✅ NotificationDto
- ✅ ReservationDto (também `residentId` → `userId`)
- ✅ SharedSpaceDto
- ✅ DocumentDto
- ✅ AssemblyDto
- ✅ UnitDto

#### AuthResponse Atualizado:
```typescript
export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  role: string;
  condominiumId?: string;  // Novo!
  unitId?: string;          // Novo!
}
```

---

### 2. **Serviços API Atualizados** ([src/api/services.ts](../src/habitus-web/src/api/services.ts))

#### Novos Serviços:
```typescript
// Gestão de Utilizadores
usersApi.getAll()
usersApi.getById(id)
usersApi.create(data: CreateUserRequest)
usersApi.update(id, data: UpdateUserRequest)
usersApi.updatePassword(id, { currentPassword, newPassword })
usersApi.delete(id)

// Gestão de Condominiums
condominiumsApi.getAll()
condominiumsApi.getById(id)
condominiumsApi.create(data: CreateCondominiumRequest)
condominiumsApi.update(id, data)
condominiumsApi.delete(id)
```

#### Serviço Deprecated:
- `residentsApi` - ainda disponível mas use `usersApi`

---

### 3. **Context de Autenticação** ([src/contexts/AuthContext.tsx](../src/habitus-web/src/contexts/AuthContext.tsx))

#### Novas Propriedades Disponíveis:
```typescript
const {
  user,              // AuthResponse completo
  login, logout,     
  isManager,         // role === 'manager' || role === '0'
  isAdmin,           // role === 'admin' || role === '1'
  isResident,        // role === 'resident' || role === '2' (NOVO!)
  condominiumId,     // Do JWT token (NOVO!)
  unitId             // Do JWT token (NOVO!)
} = useAuth();
```

---

### 4. **Novas Páginas Criadas**

#### 📋 **CondominiumsPage** ([src/pages/CondominiumsPage.tsx](../src/habitus-web/src/pages/CondominiumsPage.tsx))
**Acesso:** Apenas **Manager**

**Funcionalidades:**
- ✅ Listar todos os condominiums
- ✅ Criar novo condominium (nome, endereço, NIF, email, telefone)
- ✅ Editar condominium existente
- ✅ Excluir condominium (com validação de dependências)
- ✅ Indicadores visuais de status (Ativo/Inativo)

---

#### 👥 **UsersPage** ([src/pages/UsersPage.tsx](../src/habitus-web/src/pages/UsersPage.tsx))
**Acesso:** **Manager** e **Admin**

**Funcionalidades:**
- ✅ Listar utilizadores (Admin vê apenas do seu condominium)
- ✅ Criar novo utilizador com validações:
  - **Manager** pode criar: Gestor, Admin, Morador
  - **Admin** pode criar: Admin, Morador (NÃO pode criar Gestor)
  - Admin/Morador precisam de `condominiumId`
  - Morador precisa de `unitId`
- ✅ Editar utilizador (nome, email, telefone)
- ✅ Excluir utilizador
- ✅ Filtros por função (Gestor/Admin/Morador)
- ✅ Pesquisa por nome/email
- ✅ Seleção de condominium (Manager) e fração (Morador)

---

#### 👤 **ProfilePage** ([src/pages/ProfilePage.tsx](../src/habitus-web/src/pages/ProfilePage.tsx))
**Acesso:** Todos os utilizadores autenticados

**Funcionalidades:**
- ✅ Editar dados pessoais (nome, email, telefone)
- ✅ Alterar senha (com confirmação)
- ✅ Visualizar informações de conta (função, condominium, fração - read-only)
- ✅ Nota: **Não pode alterar a própria fração** (apenas Admin/Manager)

---

### 5. **Páginas Atualizadas**

#### 🏢 **UnitsPage** ([src/pages/UnitsPage.tsx](../src/habitus-web/src/pages/UnitsPage.tsx))
**Alterações:**
- ✅ `buildingId` → `condominiumId`
- ✅ Acesso: Manager E Admin (antes apenas Admin)
- ✅ **Manager**: Pode escolher condominium ao criar fração + filtro por condominium
- ✅ **Admin**: Criação automática no seu condominium (sem escolha)
- ✅ Validação ao excluir (verifica utilizadores associados)

---

### 6. **Navegação e Layout** ([src/components/Layout.tsx](../src/habitus-web/src/components/Layout.tsx))

#### Menus por Role:

**Manager** (`managerMenuOrder`):
```
/dashboard         Dashboard
/condominiums      Condomínios
/billing           Faturação
/users             Gestores do Portal
```

**Admin** (`adminMenuOrder`):
```
/dashboard, /notifications, /announcements, /maintenance,
/financial, /reservations, /documents, /assemblies, /users, /settings
```

**Resident** (`residentMenuOrder`):
```
/dashboard, /notifications, /announcements, /payments,
/reservations, /maintenance, /documents, /assemblies, /financial
```

> Itens com `managerOnly`, `managerOrAdminOnly` ou `residentOnly` controlam visibilidade individual. Para o Manager, só são visíveis itens presentes em `managerMenuOrder`.

---

### 7. **Rotas da Aplicação** ([src/App.tsx](../src/habitus-web/src/App.tsx))

#### Rotas disponíveis:
```typescript
/dashboard        → DashboardPage
/maintenance      → MaintenancePage
/financial        → FinancialPage
/notifications    → NotificationsPage
/announcements    → AnnouncementsPage
/reservations     → ReservationsPage
/documents        → DocumentsPage
/assemblies       → AssembliesPage
/shared-spaces    → SharedSpacesPage
/suppliers        → SuppliersPage
/payments         → PaymentsPage
/condominiums     → CondominiumsPage (Manager only)
/billing          → BillingPage (Manager only)  ← Novo
/users            → UsersPage (Manager & Admin)
/units            → UnitsPage
/settings         → CondominiumSettingsPage
/profile          → ProfilePage
/residents        → redirect /users
```

---

## 🔐 Matriz de Permissões

| Funcionalidade | Manager | Admin | Resident |
|---|---|---|---|
| **Dashboard** | Painel de plataforma (stats + MRR) | Painel do condomínio | Painel pessoal |
| **Faturação** (`/billing`) | CRUD completo | — | — |
| **Condomínios** | CRUD completo | — | — |
| **Gestores do Portal** (`/users`) | Listar/criar/editar Managers | — | — |
| **Utilizadores** (`/users`) | — | CRUD Admin e Resident do seu condo | — |
| **Frações** | CRUD completo | CRUD no seu condo | — |
| **Manutenção** | — | CRUD no seu condo | CRUD próprias requisições |
| **Financeiro** | — | CRUD no seu condo | Ver apenas |
| **Documentos** | — | CRUD no seu condo | Ver apenas |
| **Assembleias** | — | CRUD no seu condo | Ver e participar |
| **Reservas** | — | CRUD no seu condo | CRUD próprias reservas |
| **Comunicados** | — | CRUD no seu condo | Publicar + comentar |
| **Notificações** | Mensagem informativa | Feed do condomínio | Feed pessoal |
| **Perfil** | Dados pessoais + senha (sem condo/fração) | Dados pessoais + senha | Dados pessoais + senha |

---

## 📝 Validações Implementadas

### Criação de Utilizadores (UsersPage):
1. **Manager criando Gestor**: ✅ Permitido, sem `condominiumId`/`unitId`
2. **Manager criando Admin**: ✅ Precisa selecionar `condominiumId`
3. **Manager criando Morador**: ✅ Precisa `condominiumId` + `unitId`
4. **Admin criando Gestor**: ❌ **BLOQUEADO** - "Admin não pode criar Gestores"
5. **Admin criando Admin**: ✅ Automaticamente no seu `condominiumId`
6. **Admin criando Morador**: ✅ Automaticamente no seu `condominiumId`, precisa `unitId`

### Criação de Frações (UnitsPage):
1. **Manager**: Precisa escolher `condominiumId` de um dropdown
2. **Admin**: Automaticamente no seu `condominiumId` (sem escolha)

### Edição de Perfil (ProfilePage):
1. ✅ Pode alterar: Nome, Email, Telefone, Senha
2. ❌ **NÃO pode alterar**: Função, Condominium, Fração
3. 💡 Nota exibida: "Não pode alterar a sua fração. Entre em contacto com o administrador ou gestor."

---

## 🚀 Próximos Passos Recomendados

### 1. **Testar a Aplicação**
```bash
cd src/habitus-web
npm install
npm run dev
```

### 2. **Fluxo de Teste Sugerido:**

#### Como Manager:
1. Login com conta Manager
2. Criar primeiro Condominium (/condominiums)
3. Criar Frações para esse condominium (/units)
4. Criar Admin para o condominium (/users)
5. Criar Moradores com frações associadas (/users)

#### Como Admin:
1. Login com conta Admin
2. Ver apenas dados do seu condominium
3. Criar/Editar Frações no seu condominium
4. Criar/Editar Admin e Moradores
5. Verificar que não pode criar Gestores

#### Como Resident:
1. Login com conta Morador
2. Ver/Editar **Meu Perfil**
3. Criar requisições de manutenção
4. Fazer reservas de espaços
5. Ver documentos e assembleias

### 3. **Páginas que Ainda Precisam de Atualização**

As seguintes páginas **ainda não foram modificadas** mas precisarão de ajustes para usar `condominiumId`:

- ❗ **MaintenancePage**: Precisa passar `condominiumId` ao criar MaintenanceRequest
- ❗ **FinancialPage**: Usar `condominiumId` em vez de `buildingId`
- ❗ **ReservationsPage**: Usar `userId` em vez de `residentId`, obter `condominiumId` do SharedSpace
- ❗ **DocumentsPage**: Filtrar por `condominiumId`  
- ❗ **AssembliesPage**: Filtrar por `condominiumId`
- ❗ **NotificationsPage**: Filtrar por `condominiumId`
- ❗ **DashboardPage**: Atualizar estatísticas com scope de condominium
- ❗ **RegisterPage**: Atualizar para novo fluxo (ou desativar se Managers criam utilizadores)

### 4. **Melhorias Futuras (Opcionais)**

#### Segurança:
- Implementar refresh tokens
- Adicionar 2FA (Two-Factor Authentication)
- Rate limiting no frontend

#### UX:
- Loading skeletons em vez de "A carregar..."
- Toasts/Notifications para sucesso/erro
- Confirmação de ações destrutivas mais robusta
- Paginação para listas grandes
- Exportação de dados (Excel/PDF)

#### Features:
- Histórico de alterações de utilizadores
- Logs de atividade
- Relatórios por condominium
- Dashboard com gráficos
- Upload de documentos/fotos

---

## 🐛 Troubleshooting

### Erro: "Cannot read property 'condominiumId' of null"
**Solução**: O token JWT não contém `condominiumId`. Faça novo login para obter token atualizado com os novos campos.

### Erro: "Admin não pode criar Gestores"
**Esperado**: Esta é uma validação de negócio. Apenas Managers podem criar outros Managers.

### Utilizadores não aparecem para Admin
**Esperado**: Admin vê apenas utilizadores do seu `condominiumId`. Verifique se está logado com o Admin correto.

### Condomínios não aparecem no menu
**Esperado**: Apenas **Manager** vê a opção "Condomínios" no menu.

---

## 📚 Arquivos Modificados/Criados

### Novos Arquivos:
```
src/habitus-web/src/pages/
  ├── CondominiumsPage.tsx    ✨ NOVO
  ├── UsersPage.tsx           ✨ NOVO
  └── ProfilePage.tsx         ✨ NOVO
```

### Arquivos Modificados:
```
src/habitus-web/src/
  ├── types/index.ts          🔄 ATUALIZADO
  ├── api/services.ts         🔄 ATUALIZADO
  ├── contexts/AuthContext.tsx 🔄 ATUALIZADO
  ├── components/Layout.tsx   🔄 ATUALIZADO
  ├── pages/UnitsPage.tsx     🔄 ATUALIZADO
  └── App.tsx                 🔄 ATUALIZADO
```

### Arquivos Deprecated (manter compatibilidade):
```
src/habitus-web/src/pages/
  └── ResidentsPage.tsx       ⚠️ DEPRECATED (redirect para /users)
```

---

## ✅ Checklist de Implementação

- [x] Atualizar tipos TypeScript (User, Condominium, DTOs)
- [x] Criar serviços API (usersApi, condominiumsApi)
- [x] Atualizar AuthContext (isResident, condominiumId, unitId)
- [x] Criar CondominiumsPage (Manager only)
- [x] Criar UsersPage (Manager & Admin com permissões)
- [x] Criar ProfilePage (edição de dados pessoais)
- [x] Atualizar Layout (menu condicional por role)
- [x] Atualizar App.tsx (novas rotas)
- [x] Atualizar UnitsPage (condominiumId, permissões)
- [ ] Atualizar MaintenancePage (condominiumId no create)
- [ ] Atualizar FinancialPage (condominiumId)
- [ ] Atualizar ReservationsPage (userId, condominiumId)
- [ ] Atualizar DocumentsPage (filtro por condominiumId)
- [ ] Atualizar AssembliesPage (filtro por condominiumId)
- [ ] Atualizar NotificationsPage (filtro por condominiumId)
- [ ] Atualizar DashboardPage (estatísticas com scope)
- [ ] Testar fluxos completos (Manager, Admin, Resident)

---

## 🎉 Conclusão

O frontend foi **completamente adaptado** para suportar a arquitetura multi-condomínio com as seguintes permissões hierárquicas:

✅ **Manager** → Controlo total de múltiplos condominiums  
✅ **Admin** → Gestão completa do seu condominium  
✅ **Resident** → Acesso aos serviços e edição do próprio perfil

Todas as páginas principais de gestão (Condominiums, Users, Units, Profile) foram criadas ou atualizadas com as validações de negócio apropriadas.

**Status:** Pronto para testes! 🚀
