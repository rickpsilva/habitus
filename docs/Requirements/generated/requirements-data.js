// Auto-generated from docs/Requirements/catalog-manifest.json
const REQUIREMENTS = [
  {
    "id": "REQ-AUTH-001",
    "title": "Role-based access restricted to the user's condominium scope",
    "type": "Non-Functional",
    "module": "Auth",
    "priority": "High",
    "status": "Implemented",
    "description": "Admin and Resident users can only access data belonging to their own condominium. Managers may access condominiums they manage.",
    "acceptanceCriteria": [
      "Given an Admin user, when they request a resource from a different condominium, then the API returns 403 or 404.",
      "Given a Manager user, when they request a resource from a condominium they manage, then the API returns the resource.",
      "Given any authenticated user, when the condominium scope check fails, then no other tenant data is included in the response."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-CONDO-001",
      "REQ-USERS-001",
      "REQ-SEC-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-AUTH-002",
    "title": "Public resident registration is available per condominium and requires approval",
    "type": "Functional",
    "module": "Auth",
    "priority": "High",
    "status": "Implemented",
    "description": "Public registration creates a pending Resident user for a specific condominium and unit, and activation requires approval by an Admin or an existing Resident.",
    "acceptanceCriteria": [
      "Given a valid condominium and unit, when a public resident registration is submitted, then the system creates an inactive Resident user tied to that condominium.",
      "Given a pending registration, when an Admin or approved Resident confirms it, then the account becomes active.",
      "Given an invalid condominium, unit, or duplicate email, when registration is submitted, then the system rejects it."
    ],
    "roles": [
      "Admin",
      "Resident",
      "Manager"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-AUTH-003",
    "title": "Authentication responses include role and condominium scope claims",
    "type": "Functional",
    "module": "Auth",
    "priority": "High",
    "status": "Implemented",
    "description": "Login and registration responses expose the authenticated user's role and scope so the frontend and API can enforce condominium and unit boundaries consistently.",
    "acceptanceCriteria": [
      "Given a successful login, when the response is returned, then it contains the JWT token, role, condominiumId, and unitId fields.",
      "Given a Manager account, when the response is returned, then condominiumId and unitId are null.",
      "Given an authenticated user, when the token is decoded, then the role and scope claims match the user record stored in the database."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-AUTH-005",
    "title": "First login requires acceptance of the RGPD terms before access is granted",
    "type": "Functional",
    "module": "Auth",
    "priority": "High",
    "status": "Implemented",
    "description": "On the user's first authenticated portal session, the system must present the RGPD notice describing which data is encrypted and which data is stored or shown without encryption, and the user must accept the terms before continuing to the application.",
    "acceptanceCriteria": [
      "Given a user who has never accepted the RGPD notice, when they authenticate for the first time, then the system displays the RGPD terms screen before granting access.",
      "Given an RGPD notice that lists encrypted and non-encrypted data categories, when the user accepts it, then the acceptance is persisted and the user can continue.",
      "Given a user who has not accepted the RGPD notice, when they try to continue after login, then the application blocks access until acceptance is recorded."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-SEC-001",
      "REQ-SEC-002",
      "REQ-SEC-003",
      "REQ-SEC-004",
      "REQ-SEC-005",
      "REQ-SEC-006",
      "REQ-AUTH-006"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/use-cases/gdpr-self-service.mmd",
      "diagrams/sequences/first-login-rgpd-acceptance.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-AUTH-006",
    "title": "Users with multiple memberships can select their active fraction and condominium",
    "type": "Functional",
    "module": "Auth",
    "priority": "High",
    "status": "Implemented",
    "description": "When a user is associated with more than one fraction and/or condominium, the portal lets the user choose the active fraction and condominium, and all subsequent data is scoped to that active context; users with a single membership skip the selection.",
    "acceptanceCriteria": [
      "Given a user with more than one condominium and/or fraction, when they sign in, then the system presents a selector to choose the active condominium and fraction before loading the workspace.",
      "Given a user with exactly one membership, when they sign in, then the system adopts it as the active context without showing a selector.",
      "Given an active context, when the user reads or writes data, then results are scoped to the selected condominium and fraction only.",
      "Given an authenticated user, when they change the active context, then the switch takes effect without requiring a new login and re-scopes the whole portal.",
      "Given a selection request targeting a membership the user does not hold, when it is submitted, then the system rejects it."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-AUTH-005",
      "REQ-UNITS-002",
      "REQ-UNITS-003",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/active-context-selection.mmd",
      "diagrams/data/user-unit-membership.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-USERS-001",
    "title": "Platform users can be managed with role and condominium constraints",
    "type": "Functional",
    "module": "Users",
    "priority": "High",
    "status": "Implemented",
    "description": "Managers can create, update, list, and delete users across condominiums, while Admins can do the same only inside their assigned condominium and cannot create Managers.",
    "acceptanceCriteria": [
      "Given a Manager, when creating a user, then the request may target any condominium and any supported role.",
      "Given an Admin, when creating or editing a user, then the request is limited to the admin's condominium and cannot assign the Manager role.",
      "Given a Resident, when calling user management endpoints, then the system denies the operation."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-AUTH-002",
      "REQ-AUTH-003",
      "REQ-AUTH-005"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-USERS-002",
    "title": "Users can manage their own profile and password",
    "type": "Functional",
    "module": "Users",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Authenticated users can update their own contact data and password, but not their role, condominium, or unit assignment.",
    "acceptanceCriteria": [
      "Given an authenticated user, when they edit their profile, then only allowed personal fields are persisted.",
      "Given an authenticated user, when they change their password with the correct current password, then the new password is stored and the old one stops working.",
      "Given a profile update that attempts to change role, condominium, or unit, then the system ignores or rejects those fields."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-004",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-USERS-003",
    "title": "Personal area hosts RGPD information and self-service export/erasure actions",
    "type": "Functional",
    "module": "Users",
    "priority": "High",
    "status": "Implemented",
    "description": "The authenticated user's personal area exposes a GDPR / RGPD section where the user can read the site's RGPD information and start self-service export (REQ-SEC-003) and erasure/anonymization (REQ-SEC-004) actions for their own data, scoped to the condominiums where they hold membership.",
    "acceptanceCriteria": [
      "Given an authenticated user, when they open the personal area, then a GDPR section is visible showing the site's RGPD information and the export and erasure actions.",
      "Given an authenticated user, when they trigger data export from the GDPR section, then the export flow of REQ-SEC-003 is started for that user, scoped to their memberships only.",
      "Given an authenticated user, when they trigger data erasure/anonymization from the GDPR section, then the erasure flow of REQ-SEC-004 is started, requiring explicit confirmation before the account is marked for deletion.",
      "Given an authenticated user, when they use the GDPR section, then only that user's own personal data can be exported or erased and no cross-user or cross-condominium data is reachable.",
      "Given the personal area, when the GDPR section is rendered, then it is distinct from the consent accept/withdraw controls and does not reuse the unit-document `Download`/`Trash2` actions."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-005",
      "REQ-SEC-003",
      "REQ-SEC-004",
      "REQ-SEC-005",
      "REQ-USERS-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/use-cases/gdpr-self-service.mmd",
      "diagrams/sequences/first-login-rgpd-acceptance.mmd",
      "diagrams/sequences/gdpr-export-erasure.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-USERS-004",
    "title": "Manager can impersonate Admin or Resident for support operations",
    "type": "Functional",
    "module": "Users",
    "priority": "High",
    "status": "Proposed",
    "description": "A Manager user should be able to assume the position of an Admin or Resident user of a specific condominium and fraction (unit) to perform support operations on their behalf.",
    "acceptanceCriteria": [
      "1. **Initiate Impersonation**",
      "- Given a Manager authenticated in the platform, when they call the impersonation endpoint with a valid target UserId (Admin or Resident) and optional UnitId, then the system returns an impersonation token/context.",
      "- Given a Manager, when they attempt to impersonate a Manager, then the system rejects the request with 403.",
      "- Given a Manager, when they attempt to impersonate a user in a condominium they don't manage, then the system rejects the request with 403.",
      "2. **Operate Under Impersonation**",
      "- Given an active impersonation session, when the Manager makes API calls, then the system evaluates permissions as the target role (Admin/Resident) in the target condominium/unit.",
      "- Given an active impersonation session, when the Manager accesses resources, then the CondominiumAccessGuardMiddleware enforces the target user's condominium scope.",
      "- Given an active impersonation session, the Manager's original identity is preserved in audit logs for all actions performed.",
      "3. **End Impersonation**",
      "- Given an active impersonation session, when the Manager calls the end-impersonation endpoint, then the session terminates and the Manager returns to their original Manager context.",
      "- Given an expired impersonation session (time limit reached), when the Manager makes a request, then the system automatically ends impersonation and returns 401 requiring re-authentication as Manager.",
      "4. **Audit & Security**",
      "- Every impersonation start/end is logged with: Manager UserId, Target UserId, Target Role, CondominiumId, UnitId (if applicable), StartTime, EndTime, Duration, IP Address.",
      "- Actions performed during impersonation include both the Manager's original UserId and the impersonated UserId in audit logs.",
      "- Impersonation tokens are distinct from regular auth tokens and cannot be used outside the impersonation flow.",
      "## Non-Functional Requirements",
      "**Security**: Impersonation tokens must be short-lived (configurable, default 30 min) and rotated if session extends.",
      "**Traceability**: All impersonation actions must be queryable for compliance/audit.",
      "**Performance**: Impersonation context switch must add <50ms latency to request processing.",
      "**Usability**: Frontend must clearly indicate when operating in impersonation mode (visual indicator, easy exit button).",
      "## Out of Scope",
      "Impersonation of external identity provider users (Google, Microsoft) — only local accounts supported initially.",
      "Delegated impersonation (Manager A impersonating Manager B who is impersonating User C).",
      "Persistent impersonation across browser sessions — session ends on browser close or explicit logout."
    ],
    "roles": [
      "Manager"
    ],
    "relatedRequirements": [
      "REQ-USERS-001",
      "REQ-AUTH-001",
      "REQ-SEC-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/manager-impersonation-flow.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-003",
    "title": "Users can export their personal data in a portable, machine-readable format",
    "type": "Functional",
    "module": "Security",
    "priority": "High",
    "status": "Implemented",
    "description": "Authenticated users can request an export (portability) of their own personal data in a portable, structured, machine-readable format, limited to the condominiums where they hold membership and excluding any other user's or tenant's personal data. This realizes the GDPR / RGPD right to data portability (Art. 20).",
    "acceptanceCriteria": [
      "Given an authenticated user, when they request a data export, then the system returns a UTF-8 JSON document containing their profile, unit memberships, consent history, and their in-scope condominium records, with encrypted PII fields decrypted to plaintext.",
      "Given an authenticated user with memberships in condominiums A and B only, when they export their data, then only records from condominiums A and B are included and no record from any other condominium is present.",
      "Given an authenticated user, when the export is generated, then no other user's personal data and no secrets/credentials (password hashes, tokens, webhook secrets) appear anywhere in the export.",
      "Given a Manager, when they request an export for a user they manage, then the export contains only data from condominiums within that Manager's authorized scope and excludes that user's data in condominiums the Manager does not manage.",
      "Given an unauthenticated caller, when they attempt to reach the export endpoint, then the request is rejected with an authentication error and no data is produced.",
      "Given repeated export requests from the same subject beyond the configured limit, when the limit is exceeded, then the system rate-limits the request, and every accepted export request is written to the audit log with subject id, timestamp, and condominium scope.",
      "Given an export request, when it completes, then the JSON validates against the documented export schema (top-level `subject`, `profile`, `memberships`, `consents`, `records`, and `exportMetadata`)."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-SEC-001",
      "REQ-SEC-002",
      "REQ-SEC-004",
      "REQ-USERS-003",
      "REQ-AUTH-006",
      "REQ-PAY-001",
      "REQ-FIN-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/use-cases/gdpr-self-service.mmd",
      "diagrams/classes/privacy-services.mmd",
      "diagrams/sequences/gdpr-export-erasure.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-004",
    "title": "Users can request full or partial erasure/anonymization of personal data with legal-retention exceptions",
    "type": "Functional",
    "module": "Security",
    "priority": "High",
    "status": "Implemented",
    "description": "Authenticated users can request erasure of their personal data (GDPR / RGPD right to be forgotten, Art. 17), in either a full or a partial form. The system honours the Art. 17(3)(b) legal-retention exception by anonymizing/pseudonymizing direct identifiers on records that must be kept by law (financial, accounting/SAF-T, audit) instead of hard-deleting them, while preserving multi-condominium isolation and role rules.",
    "acceptanceCriteria": [
      "Given an authenticated user, when they confirm a full erasure request (with confirmation/re-authentication), then the account is marked for deletion, all direct identifiers (name, email, phone, address, external login links) are removed or replaced with anonymized values, and the account can no longer authenticate.",
      "Given an authenticated user, when they request partial erasure of specific non-retained fields, then only those fields are removed and the account remains active and able to authenticate.",
      "Given records that must be retained for legal or accounting reasons (financial/SAF-T/audit), when erasure is processed, then the record is preserved with its amounts, dates, and SAF-T-relevant fields intact while direct identifiers are replaced with anonymized/pseudonymized values (e.g. \"Utilizador anonimizado\") and the user link is severed.",
      "Given a user whose data was erased or anonymized, when the profile is viewed, then no plaintext personal data remains in any user-facing field.",
      "Given a full erasure, when it is processed, then the user's `UnitMembership` links and `User.UnitId`/`User.CondominiumId` associations are severed/anonymized, and no other tenant's records are altered or broken.",
      "Given a Manager, when they trigger erasure for a managed user, then only data within that Manager's authorized condominium scope is affected and no data outside that scope is erased or anonymized.",
      "Given any erasure request, when it is submitted, then an append-only record of the request (type, timestamp, actor) is stored consistently with the `UserConsent` history model.",
      "Given a user who has been fully erased/anonymized, when they attempt to authenticate or reach a consent-gated (HTTP 451) or context-scoped endpoint, then access is denied."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-SEC-001",
      "REQ-SEC-002",
      "REQ-SEC-003",
      "REQ-SEC-005",
      "REQ-PAY-001",
      "REQ-FIN-001",
      "REQ-AUTH-006",
      "REQ-USERS-003"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/use-cases/gdpr-self-service.mmd",
      "diagrams/classes/privacy-services.mmd",
      "diagrams/sequences/gdpr-export-erasure.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-001",
    "title": "Sensitive data is encrypted and external callbacks are verified",
    "type": "Non-Functional",
    "module": "Security",
    "priority": "High",
    "status": "Implemented",
    "description": "Sensitive identifiers, payment credentials, and webhook callbacks are protected through encryption, rate limiting, and signature verification.",
    "acceptanceCriteria": [
      "Given a sensitive field such as NIF, IBAN, SMTP password, or webhook secret, when it is stored, then it is encrypted at rest.",
      "Given the public API, when requests exceed the configured limit, then rate limiting protects the service from abuse.",
      "Given a Stripe webhook payload, when the signature is invalid, then the system rejects or ignores the callback."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-PAY-002",
      "REQ-BILL-002",
      "REQ-INV-001",
      "REQ-SEC-002",
      "REQ-SEC-003",
      "REQ-SEC-004"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-005",
    "title": "Users can view and manage RGPD consent from their personal area",
    "type": "Functional",
    "module": "Security",
    "priority": "High",
    "status": "Implemented",
    "description": "From the personal area, a user can read the current RGPD terms, see whether they have accepted them, and grant or withdraw consent; withdrawing a consent that is mandatory to operate the portal blocks further operation until it is accepted again, and mandatory RGPD acceptance is required before the user can operate the portal.",
    "acceptanceCriteria": [
      "Given an authenticated user, when they open the RGPD section of the personal area, then the full RGPD terms text and their current acceptance status are visible.",
      "Given a user who has not accepted the mandatory RGPD terms, when they attempt to use portal features, then the system blocks operation until acceptance is recorded.",
      "Given a user in the personal area, when they accept the RGPD terms, then acceptance is persisted with a timestamp and access is granted.",
      "Given a user who withdraws a mandatory consent, when the withdrawal is saved, then the portal blocks operation and prompts re-acceptance, while the withdrawal is logged.",
      "Given the personal area, when the user requests data export or erasure, then the actions defined in REQ-SEC-003 and REQ-SEC-004 remain available alongside consent management."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-005",
      "REQ-USERS-003",
      "REQ-SEC-003",
      "REQ-SEC-004",
      "REQ-SEC-006"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/cookie-and-rgpd-consent.mmd",
      "diagrams/use-cases/gdpr-self-service.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-006",
    "title": "The login page requires cookie consent before non-essential cookies are set",
    "type": "Functional",
    "module": "Security",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Any user reaching the login page is informed about cookie usage and must accept before non-essential cookies are set; essential cookies required for authentication and security may be used, and the preference is remembered.",
    "acceptanceCriteria": [
      "Given a visitor on the login page, when the page loads, then a cookie notice describing cookie usage is shown before any non-essential cookie is written.",
      "Given the cookie notice, when the user accepts, then non-essential cookies may be set and the preference is stored so the notice is not shown again.",
      "Given the cookie notice, when the user rejects non-essential cookies, then only essential cookies are used and the site remains usable for authentication.",
      "Given a stored cookie preference, when the user returns to the login page, then the previous choice is respected without prompting again, unless the policy changes."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-005",
      "REQ-SEC-005"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/cookie-and-rgpd-consent.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-007",
    "title": "PII is persisted only in encrypted form and redundant plaintext columns are removed (data minimization)",
    "type": "Non-Functional",
    "module": "Security",
    "priority": "High",
    "status": "Implemented",
    "description": "Personal and sensitive identifiers (PII) are persisted only in their encrypted form. The obsolete plaintext columns that were superseded by encrypted counterparts (naming pattern `<Property>Encrypted`, with an accompanying `<Property>Hash` where lookups are required) are removed from the schema and the domain model, and the transitional backfill hosted-services that populated the encrypted columns are decommissioned. After this change, encryption at rest is the single source of truth for these fields, realizing the GDPR / RGPD data-minimization principle (Art. 5(1)(c)) and reinforcing REQ-SEC-001 (encryption at rest).",
    "acceptanceCriteria": [
      "Given the database schema after this change, when the `User`, `Condominium`, `Supplier`, `UsefulContact`, and `Invoice` tables are inspected, then none of the listed plaintext PII columns (`User.Email`, `User.Phone`, `Condominium.Address`, `Condominium.Email`, `Supplier.Email`, `Supplier.Phone`, `Supplier.Address`, `UsefulContact.Phone`, `Invoice.CustomerTaxId`) exist, and only their `*Encrypted` (and `*Hash` where applicable) counterparts remain.",
      "Given any read, query, export, or serialization path for the affected entities, when a PII field is resolved, then the value is obtained by decrypting the encrypted column and no code path reads from a plaintext column.",
      "Given the transitional backfill hosted services for these encrypted fields, when the application starts after this change, then those hosted services are no longer registered or executed, because the encrypted columns are already populated.",
      "Given the migration that drops a plaintext column, when it runs, then it drops the column only after the corresponding encrypted column exists and is backfilled for all rows, so no PII is lost by the drop (additive-safe sequencing consistent with the prior legacy-plaintext-drop migrations).",
      "Given equality lookups or uniqueness constraints that previously used a plaintext column (e.g. user email), when they execute after this change, then they use the hash column (e.g. `User.EmailHash`) and continue to behave correctly without scanning plaintext.",
      "Given the automated test suite, when it runs, then tests assert encrypted-only behaviour: the plaintext columns are absent from the model/schema, reads return the correct decrypted values, and no regression exposes plaintext PII.",
      "Given multi-condominium isolation and role-based rules, when the schema change is applied, then no cross-tenant data is exposed and existing access controls remain enforced.",
      "## Traceability Note",
      "`implementationRefs` and `testRefs` are intentionally empty at Draft status: the schema migration, entity/model edits, hosted-service removal, and tests are produced in the implementation stage. They must be populated (drop migration, updated `User`/`Condominium`/`Supplier`/`UsefulContact`/`Invoice` entities, encrypted-only repository/service reads, removed backfill hosted services, and the asserting tests) before this requirement moves to `Implemented`."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-SEC-001",
      "REQ-SEC-003",
      "REQ-SEC-004",
      "REQ-CONDO-001",
      "REQ-SUPP-001",
      "REQ-FIN-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SEC-008",
    "title": "A Manager can author consent documents and publish new versions in the application",
    "type": "Functional",
    "module": "Security",
    "priority": "High",
    "status": "Draft",
    "description": "A user with the `Manager` role can author and maintain the legal text of the consent documents (e.g. Terms of Use and Privacy / RGPD notice) from inside the application, without resorting to SQL or database migrations. The Manager can (a) list the current consent definitions and read their bodies, (b) correct the text of an existing definition **in place** as a draft correction that keeps the same `Version` and therefore does **not** force users to re-consent, and (c) publish a **new version** of a consent `Key`, which — per the existing consent semantics where the latest active version per key wins — transparently forces re-consent for all users. This requirement specifies the authoring capability, its authorization boundary, the versioning semantics, and the auditing needed for traceability. It does **not** define the legal text itself; the content is written by the Manager.",
    "acceptanceCriteria": [
      "Given a user with the `Manager` role, when they open the consent-authoring area, then all consent definitions and the full `Body`, `Title`, and `Url` of each are listed and readable.",
      "Given a Manager editing an existing definition in place, when they save changes to `Title`, `Url`, or `Body`, then the definition's `Key` and `Version` are unchanged, the change is persisted, and no user is prompted to re-consent.",
      "Given a Manager publishing a new version of a consent `Key`, when the new `Version` and `Body` are saved, then a new active definition becomes the latest for that `Key`, prior definitions and `UserConsent` history are left intact, and users who accepted only an earlier version are re-prompted through the mandatory-consent gate.",
      "Given a non-`Manager` authenticated user (e.g. `Admin` or `Resident`), when they attempt to list, edit, or publish a consent definition, then the system responds with HTTP `403 Forbidden` and persists no change.",
      "Given any successful authoring action, when it completes, then the acting Manager's identity and a timestamp are recorded so the change is auditable.",
      "Given a published sequence of versions for a `Key`, when the consent history is inspected, then the required `{Key, Version}` and its `Body` at any past point in time can be determined, and no historical acceptance record was overwritten.",
      "## Traceability Note",
      "`implementationRefs` and `testRefs` are intentionally empty because this requirement is `Draft` and the authoring capability is not yet implemented. The capability will build on the existing consent foundation (`src/Habitus.Domain/Entities/ConsentDefinition.cs`, `src/Habitus.Domain/Entities/UserConsent.cs`, `src/Habitus.Application/Services/ConsentService.cs`, `src/Habitus.Application/Interfaces/IConsentService.cs`, `src/Habitus.Api/Middleware/RequireMandatoryConsentFilter.cs`), whose consumer-side semantics (latest active version per key wins) this requirement relies on. These references will be filled in when the Manager authoring endpoints, service methods, and tests are added."
    ],
    "roles": [
      "Manager"
    ],
    "relatedRequirements": [
      "REQ-SEC-005",
      "REQ-SEC-006",
      "REQ-AUTH-005",
      "REQ-AUTH-006"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/consent-authoring-and-versioning.mmd",
      "diagrams/sequences/cookie-and-rgpd-consent.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-CONDO-001",
    "title": "Managers can create and maintain condominiums",
    "type": "Functional",
    "module": "Condominium",
    "priority": "High",
    "status": "Implemented",
    "description": "Managers can create, update, activate, deactivate, and delete condominiums, while non-manager roles cannot manage condominium records.",
    "acceptanceCriteria": [
      "Given a Manager, when a condominium creation request is submitted, then the system creates a new active condominium.",
      "Given a non-Manager, when a condominium management endpoint is called, then the system rejects the request.",
      "Given a condominium with dependent records, when delete is attempted, then the system prevents data loss or surfaces the dependency error."
    ],
    "roles": [
      "Manager"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-UNITS-001",
    "title": "Condominium units are managed within condominium scope",
    "type": "Functional",
    "module": "Units",
    "priority": "High",
    "status": "Implemented",
    "description": "Managers and Admins can create, update, list, and delete units within the condominiums they are allowed to manage, and Residents remain tied to an assigned unit.",
    "acceptanceCriteria": [
      "Given a Manager, when creating a unit, then the manager can choose any condominium they manage.",
      "Given an Admin, when creating a unit, then the unit is created only in the admin's condominium.",
      "Given a Resident or Admin accessing a foreign condominium, then the system rejects the request."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-USERS-001",
      "REQ-CONDO-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-UNITS-002",
    "title": "A resident or internal admin can own multiple fractions within a condominium",
    "type": "Functional",
    "module": "Units",
    "priority": "High",
    "status": "Draft",
    "description": "A resident or internal admin can be associated as owner/occupant of more than one fraction (unit) inside the same condominium, replacing the current single-unit assignment with a many-to-many membership while preserving condominium isolation.",
    "acceptanceCriteria": [
      "Given a resident or internal admin, when they are linked to two or more units of the same condominium, then all those memberships are persisted and visible without overwriting each other.",
      "Given a user with multiple fractions in a condominium, when condominium-scoped data (quotas, payments, documents) is listed, then the data is aggregated or filtered by the fractions the user actually owns in that condominium.",
      "Given a membership create/update request, when it targets a unit outside the user's authorized condominium, then the system rejects the request and preserves multi-condominium isolation.",
      "Given a user with several fractions, when exactly one is flagged as primary, then the system uses it as the default fraction for that condominium."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-UNITS-001",
      "REQ-UNITS-003",
      "REQ-AUTH-006",
      "REQ-USERS-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/user-unit-membership.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-UNITS-003",
    "title": "A resident or internal admin can hold fractions across multiple condominiums",
    "type": "Functional",
    "module": "Units",
    "priority": "High",
    "status": "Implemented",
    "description": "A resident or internal admin can own fractions in more than one condominium, each membership being scoped to its own condominium, so that data from one condominium is never mixed with, or exposed to, another.",
    "acceptanceCriteria": [
      "Given a user linked to fractions in condominium A and condominium B, when both memberships exist, then each is stored independently with its own condominium scope.",
      "Given a user active in condominium A, when they read or write condominium-scoped data, then only condominium A data is returned and condominium B data stays inaccessible.",
      "Given an internal admin with memberships in two condominiums, when acting in one condominium, then the admin's role permissions apply only to the active condominium and not to the other.",
      "Given a user with no membership in a condominium, when they request that condominium's data, then the system denies access."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-UNITS-001",
      "REQ-UNITS-002",
      "REQ-AUTH-006",
      "REQ-CONDO-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/user-unit-membership.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-PAY-001",
    "title": "Payments are recorded and filtered by condominium and resident",
    "type": "Functional",
    "module": "Payments",
    "priority": "High",
    "status": "Implemented",
    "description": "Residents and Admins can create and view payment records within their condominium, while Admins may inspect pending items for the whole condominium.",
    "acceptanceCriteria": [
      "Given a Resident or Admin, when a payment is created for the allowed condominium, then the record is stored and linked to that condominium.",
      "Given a Resident, when viewing payments, then only that resident's own payments are returned.",
      "Given an Admin, when viewing pending or paged payments, then only the condominium's payments are returned."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-PAY-002",
      "REQ-INV-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-PAY-002",
    "title": "Condominium payment settings are configurable and encrypted",
    "type": "Non-Functional",
    "module": "Payments",
    "priority": "High",
    "status": "Implemented",
    "description": "Bank transfer, MB reference, MB Way, and card payment settings are configurable per condominium, with sensitive values stored encrypted at rest.",
    "acceptanceCriteria": [
      "Given an Admin or Manager with permission, when payment settings are updated, then the configuration is stored only for that condominium.",
      "Given a sensitive payment value such as IBAN or merchant ID, when it is persisted, then it is encrypted before storage.",
      "Given missing settings, when payment settings are fetched, then the API returns safe defaults instead of failing."
    ],
    "roles": [
      "Manager",
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-SEC-001",
      "REQ-PAY-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-FIN-001",
    "title": "Financial records support income, expense, and summary reporting",
    "type": "Functional",
    "module": "Financial",
    "priority": "High",
    "status": "Implemented",
    "description": "The system allows condominium financial records to be created and summarized as income, expense, and balance views within the allowed condominium scope.",
    "acceptanceCriteria": [
      "Given an authorized condominium user, when a financial record is created, then it is stored under that condominium.",
      "Given a condominium and time range, when the summary report is requested, then the totals reflect only that condominium's records.",
      "Given a user outside the condominium, when they request financial data, then no cross-tenant data is returned."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-PAY-001",
      "REQ-FIN-002"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-DOC-001",
    "title": "Documents are stored and accessed per condominium",
    "type": "Functional",
    "module": "Documents",
    "priority": "High",
    "status": "Implemented",
    "description": "Users with the right condominium scope can upload, list, and download documents for that condominium, with access restricted by role and tenancy.",
    "acceptanceCriteria": [
      "Given an authorized user, when a document is uploaded for a condominium, then the document is persisted under that condominium.",
      "Given a user outside the condominium scope, when they request a document, then the system denies the download or hides the record.",
      "Given a supported document type, when it is uploaded, then the metadata and storage reference are stored successfully."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-SET-001",
      "REQ-SEC-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-MAINT-001",
    "title": "Maintenance requests support photos, location, and confirmation workflow",
    "type": "Functional",
    "module": "Maintenance",
    "priority": "High",
    "status": "Implemented",
    "description": "Maintenance requests capture condominium scope, photos, location details, and confirmation state so Admins and Residents can track the lifecycle of each request.",
    "acceptanceCriteria": [
      "Given an Admin or Resident, when a maintenance request is created, then it can include location information and attachments.",
      "Given an existing request, when another resident confirms it, then the confirmation state is updated and preserved.",
      "Given a request outside the user's condominium, then the system rejects or hides it."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-DOC-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ANN-001",
    "title": "Announcements support attachments, comments, and read tracking",
    "type": "Functional",
    "module": "Announcements",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Announcements are created within a condominium and support attachments, comments, and per-user read status tracking.",
    "acceptanceCriteria": [
      "Given an authorized user, when an announcement is published, then it is stored for the condominium audience.",
      "Given a user who reads an announcement, when the read status is saved, then the announcement is marked as read for that user.",
      "Given comments or attachments, when they are added, then they remain associated with the same announcement and condominium."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-DOC-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ANN-002",
    "title": "Expiration date validation - must be current or future date",
    "type": "Functional",
    "module": "Announcements",
    "priority": "High",
    "status": "Planned",
    "description": "The expiration date (ValidUntil) must not be a date/time in the past. Validation must occur server-side (mandatory) with a clear error message; client-side validation is nice-to-have.",
    "acceptanceCriteria": [
      "Given an authorized user creating or updating an announcement, when they provide a ValidUntil value that is before the current date/time, then the API returns HTTP 400 with error message \"A data de expiração não pode ser anterior à data atual\" (or equivalent translated message).",
      "Given an authorized user, when they provide a ValidUntil value equal to or after the current date/time, then the request is accepted (subject to other validations).",
      "Given an authorized user, when ValidUntil is null/omitted, then the request is accepted (expiration is optional).",
      "Server-side validation is mandatory; client-side validation prevents unnecessary round-trips.",
      "## Quality Criteria",
      "Unit test for validator rejecting past dates.",
      "Integration test for Create endpoint rejecting past ValidUntil.",
      "Integration test for Update endpoint rejecting past ValidUntil.",
      "Error message is clear and localized."
    ],
    "roles": [
      "Admin",
      "Manager",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-ANN-001",
      "REQ-ANN-005"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ANN-003",
    "title": "Default status filter on announcements list is Published",
    "type": "Functional",
    "module": "Announcements",
    "priority": "Medium",
    "status": "Planned",
    "description": "The announcements list page must default to filtering by \"Publicado\" (Published) status instead of \"Todos\" (All). Users can still select \"Todos\" or other statuses explicitly.",
    "acceptanceCriteria": [
      "Given a user navigating to the announcements page, when the page loads without a status query parameter, then the status filter dropdown shows \"Publicado\" as selected and only published announcements are displayed (respecting visibility rules).",
      "Given a user explicitly selects \"Todos\" from the status filter dropdown, then all announcements visible to the user (per role-based visibility) are displayed.",
      "Given a user selects another status (e.g., \"Rascunho\", \"Aguardando aprovação\", \"Rejeitado\", \"Arquivado\"), then the list filters accordingly.",
      "The URL query parameter `status` reflects the selected filter (empty when \"Publicado\" is default, \"All\" when \"Todos\" is selected, or the status enum value).",
      "## Quality Criteria",
      "Default filter is \"Publicado\" on initial page load.",
      "\"Todos\" option remains available and functional.",
      "URL sync works correctly for all filter values.",
      "No breaking change to existing direct links with explicit status parameters."
    ],
    "roles": [
      "Admin",
      "Manager",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-ANN-001",
      "REQ-ANN-005"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ANN-004",
    "title": "Automatic background job archives expired announcements",
    "type": "Functional",
    "module": "Announcements",
    "priority": "High",
    "status": "Planned",
    "description": "An automatic background job (mirroring the existing `InvoiceGenerationBackgroundService` pattern) periodically archives announcements whose `ValidUntil` date has passed.",
    "acceptanceCriteria": [
      "A new hosted service `AnnouncementExpiryBackgroundService` is registered in DI and runs on a configurable interval (default: daily at a sensible hour, e.g., 03:00 AM).",
      "The job queries all announcements per condominium where `ValidUntil` is not null, `ValidUntil < DateTime.UtcNow`, and `Status == Published` (or `PendingApproval`? — only Published makes sense for expiry).",
      "For each matching announcement, the job sets `Status = Archived` and `UpdatedAt = DateTime.UtcNow`.",
      "The job is idempotent: running multiple times does not double-archive or cause errors.",
      "The job respects multi-condominium scope: processes each condominium's announcements independently.",
      "The job logs: number of announcements archived per condominium, any errors.",
      "Configuration via `appsettings.json` section `Announcements:ExpiryJob` with properties `Enabled` (bool, default true), `RunTime` (time of day, default \"03:00\"), `IntervalHours` (default 24).",
      "The job can be disabled via configuration for testing/maintenance.",
      "## Quality Criteria",
      "Unit test for the service's core logic (mock repository, verify status change).",
      "Integration test verifying expired announcements become Archived after job runs.",
      "Job follows the exact same pattern as `InvoiceGenerationBackgroundService` (BackgroundService, IServiceProvider scope, structured logging, cancellation token handling).",
      "No performance regression: job uses efficient query (index on ValidUntil + Status + CondominiumId recommended)."
    ],
    "roles": [
      "System"
    ],
    "relatedRequirements": [
      "REQ-ANN-001",
      "REQ-ANN-002",
      "REQ-ANN-005"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ANN-005",
    "title": "Archived announcements reject new comments",
    "type": "Functional",
    "module": "Announcements",
    "priority": "High",
    "status": "Planned",
    "description": "Archived announcements must not accept new comments. The API must reject comment creation on archived announcements, and the UI must hide/disable the comment input for archived announcements.",
    "acceptanceCriteria": [
      "Given an announcement with Status = Archived, when any user attempts to add a comment via POST /api/condominiums/{condominiumId}/announcements/{id}/comments, then the API returns HTTP 400 with error message \"Não é possível comentar em comunicados arquivados\" (or equivalent translated message).",
      "Given an announcement with Status = Archived, when the announcement detail view is displayed, then the comment input area is hidden or disabled with a visual indication that commenting is not allowed for archived announcements.",
      "Given an announcement with Status = Published (or other non-archived statuses where comments are allowed), when a user adds a comment, then the comment is accepted per existing rules.",
      "The existing check for `announcement.Status != AnnouncementStatus.Published` in the comments endpoint is extended to also reject `AnnouncementStatus.Archived`.",
      "## Quality Criteria",
      "Integration test: POST comment on Archived announcement returns 400.",
      "Integration test: POST comment on Published announcement still works.",
      "UI test: comment form not rendered for Archived announcements.",
      "No regression on existing comment functionality for non-archived announcements."
    ],
    "roles": [
      "Admin",
      "Manager",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-ANN-001",
      "REQ-ANN-004"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SUPP-001",
    "title": "Suppliers and interventions are linked to condominiums",
    "type": "Functional",
    "module": "Suppliers",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Supplier records and scheduled interventions are associated with a condominium so maintenance planning remains tenant-scoped.",
    "acceptanceCriteria": [
      "Given an authorized user, when a supplier is created or updated, then it is linked to a condominium.",
      "Given an intervention schedule, when it is stored, then the intervention references the supplier and condominium.",
      "Given a user outside the condominium, when they request supplier or intervention data, then the system hides or rejects it."
    ],
    "roles": [
      "Manager",
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-MAINT-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-RES-001",
    "title": "Shared-space reservations prevent conflicting bookings",
    "type": "Functional",
    "module": "Reservations",
    "priority": "High",
    "status": "Implemented",
    "description": "Reservation creation and updates reject overlapping bookings for the same shared space and condominium time window.",
    "acceptanceCriteria": [
      "Given a shared space and time slot, when a conflicting reservation is created, then the system rejects it.",
      "Given a valid time slot, when a reservation is created, then it is saved under the caller's condominium.",
      "Given a user outside the condominium, when they request the reservation, then the system denies access."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-SPACES-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-SPACES-001",
    "title": "Shared spaces are configured per condominium",
    "type": "Functional",
    "module": "SharedSpaces",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Each condominium can define and manage its own shared spaces so reservation availability and rules remain tenant-scoped.",
    "acceptanceCriteria": [
      "Given an authorized condominium user, when a shared space is created, then it is associated with that condominium.",
      "Given a user from another condominium, when shared spaces are queried, then the records are not exposed.",
      "Given a shared space update, when it is saved, then the new data remains isolated to the same condominium."
    ],
    "roles": [
      "Manager",
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-RES-001",
      "REQ-AUTH-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-ASM-001",
    "title": "Assemblies capture attendance and decisions",
    "type": "Functional",
    "module": "Assemblies",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Assembly records support attendance tracking, decision recording, and condominium-scoped visibility.",
    "acceptanceCriteria": [
      "Given an authorized user, when an assembly is created or updated, then it remains associated with the condominium.",
      "Given an attendance entry, when it is stored, then the participant and status are preserved.",
      "Given a decision record, when it is added, then it is tied to the assembly and available only within scope."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-NOTIF-001",
    "title": "Notifications are targeted by role and condominium scope",
    "type": "Functional",
    "module": "Notifications",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Notifications are delivered only to the intended role or user scope and must not leak condominium notifications to Manager accounts unless explicitly targeted.",
    "acceptanceCriteria": [
      "Given a notification targeted at a condominium, when a user outside the condominium requests it, then it is not returned.",
      "Given a Manager, when the notification feed is loaded, then only manager-targeted notifications appear unless a message is explicitly addressed to that manager.",
      "Given a Resident or Admin, when a condo notification is created, then it is visible only to users in the same condominium scope."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-I18N-001",
    "title": "Multilanguage is a subscription-plan feature, with a single platform default language",
    "type": "Functional",
    "module": "Localization",
    "priority": "Medium",
    "status": "Implemented",
    "description": "The multilanguage capability is an opt-in feature configured per subscription plan: a Manager enables or disables it on each available plan. A condominium exposes language selection only when its associated (active) plan has the multilanguage feature enabled. The platform has a single default language (set by a Manager in the platform configuration) that applies whenever multilanguage is not available.",
    "acceptanceCriteria": [
      "Given a Manager in the plan management, when they enable the multilanguage feature on a plan, then condominiums subscribed to that plan expose language selection to their users.",
      "Given a Manager, when they disable the multilanguage feature on a plan, then condominiums on that plan fall back to the platform default language and the language selector is hidden.",
      "Given a Manager in the platform configuration, when they set the platform default language, then it applies platform-wide as the fallback language for every condominium.",
      "Given a non-Manager role, when the plan multilanguage toggle or the platform default-language endpoint is called, then the system rejects the request.",
      "Given the multilanguage feature enabled on one plan, when it is toggled, then condominiums on other plans are not affected."
    ],
    "roles": [
      "Manager"
    ],
    "relatedRequirements": [
      "REQ-CONDO-001",
      "REQ-I18N-002"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-I18N-002",
    "title": "The portal provides Portuguese and English resources and lets users pick their language",
    "type": "Functional",
    "module": "Localization",
    "priority": "Medium",
    "status": "Implemented",
    "description": "The portal externalizes user-facing text into per-language resource bundles, supporting Portuguese and English for now, and — when the multilanguage feature is enabled for the condominium — a user can choose their language, which persists across sessions; Portuguese is the default.",
    "acceptanceCriteria": [
      "Given the portal, when text is rendered, then it comes from a language resource bundle rather than hardcoded strings, with bundles available for Portuguese and English.",
      "Given a condominium with the multilanguage feature enabled, when a user selects English, then the interface renders English resources and the choice is persisted for future sessions.",
      "Given a missing translation key for the selected language, when the page renders, then the system falls back to the default language instead of showing an empty or broken label.",
      "Given a condominium with the multilanguage feature disabled, when a user opens the portal, then it renders in the default language (Portuguese) with no language selector."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-I18N-001",
      "REQ-USERS-002"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-CONDO-002",
    "title": "Admin configures expense categories in condominium settings",
    "type": "Functional",
    "module": "Condominium",
    "priority": "High",
    "status": "Draft",
    "description": "An Admin of a condominium can create, update, deactivate, and list expense categories scoped to that condominium through the condominium settings page.",
    "acceptanceCriteria": [
      "Given an Admin of condominium A, when they create an expense category with a unique name within A, then the category is persisted and visible only inside condominium A.",
      "Given an Admin, when they update the name or active state of an existing category, then the change is reflected for future financial and maintenance records.",
      "Given an Admin, when they deactivate a category, then it no longer appears in new selection lists while historical records continue to reference it.",
      "Given a non-Admin user or an Admin of condominium B, when they attempt to create, update, or delete categories in condominium A, then the system rejects the request with a 403 or 404 response.",
      "Given a category already referenced by financial or maintenance records, when hard delete is attempted, then the system prevents data loss by allowing only deactivation (soft delete).",
      "Given the condominium settings page, when an Admin navigates to the categories tab, then they see the list of categories for the active condominium and controls to add or edit them."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-CONDO-001",
      "REQ-FIN-001",
      "REQ-MAINT-001",
      "REQ-CONDO-003",
      "REQ-FIN-002",
      "REQ-MAINT-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/expense-categories.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-CONDO-003",
    "title": "Admin catalogs expense categories with hashtags",
    "type": "Functional",
    "module": "Condominium",
    "priority": "Medium",
    "status": "Draft",
    "description": "Each condominium expense category can be associated with one or more hashtags so that Admins can quickly identify and group categories when creating expenses or completing maintenance work.",
    "acceptanceCriteria": [
      "Given an Admin creating or editing an expense category, when they provide hashtags, then the system stores them as normalized lowercase labels without spaces or special characters (e.g., `#manutencao`, `#condominio`).",
      "Given an input containing duplicate hashtags, when the category is saved, then duplicates are removed automatically.",
      "Given an input containing hashtags with invalid characters or excessive length, when the category is saved, then the system rejects the input with a clear validation message.",
      "Given a category with hashtags, when the category is displayed in selection components, then the hashtags are shown alongside the category name.",
      "Given a category rendered in the settings list, when hashtags exist, then they appear as distinct badges or labels."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-CONDO-002",
      "REQ-FIN-002",
      "REQ-MAINT-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/expense-categories.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-FIN-002",
    "title": "Expense category field is autocomplete and shows associated hashtags",
    "type": "Functional",
    "module": "Financial",
    "priority": "High",
    "status": "Draft",
    "description": "When an Admin creates or edits an expense financial record, the category field is an autocomplete populated with the active expense categories configured for the current condominium, and each option displays the category's associated hashtags.",
    "acceptanceCriteria": [
      "Given an Admin creating an expense in condominium A, when they focus the category field, then the autocomplete lists only active expense categories configured for condominium A.",
      "Given the autocomplete dropdown, when categories have hashtags, then each option shows the category name followed by its hashtags.",
      "Given a user typing in the category field, when the typed text matches a category name or any of its hashtags, then the list filters to show matching categories.",
      "Given no category selected, when the user submits an expense record, then the system rejects the submission with a validation error indicating the category is required.",
      "Given a category belonging to condominium B, when the user attempts to select it, then it is not available in the autocomplete and cannot be submitted.",
      "Given an expense record saved with a category, when the record is later viewed or edited, then the selected category and its hashtags are displayed correctly."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-FIN-001",
      "REQ-CONDO-002",
      "REQ-CONDO-003"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/expense-categories.mmd",
      "diagrams/sequences/financial-expense-category-selection.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-FIN-003",
    "title": "Admin views an annual Revenue and Expenses report from the Financial page, with PDF export",
    "type": "Functional",
    "module": "Financial",
    "priority": "High",
    "status": "Implemented",
    "description": "An Admin can open, from the Financial page, an annual Revenue + Expenses report for the currently selected fiscal year of their condominium. The report is displayed in a modal popup and can be exported to PDF.",
    "acceptanceCriteria": [
      "Given an Admin on the Financial page with a fiscal year selected, when they choose the \"Annual report\" option, then a modal popup opens showing the Revenue + Expenses report for that year and condominium.",
      "Given the report modal, when it renders, then it shows total income, total expenses, and the resulting balance for the selected year, with a monthly breakdown (income, expenses, balance per month) and an expense breakdown by category.",
      "Given the report modal, when the Admin clicks \"Export PDF\", then a PDF file containing the same report data (year, totals, breakdowns) is downloaded.",
      "Given a year with no financial records, when the report is opened, then the modal shows zeroed totals and an explicit empty-state message instead of an error.",
      "Given a non-Admin user (Manager or Resident), when they attempt to access the report data endpoint directly, then the request is rejected with 403.",
      "Given an Admin of condominium A, when the report is generated, then only records belonging to condominium A are included; no cross-tenant data leaks into totals or breakdowns.",
      "Given the PDF export, when the generated file is opened, then its content matches the data displayed in the modal for the same year."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-FIN-001",
      "REQ-FIN-002",
      "REQ-CONDO-002",
      "REQ-CONDO-003"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/financial-annual-report.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-MAINT-002",
    "title": "Maintenance completion requires an expense category selection",
    "type": "Functional",
    "module": "Maintenance",
    "priority": "High",
    "status": "Draft",
    "description": "When an Admin transitions a maintenance request to the Completed status and indicates that the work generated an expense, the system requires selection of an expense category from the condominium's configured categories.",
    "acceptanceCriteria": [
      "Given an Admin marking a maintenance request as Completed with HasExpense set to true, when they do not select an expense category, then the status transition is rejected with a validation error.",
      "Given an Admin completing a maintenance request, when they select an expense category and enter an expense amount, then both the category identifier and amount are persisted on the maintenance request.",
      "Given the completion form, when the category selector is shown, then it lists only active categories for the current condominium and displays each category's hashtags.",
      "Given a maintenance request completed with a category, when the system generates or updates the associated financial expense record, then the same expense category is used on the financial record.",
      "Given a maintenance request completed without expense (HasExpense = false), when the Admin finalizes it, then no expense category is required and no financial record is created.",
      "Given a non-Admin user, when they attempt to complete a maintenance request, then the request is rejected regardless of category selection."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-MAINT-001",
      "REQ-CONDO-002",
      "REQ-CONDO-003",
      "REQ-FIN-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/expense-categories.mmd",
      "diagrams/sequences/maintenance-expense-category-selection.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-POLL-001",
    "title": "Administrator creates a poll with description, vote options, and mandatory expiration",
    "type": "Functional",
    "module": "Polls",
    "priority": "High",
    "status": "Draft",
    "description": "A condominium administrator creates a poll vote linked to an announcement of the same condominium. A poll must have a description, at least two distinct vote options, and a mandatory expiration date/time. All residents of the condominium are invited to vote through the linked announcement.",
    "acceptanceCriteria": [
      "Given an authenticated Admin of a condominium, when they create a poll with a description, at least two distinct vote options, and a future expiration date/time, linked to an existing announcement of the same condominium, then the poll is created and associated with that announcement and condominium.",
      "Given a poll creation request without an expiration date/time, when submitted, then the API rejects it with HTTP 400 and a clear error message.",
      "Given a poll creation request with an expiration date/time in the past, when submitted, then the API rejects it with HTTP 400 (consistent with REQ-ANN-002 expiration semantics).",
      "Given a poll creation request with fewer than two distinct vote options, when submitted, then the API rejects it with HTTP 400.",
      "Given an authenticated user who is not an Admin of the target condominium, when attempting to create a poll, then the API refuses the operation and no poll is created.",
      "Given an announcement that belongs to a different condominium, when an Admin tries to link a poll to it, then the operation is refused (multi-condominium isolation).",
      "Given a successfully created poll, when residents of the condominium view the linked announcement, then the poll is offered to every resident of that condominium for voting.",
      "## Quality Criteria",
      "Unit tests cover description, option-count, and expiration validation.",
      "Integration tests cover creation authorization and cross-condominium linkage refusal.",
      "Error messages are clear and localized (pt-PT/en)."
    ],
    "roles": [
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-ANN-001",
      "REQ-ANN-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/poll-vote-er.mmd",
      "diagrams/sequences/poll-create-vote-flow.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-POLL-002",
    "title": "Residents vote once on active polls of their condominium",
    "type": "Functional",
    "module": "Polls",
    "priority": "High",
    "status": "Draft",
    "description": "Residents of a condominium can cast one vote on an active poll (published and not yet expired) of their own condominium. Each vote is recorded per user; only one vote per resident per poll is allowed.",
    "acceptanceCriteria": [
      "Given a published, non-expired poll in the resident's condominium, when the resident submits a vote selecting one of the poll options, then the vote is recorded with the resident identity, poll, selected option, and timestamp.",
      "Given a resident who already voted in a poll, when they attempt to vote again in the same poll, then the API rejects the second vote (HTTP 409) and the original vote remains unchanged.",
      "Given an expired or unpublished poll, when a resident attempts to vote, then the API rejects the vote.",
      "Given a user with no residency in the poll's condominium, when they attempt to vote, then the API refuses and no vote is recorded (multi-condominium isolation).",
      "Given a vote submission referencing a nonexistent option or an option of another poll, when submitted, then the API rejects it with HTTP 400.",
      "## Quality Criteria",
      "Tests cover one-vote-per-resident, including concurrent duplicate submissions producing exactly one stored vote.",
      "Isolation tests prove cross-condominium vote attempts fail.",
      "Vote records remain attributable per user (per-user vote rows persisted)."
    ],
    "roles": [
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-POLL-001",
      "REQ-ANN-001",
      "REQ-AUTH-001"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/sequences/poll-create-vote-flow.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-POLL-003",
    "title": "Poll results show per-option counts and expired polls become read-only",
    "type": "Functional",
    "module": "Polls",
    "priority": "Medium",
    "status": "Draft",
    "description": "Poll results are visible as aggregated counts per vote option after a resident has voted, and final results remain visible after the poll expires. Expired polls become read-only: no further votes or modifications are accepted.",
    "acceptanceCriteria": [
      "Given a resident who has voted in an active poll, when they view the poll, then they see the aggregated vote count per option.",
      "Given a poll that has expired, when an authorized user of the condominium views it, then final per-option totals are shown and the poll accepts no new votes or edits (read-only).",
      "Given results data for any poll, when returned to regular users, then it exposes aggregate counts per option only, never individual voter choices.",
      "Given a poll in another condominium, when a user requests its results, then the API refuses or hides them (multi-condominium isolation).",
      "## Quality Criteria",
      "Reported per-option totals equal the sum of recorded votes (integrity check in tests).",
      "Read-only enforcement is tested after expiration (vote/edit attempts rejected)."
    ],
    "roles": [
      "Resident",
      "Admin"
    ],
    "relatedRequirements": [
      "REQ-POLL-001",
      "REQ-POLL-002"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/poll-vote-er.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-POLL-004",
    "title": "Server-side role enforcement, double-voting prevention, and vote auditability",
    "type": "Non-Functional",
    "module": "Polls",
    "priority": "Medium",
    "status": "Draft",
    "description": "All poll operations must be enforced server-side: only condominium administrators create polls, only residents of the owning condominium vote, double-voting is impossible even under concurrent requests, and votes are auditable.",
    "acceptanceCriteria": [
      "Given any poll endpoint, when invoked, then role and condominium-membership checks happen server-side; client-side checks are convenience only and bypassing them has no effect.",
      "Given concurrent duplicate vote submissions from the same resident for the same poll, when processed, then exactly one vote is stored (atomic uniqueness at the persistence layer).",
      "Given a stored vote, when inspected for audit purposes, then it persists voter identity, poll identifier, option identifier, and timestamp, and these audit fields are immutable.",
      "Given adversarial requests with forged identifiers or cross-condominium references, when sent to create/vote/results endpoints, then multi-condominium isolation still holds.",
      "## Quality Criteria",
      "Integration test issuing parallel duplicate votes yields a single record.",
      "Authorization-matrix tests: Admin creates; Resident votes; other roles/outsiders refused.",
      "Audit fields present and non-null on every persisted vote."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-POLL-001",
      "REQ-POLL-002",
      "REQ-POLL-003"
    ],
    "designRefs": [],
    "diagramRefs": [
      "diagrams/data/poll-vote-er.mmd",
      "diagrams/sequences/poll-create-vote-flow.mmd"
    ],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  },
  {
    "id": "REQ-POLL-005",
    "title": "Poll voting is a subscription-plan feature managed per pack",
    "type": "Functional",
    "module": "Polls",
    "priority": "High",
    "status": "Draft",
    "description": "Poll voting (\"Votações\") is a platform feature gated by its own feature key (`polls`) through the existing subscription/plan-feature system. Platform Managers can enable or disable the feature per subscription plan/pack (e.g., enabled in the Gold pack, disabled in the Free pack). Condominium access to poll endpoints follows the standard feature entitlement resolution (active condominium subscription → plan features → active Free plan).",
    "acceptanceCriteria": [
      "Given a condominium whose active subscription plan has the `polls` feature disabled, when any non-Manager user calls any `/polls` endpoint for that condominium, then the API responds with HTTP 403 and a message indicating the feature is not available for the current subscription.",
      "Given a condominium whose active subscription plan has the `polls` feature enabled, when an authorized user calls a `/polls` endpoint for that condominium, then the request proceeds normally.",
      "Given a platform Manager, when they edit a subscription plan's features, then `polls` appears in the manageable feature catalog and can be enabled or disabled independently of other features.",
      "Given a new installation with seeded plans, when plans are inspected, then the `polls` feature is enabled for the Gold plan and disabled for the Free plan (Silver disabled by default).",
      "Given a user with the Manager role, when calling `/polls` endpoints, then the feature gate does not block them (Managers manage subscriptions and are not subject to per-condominium gating).",
      "The `polls` feature must not be part of the hardcoded free fallback set used when no plan features exist.",
      "## Quality Criteria",
      "Integration tests cover the feature-disabled 403 path and the feature-enabled success path.",
      "Seed data changes are covered by an EF migration and verifiable after `database update`."
    ],
    "roles": [
      "Manager",
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-POLL-001",
      "REQ-POLL-002"
    ],
    "designRefs": [],
    "diagramRefs": [],
    "implementationRefs": [],
    "testRefs": [],
    "diagram": ""
  }
];
