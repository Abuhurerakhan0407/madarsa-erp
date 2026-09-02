#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"
OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-recovery-drill-output}"
mkdir -p "${OUTPUT_DIR_INPUT}"
OUTPUT_DIR="$(cd "${OUTPUT_DIR_INPUT}" && pwd)"
STAGE_FILE="${OUTPUT_DIR}/stage-status.txt"
VERIFICATION_SUMMARY_FILE="${OUTPUT_DIR}/verification-summary.json"
WORK_DIR="$(mktemp -d)"
BACKUP_DIR="${WORK_DIR}/backup"
RESTORE_DIR="${WORK_DIR}/restore"
CURRENT_STAGE="initialization"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT
umask 077
mkdir -p "${BACKUP_DIR}" "${RESTORE_DIR}"

write_stage_status() {
  local status="$1"
  local classification="${2:-none}"
  {
    printf 'stage=%s\n' "${CURRENT_STAGE}"
    printf 'status=%s\n' "${status}"
    printf 'classification=%s\n' "${classification}"
  } > "${STAGE_FILE}"
}

mark_stage() {
  CURRENT_STAGE="$1"
  write_stage_status running none
}

record_unexpected_error() {
  local exit_code="$1"
  write_stage_status failed unexpected_exit
  echo "::error::Recovery drill failed during sanitized stage '${CURRENT_STAGE}' (exit ${exit_code})." >&2
}
trap 'record_unexpected_error "$?"' ERR

fail_with_classification() {
  local message="$1"
  local classification="$2"
  write_stage_status failed "${classification}"
  echo "::error::${message}" >&2
  trap - ERR
  exit 1
}

fail() {
  fail_with_classification "$1" command_failure
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required recovery command '$1' is not installed."
}

source_database_is_expected() {
  python3 - "${SOURCE_DB_URL}" "${EXPECTED_PROJECT_REF}" <<'PY'
import sys
from urllib.parse import parse_qs, unquote, urlparse

raw_url, project_ref = sys.argv[1], sys.argv[2]
try:
    parsed = urlparse(raw_url)
except ValueError:
    raise SystemExit(1)

if parsed.scheme.lower() not in {"postgres", "postgresql"}:
    raise SystemExit(1)

query = {key.lower() for key in parse_qs(parsed.query, keep_blank_values=True)}
if query.intersection({"host", "hostaddr", "service", "servicefile"}):
    raise SystemExit(1)

host = (parsed.hostname or "").lower().rstrip(".")
username = unquote(parsed.username or "")
direct_host = f"db.{project_ref}.supabase.co"
is_direct = host == direct_host
is_pooler = host.endswith(".pooler.supabase.com") and username == f"postgres.{project_ref}"

if not (is_direct or is_pooler):
    raise SystemExit(1)
PY
}

restore_database_is_isolated() {
  python3 - "${RESTORE_DB_URL}" <<'PY'
import sys
from urllib.parse import parse_qs, urlparse

raw_url = sys.argv[1]
try:
    parsed = urlparse(raw_url)
except ValueError:
    raise SystemExit(1)

if parsed.scheme.lower() not in {"postgres", "postgresql"}:
    raise SystemExit(1)

query = {key.lower() for key in parse_qs(parsed.query, keep_blank_values=True)}
if query.intersection({"host", "hostaddr", "service", "servicefile"}):
    raise SystemExit(1)

host = (parsed.hostname or "").lower().rstrip(".")
if host not in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit(1)
PY
}

classify_schema_restore_error() {
  local file="$1"
  if grep -Eqi 'role .* does not exist|must be member of role|permission denied to set role' "${file}"; then
    printf '%s' role_dependency
  elif grep -Eqi 'permission denied|must be owner|not permitted' "${file}"; then
    printf '%s' permission
  elif grep -Eqi 'already exists|duplicate object' "${file}"; then
    printf '%s' preexisting_object
  elif grep -Eqi 'extension .* is not available|could not open extension control file' "${file}"; then
    printf '%s' extension_dependency
  elif grep -Eqi 'relation .* does not exist|type .* does not exist|function .* does not exist' "${file}"; then
    printf '%s' dependency_missing
  elif grep -Eqi 'syntax error|invalid command' "${file}"; then
    printf '%s' sql_compatibility
  else
    printf '%s' command_failure
  fi
}

classify_data_restore_error() {
  local file="$1"
  if grep -Eqi 'duplicate key|unique constraint' "${file}"; then
    printf '%s' data_conflict
  elif grep -Eqi 'violates foreign key|violates check constraint|not-null constraint|null value in column' "${file}"; then
    printf '%s' constraint_violation
  elif grep -Eqi 'relation .* does not exist|type .* does not exist|function .* does not exist' "${file}"; then
    printf '%s' dependency_missing
  elif grep -Eqi 'permission denied|must be owner|not permitted' "${file}"; then
    printf '%s' permission
  else
    printf '%s' command_failure
  fi
}

mark_stage validation
[[ -n "${SOURCE_DB_URL:-}" ]] || fail "Missing GitHub Actions secret MADARSA_ERP_DATABASE_URL."
[[ -n "${RECOVERY_PASSPHRASE:-}" ]] || fail "Missing GitHub Actions secret MADARSA_ERP_RECOVERY_PASSPHRASE."
[[ ${#RECOVERY_PASSPHRASE} -ge 24 ]] || fail "Recovery passphrase must be at least 24 characters."
[[ -n "${RESTORE_DB_URL:-}" ]] || fail "RESTORE_DB_URL is required."

require_command python3
source_database_is_expected || fail_with_classification "Database URL does not point to the approved Madarsa ERP Supabase project endpoint." source_endpoint_validation
restore_database_is_isolated || fail_with_classification "Restore target must resolve directly to localhost, 127.0.0.1, or ::1 with no host/service override." restore_endpoint_validation

if ! [[ "${TARGET_RPO_HOURS:-24}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  fail "target_rpo_hours must be a positive number."
fi
if ! awk -v target="${TARGET_RPO_HOURS:-24}" 'BEGIN { exit !(target > 0) }'; then
  fail "target_rpo_hours must be greater than zero."
fi

for recovery_command in supabase psql openssl jq tar sha256sum awk date; do
  require_command "${recovery_command}"
done

snapshot_counts() {
  local db_url="$1"
  psql "${db_url}" -X -v ON_ERROR_STOP=1 -Atc "
    select jsonb_build_object(
      'tenants', (select count(*) from public.tenants),
      'branches', (select count(*) from public.branches),
      'persons', (select count(*) from public.persons),
      'student_profiles', (select count(*) from public.student_profiles),
      'enrollments', (select count(*) from public.enrollments),
      'attendance_records', (select count(*) from public.attendance_records),
      'memberships', (select count(*) from public.memberships),
      'documents', (select count(*) from public.documents)
    )::text;
  "
}

schema_metrics() {
  local db_url="$1"
  psql "${db_url}" -X -v ON_ERROR_STOP=1 -Atc "
    select jsonb_build_object(
      'public_tables', (select count(*) from pg_tables where schemaname = 'public'),
      'public_private_functions', (
        select count(*)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','private')
      ),
      'public_policies', (select count(*) from pg_policies where schemaname = 'public')
    )::text;
  "
}

run_supabase_dump() {
  local dump_name="$1"
  shift
  if ! supabase db dump --db-url "${SOURCE_DB_URL}" "$@" > /dev/null 2> "${WORK_DIR}/${dump_name}.stderr"; then
    fail_with_classification "Supabase ${dump_name} dump failed; command output was withheld from logs because it may contain connection metadata." source_dump_failure
  fi
  rm -f "${WORK_DIR}/${dump_name}.stderr"
}

mark_stage source_snapshot
SOURCE_SNAPSHOT_EPOCH="$(psql "${SOURCE_DB_URL}" -X -v ON_ERROR_STOP=1 -Atc "select floor(extract(epoch from clock_timestamp()))::bigint;")"
SOURCE_COUNTS="$(snapshot_counts "${SOURCE_DB_URL}")"
SOURCE_SCHEMA_METRICS="$(schema_metrics "${SOURCE_DB_URL}")"

DUMP_STARTED_EPOCH="$(date +%s)"
mark_stage roles_dump
run_supabase_dump roles -f "${BACKUP_DIR}/roles.sql" --role-only
mark_stage schema_dump
run_supabase_dump schema -f "${BACKUP_DIR}/schema.sql"
mark_stage data_dump
run_supabase_dump data -f "${BACKUP_DIR}/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
DUMP_COMPLETED_EPOCH="$(date +%s)"

mark_stage checksum
(
  cd "${BACKUP_DIR}"
  sha256sum roles.sql schema.sql data.sql > "${OUTPUT_DIR}/checksums.sha256"
)

mark_stage archive_encryption
tar -C "${BACKUP_DIR}" -czf "${WORK_DIR}/database-backup.tar.gz" roles.sql schema.sql data.sql
BACKUP_DIGEST="$(sha256sum "${WORK_DIR}/database-backup.tar.gz" | awk '{print $1}')"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:RECOVERY_PASSPHRASE \
  -in "${WORK_DIR}/database-backup.tar.gz" \
  -out "${OUTPUT_DIR}/database-backup.tar.gz.enc"
rm -f "${WORK_DIR}/database-backup.tar.gz"

mark_stage decrypt_digest
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:RECOVERY_PASSPHRASE \
  -in "${OUTPUT_DIR}/database-backup.tar.gz.enc" \
  -out "${WORK_DIR}/restore-input.tar.gz"
[[ "$(sha256sum "${WORK_DIR}/restore-input.tar.gz" | awk '{print $1}')" == "${BACKUP_DIGEST}" ]] || fail_with_classification "Encrypted backup round-trip digest mismatch." digest_mismatch

mark_stage archive_extract
tar -C "${RESTORE_DIR}" -xzf "${WORK_DIR}/restore-input.tar.gz"
rm -f "${WORK_DIR}/restore-input.tar.gz"

RESTORE_STARTED_EPOCH="$(date +%s)"
# A fresh Supabase restore image bootstraps its own managed roles. Preserve roles.sql in the
# encrypted backup, but do not replay provider-managed ALTER ROLE statements into the isolated
# target. Restore schema and data as separate stages so failures are diagnosable without exposing SQL.
mark_stage local_schema_restore
if ! psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "${RESTORE_DIR}/schema.sql" \
  --dbname "${RESTORE_DB_URL}" \
  > /dev/null 2> "${WORK_DIR}/local-schema.stderr"; then
  SCHEMA_CLASSIFICATION="$(classify_schema_restore_error "${WORK_DIR}/local-schema.stderr")"
  rm -f "${WORK_DIR}/local-schema.stderr"
  fail_with_classification "Isolated schema restore failed; raw PostgreSQL output was withheld from logs." "${SCHEMA_CLASSIFICATION}"
fi
rm -f "${WORK_DIR}/local-schema.stderr"

mark_stage local_data_restore
if ! psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file "${RESTORE_DIR}/data.sql" \
  --dbname "${RESTORE_DB_URL}" \
  > /dev/null 2> "${WORK_DIR}/local-data.stderr"; then
  DATA_CLASSIFICATION="$(classify_data_restore_error "${WORK_DIR}/local-data.stderr")"
  rm -f "${WORK_DIR}/local-data.stderr"
  fail_with_classification "Isolated data restore failed; raw PostgreSQL output was withheld from logs." "${DATA_CLASSIFICATION}"
fi
rm -f "${WORK_DIR}/local-data.stderr"
RESTORE_COMPLETED_EPOCH="$(date +%s)"

mark_stage restored_counts
RESTORED_COUNTS="$(snapshot_counts "${RESTORE_DB_URL}")"
mark_stage restored_schema_metrics
RESTORED_SCHEMA_METRICS="$(schema_metrics "${RESTORE_DB_URL}")"

# Aggregate counts and schema metrics are safe diagnostic evidence. They contain no row contents,
# credentials, connection strings, or raw SQL.
jq -n \
  --argjson source_counts "${SOURCE_COUNTS}" \
  --argjson restored_counts "${RESTORED_COUNTS}" \
  --argjson source_schema_metrics "${SOURCE_SCHEMA_METRICS}" \
  --argjson restored_schema_metrics "${RESTORED_SCHEMA_METRICS}" \
  '{
    source_counts: $source_counts,
    restored_counts: $restored_counts,
    source_schema_metrics: $source_schema_metrics,
    restored_schema_metrics: $restored_schema_metrics
  }' > "${VERIFICATION_SUMMARY_FILE}"

mark_stage equality_verification
SOURCE_COUNTS_CANON="$(printf '%s' "${SOURCE_COUNTS}" | jq -cS .)"
RESTORED_COUNTS_CANON="$(printf '%s' "${RESTORED_COUNTS}" | jq -cS .)"
SOURCE_SCHEMA_METRICS_CANON="$(printf '%s' "${SOURCE_SCHEMA_METRICS}" | jq -cS .)"
RESTORED_SCHEMA_METRICS_CANON="$(printf '%s' "${RESTORED_SCHEMA_METRICS}" | jq -cS .)"
[[ "${SOURCE_COUNTS_CANON}" == "${RESTORED_COUNTS_CANON}" ]] || fail_with_classification "Restored core row counts do not match the source snapshot." row_count_mismatch
[[ "${SOURCE_SCHEMA_METRICS_CANON}" == "${RESTORED_SCHEMA_METRICS_CANON}" ]] || fail_with_classification "Restored schema metrics do not match the source snapshot." schema_metric_mismatch

mark_stage rpo_rto
MEASURED_RPO_HOURS="$(awk -v end="${DUMP_COMPLETED_EPOCH}" -v snap="${SOURCE_SNAPSHOT_EPOCH}" 'BEGIN { printf "%.4f", (end-snap)/3600 }')"
MEASURED_RTO_HOURS="$(awk -v end="${RESTORE_COMPLETED_EPOCH}" -v start="${RESTORE_STARTED_EPOCH}" 'BEGIN { printf "%.4f", (end-start)/3600 }')"

if ! awk -v measured="${MEASURED_RPO_HOURS}" -v target="${TARGET_RPO_HOURS:-24}" 'BEGIN { exit !(measured <= target) }'; then
  fail_with_classification "Measured RPO ${MEASURED_RPO_HOURS}h exceeds target ${TARGET_RPO_HOURS}h." rpo_target_miss
fi

mark_stage evidence
PROVIDER_REFERENCE="github-actions:${GITHUB_REPOSITORY:-unknown}:${GITHUB_RUN_ID:-local}:${GITHUB_RUN_ATTEMPT:-1}"
DRILL_REASON_SAFE="${DRILL_REASON:-manual recovery verification}"

jq -n \
  --arg provider_reference "${PROVIDER_REFERENCE}" \
  --arg project_ref "${EXPECTED_PROJECT_REF}" \
  --arg source_snapshot_epoch "${SOURCE_SNAPSHOT_EPOCH}" \
  --arg dump_started_epoch "${DUMP_STARTED_EPOCH}" \
  --arg dump_completed_epoch "${DUMP_COMPLETED_EPOCH}" \
  --arg restore_started_epoch "${RESTORE_STARTED_EPOCH}" \
  --arg restore_completed_epoch "${RESTORE_COMPLETED_EPOCH}" \
  --arg measured_rpo_hours "${MEASURED_RPO_HOURS}" \
  --arg measured_rto_hours "${MEASURED_RTO_HOURS}" \
  --arg target_rpo_hours "${TARGET_RPO_HOURS:-24}" \
  --arg backup_digest "${BACKUP_DIGEST}" \
  --arg reason "${DRILL_REASON_SAFE}" \
  --argjson source_counts "${SOURCE_COUNTS}" \
  --argjson restored_counts "${RESTORED_COUNTS}" \
  --argjson source_schema_metrics "${SOURCE_SCHEMA_METRICS}" \
  --argjson restored_schema_metrics "${RESTORED_SCHEMA_METRICS}" \
  '{
    schema_version: 1,
    provider_reference: $provider_reference,
    project_ref: $project_ref,
    scope: "database_logical_schema_data_restore",
    reason: $reason,
    backup: {
      encrypted: true,
      roles_dump_preserved: true,
      digest_sha256: $backup_digest,
      source_snapshot_epoch: ($source_snapshot_epoch | tonumber),
      started_epoch: ($dump_started_epoch | tonumber),
      completed_epoch: ($dump_completed_epoch | tonumber)
    },
    restore: {
      isolated_target: true,
      managed_roles_replayed: false,
      started_epoch: ($restore_started_epoch | tonumber),
      completed_epoch: ($restore_completed_epoch | tonumber),
      database_verified: true,
      storage_verified: false,
      application_verified: false
    },
    objectives: {
      target_rpo_hours: ($target_rpo_hours | tonumber),
      measured_rpo_hours: ($measured_rpo_hours | tonumber),
      measured_rto_hours: ($measured_rto_hours | tonumber)
    },
    verification: {
      source_counts: $source_counts,
      restored_counts: $restored_counts,
      source_schema_metrics: $source_schema_metrics,
      restored_schema_metrics: $restored_schema_metrics
    },
    launch_gate: {
      backup_restore_drill_passed: false,
      gate_can_be_closed: false,
      reason: "Database schema/data recovery is proven by this workflow; provider-managed roles, storage, and application verification remain separate and must not be fabricated."
    }
  }' > "${OUTPUT_DIR}/evidence.json"

mark_stage cleanup
rm -rf "${BACKUP_DIR}" "${RESTORE_DIR}"

CURRENT_STAGE="complete"
write_stage_status success none

echo "Database recovery drill completed: encrypted logical backup schema/data restored into an isolated Supabase Postgres target."
echo "Measured RPO: ${MEASURED_RPO_HOURS}h; measured RTO: ${MEASURED_RTO_HOURS}h."
echo "Commercial backup_restore_drill_passed remains false until provider-managed roles, storage, and application scope are separately verified."
