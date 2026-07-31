---
id: REQ-SEC-008
title: A Manager can author consent documents and publish new versions in the application
type: Functional
module: Security
priority: High
status: Draft
roles:
  - Manager
relatedRequirements:
  - REQ-SEC-005
  - REQ-SEC-006
  - REQ-AUTH-005
  - REQ-AUTH-006
designRefs:
  - docs/Requirements/diagrams/sequences/consent-authoring-and-versioning.mmd
  - docs/Requirements/diagrams/sequences/cookie-and-rgpd-consent.mmd
implementationRefs:
  - src/Habitus.Domain/Entities/ConsentDefinition.cs
  - src/Habitus.Application/DTOs/Consents/ConsentAdminDtos.cs
  - src/Habitus.Application/Interfaces/IConsentService.cs
  - src/Habitus.Application/Interfaces/ConsentAuthoringException.cs
  - src/Habitus.Application/Services/ConsentService.cs
  - src/Habitus.Api/Controllers/ConsentDefinitionsController.cs
  - src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs
  - src/Habitus.Infrastructure/Migrations/20260731163907_AddConsentDefinitionAudit.cs
testRefs:
  - tests/Habitus.Tests/ConsentServiceTests.cs
  - tests/Habitus.Api.IntegrationTests/ConsentAuthoringIntegrationTests.cs
---

# REQ-SEC-008

A user with the `Manager` role can author and maintain the legal text of the consent documents (e.g. Terms of Use and Privacy / RGPD notice) from inside the application, without resorting to SQL or database migrations. The Manager can (a) list the current consent definitions and read their bodies, (b) correct the text of an existing definition **in place** as a draft correction that keeps the same `Version` and therefore does **not** force users to re-consent, and (c) publish a **new version** of a consent `Key`, which — per the existing consent semantics where the latest active version per key wins — transparently forces re-consent for all users. This requirement specifies the authoring capability, its authorization boundary, the versioning semantics, and the auditing needed for traceability. It does **not** define the legal text itself; the content is written by the Manager.

## Scope: Authoring Actions

Operating on `ConsentDefinition` (`Key`, `Version`, `Title`, `Url`, `Body`, `IsMandatory`, `IsActive`, `CreatedAt`), a Manager can:

- **List / read** — retrieve all consent definitions and the full `Body` of each, so the current published text is visible before editing.
- **In-place correction** — update `Title`, `Url`, and `Body` of an existing definition while preserving its `Key` and `Version`. This is a non-material draft correction (e.g. typo, formatting) and MUST NOT change which version is considered "latest", so it does not re-trigger the mandatory-consent gate for users who already accepted that version.
- **Publish a new version** — create a new definition for an existing `Key` with a new `Version` string and new `Body`. Because the consent store treats the latest active version per `Key` as the currently required consent, this makes the previously recorded acceptances stale and forces re-consent through the existing mandatory gate.

## Authorization

- Only users with the `Manager` role may list, edit, or publish consent definitions.
- Any authenticated non-`Manager` role (e.g. `Admin`, `Resident`) that attempts any authoring action MUST receive an HTTP `403 Forbidden` and no change is persisted.
- Unauthenticated requests are rejected before reaching the authoring capability.

## Versioning Semantics

- An in-place correction keeps `{Key, Version}` constant; users who already accepted that `{Key, Version}` remain compliant and are **not** prompted again.
- Publishing a new `Version` for a `Key` never mutates or deletes prior definitions or the append-only `UserConsent` history; it adds a new active definition that becomes the latest for that `Key`.
- After a new mandatory version is published, users who had accepted only an earlier version are treated as missing that consent and the mandatory-consent gate (HTTP 451 `consent_required`) re-triggers until they accept the new version.

## Auditing and Traceability

- Every authoring action (in-place correction and new-version publication) records who performed it and when, so consent-text changes are attributable and reviewable.
- The published consent history remains reconstructable: for any point in time it is possible to determine which `{Key, Version}` was the required consent and what its `Body` was.

## Acceptance Criteria

- Given a user with the `Manager` role, when they open the consent-authoring area, then all consent definitions and the full `Body`, `Title`, and `Url` of each are listed and readable.
- Given a Manager editing an existing definition in place, when they save changes to `Title`, `Url`, or `Body`, then the definition's `Key` and `Version` are unchanged, the change is persisted, and no user is prompted to re-consent.
- Given a Manager publishing a new version of a consent `Key`, when the new `Version` and `Body` are saved, then a new active definition becomes the latest for that `Key`, prior definitions and `UserConsent` history are left intact, and users who accepted only an earlier version are re-prompted through the mandatory-consent gate.
- Given a non-`Manager` authenticated user (e.g. `Admin` or `Resident`), when they attempt to list, edit, or publish a consent definition, then the system responds with HTTP `403 Forbidden` and persists no change.
- Given any successful authoring action, when it completes, then the acting Manager's identity and a timestamp are recorded so the change is auditable.
- Given a published sequence of versions for a `Key`, when the consent history is inspected, then the required `{Key, Version}` and its `Body` at any past point in time can be determined, and no historical acceptance record was overwritten.

## Traceability Note

`implementationRefs` and `testRefs` are intentionally empty because this requirement is `Draft` and the authoring capability is not yet implemented. The capability will build on the existing consent foundation (`src/Habitus.Domain/Entities/ConsentDefinition.cs`, `src/Habitus.Domain/Entities/UserConsent.cs`, `src/Habitus.Application/Services/ConsentService.cs`, `src/Habitus.Application/Interfaces/IConsentService.cs`, `src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs`), whose consumer-side semantics (latest active version per key wins) this requirement relies on. These references will be filled in when the Manager authoring endpoints, service methods, and tests are added.
