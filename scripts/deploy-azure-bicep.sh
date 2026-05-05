#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_FILE="$ROOT_DIR/infra/azure/main.bicep"

PREFIX="habitus"
ENVIRONMENT_NAME="prod"
LOCATION="westeurope"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-HabitusCond}"
RESOURCE_GROUP=""
POSTGRES_ADMIN="habitusadmin"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_DB="habitus"
DOCS_CONTAINER="habitus-docs"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    printf "%b%s%b\n" "$BLUE" "$1" "$NC"
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
  ./scripts/deploy-azure-bicep.sh [options]

Options:
  --prefix VALUE            Base name for Azure resources (default: habitus)
  --environment VALUE       Environment suffix (default: prod)
  --location VALUE          Azure region (default: westeurope)
    --subscription VALUE      Azure subscription id or name (default: HabitusCond)
  --resource-group VALUE    Resource group name override
  --postgres-admin VALUE    PostgreSQL admin username (default: habitusadmin)
  --postgres-password VALUE PostgreSQL admin password override
  --postgres-db VALUE       PostgreSQL database name (default: habitus)
  --docs-container VALUE    Blob container for documents (default: habitus-docs)
  --help                    Show this help
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

trim_trailing_dash() {
    printf '%s' "$1" | sed 's/-*$//'
}

hash_suffix() {
    printf '%s' "$1" | sha1sum | cut -c1-6
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
require_command sha1sum
require_command openssl

if ! az account show >/dev/null 2>&1; then
    fail "Azure CLI is not logged in. Run 'az login -u ricardopsilva@hotmail.com' first."
fi

log "Selecting Azure subscription $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"

name_hash="$(hash_suffix "${PREFIX}-${ENVIRONMENT_NAME}-${RESOURCE_GROUP:-auto}")"
prefix_dash="$(normalize_dash "$PREFIX")"
env_dash="$(normalize_dash "$ENVIRONMENT_NAME")"
prefix_compact="$(normalize_compact "$PREFIX")"
env_compact="$(normalize_compact "$ENVIRONMENT_NAME")"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-${prefix_dash}-${env_dash}}"
APP_SERVICE_PLAN="asp-${prefix_dash}-${env_dash}"
API_APP_NAME="$(trim_trailing_dash "$(printf 'app-%s-%s-api-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-60)")"
KEY_VAULT_NAME="$(trim_trailing_dash "$(printf 'kv-%s-%s-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-24)")"
POSTGRES_SERVER="$(trim_trailing_dash "$(printf 'psql-%s-%s-%s' "$prefix_dash" "$env_dash" "$name_hash" | cut -c1-63)")"
STORAGE_ACCOUNT="$(printf 'st%s%s%s' "$prefix_compact" "$env_compact" "$name_hash" | cut -c1-24)"
DEPLOYMENT_NAME="bicep-${prefix_dash}-${env_dash}"

[[ -n "$POSTGRES_PASSWORD" ]] || POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"

log "Ensuring resource group exists"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

log "Deploying Bicep template"
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters \
        prefix="$PREFIX" \
        environmentName="$ENVIRONMENT_NAME" \
        location="$LOCATION" \
        appServicePlanName="$APP_SERVICE_PLAN" \
        apiAppName="$API_APP_NAME" \
        storageAccountName="$STORAGE_ACCOUNT" \
        keyVaultName="$KEY_VAULT_NAME" \
        postgresServerName="$POSTGRES_SERVER" \
        postgresAdminLogin="$POSTGRES_ADMIN" \
        postgresAdminPassword="$POSTGRES_PASSWORD" \
        postgresDatabaseName="$POSTGRES_DB" \
        docsContainerName="$DOCS_CONTAINER" \
    --output none

api_url="$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query 'properties.outputs.apiUrl.value' -o tsv)"
frontend_url="$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query 'properties.outputs.storageWebEndpoint.value' -o tsv | sed 's:/*$::')"

printf '\n'
success "Bicep deployment completed"
printf '  Resource group : %s\n' "$RESOURCE_GROUP"
printf '  API URL        : %s\n' "$api_url"
printf '  Frontend URL   : %s\n' "$frontend_url"
printf '  Key Vault      : %s\n' "$KEY_VAULT_NAME"
printf '\n'
printf 'Next:\n'
printf '  1. Run ./scripts/deploy-azure.sh --subscription "%s" --resource-group "%s" --api-app-name "%s" --storage-account "%s" --key-vault-name "%s" --postgres-server "%s" --postgres-admin "%s" --postgres-password "%s" --postgres-db "%s"\n' "$SUBSCRIPTION_ID" "$RESOURCE_GROUP" "$API_APP_NAME" "$STORAGE_ACCOUNT" "$KEY_VAULT_NAME" "$POSTGRES_SERVER" "$POSTGRES_ADMIN" "$POSTGRES_PASSWORD" "$POSTGRES_DB"
