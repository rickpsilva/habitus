#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PROJECT="$ROOT_DIR/src/Habitus.Api/Habitus.Api.csproj"
WEB_DIR="$ROOT_DIR/src/habitus-web"
API_RUNTIME_STACK=""

PREFIX="habitus"
ENVIRONMENT_NAME="prod"
LOCATION="westeurope"
POSTGRES_ADMIN="habitusadmin"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_DB="habitus"
DOCS_CONTAINER="habitus-docs"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-HabitusCond}"
RUN_MIGRATIONS="false"
SKIP_DEPLOY="false"
SKIP_FRONTEND="false"
SKIP_API="false"
FRONTEND_ON_API="false"
ENABLE_FRONT_DOOR="false"
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-}"
DOMAIN_ROOT="${DOMAIN_ROOT:-}"

RESOURCE_GROUP=""
APP_SERVICE_PLAN=""
API_APP_NAME=""
STORAGE_ACCOUNT=""
KEY_VAULT_NAME=""
POSTGRES_SERVER=""
FRONTDOOR_PROFILE=""
FRONTDOOR_ENDPOINT=""
FRONTDOOR_ORIGIN_GROUP=""
FRONTDOOR_ORIGIN=""
FRONTDOOR_ROUTE=""
FRONTDOOR_CUSTOM_DOMAIN=""

APP_SERVICE_SKU="B1"
POSTGRES_SKU="Standard_B1ms"
POSTGRES_TIER="Burstable"
POSTGRES_STORAGE_GB="32"

EXTRA_ALLOWED_ORIGINS="${EXTRA_ALLOWED_ORIGINS:-}"
JWT_SECRET="${JWT_SECRET:-}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
AZURE_COMMUNICATION_CONNECTION_STRING="${AZURE_COMMUNICATION_CONNECTION_STRING:-}"
AZURE_COMMUNICATION_SENDER_EMAIL="${AZURE_COMMUNICATION_SENDER_EMAIL:-noreply@habitus.com}"
AZURE_TRANSLATION_ENDPOINT="${AZURE_TRANSLATION_ENDPOINT:-}"
AZURE_TRANSLATION_KEY="${AZURE_TRANSLATION_KEY:-}"
AZURE_TRANSLATION_REGION="${AZURE_TRANSLATION_REGION:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
MICROSOFT_CLIENT_ID="${MICROSOFT_CLIENT_ID:-}"
MICROSOFT_CLIENT_SECRET="${MICROSOFT_CLIENT_SECRET:-}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
STRIPE_PUBLIC_KEY="${STRIPE_PUBLIC_KEY:-}"
INITIAL_MANAGER_NAME="${INITIAL_MANAGER_NAME:-}"
INITIAL_MANAGER_EMAIL="${INITIAL_MANAGER_EMAIL:-}"
INITIAL_MANAGER_PASSWORD="${INITIAL_MANAGER_PASSWORD:-}"
INITIAL_MANAGER_PHONE="${INITIAL_MANAGER_PHONE:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    printf "%b%s%b\n" "$BLUE" "$1" "$NC"
}

warn() {
    printf "%b%s%b\n" "$YELLOW" "$1" "$NC"
}

success() {
    printf "%b%s%b\n" "$GREEN" "$1" "$NC"
}

fail() {
    printf "%b%s%b\n" "$RED" "$1" "$NC" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage:
  ./scripts/deploy-azure.sh [options]

Options:
  --prefix VALUE                Base name for Azure resources (default: habitus)
  --environment VALUE           Environment suffix (default: prod)
  --location VALUE              Azure region (default: westeurope)
    --subscription VALUE          Azure subscription id or name (default: HabitusCond)
  --resource-group VALUE        Resource group name override
  --app-service-plan VALUE      App Service plan name override
  --api-app-name VALUE          API Web App name override
  --storage-account VALUE       Storage account name override
  --key-vault-name VALUE        Key Vault name override
    --postgres-server VALUE       PostgreSQL flexible server name override
    --enable-front-door           Create Azure Front Door for the frontend
    --domain-root VALUE           Root domain used to auto-generate frontend domain (app.<domain>)
    --frontend-domain VALUE       Custom frontend domain to attach to Front Door with managed TLS
  --postgres-admin VALUE        PostgreSQL admin username (default: habitusadmin)
  --postgres-password VALUE     PostgreSQL admin password override
  --postgres-db VALUE           PostgreSQL database name (default: habitus)
  --docs-container VALUE        Blob container for files (default: habitus-docs)
  --run-migrations              Run dotnet ef database update against Azure PostgreSQL
  --skip-api                    Provision resources and deploy only the frontend
  --skip-frontend               Provision resources and deploy only the API
    --frontend-on-api             Build frontend and deploy it inside API Web App (single host/domain)
  --skip-deploy                 Provision resources but do not publish application artifacts
  --help                        Show this help

Environment variables for optional secrets:
  JWT_SECRET
  ENCRYPTION_KEY
  AZURE_COMMUNICATION_CONNECTION_STRING
  AZURE_COMMUNICATION_SENDER_EMAIL
  AZURE_TRANSLATION_ENDPOINT
  AZURE_TRANSLATION_KEY
  AZURE_TRANSLATION_REGION
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  MICROSOFT_CLIENT_ID
  MICROSOFT_CLIENT_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PUBLIC_KEY
    INITIAL_MANAGER_NAME
    INITIAL_MANAGER_EMAIL
    INITIAL_MANAGER_PASSWORD
    INITIAL_MANAGER_PHONE
    DOMAIN_ROOT
  EXTRA_ALLOWED_ORIGINS         Comma-separated additional frontend origins
EOF
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

normalize_dash() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

normalize_compact() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9'
}

detect_api_runtime_stack() {
    local tfm
    local runtime_version

    tfm="$(sed -nE 's#.*<TargetFramework>(net[0-9]+\.[0-9]+)</TargetFramework>.*#\1#p' "$API_PROJECT" | head -n1)"
    if [[ -z "$tfm" ]]; then
        tfm="$(sed -nE 's#.*<TargetFrameworks>([^<]+)</TargetFrameworks>.*#\1#p' "$API_PROJECT" | head -n1 | cut -d';' -f1)"
    fi

    if [[ -z "$tfm" ]]; then
        fail "Could not determine TargetFramework from $API_PROJECT"
    fi

    runtime_version="${tfm#net}"
    if [[ "$runtime_version" == "$tfm" ]]; then
        fail "Unsupported TargetFramework '$tfm' in $API_PROJECT"
    fi

    printf 'DOTNETCORE|%s' "$runtime_version"
}

trim_trailing_dash() {
    printf '%s' "$1" | sed 's/-*$//'
}

hash_suffix() {
    printf '%s' "$1" | sha1sum | cut -c1-6
}

secret_uri() {
    printf 'https://%s.vault.azure.net/secrets/%s' "$KEY_VAULT_NAME" "$1"
}

upsert_secret() {
    local secret_name="$1"
    local secret_value="$2"

    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$secret_name" \
        --value "$secret_value" \
        --output none >/dev/null
}

build_kv_ref() {
    printf '@Microsoft.KeyVault(SecretUri=%s)' "$(secret_uri "$1")"
}

get_secret_value() {
    local secret_name="$1"
    az keyvault secret show \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$secret_name" \
        --query value \
        -o tsv 2>/dev/null || true
}

webapp_exists() {
    az webapp show --resource-group "$RESOURCE_GROUP" --name "$1" --only-show-errors >/dev/null 2>&1
}

plan_exists() {
    az appservice plan show --resource-group "$RESOURCE_GROUP" --name "$1" --only-show-errors >/dev/null 2>&1
}

resource_group_exists() {
    az group exists --name "$1"
}

storage_account_exists() {
    az storage account show --resource-group "$RESOURCE_GROUP" --name "$1" --only-show-errors >/dev/null 2>&1
}

key_vault_exists() {
    az keyvault show --name "$1" --only-show-errors >/dev/null 2>&1
}

postgres_server_exists() {
    az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$1" --only-show-errors >/dev/null 2>&1
}

postgres_firewall_rule_exists() {
    az postgres flexible-server firewall-rule show --resource-group "$RESOURCE_GROUP" --name "$POSTGRES_SERVER" --rule-name "$1" --only-show-errors >/dev/null 2>&1
}

postgres_db_exists() {
    az postgres flexible-server db show --resource-group "$RESOURCE_GROUP" --server-name "$POSTGRES_SERVER" --database-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_profile_exists() {
    az afd profile show --resource-group "$RESOURCE_GROUP" --profile-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_endpoint_exists() {
    az afd endpoint show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --endpoint-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_origin_group_exists() {
    az afd origin-group show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --origin-group-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_origin_exists() {
    az afd origin show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --origin-group-name "$FRONTDOOR_ORIGIN_GROUP" --origin-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_route_exists() {
    az afd route show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --endpoint-name "$FRONTDOOR_ENDPOINT" --route-name "$1" --only-show-errors >/dev/null 2>&1
}

afd_custom_domain_exists() {
    az afd custom-domain show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --custom-domain-name "$1" --only-show-errors >/dev/null 2>&1
}

ensure_provider_registered() {
    local namespace="$1"
    local state

    state="$(az provider show --namespace "$namespace" --subscription "$SUBSCRIPTION_ID" --query registrationState -o tsv 2>/dev/null || true)"
    if [[ "$state" == "Registered" ]]; then
        return
    fi

    log "Registering Azure resource provider $namespace"
    az provider register \
        --namespace "$namespace" \
        --subscription "$SUBSCRIPTION_ID" \
        --wait \
        --only-show-errors \
        --output none
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prefix)
            PREFIX="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT_NAME="$2"
            shift 2
            ;;
        --location)
            LOCATION="$2"
            shift 2
            ;;
        --subscription)
            SUBSCRIPTION_ID="$2"
            shift 2
            ;;
        --resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        --app-service-plan)
            APP_SERVICE_PLAN="$2"
            shift 2
            ;;
        --api-app-name)
            API_APP_NAME="$2"
            shift 2
            ;;
        --storage-account)
            STORAGE_ACCOUNT="$2"
            shift 2
            ;;
        --key-vault-name)
            KEY_VAULT_NAME="$2"
            shift 2
            ;;
        --postgres-server)
            POSTGRES_SERVER="$2"
            shift 2
            ;;
        --enable-front-door)
            ENABLE_FRONT_DOOR="true"
            shift
            ;;
        --domain-root)
            DOMAIN_ROOT="$2"
            ENABLE_FRONT_DOOR="true"
            shift 2
            ;;
        --frontend-domain)
            FRONTEND_DOMAIN="$2"
            ENABLE_FRONT_DOOR="true"
            shift 2
            ;;
        --postgres-admin)
            POSTGRES_ADMIN="$2"
            shift 2
            ;;
        --postgres-password)
            POSTGRES_PASSWORD="$2"
            shift 2
            ;;
        --postgres-db)
            POSTGRES_DB="$2"
            shift 2
            ;;
        --docs-container)
            DOCS_CONTAINER="$2"
            shift 2
            ;;
        --run-migrations)
            RUN_MIGRATIONS="true"
            shift
            ;;
        --skip-api)
            SKIP_API="true"
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND="true"
            shift
            ;;
        --frontend-on-api)
            FRONTEND_ON_API="true"
            shift
            ;;
        --skip-deploy)
            SKIP_DEPLOY="true"
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown option: $1"
            ;;
    esac
done

require_command az
require_command dotnet
require_command npm
require_command zip
require_command sha1sum
require_command openssl

if [[ "$RUN_MIGRATIONS" == "true" ]]; then
    require_command curl
fi

if ! az account show >/dev/null 2>&1; then
    fail "Azure CLI is not logged in. Run 'az login' first."
fi

if [[ -n "$SUBSCRIPTION_ID" ]]; then
    log "Selecting Azure subscription $SUBSCRIPTION_ID"
    az account set --subscription "$SUBSCRIPTION_ID"
fi

if [[ -n "$DOMAIN_ROOT" && -z "$FRONTEND_DOMAIN" ]]; then
    FRONTEND_DOMAIN="app.${DOMAIN_ROOT}"
fi

if [[ "$FRONTEND_ON_API" == "true" && "$ENABLE_FRONT_DOOR" == "true" ]]; then
    fail "--frontend-on-api cannot be combined with --enable-front-door."
fi

if [[ "$FRONTEND_ON_API" == "true" && "$SKIP_API" == "true" && "$SKIP_FRONTEND" == "false" ]]; then
    fail "--frontend-on-api requires API deployment. Remove --skip-api or also pass --skip-frontend."
fi

API_RUNTIME_STACK="$(detect_api_runtime_stack)"

ensure_provider_registered "Microsoft.Storage"
ensure_provider_registered "Microsoft.KeyVault"
ensure_provider_registered "Microsoft.DBforPostgreSQL"
ensure_provider_registered "Microsoft.Web"
if [[ "$ENABLE_FRONT_DOOR" == "true" ]]; then
    ensure_provider_registered "Microsoft.Cdn"
fi

name_hash="$(hash_suffix "${PREFIX}-${ENVIRONMENT_NAME}-${RESOURCE_GROUP:-auto}")"
prefix_dash="$(normalize_dash "$PREFIX")"
env_dash="$(normalize_dash "$ENVIRONMENT_NAME")"
prefix_compact="$(normalize_compact "$PREFIX")"
env_compact="$(normalize_compact "$ENVIRONMENT_NAME")"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-${prefix_dash}-${env_dash}}"
APP_SERVICE_PLAN="${APP_SERVICE_PLAN:-asp-${prefix_dash}-${env_dash}}"
API_APP_NAME="${API_APP_NAME:-$(trim_trailing_dash "$(printf 'app-%s-%s-api-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-60)")}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-$(trim_trailing_dash "$(printf 'kv-%s-%s-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-24)")}"
POSTGRES_SERVER="${POSTGRES_SERVER:-$(trim_trailing_dash "$(printf 'psql-%s-%s-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-63)")}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-$(printf 'st%s%s%s' "$prefix_compact" "$env_compact" "$name_hash" | cut -c1-24)}"
FRONTDOOR_PROFILE="${FRONTDOOR_PROFILE:-afd-${prefix_dash}-${env_dash}}"
FRONTDOOR_ENDPOINT="${FRONTDOOR_ENDPOINT:-$(trim_trailing_dash "$(printf 'fd-%s-%s-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-46)")}"
FRONTDOOR_ORIGIN_GROUP="${FRONTDOOR_ORIGIN_GROUP:-frontend-origin-group}"
FRONTDOOR_ORIGIN="${FRONTDOOR_ORIGIN:-frontend-storage-origin}"
FRONTDOOR_ROUTE="${FRONTDOOR_ROUTE:-frontend-route}"
FRONTDOOR_CUSTOM_DOMAIN="${FRONTDOOR_CUSTOM_DOMAIN:-frontend-domain}"

success "Habitus Azure deployment"
printf '  Resource group : %s\n' "$RESOURCE_GROUP"
printf '  API app        : %s\n' "$API_APP_NAME"
printf '  API runtime    : %s\n' "$API_RUNTIME_STACK"
printf '  PostgreSQL     : %s\n' "$POSTGRES_SERVER"
printf '  Storage        : %s\n' "$STORAGE_ACCOUNT"
printf '  Key Vault      : %s\n' "$KEY_VAULT_NAME"
printf '  Front Door     : %s\n' "$ENABLE_FRONT_DOOR"
printf '  Frontend on API: %s\n' "$FRONTEND_ON_API"
if [[ -n "$FRONTEND_DOMAIN" ]]; then
    printf '  Frontend domain: %s\n' "$FRONTEND_DOMAIN"
fi
printf '  Location       : %s\n' "$LOCATION"
printf '\n'

if [[ "$(resource_group_exists "$RESOURCE_GROUP")" != "true" ]]; then
    log "Creating resource group"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
else
    success "Resource group already exists"
fi

if ! storage_account_exists "$STORAGE_ACCOUNT"; then
        log "Creating storage account via ARM deployment"
        az deployment group create \
                --resource-group "$RESOURCE_GROUP" \
                --name "storage-${STORAGE_ACCOUNT}" \
                --template-file /dev/stdin \
                --parameters storageAccountName="$STORAGE_ACCOUNT" location="$LOCATION" <<'EOF' >/dev/null
{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "storageAccountName": { "type": "string" },
        "location": { "type": "string" }
    },
    "resources": [
        {
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2023-05-01",
            "name": "[parameters('storageAccountName')]",
            "location": "[parameters('location')]",
            "sku": { "name": "Standard_LRS" },
            "kind": "StorageV2",
            "properties": {
                "minimumTlsVersion": "TLS1_2",
                "allowBlobPublicAccess": false,
                "supportsHttpsTrafficOnly": true
            }
        }
    ]
}
EOF
else
    success "Storage account already exists"
fi

storage_key="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
storage_connection_string="$(az storage account show-connection-string --resource-group "$RESOURCE_GROUP" --name "$STORAGE_ACCOUNT" --query connectionString -o tsv)"
storage_web_endpoint="$(az storage account show --resource-group "$RESOURCE_GROUP" --name "$STORAGE_ACCOUNT" --query 'primaryEndpoints.web' -o tsv | sed 's:/*$::')"
storage_web_host="$(printf '%s' "$storage_web_endpoint" | sed -E 's#https?://([^/]+)/?#\1#')"

log "Configuring static website and blob container"
az storage blob service-properties update \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$storage_key" \
    --static-website \
    --index-document index.html \
    --404-document index.html \
    --output none
az storage container create \
    --name "$DOCS_CONTAINER" \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$storage_key" \
    --public-access off \
    --output none >/dev/null

if ! key_vault_exists "$KEY_VAULT_NAME"; then
    log "Creating Key Vault"
    az keyvault create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$KEY_VAULT_NAME" \
        --location "$LOCATION" \
        --enable-rbac-authorization false \
        --output none
else
    success "Key Vault already exists"
fi

if [[ -z "$POSTGRES_PASSWORD" ]]; then
    POSTGRES_PASSWORD="$(get_secret_value 'Postgres--AdminPassword')"
fi
if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="$(get_secret_value 'JwtSettings--SecretKey')"
fi
if [[ -z "$ENCRYPTION_KEY" ]]; then
    ENCRYPTION_KEY="$(get_secret_value 'EncryptionKey')"
fi

if [[ -z "$POSTGRES_PASSWORD" ]]; then
    if postgres_server_exists "$POSTGRES_SERVER"; then
        fail "POSTGRES_PASSWORD is missing and no existing Key Vault secret was found for Postgres--AdminPassword. Set POSTGRES_PASSWORD before running a release deploy."
    fi
    POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
fi

if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
fi

if [[ -z "$ENCRYPTION_KEY" ]]; then
    ENCRYPTION_KEY="$(openssl rand -hex 32)"
fi

if ! postgres_server_exists "$POSTGRES_SERVER"; then
    log "Creating Azure Database for PostgreSQL Flexible Server"
    az postgres flexible-server create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --location "$LOCATION" \
        --admin-user "$POSTGRES_ADMIN" \
        --admin-password "$POSTGRES_PASSWORD" \
        --sku-name "$POSTGRES_SKU" \
        --tier "$POSTGRES_TIER" \
        --storage-size "$POSTGRES_STORAGE_GB" \
        --version 16 \
        --public-access 0.0.0.0 \
        --output none
else
    success "PostgreSQL flexible server already exists"
fi

if ! postgres_firewall_rule_exists allow-azure-services; then
    log "Allowing Azure services to reach PostgreSQL"
    az postgres flexible-server firewall-rule create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --rule-name allow-azure-services \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0 \
        --output none >/dev/null
else
    success "Azure services firewall rule already exists"
fi

if ! postgres_db_exists "$POSTGRES_DB"; then
    log "Creating PostgreSQL database $POSTGRES_DB"
    az postgres flexible-server db create \
        --resource-group "$RESOURCE_GROUP" \
        --server-name "$POSTGRES_SERVER" \
        --database-name "$POSTGRES_DB" \
        --output none
else
    success "PostgreSQL database already exists"
fi

if ! plan_exists "$APP_SERVICE_PLAN"; then
    log "Creating Linux App Service plan"
    az appservice plan create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_SERVICE_PLAN" \
        --location "$LOCATION" \
        --is-linux \
        --sku "$APP_SERVICE_SKU" \
        --output none
else
    success "App Service plan already exists"
fi

if ! webapp_exists "$API_APP_NAME"; then
    log "Creating API Web App"
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$APP_SERVICE_PLAN" \
        --name "$API_APP_NAME" \
        --runtime "$API_RUNTIME_STACK" \
        --output none
else
    success "API Web App already exists"
fi

log "Applying API runtime stack $API_RUNTIME_STACK"
az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$API_APP_NAME" \
    --linux-fx-version "$API_RUNTIME_STACK" \
    --output none >/dev/null

az webapp update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$API_APP_NAME" \
    --set httpsOnly=true \
    --output none >/dev/null

api_principal_id="$(az webapp identity assign --resource-group "$RESOURCE_GROUP" --name "$API_APP_NAME" --query principalId -o tsv)"
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --object-id "$api_principal_id" \
    --secret-permissions get list \
    --output none >/dev/null

frontend_url="$storage_web_endpoint"
api_url="https://${API_APP_NAME}.azurewebsites.net"
allowed_origins="$frontend_url"

if [[ "$FRONTEND_ON_API" == "true" ]]; then
    frontend_url="$api_url"
    allowed_origins="$frontend_url"
fi

if [[ "$ENABLE_FRONT_DOOR" == "true" ]]; then
    if ! afd_profile_exists "$FRONTDOOR_PROFILE"; then
        log "Creating Azure Front Door profile"
        az afd profile create \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --sku Standard_AzureFrontDoor \
            --output none
    else
        success "Azure Front Door profile already exists"
    fi

    if ! afd_endpoint_exists "$FRONTDOOR_ENDPOINT"; then
        log "Creating Azure Front Door endpoint"
        az afd endpoint create \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --endpoint-name "$FRONTDOOR_ENDPOINT" \
            --enabled-state Enabled \
            --output none
    else
        success "Azure Front Door endpoint already exists"
    fi

    if ! afd_origin_group_exists "$FRONTDOOR_ORIGIN_GROUP"; then
        log "Creating Azure Front Door origin group"
        az afd origin-group create \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --origin-group-name "$FRONTDOOR_ORIGIN_GROUP" \
            --enable-health-probe true \
            --probe-request-type GET \
            --probe-protocol Https \
            --probe-path "/" \
            --probe-interval-in-seconds 120 \
            --sample-size 4 \
            --successful-samples-required 3 \
            --additional-latency-in-milliseconds 50 \
            --output none
    else
        success "Azure Front Door origin group already exists"
    fi

    if ! afd_origin_exists "$FRONTDOOR_ORIGIN"; then
        log "Creating Azure Front Door origin for the static website"
        az afd origin create \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --origin-group-name "$FRONTDOOR_ORIGIN_GROUP" \
            --origin-name "$FRONTDOOR_ORIGIN" \
            --host-name "$storage_web_host" \
            --origin-host-header "$storage_web_host" \
            --http-port 80 \
            --https-port 443 \
            --priority 1 \
            --weight 1000 \
            --enabled-state Enabled \
            --output none
    else
        success "Azure Front Door origin already exists"
    fi

    if ! afd_route_exists "$FRONTDOOR_ROUTE"; then
        log "Creating Azure Front Door route"
        az afd route create \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --endpoint-name "$FRONTDOOR_ENDPOINT" \
            --route-name "$FRONTDOOR_ROUTE" \
            --origin-group "$FRONTDOOR_ORIGIN_GROUP" \
            --supported-protocols Http Https \
            --patterns-to-match '/*' \
            --https-redirect Enabled \
            --forwarding-protocol MatchRequest \
            --link-to-default-domain Enabled \
            --enabled-state Enabled \
            --output none
    else
        success "Azure Front Door route already exists"
    fi

    frontdoor_host="$(az afd endpoint show --resource-group "$RESOURCE_GROUP" --profile-name "$FRONTDOOR_PROFILE" --endpoint-name "$FRONTDOOR_ENDPOINT" --query hostName -o tsv)"
    frontend_url="https://${frontdoor_host}"
    allowed_origins="$frontend_url"

    if [[ -n "$FRONTEND_DOMAIN" ]]; then
        if ! afd_custom_domain_exists "$FRONTDOOR_CUSTOM_DOMAIN"; then
            log "Creating Azure Front Door custom domain with managed TLS"
            az afd custom-domain create \
                --resource-group "$RESOURCE_GROUP" \
                --profile-name "$FRONTDOOR_PROFILE" \
                --custom-domain-name "$FRONTDOOR_CUSTOM_DOMAIN" \
                --host-name "$FRONTEND_DOMAIN" \
                --certificate-type ManagedCertificate \
                --minimum-tls-version TLS12 \
                --output none
        else
            success "Azure Front Door custom domain already exists"
        fi

        log "Associating the custom domain with the frontend route"
        az afd route update \
            --resource-group "$RESOURCE_GROUP" \
            --profile-name "$FRONTDOOR_PROFILE" \
            --endpoint-name "$FRONTDOOR_ENDPOINT" \
            --route-name "$FRONTDOOR_ROUTE" \
            --custom-domains "$FRONTDOOR_CUSTOM_DOMAIN" \
            --output none >/dev/null

        frontend_url="https://${FRONTEND_DOMAIN}"
        allowed_origins="$frontend_url"
        warn "Make sure your DNS CNAME points ${FRONTEND_DOMAIN} to ${frontdoor_host}."
    fi
fi

if [[ -n "$EXTRA_ALLOWED_ORIGINS" ]]; then
    allowed_origins="${allowed_origins},${EXTRA_ALLOWED_ORIGINS}"
fi

db_connection_string="Host=${POSTGRES_SERVER}.postgres.database.azure.com;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_ADMIN};Password=${POSTGRES_PASSWORD};Ssl Mode=Require;Trust Server Certificate=true"

log "Storing required secrets in Key Vault"
upsert_secret 'Postgres--AdminPassword' "$POSTGRES_PASSWORD"
upsert_secret 'ConnectionStrings--DefaultConnection' "$db_connection_string"
upsert_secret 'JwtSettings--SecretKey' "$JWT_SECRET"
upsert_secret 'EncryptionKey' "$ENCRYPTION_KEY"
upsert_secret 'AzureStorage--ConnectionString' "$storage_connection_string"

if [[ -n "$AZURE_COMMUNICATION_CONNECTION_STRING" ]]; then
    upsert_secret 'AzureCommunication--ConnectionString' "$AZURE_COMMUNICATION_CONNECTION_STRING"
fi
if [[ -n "$AZURE_TRANSLATION_KEY" ]]; then
    upsert_secret 'AzureTranslation--Key' "$AZURE_TRANSLATION_KEY"
fi
if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
    upsert_secret 'Authentication--Google--ClientId' "$GOOGLE_CLIENT_ID"
fi
if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
    upsert_secret 'Authentication--Google--ClientSecret' "$GOOGLE_CLIENT_SECRET"
fi
if [[ -n "$MICROSOFT_CLIENT_ID" ]]; then
    upsert_secret 'Authentication--Microsoft--ClientId' "$MICROSOFT_CLIENT_ID"
fi
if [[ -n "$MICROSOFT_CLIENT_SECRET" ]]; then
    upsert_secret 'Authentication--Microsoft--ClientSecret' "$MICROSOFT_CLIENT_SECRET"
fi
if [[ -n "$STRIPE_SECRET_KEY" ]]; then
    upsert_secret 'Stripe--SecretKey' "$STRIPE_SECRET_KEY"
fi
if [[ -n "$STRIPE_WEBHOOK_SECRET" ]]; then
    upsert_secret 'Stripe--WebhookSecret' "$STRIPE_WEBHOOK_SECRET"
fi
if [[ -n "$STRIPE_PUBLIC_KEY" ]]; then
    upsert_secret 'Stripe--PublicKey' "$STRIPE_PUBLIC_KEY"
fi
if [[ -n "$INITIAL_MANAGER_NAME" ]]; then
    upsert_secret 'InitialManager--Name' "$INITIAL_MANAGER_NAME"
fi
if [[ -n "$INITIAL_MANAGER_EMAIL" ]]; then
    upsert_secret 'InitialManager--Email' "$INITIAL_MANAGER_EMAIL"
fi
if [[ -n "$INITIAL_MANAGER_PASSWORD" ]]; then
    upsert_secret 'InitialManager--Password' "$INITIAL_MANAGER_PASSWORD"
fi
if [[ -n "$INITIAL_MANAGER_PHONE" ]]; then
    upsert_secret 'InitialManager--Phone' "$INITIAL_MANAGER_PHONE"
fi

app_settings=(
    "ASPNETCORE_ENVIRONMENT=Production"
    "Frontend__BaseUrl=${frontend_url}"
    "AllowedOrigins=${allowed_origins}"
    "AzureStorage__ContainerName=${DOCS_CONTAINER}"
    "AzureCommunication__SenderEmail=${AZURE_COMMUNICATION_SENDER_EMAIL}"
    "AzureTranslation__Endpoint=${AZURE_TRANSLATION_ENDPOINT}"
    "AzureTranslation__Region=${AZURE_TRANSLATION_REGION}"
    "ConnectionStrings__DefaultConnection=$(build_kv_ref 'ConnectionStrings--DefaultConnection')"
    "JwtSettings__SecretKey=$(build_kv_ref 'JwtSettings--SecretKey')"
    "EncryptionKey=$(build_kv_ref 'EncryptionKey')"
    "AzureStorage__ConnectionString=$(build_kv_ref 'AzureStorage--ConnectionString')"
)

if [[ -n "$AZURE_COMMUNICATION_CONNECTION_STRING" ]]; then
    app_settings+=("AzureCommunication__ConnectionString=$(build_kv_ref 'AzureCommunication--ConnectionString')")
fi
if [[ -n "$AZURE_TRANSLATION_KEY" ]]; then
    app_settings+=("AzureTranslation__Key=$(build_kv_ref 'AzureTranslation--Key')")
fi
if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
    app_settings+=("Authentication__Google__ClientId=$(build_kv_ref 'Authentication--Google--ClientId')")
fi
if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
    app_settings+=("Authentication__Google__ClientSecret=$(build_kv_ref 'Authentication--Google--ClientSecret')")
fi
if [[ -n "$MICROSOFT_CLIENT_ID" ]]; then
    app_settings+=("Authentication__Microsoft__ClientId=$(build_kv_ref 'Authentication--Microsoft--ClientId')")
fi
if [[ -n "$MICROSOFT_CLIENT_SECRET" ]]; then
    app_settings+=("Authentication__Microsoft__ClientSecret=$(build_kv_ref 'Authentication--Microsoft--ClientSecret')")
fi
if [[ -n "$STRIPE_SECRET_KEY" ]]; then
    app_settings+=("Stripe__SecretKey=$(build_kv_ref 'Stripe--SecretKey')")
fi
if [[ -n "$STRIPE_WEBHOOK_SECRET" ]]; then
    app_settings+=("Stripe__WebhookSecret=$(build_kv_ref 'Stripe--WebhookSecret')")
fi
if [[ -n "$STRIPE_PUBLIC_KEY" ]]; then
    app_settings+=("Stripe__PublicKey=$(build_kv_ref 'Stripe--PublicKey')")
fi
if [[ -n "$INITIAL_MANAGER_NAME" ]]; then
    app_settings+=("InitialManager__Name=$(build_kv_ref 'InitialManager--Name')")
fi
if [[ -n "$INITIAL_MANAGER_EMAIL" ]]; then
    app_settings+=("InitialManager__Email=$(build_kv_ref 'InitialManager--Email')")
fi
if [[ -n "$INITIAL_MANAGER_PASSWORD" ]]; then
    app_settings+=("InitialManager__Password=$(build_kv_ref 'InitialManager--Password')")
fi
if [[ -n "$INITIAL_MANAGER_PHONE" ]]; then
    app_settings+=("InitialManager__Phone=$(build_kv_ref 'InitialManager--Phone')")
fi

log "Applying API configuration"
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$API_APP_NAME" \
    --settings "${app_settings[@]}" \
    --output none >/dev/null

if [[ -z "$INITIAL_MANAGER_NAME" || -z "$INITIAL_MANAGER_EMAIL" || -z "$INITIAL_MANAGER_PASSWORD" ]]; then
    warn "Initial Manager bootstrap is not fully configured. If this is the first deployment, set INITIAL_MANAGER_NAME, INITIAL_MANAGER_EMAIL, and INITIAL_MANAGER_PASSWORD."
fi

if [[ "$RUN_MIGRATIONS" == "true" ]]; then
    if ! command -v dotnet-ef >/dev/null 2>&1 && ! dotnet tool list -g | grep -q '^dotnet-ef '; then
        warn "Skipping migrations because dotnet-ef is not installed."
    else
        current_ip="$(curl -fsSL https://api.ipify.org || true)"
        if [[ -n "$current_ip" ]]; then
            if ! postgres_firewall_rule_exists allow-local-deployer; then
                log "Allowing current client IP for migrations ($current_ip)"
                az postgres flexible-server firewall-rule create \
                    --resource-group "$RESOURCE_GROUP" \
                    --name "$POSTGRES_SERVER" \
                    --rule-name allow-local-deployer \
                    --start-ip-address "$current_ip" \
                    --end-ip-address "$current_ip" \
                    --output none >/dev/null
            else
                success "Local deployer firewall rule already exists"
            fi
        else
            warn "Could not detect current public IP. Migrations may fail if PostgreSQL is private to Azure services only."
        fi

        log "Running Entity Framework migrations against Azure PostgreSQL"
        (
            cd "$ROOT_DIR/src/Habitus.Api"
            ConnectionStrings__DefaultConnection="$db_connection_string" dotnet ef database update
        )
    fi
fi

if [[ "$SKIP_DEPLOY" == "false" && "$SKIP_API" == "false" ]]; then
    temp_dir="$(mktemp -d)"
    trap 'rm -rf "$temp_dir"' EXIT

    if [[ "$FRONTEND_ON_API" == "true" && "$SKIP_FRONTEND" == "false" ]]; then
        log "Building frontend to be served by API Web App"
        (
            cd "$WEB_DIR"
            npm ci
            VITE_API_BASE_URL="/api" npm run build
        )
    fi

    log "Publishing API"
    dotnet publish "$API_PROJECT" -c Release -o "$temp_dir/api-publish"

    if [[ "$FRONTEND_ON_API" == "true" && "$SKIP_FRONTEND" == "false" ]]; then
        log "Embedding frontend artifacts into API publish output"
        rm -rf "$temp_dir/api-publish/wwwroot"
        mkdir -p "$temp_dir/api-publish/wwwroot"
        cp -R "$WEB_DIR/dist/." "$temp_dir/api-publish/wwwroot/"
    fi

    (
        cd "$temp_dir/api-publish"
        zip -qr "$temp_dir/api.zip" .
    )

    az webapp deploy \
        --resource-group "$RESOURCE_GROUP" \
        --name "$API_APP_NAME" \
        --src-path "$temp_dir/api.zip" \
        --type zip \
        --clean true \
        --output none

    success "API deployed"
fi

if [[ "$SKIP_DEPLOY" == "false" && "$SKIP_FRONTEND" == "false" ]]; then
    if [[ "$FRONTEND_ON_API" == "true" ]]; then
        success "Frontend deployed inside API Web App"
    else
        log "Building frontend with Azure API URL"
        (
            cd "$WEB_DIR"
            npm ci
            VITE_API_BASE_URL="${api_url}/api" npm run build
        )

        log "Uploading frontend to Azure Storage static website"
        az storage blob upload-batch \
            --account-name "$STORAGE_ACCOUNT" \
            --account-key "$storage_key" \
            --destination '$web' \
            --source "$WEB_DIR/dist" \
            --overwrite true \
            --output none

        success "Frontend deployed"
    fi
fi

printf '\n'
success "Deployment completed"
printf '  Frontend URL : %s\n' "$frontend_url"
printf '  API URL      : %s\n' "$api_url"
printf '  Docs blob    : %s\n' "$DOCS_CONTAINER"
printf '  Key Vault    : %s\n' "$KEY_VAULT_NAME"
if [[ "$ENABLE_FRONT_DOOR" == "true" ]]; then
    printf '  Front Door   : %s\n' "$FRONTDOOR_PROFILE"
fi
printf '\n'

if [[ "$ENABLE_FRONT_DOOR" == "true" && -n "$FRONTEND_DOMAIN" ]]; then
    printf 'DNS checklist (amen.pt):\n'
    printf '  CNAME %s -> %s\n' "$FRONTEND_DOMAIN" "$frontdoor_host"
    printf '  Note: keep it as DNS-only and wait for propagation before certificate issuance.\n'
    printf '\n'
fi

printf 'Optional next steps:\n'
printf '  1. Add Azure Communication Services, Stripe, and OAuth secrets with environment variables and rerun the script.\n'
printf '  2. Review PostgreSQL networking and replace public access rules with private networking when you are ready.\n'
printf '  3. If you want a custom API domain too, bind it in App Service and issue a managed certificate.\n'