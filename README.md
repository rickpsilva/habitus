# Habitus — Condominium Management Platform

Habitus is a modern condominium management platform built with **.NET 8** and a clean, modular architecture. It covers all administrative, financial, and operational needs of residential buildings.

## Features

- **Multi-Condominium Support** — platform now supports multiple condominiums with proper access control
- **User Management** — separate User entity for authentication (Managers, Admins, Residents)
- **Resident Self-Registration** — public resident signup flow per condominium/unit with pending approval
- **Resident & Unit Management** — manage buildings, units, and resident profiles
- **User Roles & Permissions**:
  - **Manager (HOI)** — Platform-level access; can create condominiums, manage users and units across all condominiums
  - **Admin** — Condominium-level access; can create users and manage units for their assigned condominium
  - **Resident** — Unit-level access; standard resident permissions
- **Document Storage** — insurance policies, receipts, meeting minutes (Azure Blob Storage)
- **Maintenance Requests** — photo attachments, location details, multi‑resident confirmation workflow
- **Interventions & Suppliers** — scheduled interventions linked to supplier contacts
- **Financial Tracking** — income/expense records, receipts, and summary reports
- **Platform Billing & Subscriptions** — Free/Silver/Gold plans, assignments, stats, and invoicing workflows
- **Invoice Operations** — PDF access, manual mark-paid/cancel, due generation, and SAF-T export
- **Payment Gateway Ready** — Stripe integration endpoints (with webhook processing)
- **Digital Assemblies** — attendance tracking and decision recording
- **Shared‑Space Reservations** — booking with conflict detection
- **Notifications & Alerts** — role‑targeted messages (Azure Communication Services)
- **Useful Contacts** — emergency, service, and administrative contacts
- **Feature Gating by Plan** — plan-aware endpoint access for selected modules
- **Security Hardening** — IP rate limiting + encryption service for sensitive fields
- **Optional Translation** — Azure AI Translator for multilingual residents

## Recent Updates (Apr 2026)

- Introduced public resident self-registration with admin/resident approval workflow.
- Added platform subscriptions and billing capabilities (plans, assignments, and stats).
- Added invoice lifecycle features, SAF-T export support, and payment gateway integration.

## Architecture

```
src/
├── Habitus.Domain/         # Domain entities and enums (User, Condominium, Unit, etc.)
├── Habitus.Application/    # Services, DTOs, and interfaces
├── Habitus.Infrastructure/ # EF Core (PostgreSQL), Azure services, repositories
└── Habitus.Api/            # ASP.NET Core Web API, JWT auth, Swagger

tests/
└── Habitus.Tests/          # xUnit unit tests
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | .NET 8 |
| API | ASP.NET Core Web API |
| ORM | EF Core + Npgsql (PostgreSQL) |
| Auth | JWT Bearer, BCrypt password hashing |
| Storage | Azure Blob Storage |
| Email | Azure Communication Services |
| Translation | Azure AI Translator |
| Secrets | Azure Key Vault |
| Containers | Docker + Docker Compose |

## Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Docker](https://www.docker.com/) + Docker Compose

### Run with Docker Compose

```bash
docker compose up --build
```

The API will be available at `http://localhost:8080`.  
Swagger UI is at `http://localhost:8080/swagger`.

### Run locally

```bash
# Start PostgreSQL
docker compose up postgres -d

# Run database migrations
cd src/Habitus.Api
dotnet ef database update

# Start the API
dotnet run
```

### Configuration

Copy `src/Habitus.Api/appsettings.json` and set the following via environment variables or Azure Key Vault in production:

| Key | Description |
|-----|-------------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `JwtSettings__SecretKey` | JWT signing secret (use a strong random key in production) |
| `AzureStorage__ConnectionString` | Azure Blob Storage connection string |
| `AzureCommunication__ConnectionString` | Azure Communication Services connection string |
| `AzureTranslation__Key` | Azure Translator API key |
| `EncryptionKey` | 32-byte key used for sensitive data encryption/decryption |
| `Stripe__SecretKey` | Stripe secret key |
| `Stripe__WebhookSecret` | Stripe webhook signing secret |
| `Stripe__PublicKey` | Stripe public key for frontend usage |

## API Endpoints

| Controller | Base Path |
|-----------|-----------|
| Auth | `/api/auth` |
| Users | `/api/users` |
| Condominiums | `/api/condominiums` |
| Residents | `/api/residents` |
| Units | `/api/units` |
| Documents | `/api/documents` |
| Maintenance | `/api/maintenance` |
| Suppliers | `/api/suppliers` |
| Financial | `/api/financial` |
| Assemblies | `/api/assemblies` |
| Reservations | `/api/reservations` |
| Shared Spaces | `/api/shared-spaces` |
| Notifications | `/api/notifications` |
| Useful Contacts | `/api/useful-contacts` |
| User Registration | `/api/user` |
| Subscriptions | `/api/subscriptions` |
| Invoices | `/api/invoices` |

Full interactive documentation is available via Swagger at `/swagger`.

## Roles

| Role | Access |
|------|--------|
| `Manager` | Platform-level access: manage multiple condominiums, create/edit users and units across all condominiums |
| `Admin` | Condominium-level access: create users, create/edit/delete units for their assigned condominium only |
| `Resident` | Unit-level access: read/create access to most endpoints within their condominium; no admin-only operations |

**Notes:**  
- Managers and Admins are NOT required to have a unit assignment
- Admins are assigned to a single condominium
- Managers can access and manage multiple condominiums

## Running Tests

```bash
dotnet test src/Habitus.slnx
```

## Deployment

The application is ready to deploy to **Azure App Service** or **Azure Container Apps**.  
Use Azure Key Vault and managed identities to secure secrets in production.
