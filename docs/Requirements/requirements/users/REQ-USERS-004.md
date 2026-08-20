---
id: REQ-USERS-004
title: Manager can impersonate Admin or Resident for support operations
type: Functional
module: Users
priority: High
status: Proposed
roles:
  - Manager
relatedRequirements:
  - REQ-USERS-001
  - REQ-AUTH-001
  - REQ-SEC-001
designRefs:
  - docs/Requirements/diagrams/sequences/auth-condominium-scope-flow.mmd
  - docs/Requirements/diagrams/sequences/users-management-scope-flow.mmd
---

# REQ-USERS-004

A Manager user should be able to assume the position of an Admin or Resident user of a specific condominium and fraction (unit) to perform support operations on their behalf.

## Motivation

Managers (platform-level administrators) often need to troubleshoot issues, verify configurations, or perform operations that require the exact permissions and context of an Admin or Resident. Currently, this requires the Manager to ask for credentials or manually switch accounts, which is insecure and inefficient.

## Scope and Behavior

- **Impersonation Session**: A Manager initiates an impersonation session by specifying a target User (Admin or Resident) and optionally a specific Unit within that user's condominium.
- **Permission Scope**: During impersonation, the Manager operates with the exact permissions of the target role (Admin or Resident) within the specified condominium/fraction context.
- **Audit Trail**: Every impersonation action is logged with the Manager's identity, target user, timestamp, and duration.
- **Time-Limited**: Impersonation sessions have a maximum duration (configurable, default 30 minutes) and auto-expire.
- **Explicit Exit**: The Manager can end the impersonation session at any time to return to their Manager context.
- **Restrictions**:
  - Managers cannot impersonate other Managers.
  - Managers can only impersonate users in condominiums they have access to (via UserCondominium).
  - Impersonation does not grant access to the target user's credentials or personal data beyond what the role permits.

## Acceptance Criteria

1. **Initiate Impersonation**
   - Given a Manager authenticated in the platform, when they call the impersonation endpoint with a valid target UserId (Admin or Resident) and optional UnitId, then the system returns an impersonation token/context.
   - Given a Manager, when they attempt to impersonate a Manager, then the system rejects the request with 403.
   - Given a Manager, when they attempt to impersonate a user in a condominium they don't manage, then the system rejects the request with 403.

2. **Operate Under Impersonation**
   - Given an active impersonation session, when the Manager makes API calls, then the system evaluates permissions as the target role (Admin/Resident) in the target condominium/unit.
   - Given an active impersonation session, when the Manager accesses resources, then the CondominiumAccessGuardMiddleware enforces the target user's condominium scope.
   - Given an active impersonation session, the Manager's original identity is preserved in audit logs for all actions performed.

3. **End Impersonation**
   - Given an active impersonation session, when the Manager calls the end-impersonation endpoint, then the session terminates and the Manager returns to their original Manager context.
   - Given an expired impersonation session (time limit reached), when the Manager makes a request, then the system automatically ends impersonation and returns 401 requiring re-authentication as Manager.

4. **Audit & Security**
   - Every impersonation start/end is logged with: Manager UserId, Target UserId, Target Role, CondominiumId, UnitId (if applicable), StartTime, EndTime, Duration, IP Address.
   - Actions performed during impersonation include both the Manager's original UserId and the impersonated UserId in audit logs.
   - Impersonation tokens are distinct from regular auth tokens and cannot be used outside the impersonation flow.

## Non-Functional Requirements

- **Security**: Impersonation tokens must be short-lived (configurable, default 30 min) and rotated if session extends.
- **Traceability**: All impersonation actions must be queryable for compliance/audit.
- **Performance**: Impersonation context switch must add <50ms latency to request processing.
- **Usability**: Frontend must clearly indicate when operating in impersonation mode (visual indicator, easy exit button).

## Out of Scope

- Impersonation of external identity provider users (Google, Microsoft) — only local accounts supported initially.
- Delegated impersonation (Manager A impersonating Manager B who is impersonating User C).
- Persistent impersonation across browser sessions — session ends on browser close or explicit logout.