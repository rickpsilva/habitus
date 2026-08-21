# Solution Design: Manager Impersonation Feature (REQ-USERS-004)

## Overview
This document describes the implementation approach for allowing Managers to impersonate Admin or Resident users for support operations.

## Architecture Decisions

### 1. Token Strategy
- **Separate Impersonation Tokens**: Create a new token type with additional claims:
  - `ImpersonatedUserId` - The target user's ID
  - `ImpersonatedRole` - The target role (Admin/Resident)
  - `ImpersonatorUserId` - The Manager's original ID
  - `ImpersonationExpiresAt` - Session expiry timestamp
  - `IsImpersonation` - Boolean flag for quick middleware checks

- **Token Lifetime**: Short-lived (configurable, default 30 minutes), non-refreshable
- **Token Format**: Same JWT structure with additional claims

### 2. Backend Components

#### New Entities
```csharp
// Audit log for impersonation sessions
public class ImpersonationSession
{
    public Guid Id { get; set; }
    public Guid ImpersonatorUserId { get; set; }  // Manager
    public Guid ImpersonatedUserId { get; set; }  // Admin/Resident
    public Guid CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? EndReason { get; set; }  // "ExplicitExit", "Expired", "Revoked"
    public string IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool IsActive { get; set; }
}
```

#### New DTOs
```csharp
// Request to start impersonation
public class StartImpersonationRequest
{
    public Guid TargetUserId { get; set; }
    public Guid? UnitId { get; set; }  // Optional: specific unit within condominium
}

// Response with impersonation token
public class ImpersonationResponse
{
    public string Token { get; set; }
    public DateTime ExpiresAt { get; set; }
    public Guid ImpersonatedUserId { get; set; }
    public int ImpersonatedRole { get; set; }
    public Guid CondominiumId { get; set; }
    public Guid? UnitId { get; set; }
    public string ImpersonatedUserName { get; set; }
}

// Request to end impersonation
public class EndImpersonationRequest { }
```

#### New Controller Endpoints (AuthController)
- `POST /api/platform/auth/impersonate/start` - Start impersonation session (Manager only)
- `POST /api/platform/auth/impersonate/end` - End impersonation session (returns Manager's original token)
- `GET /api/platform/auth/impersonate/status` - Check current impersonation status

#### AuthService Extensions
- `StartImpersonationAsync(Guid managerId, StartImpersonationRequest request, string ip, string userAgent)` 
- `EndImpersonationAsync(Guid managerId)`
- `GetImpersonationStatusAsync(Guid managerId)`
- `ValidateImpersonationTokenAsync(string token)` - For middleware

#### Middleware Updates
- **CondominiumAccessGuardMiddleware**: Check for `IsImpersonation` claim; if present, enforce scope based on `ImpersonatedUserId` and `ImpersonatedRole`
- **New ImpersonationMiddleware** (optional): Validate impersonation token expiry, auto-end expired sessions

### 3. Frontend Components

#### API Client Extensions (services.ts)
```typescript
impersonationApi: {
  start: (data: StartImpersonationRequest) => api.post<ImpersonationResponse>('/platform/auth/impersonate/start', data),
  end: () => api.post<AuthResponse>('/platform/auth/impersonate/end'),
  status: () => api.get<ImpersonationStatusResponse>('/platform/auth/impersonate/status'),
}
```

#### AuthContext Extensions
- `impersonation: ImpersonationState | null` - Current impersonation state
- `startImpersonation(targetUserId, unitId?)` - Initiate impersonation
- `endImpersonation()` - Exit impersonation, restore Manager context
- `isImpersonating: boolean` - Computed property

#### UI Components
- **ImpersonationBanner**: Persistent banner showing "Impersonating as [Name] (Admin/Resident)" with "Exit Impersonation" button
- **UserSelector**: Modal/page for Manager to search/select target Admin/Resident user
- **Integration**: Add "Impersonate" action in Users management page for Managers

### 4. Database Changes
- New table: `ImpersonationSessions` with indexes on `ImpersonatorUserId`, `ImpersonatedUserId`, `IsActive`
- Migration for the new entity

### 5. Security Considerations
1. **Authorization**: Only Managers can initiate; target must be Admin/Resident in accessible condominium
2. **Audit Trail**: All actions during impersonation logged with both IDs
3. **Token Isolation**: Impersonation tokens cannot be used to start new impersonation
4. **Session Limits**: One active impersonation per Manager at a time
5. **Auto-Expiry**: Background job or middleware check to clean expired sessions

### 6. Integration Points
- **Existing Context Switching**: Reuse `SetActiveContextAsync` pattern but with impersonation claims
- **Condominium Scope**: Leverage existing `CondominiumAccessGuardMiddleware` with impersonation-aware logic
- **Frontend AuthContext**: Extend existing `switchContext` pattern

## File Changes Summary

### Backend (New)
1. `src/Habitus.Domain/Entities/ImpersonationSession.cs` - Domain entity
2. `src/Habitus.Application/DTOs/Auth/StartImpersonationRequest.cs` - Request DTO
3. `src/Habitus.Application/DTOs/Auth/ImpersonationResponse.cs` - Response DTO
4. `src/Habitus.Application/DTOs/Auth/ImpersonationStatusResponse.cs` - Status DTO
5. `src/Habitus.Application/Services/ImpersonationService.cs` - New service (or extend AuthService)
6. `src/Habitus.Api/Controllers/AuthController.cs` - Add impersonation endpoints
7. `src/Habitus.Infrastructure/Data/HabitusDbContext.cs` - Add DbSet
8. `src/Habitus.Infrastructure/Migrations/xxxx_ImpersonationSupport.cs` - Migration

### Backend (Modified)
1. `src/Habitus.Application/Services/AuthService.cs` - Add impersonation methods, token generation
2. `src/Habitus.Api/Middleware/CondominiumAccessGuardMiddleware.cs` - Handle impersonation claims
3. `src/Habitus.Infrastructure/DependencyInjection.cs` - Register new service

### Frontend (New)
1. `src/habitus-web/src/components/ImpersonationBanner.tsx` - Visual indicator
2. `src/habitus-web/src/components/UserImpersonationSelector.tsx` - User selection UI
3. `src/habitus-web/src/pages/ImpersonationPage.tsx` - Page to start impersonation

### Frontend (Modified)
1. `src/habitus-web/src/api/services.ts` - Add impersonationApi
2. `src/habitus-web/src/contexts/AuthContext.tsx` - Add impersonation state/methods
3. `src/habitus-web/src/pages/UsersPage.tsx` - Add "Impersonate" action for Managers
4. `src/habitus-web/src/components/Layout.tsx` - Show ImpersonationBanner when active

## Implementation Priority
1. Backend: Domain entity, DTOs, AuthService extensions, AuthController endpoints
2. Backend: Middleware updates, migration, DI registration
3. Frontend: API client, AuthContext extensions
4. Frontend: UI components (banner, selector, integration in UsersPage)
5. Tests: Unit + integration tests for impersonation flow