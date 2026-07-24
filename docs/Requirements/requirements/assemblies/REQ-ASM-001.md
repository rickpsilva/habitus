---
id: REQ-ASM-001
title: Assemblies capture attendance and decisions
type: Functional
module: Assemblies
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
designRefs:
  - /home/rick/workspace/habitus/docs/Requirements/diagrams/sequences/assemblies-lifecycle-flow.mmd
implementationRefs:
  - /home/rick/workspace/habitus/src/Habitus.Api/Controllers/AssembliesController.cs
testRefs:
  - /home/rick/workspace/habitus/tests/Habitus.Tests/AssemblyServiceIsolationTests.cs
  - /home/rick/workspace/habitus/tests/Habitus.Tests/NotificationDispatchServiceTests.cs
---

# REQ-ASM-001

Assembly records support attendance tracking, decision recording, and condominium-scoped visibility.

## Acceptance Criteria

- Given an authorized user, when an assembly is created or updated, then it remains associated with the condominium.
- Given an attendance entry, when it is stored, then the participant and status are preserved.
- Given a decision record, when it is added, then it is tied to the assembly and available only within scope.
