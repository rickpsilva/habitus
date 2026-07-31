---
id: REQ-DOC-001
title: Documents are stored and accessed per condominium
type: Functional
module: Documents
priority: High
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-001
  - REQ-SET-001
  - REQ-SEC-001
designRefs:
  - docs/Requirements/diagrams/sequences/documents-scope-and-access-flow.mmd
implementationRefs:
  - src/Habitus.Api/Controllers/DocumentsController.cs
testRefs: []
---

# REQ-DOC-001

Users with the right condominium scope can upload, list, and download documents for that condominium, with access restricted by role and tenancy.

## Acceptance Criteria

- Given an authorized user, when a document is uploaded for a condominium, then the document is persisted under that condominium.
- Given a user outside the condominium scope, when they request a document, then the system denies the download or hides the record.
- Given a supported document type, when it is uploaded, then the metadata and storage reference are stored successfully.
