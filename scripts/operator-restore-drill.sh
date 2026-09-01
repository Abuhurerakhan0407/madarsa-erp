#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"
OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-operator-restore-output}"
mkdir -p "${OUTPUT_DIR_INPUT}"
OUTPUT_DIR="$(cd "${OUTPUT_DIR_INPUT}" && pwd)"
WORK_DIR="$(mktemp -d)"
RESTORE_DIR="${WORK_DIR}/restore"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT
umask 077
mkdir -p "${RESTORE_DIR}"

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ -n "${RESTORE_DB_URL:-}" ]] || fail "Missing required environment variable RESTORE_DB_URL."
[[ -n "${MADARSA_ERP_RECOVERY_PASSPHRASE:-}" ]] || fail "Missing required environment variable MADARSA_ERP_RECOVERY_PASSPHRASE."
[[ -n "${ENCRYPTED_BACKUP_PATH:-}" ]] || fail "Missing required environment variable ENCRYPTED_BACKUP_PATH."

[[ "${RESTORE_DB_URL}" == *"127.0.0.1"* || "${RESTORE_DB_URL}" == *"localhost"* ]] || fail "Restore target must be local/isolated (e.g. 127.0.0.1 or localhost)."
[[ -f "${ENCRYPTED_BACKUP_PATH}" ]] || fail "Encrypted backup file not found at ${ENCRYPTED_BACKUP_PATH}."

echo "Starting operator restore drill. Environment variables validated."

# Decrypt the backup
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:MADARSA_ERP_RECOVERY_PASSPHRASE \
  -in "${ENCRYPTED_BACKUP_PATH}" \
  -out "${WORK_DIR}/restore-input.tar.gz"

tar -C "${RESTORE_DIR}" -xzf "${WORK_DIR}/restore-input.tar.gz"
rm -f "${WORK_DIR}/restore-input.tar.gz"

RESTORE_STARTED_EPOCH="$(date +%s)"
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "${RESTORE_DIR}/roles.sql" \
  --file "${RESTORE_DIR}/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "${RESTORE_DIR}/data.sql" \
  --dbname "${RESTORE_DB_URL}" \
  > /dev/null
RESTORE_COMPLETED_EPOCH="$(date +%s)"

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

RESTORED_COUNTS="$(snapshot_counts "${RESTORE_DB_URL}")"
RESTORED_SCHEMA_METRICS="$(schema_metrics "${RESTORE_DB_URL}")"

jq -n \
  --arg restore_started_epoch "${RESTORE_STARTED_EPOCH}" \
  --arg restore_completed_epoch "${RESTORE_COMPLETED_EPOCH}" \
  --argjson restored_counts "${RESTORED_COUNTS}" \
  --argjson restored_schema_metrics "${RESTORED_SCHEMA_METRICS}" \
  '{
    schema_version: 1,
    restore: {
      isolated_target: true,
      started_epoch: ($restore_started_epoch | tonumber),
      completed_epoch: ($restore_completed_epoch | tonumber),
      database_verified: true,
      storage_verified: false,
      application_verified: false
    },
    verification: {
      restored_counts: $restored_counts,
      restored_schema_metrics: $restored_schema_metrics
    },
    launch_gate: {
      backup_restore_drill_passed: false,
      gate_can_be_closed: false,
      reason: "Database recovery is proven by this script; storage/application verification remains separate and must not be fabricated."
    }
  }' > "${OUTPUT_DIR}/restore-evidence.json"

echo "Restore drill completed successfully."
echo "Restored counts and metrics verified. Evidence written to: ${OUTPUT_DIR}/restore-evidence.json"
echo ""
echo "Next steps:"
echo "1. If this was an official restore drill, record the results in the 'restore_drills' table in production."
echo "2. The launch gate 'backup_restore_drill_passed' remains FALSE."
echo "   Do NOT fabricate evidence in production to flip this gate."
