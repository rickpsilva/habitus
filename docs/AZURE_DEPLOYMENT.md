# Azure Deployment

This repository includes a Bash deployment script at [scripts/deploy-azure.sh](/home/rick/workspace/habitus/scripts/deploy-azure.sh) that provisions and publishes the Habitus stack on Azure using Azure CLI.

It also includes:

- [scripts/deploy-azure-bicep.sh](/home/rick/workspace/habitus/scripts/deploy-azure-bicep.sh) for Azure-native infrastructure deployment with Bicep
- [infra/azure/main.bicep](/home/rick/workspace/habitus/infra/azure/main.bicep) as the declarative infrastructure template

## What the script creates

- Resource Group
- Azure App Service Plan (Linux)
- Azure Web App for the .NET 8 API
- Azure Database for PostgreSQL Flexible Server
- Azure Storage Account
- Static website hosting in the `$web` container
- Blob container for documents and images
- Azure Key Vault for secrets
- Managed identity on the API Web App with Key Vault access
- Optional bootstrap of the first platform Manager account on application startup

## Cost profile

The current defaults are intentionally conservative for a small first production deployment:

- App Service Plan: `B1`
- PostgreSQL Flexible Server: `Standard_B1ms` Burstable with 32 GB storage
- Frontend: Azure Storage static website
- Documents/images: private blob container in the same Storage Account

This keeps the platform lean while still supporting HTTPS, Blob Storage, Key Vault, and repeatable deployments.

## Prerequisites

- Azure CLI authenticated with `az login`
- .NET 8 SDK
- Node.js and npm
- `zip`
- A subscription with permission to create resource groups, App Service, Storage, Key Vault, and PostgreSQL

For your subscription, the expected login flow is:

```bash
az login -u ricardopsilva@hotmail.com
az account set --subscription "HabitusCond"
```

## Basic usage

```bash
chmod +x ./scripts/deploy-azure.sh

./scripts/deploy-azure.sh \
  --prefix habitus \
  --environment prod \
  --location westeurope \
  --subscription "HabitusCond" \
  --postgres-admin habitusadmin \
  --run-migrations
```

## Important options

- `--subscription`: selects the Azure subscription before provisioning.
- `--resource-group`: overrides the generated resource group name.
- `--api-app-name`: overrides the generated global Web App name.
- `--storage-account`: overrides the generated global storage account name.
- `--key-vault-name`: overrides the generated global Key Vault name.
- `--postgres-server`: overrides the generated PostgreSQL server name.
- `--enable-front-door`: creates Azure Front Door for the frontend.
- `--domain-root`: sets your main domain and auto-generates `app.<domain>` as frontend domain.
- `--frontend-domain`: adds a custom frontend domain to Front Door and requests a managed TLS certificate.
- `--skip-deploy`: provisions infrastructure without publishing code.
- `--skip-api`: provisions infrastructure and publishes only the frontend.
- `--skip-frontend`: provisions infrastructure and publishes only the API.
- `--run-migrations`: runs `dotnet ef database update` against Azure PostgreSQL.

Example with Front Door and a custom frontend domain (`www`):

```bash
./scripts/deploy-azure.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod \
  --enable-front-door \
  --frontend-domain www.habituscond.pt \
  --run-migrations
```

Shortcut version with domain root:

```bash
./scripts/deploy-azure.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod \
  --enable-front-door \
  --domain-root habituscond.pt \
  --run-migrations
```

## Bicep workflow

If you want the infrastructure described declaratively instead of created imperatively command by command, use:

```bash
./scripts/deploy-azure-bicep.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod
```

This deploys [infra/azure/main.bicep](/home/rick/workspace/habitus/infra/azure/main.bicep) and prints the exact follow-up command to publish the application with [scripts/deploy-azure.sh](/home/rick/workspace/habitus/scripts/deploy-azure.sh).

## Bicep vs Terraform

- Bicep is Azure-native infrastructure as code. It compiles to ARM and is the best fit when you are deploying only to Azure.
- Terraform is multi-cloud infrastructure as code. It is useful when you want the same provisioning approach across Azure, AWS, GCP, Cloudflare, and other providers.
- For this project, Bicep is the simpler and more natural choice because your target stack is fully Azure.

## Secrets handled by Key Vault

The script stores the following required secrets in Key Vault and injects them into the API via Key Vault references:

- `ConnectionStrings--DefaultConnection`
- `JwtSettings--SecretKey`
- `EncryptionKey`
- `AzureStorage--ConnectionString`

If you export optional environment variables before running the script, it also stores and wires them automatically:

- `AZURE_COMMUNICATION_CONNECTION_STRING`
- `AZURE_TRANSLATION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLIC_KEY`
- `INITIAL_MANAGER_NAME`
- `INITIAL_MANAGER_EMAIL`
- `INITIAL_MANAGER_PASSWORD`
- `INITIAL_MANAGER_PHONE`

Example:

```bash
export STRIPE_SECRET_KEY='...'
export STRIPE_WEBHOOK_SECRET='...'
export GOOGLE_CLIENT_ID='...'
export GOOGLE_CLIENT_SECRET='...'
export INITIAL_MANAGER_NAME='Ricardo Silva'
export INITIAL_MANAGER_EMAIL='ricardopsilva@hotmail.com'
export INITIAL_MANAGER_PASSWORD='trocar-por-uma-password-forte'

./scripts/deploy-azure.sh --prefix habitus --environment prod
```

## Initial HOI / Manager bootstrap

On startup, the API now checks whether any `Manager` user already exists.

- If at least one `Manager` exists, nothing is created.
- If no `Manager` exists and `INITIAL_MANAGER_NAME`, `INITIAL_MANAGER_EMAIL`, and `INITIAL_MANAGER_PASSWORD` were configured during deploy, the API creates the first platform manager automatically.
- This is idempotent, so you can redeploy the platform multiple times without creating duplicate manager accounts.

This is the safest path for your first production login because it avoids exposing public manager self-registration.

## Repeatable deployments

The deploy script is designed for ongoing platform updates:

- Resource creation is idempotent where possible.
- Application publish can be rerun without rebuilding the whole environment from scratch.
- The initial manager bootstrap only acts on the first deploy where no manager exists yet.
- Static frontend hosting and API deployment are updated in place.

Yes: for a new release, run the same script again.

- If you keep the same `--prefix` and `--environment`, it targets the same Azure resources.
- The script now reuses existing secrets from Key Vault by default (instead of rotating them each run).
- If an existing PostgreSQL server is found and the admin password is not in Key Vault, the script stops with a clear error so you can provide `POSTGRES_PASSWORD` explicitly.

Release deploy command (same infrastructure, new app version):

```bash
./scripts/deploy-azure.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod \
  --enable-front-door \
  --domain-root habituscond.pt
```

## Frontend deployment model

The frontend is built with `VITE_API_BASE_URL=https://<api-app>.azurewebsites.net/api` and then uploaded to the Storage Account static website. This avoids same-origin proxy assumptions and works cleanly with a separately hosted API.

If you pass `--enable-front-door`, the static website is placed behind Azure Front Door. That gives you:

- HTTPS on the Front Door default domain
- A clean path to custom domains
- Managed TLS certificates for the frontend custom domain
- Better performance and caching options later

## HTTPS and certificates

- The API already runs on `https://<app-name>.azurewebsites.net` with Azure-managed HTTPS.
- The frontend static website endpoint already uses HTTPS on the default Azure domain.
- If you want your own domain on the frontend with a certificate, Front Door is the right layer. The script now supports that with `--enable-front-door` and `--frontend-domain`.
- If you want your own domain on the API, bind the custom domain in App Service and then create an App Service Managed Certificate.

Notes for custom domains:

- Front Door custom domains require DNS validation and a CNAME to the Front Door endpoint.
- App Service custom domains require DNS verification before the managed certificate can be issued.
- Certificate issuance is not instant; Azure may keep the domain in a pending state until DNS is correct and propagated.

## Your domain: habituscond.pt (amen.pt)

Recommended setup:

- Frontend: `www.habituscond.pt` (via Front Door + managed certificate)
- API: keep `https://<api-app>.azurewebsites.net` initially for lower complexity/cost

Deploy command:

```bash
export INITIAL_MANAGER_NAME='Ricardo Silva'
export INITIAL_MANAGER_EMAIL='ricardopsilva@hotmail.com'
export INITIAL_MANAGER_PASSWORD='trocar-por-password-forte'

./scripts/deploy-azure.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod \
  --enable-front-door \
  --frontend-domain www.habituscond.pt \
  --run-migrations
```

## Comando final (recomendado)

```bash
az login -u ricardopsilva@hotmail.com
az account set --subscription "HabitusCond"

export INITIAL_MANAGER_NAME="Ricardo Silva"
export INITIAL_MANAGER_EMAIL="ricardopsilva@hotmail.com"
export INITIAL_MANAGER_PASSWORD="troca-por-password-forte"
export INITIAL_MANAGER_PHONE="+351910000000"

./scripts/deploy-azure.sh \
  --subscription "HabitusCond" \
  --prefix habitus \
  --environment prod \
  --enable-front-door \
  --frontend-domain www.habituscond.pt \
  --run-migrations
```

DNS on amen.pt (after the script prints the Front Door hostname):

- Create `CNAME` for `www.habituscond.pt` pointing to `<frontdoor-endpoint>.z01.azurefd.net`.
- If Front Door shows a DNS validation token for managed TLS, create a `TXT` record at `_dnsauth.www.habituscond.pt` with that token value.
- Do not proxy or mask the record; keep it as standard DNS.
- Wait for propagation, then Azure Front Door will complete domain validation and certificate issuance.

## Current production domain policy

- Public frontend domain: `https://www.habituscond.pt`
- `app.habituscond.pt` is no longer used and should not be reattached to Front Door routes.
- Use `--frontend-domain www.habituscond.pt` in release deploys to keep the configuration aligned.

Quick checks:

```bash
az afd custom-domain show \
  --resource-group rg-habitus-prod \
  --profile-name afd-habitus-prod \
  --custom-domain-name frontend-www-domain \
  --query "{validation:domainValidationState,deployment:deploymentStatus,host:hostName}" -o table

curl -I https://www.habituscond.pt
```

## Notes

- The API CORS configuration is updated automatically with the static website URL.
- When Front Door is enabled, the API CORS configuration is updated with the Front Door URL or your custom frontend domain.
- `Frontend__BaseUrl` is set to the static website endpoint, which keeps reset-password and payment redirect links aligned with production.
- When Front Door is enabled, `Frontend__BaseUrl` is set to the Front Door hostname or your custom frontend domain.
- Public self-registration of `Manager` accounts is disabled. The first `Manager` should be created through the deploy bootstrap configuration.
- If you enable `--run-migrations`, the script tries to detect your public IP and temporarily allows it on PostgreSQL to run `dotnet ef database update` from your machine.
- Optional Azure Communication Services and Azure Translator settings remain disabled if you do not provide their environment variables. In that case the application falls back to its existing mock services.
- Blob document storage uses the same Storage Account as the frontend static site, but a separate private blob container.