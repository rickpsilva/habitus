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
    "title": "Announcements support an approval workflow and condominium-scoped visibility",
    "type": "Functional",
    "module": "Announcements",
    "priority": "Medium",
    "status": "Implemented",
    "description": "Announcements (\"Comunicados\") let Admins and Residents publish condominium-scoped notices with a category, rich-text content, optional attachments, and comments. A resident-authored announcement follows an approval workflow (Draft, PendingApproval, Published, Rejected, Archived), read status is tracked per user, and the whole module is gated by the `announcements` subscription-plan feature.",
    "acceptanceCriteria": [
      "Given an authorized user in a condominium, when an announcement is created, then it is persisted under that condominium with its category, content, and author.",
      "Given a Resident who submits an announcement, when it awaits approval, then it stays in PendingApproval until an Admin approves or rejects it, and Admins are notified.",
      "Given an Admin, when a pending announcement is approved, then it becomes Published and is visible to residents of the condominium; when it is rejected, then the rejection reason is preserved.",
      "Given a published announcement, when a user opens it, then their read status is recorded for that announcement.",
      "Given a user outside the condominium scope, when they request an announcement, then the system denies access or hides the record.",
      "Given a condominium whose active plan does not include the `announcements` feature, when the module endpoints are called, then the system rejects the request."
    ],
    "roles": [
      "Admin",
      "Resident"
    ],
    "relatedRequirements": [
      "REQ-AUTH-001",
      "REQ-CONDO-001",
      "REQ-NOTIF-001"
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
  }
];
