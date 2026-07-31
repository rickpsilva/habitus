---
id: REQ-SEC-006
title: The login page requires cookie consent before non-essential cookies are set
type: Functional
module: Security
priority: Medium
status: Implemented
roles:
  - Manager
  - Admin
  - Resident
relatedRequirements:
  - REQ-AUTH-005
  - REQ-SEC-005
designRefs:
  - docs/Requirements/diagrams/sequences/cookie-and-rgpd-consent.mmd
implementationRefs:
  - src/habitus-web/src/pages/LoginPage.tsx
testRefs: []
---

# REQ-SEC-006

Any user reaching the login page is informed about cookie usage and must accept before non-essential cookies are set; essential cookies required for authentication and security may be used, and the preference is remembered.

## Acceptance Criteria

- Given a visitor on the login page, when the page loads, then a cookie notice describing cookie usage is shown before any non-essential cookie is written.
- Given the cookie notice, when the user accepts, then non-essential cookies may be set and the preference is stored so the notice is not shown again.
- Given the cookie notice, when the user rejects non-essential cookies, then only essential cookies are used and the site remains usable for authentication.
- Given a stored cookie preference, when the user returns to the login page, then the previous choice is respected without prompting again, unless the policy changes.
