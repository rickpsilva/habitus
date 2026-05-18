#!/usr/bin/env bash

set -Eeuo pipefail

# RGPD production-oriented orchestration script.
# Purpose:
# - minimize human error in RGPD rollout execution
# - provide a single, commented flow matching docs/RGPD_DEPLOY_ROLLBACK_RUNBOOK.md
# - keep every step explicit and traceable in logs
#
# Notes:
# - This script is SAFE by default: nothing is hidden and every action is logged.
# - Use --dry-run first in staging/production windows.
# - Requires a Manager bearer token for maintenance RGPD endpoints.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_DIR="${RGPD_LOG_DIR:-/tmp/habitus-rgpd}"
mkdir -p "$LOG_DIR"

API_BASE_URL="${API_BASE_URL:-}"
API_BEARER_TOKEN="${API_BEARER_TOKEN:-}"
DATABASE_URL="${DATABASE_URL:-}"

RUN_TESTS="true"
RUN_MIGRATIONS="true"
RUN_HEALTHCHECK="true"
RUN_API_MAINTENANCE="true"
RUN_SQL_VALIDATION="true"

POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-1800}"

DRY_RUN="false"
VERBOSE="false"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { printf "%b[RGPD]%b %s\n" "$BLUE" "$NC" "$1"; }
warn() { printf "%b[WARN]%b %s\n" "$YELLOW" "$NC" "$1"; }
ok() { printf "%b[OK]%b %s\n" "$GREEN" "$NC" "$1"; }
err() { printf "%b[ERR]%b %s\n" "$RED" "$NC" "$1" >&2; }

usage() {
  cat <<'EOF'
Usage:
  ./scripts/rgpd-release-runbook.sh [options]

Options:
  --api-base-url URL            API base URL (e.g. https://api.example.com)
  --api-bearer-token TOKEN      Manager JWT for RGPD maintenance endpoints
  --database-url URL            PostgreSQL connection string for SQL validation (psql)

  --skip-tests                  Skip .NET RGPD test battery
  --skip-migrations             Skip EF migrations step
  --skip-healthcheck            Skip GET /health
  --skip-api-maintenance        Skip RGPD maintenance API flow (audit/run/status)
  --skip-sql-validation         Skip SQL validation scripts

  --poll-interval SECONDS       Poll interval for run status (default: 10)
  --poll-timeout SECONDS        Poll timeout for run status (default: 1800)

  --dry-run                     Print commands without executing
  --verbose                     Enable shell trace (set -x)
  --help                        Show this help

Environment equivalents:
  API_BASE_URL, API_BEARER_TOKEN, DATABASE_URL,
  POLL_INTERVAL_SECONDS, POLL_TIMEOUT_SECONDS, RGPD_LOG_DIR

Examples:
  ./scripts/rgpd-release-runbook.sh \\
    --api-base-url https://api.habitus.pt \\
    --api-bearer-token "$TOKEN" \\
    --database-url "$DATABASE_URL" \\
    --dry-run

  ./scripts/rgpd-release-runbook.sh \\
    --api-base-url https://api.habitus.pt \\
    --api-bearer-token "$TOKEN" \\
    --database-url "$DATABASE_URL"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base-url)
      API_BASE_URL="$2"; shift 2 ;;
    --api-bearer-token)
      API_BEARER_TOKEN="$2"; shift 2 ;;
    --database-url)
      DATABASE_URL="$2"; shift 2 ;;
    --skip-tests)
      RUN_TESTS="false"; shift ;;
    --skip-migrations)
      RUN_MIGRATIONS="false"; shift ;;
    --skip-healthcheck)
      RUN_HEALTHCHECK="false"; shift ;;
    --skip-api-maintenance)
      RUN_API_MAINTENANCE="false"; shift ;;
    --skip-sql-validation)
      RUN_SQL_VALIDATION="false"; shift ;;
    --poll-interval)
      POLL_INTERVAL_SECONDS="$2"; shift 2 ;;
    --poll-timeout)
      POLL_TIMEOUT_SECONDS="$2"; shift 2 ;;
    --dry-run)
      DRY_RUN="true"; shift ;;
    --verbose)
      VERBOSE="true"; shift ;;
    --help)
      usage; exit 0 ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1 ;;
  esac
done

if [[ "$VERBOSE" == "true" ]]; then
  set -x
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    err "Missing required command: $1"
    return 1
  }
}

run_cmd() {
  local description="$1"
  shift
  log "$description"
  if [[ "$DRY_RUN" == "true" ]]; then
    printf "  [dry-run] %q" "$1"
    shift
    for arg in "$@"; do printf " %q" "$arg"; done
    printf "\n"
    return 0
  fi
  "$@"
}

api_call() {
  local method="$1"
  local path="$2"
  local out_file="$3"

  local url="${API_BASE_URL%/}$path"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] $method $url"
    return 0
  fi

  curl --fail --silent --show-error \
    --request "$method" \
    --header "Authorization: Bearer $API_BEARER_TOKEN" \
    --header "Content-Type: application/json" \
    "$url" \
    > "$out_file"
}

# Preflight command checks
require_cmd dotnet
require_cmd curl
require_cmd jq

if [[ "$RUN_SQL_VALIDATION" == "true" ]]; then
  require_cmd psql || {
    err "psql is required for SQL validation. Use --skip-sql-validation to bypass."
    exit 1
  }
fi

if [[ "$RUN_API_MAINTENANCE" == "true" || "$RUN_HEALTHCHECK" == "true" ]]; then
  if [[ -z "$API_BASE_URL" ]]; then
    err "API base URL missing. Use --api-base-url or API_BASE_URL env var."
    exit 1
  fi
fi

if [[ "$RUN_API_MAINTENANCE" == "true" ]]; then
  if [[ -z "$API_BEARER_TOKEN" ]]; then
    err "API bearer token missing. Use --api-bearer-token or API_BEARER_TOKEN env var."
    exit 1
  fi
fi

if [[ "$RUN_SQL_VALIDATION" == "true" && -z "$DATABASE_URL" ]]; then
  err "DATABASE_URL missing for SQL validation. Use --database-url or DATABASE_URL env var."
  exit 1
fi

log "Logs directory: $LOG_DIR"

# 1) RGPD test battery
if [[ "$RUN_TESTS" == "true" ]]; then
  run_cmd "Running RGPD integration test battery" \
    dotnet test "$ROOT_DIR/tests/Habitus.Api.IntegrationTests/Habitus.Api.IntegrationTests.csproj" \
    --filter "SensitiveDataMaskingIntegrationTests|CondominiumScopeEnforcementTests|PaymentSettingsEncryptionIntegrationTests|UsersGdprAuthorizationIntegrationTests|CommunicationSettingsSecurityIntegrationTests|RgpdMigrationAsyncIntegrationTests"

  run_cmd "Running RGPD unit/service test battery" \
    dotnet test "$ROOT_DIR/tests/Habitus.Tests/Habitus.Tests.csproj" \
    --filter "GdprConsentTests|GdprErasureTests|GdprConsentMiddlewareTests|RgpdMigrationOperationsServiceTests|RgpdMigrationControllerTests|RgpdMigrationJobQueueTests|RgpdRuntimePolicyTests|HistoricalEncryptionBackfillServiceTests|EncryptionServiceTests|SensitiveDataMaskingTests|UserServicePhoneEncryptionTests|PaymentSettingsServiceEncryptionTests|PaymentSettingsControllerEncryptionTests|CondominiumServiceEncryptionTests|InvoiceServiceEncryptionTests|InvoicePdfServiceEncryptionTests|SupplierServiceEncryptionTests|UsefulContactServiceEncryptionTests|ReceiptServiceEncryptionTests|ReceiptTemplateSettingsServiceEncryptionTests|ReservationServiceIsolationTests"

  ok "RGPD tests completed"
else
  warn "Skipping test battery (--skip-tests)"
fi

# 2) EF migrations
if [[ "$RUN_MIGRATIONS" == "true" ]]; then
  run_cmd "Applying EF migrations" \
    dotnet ef database update \
    --project "$ROOT_DIR/src/Habitus.Infrastructure/Habitus.Infrastructure.csproj" \
    --startup-project "$ROOT_DIR/src/Habitus.Api/Habitus.Api.csproj"

  ok "EF migrations step completed"
else
  warn "Skipping EF migrations (--skip-migrations)"
fi

# 3) API healthcheck
if [[ "$RUN_HEALTHCHECK" == "true" ]]; then
  HEALTH_OUT="$LOG_DIR/health.json"
  run_cmd "Checking API health endpoint" \
    curl --fail --silent --show-error "${API_BASE_URL%/}/health" --output "$HEALTH_OUT"
  ok "Healthcheck succeeded"
else
  warn "Skipping healthcheck (--skip-healthcheck)"
fi

# 4) RGPD maintenance API flow
if [[ "$RUN_API_MAINTENANCE" == "true" ]]; then
  AUDIT_OUT="$LOG_DIR/rgpd_audit.json"
  RUN_OUT="$LOG_DIR/rgpd_run.json"
  STATUS_OUT="$LOG_DIR/rgpd_status.json"

  log "Running RGPD audit baseline"
  api_call POST "/api/maintenance/rgpd-migration/audit" "$AUDIT_OUT"

  log "Starting RGPD backfill run"
  api_call POST "/api/maintenance/rgpd-migration/run" "$RUN_OUT"

  # Poll status until Completed/Failed/timeout.
  start_epoch="$(date +%s)"
  final_state="Unknown"

  while true; do
    api_call GET "/api/maintenance/rgpd-migration/status" "$STATUS_OUT"

    if [[ "$DRY_RUN" == "true" ]]; then
      final_state="DryRun"
      break
    fi

    # Try both top-level status and latestRun.status shapes.
    current_state="$(jq -r '.status // .latestRun.status // empty' "$STATUS_OUT")"
    if [[ -z "$current_state" || "$current_state" == "null" ]]; then
      current_state="Unknown"
    fi

    log "Current RGPD migration state: $current_state"

    if [[ "$current_state" == "Completed" || "$current_state" == "Failed" ]]; then
      final_state="$current_state"
      break
    fi

    now_epoch="$(date +%s)"
    elapsed="$((now_epoch - start_epoch))"
    if (( elapsed >= POLL_TIMEOUT_SECONDS )); then
      final_state="Timeout"
      break
    fi

    sleep "$POLL_INTERVAL_SECONDS"
  done

  if [[ "$final_state" == "Failed" || "$final_state" == "Timeout" ]]; then
    err "RGPD migration ended in state: $final_state"
    err "Check: $STATUS_OUT"
    exit 1
  fi

  ok "RGPD maintenance API flow completed with state: $final_state"
else
  warn "Skipping RGPD maintenance API flow (--skip-api-maintenance)"
fi

# 5) SQL validation scripts
if [[ "$RUN_SQL_VALIDATION" == "true" ]]; then
  SQL01="$LOG_DIR/sql_01_plaintext_vs_encrypted.log"
  SQL02="$LOG_DIR/sql_02_legacy_null.log"
  SQL03="$LOG_DIR/sql_03_integrity_counts.log"

  run_cmd "Running SQL validation 01 (plaintext vs encrypted)" \
    psql "$DATABASE_URL" -f "$ROOT_DIR/scripts/sql/rgpd_validation_01_plaintext_vs_encrypted.sql" \
    > "$SQL01"

  run_cmd "Running SQL validation 02 (legacy columns null check)" \
    psql "$DATABASE_URL" -f "$ROOT_DIR/scripts/sql/rgpd_validation_02_legacy_columns_null.sql" \
    > "$SQL02"

  run_cmd "Running SQL validation 03 (integrity counts)" \
    psql "$DATABASE_URL" -f "$ROOT_DIR/scripts/sql/rgpd_validation_03_integrity_counts.sql" \
    > "$SQL03"

  if [[ "$DRY_RUN" != "true" ]]; then
    log "Residual plaintext quick checks"
    psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE \"TaxId\" IS NOT NULL AND btrim(\"TaxId\") <> '') AS legacy_non_null, count(*) FILTER (WHERE \"TaxIdEncrypted\" IS NOT NULL AND btrim(\"TaxIdEncrypted\") <> '') AS encrypted_non_null FROM \"public\".\"Condominiums\";"
    psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE \"PaymentIban\" IS NOT NULL AND btrim(\"PaymentIban\") <> '') AS legacy_non_null, count(*) FILTER (WHERE \"PaymentIbanEncrypted\" IS NOT NULL AND btrim(\"PaymentIbanEncrypted\") <> '') AS encrypted_non_null FROM \"public\".\"Condominiums\";"
    psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE \"CustomerTaxId\" IS NOT NULL AND btrim(\"CustomerTaxId\") <> '') AS legacy_non_null, count(*) FILTER (WHERE \"CustomerTaxIdEncrypted\" IS NOT NULL AND btrim(\"CustomerTaxIdEncrypted\") <> '') AS encrypted_non_null FROM \"public\".\"Invoices\";"
  fi

  ok "SQL validation scripts completed"
else
  warn "Skipping SQL validation (--skip-sql-validation)"
fi

printf "\n"
ok "RGPD runbook execution completed"
log "Artifacts: $LOG_DIR"
log "If needed, follow rollback sequence in docs/RGPD_DEPLOY_ROLLBACK_RUNBOOK.md"
