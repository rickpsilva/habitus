---
id: REQ-POLL-005
title: Poll voting is a subscription-plan feature managed per pack
type: Functional
module: Polls
priority: High
status: Draft
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-POLL-001
  - REQ-POLL-002
designRefs:
  - docs/Requirements/diagrams/data/poll-vote-er.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/PollsController.cs
  - src/Habitus.Application/Services/SubscriptionService.cs
  - src/Habitus.Infrastructure/Data/HabitusDbContext.cs
  - src/Habitus.Infrastructure/Migrations/20260824223247_AddPollVotes.cs
testRefs:
  - tests/Habitus.Tests/LocalizationSettingsTests.cs
---

# REQ-POLL-005

Poll voting ("Votações") is a platform feature gated by its own feature key (`polls`) through the existing subscription/plan-feature system. Platform Managers can enable or disable the feature per subscription plan/pack (e.g., enabled in the Gold pack, disabled in the Free pack). Condominium access to poll endpoints follows the standard feature entitlement resolution (active condominium subscription → plan features → active Free plan).

> Note: `implementationRefs` and `testRefs` were populated by the backend/frontend implementation and test & validation stages (2026-08-25). `designRefs` are covered by the diagrams listed in `catalog-manifest.json`.

## Acceptance Criteria

- Given a condominium whose active subscription plan has the `polls` feature disabled, when any non-Manager user calls any `/polls` endpoint for that condominium, then the API responds with HTTP 403 and a message indicating the feature is not available for the current subscription.
- Given a condominium whose active subscription plan has the `polls` feature enabled, when an authorized user calls a `/polls` endpoint for that condominium, then the request proceeds normally.
- Given a platform Manager, when they edit a subscription plan's features, then `polls` appears in the manageable feature catalog and can be enabled or disabled independently of other features.
- Given a new installation with seeded plans, when plans are inspected, then the `polls` feature is enabled for the Gold plan and disabled for the Free plan (Silver disabled by default).
- Given a user with the Manager role, when calling `/polls` endpoints, then the feature gate does not block them (Managers manage subscriptions and are not subject to per-condominium gating).
- The `polls` feature must not be part of the hardcoded free fallback set used when no plan features exist.

## Quality Criteria

- Integration tests cover the feature-disabled 403 path and the feature-enabled success path.
- Seed data changes are covered by an EF migration and verifiable after `database update`.
