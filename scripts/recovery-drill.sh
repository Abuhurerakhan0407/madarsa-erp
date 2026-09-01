#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"
OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-recovery-drill-output}"
mkdir -p "${OUTPUT_DIR_INPUT}"
OUTPUT_DIR="$(cd "${OUTPUT_DIR_INPUT}" && pwd)"
WORK_DIR="$(mktemp -d)"
BACKUP_DIR="${WORK_DIR}/backup"
RESTORE_DIR="${WORK_DIR}/restore"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT
umask 077
mkdir -p "${BACKUP_DIR}" "${RESTORE_DIR}"

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ -n "${SOURCE_DB_URL:-}" ]] || fail "Missing GitHub Actions secret MADARSA_ERP_DATABASE_URL."
[[ -n "${RECOVERY_PASSPHRASE:-}" ]] || fail "Missing GitHub Actions secret MADARSA_ERP_RECOVERY_PASSPHRASE."
[[ ${#RECOVERY_PASSPHRASE} -ge 24 ]] || fail "Recovery passphrase must be at least 24 characters."
[[ "${SOURCE_DB_URL}" == *"${EXPECTED_PROJECT_REF}"* ]] || fail "Database URL does not point to the Madarsa ERP Supabase project."
[[ -n "${RESTORE_DB_URL:-}" ]] || fail "RESTORE_DB_URL is required."
[[ "${RESTORE_DB_URL}" == *"127.0.0.1"* || "${RESTORE_DB_URL}" == *"localhost"* ]] || fail "Restore target must be local/isolated."

if ! [[ "${TARGET_RPO_HOURS:-24}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  fail "target_rpo_hours must be a positive number."
fi
if ! awk -v target="${TARGET_RPO_HOURS:-24}" 'BEGIN { exit !(target > 0) }'; then
  fail "target_rpo_hours must be greater than zero."
fi

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

SOURCE_SNAPSHOT_EPOCH="$(psql "${SOURCE_DB_URL}" -X -v ON_ERROR_STOP=1 -Atc "select floor(extract(epoch from clock_timestamp()))::bigint;")"
SOURCE_COUNTS="$(snapshot_counts "${SOURCE_DB_URL}")"
SOURCE_SCHEMA_METRICS="$(schema_metrics "${SOURCE_DB_URL}")"

DUMP_STARTED_EPOCH="$(date +%s)"
supabase db dump --db-url "${SOURCE_DB_URL}" -f "${BACKUP_DIR}/roles.sql" --role-only
supabase db dump --db-url "${SOURCE_DB_URL}" -f "${BACKUP_DIR}/schema.sql"
supabase db dump --db-url "${SOURCE_DB_URL}" -f "${BACKUP_DIR}/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
DUMP_COMPLETED_EPOCH="$(date +%s)"

(
  cd "${BACKUP_DIR}"
  sha256sum roles.sql schema.sql data.sql > "${OUTPUT_DIR}/checksums.sha256"
)

# Keep the dump encrypted outside the temporary workspace. Plain SQL never becomes an artifact.
tar -C "${BACKUP_DIR}" -czf "${WORK_DIR}/database-backup.tar.gz" roles.sql schema.sql data.sql
BACKUP_DIGEST="$(sha256sum "${WORK_DIR}/database-backup.tar.gz" | awk '{print $1}')"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:RECOVERY_PASSPHRASE \
  -in "${WORK_DIR}/database-backup.tar.gz" \
  -out "${OUTPUT_DIR}/database-backup.tar.gz.enc"
rm -f "${WORK_DIR}/database-backup.tar.gz"

# Prove that the encrypted artifact can be decrypted before attempting the restore.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:RECOVERY_PASSPHRASE \
  -in "${OUTPUT_DIR}/database-backup.tar.gz.enc" \
  -out "${WORK_DIR}/restore-input.tar.gz"
[[ "$(sha256sum "${WORK_DIR}/restore-input.tar.gz" | awk '{print $1}')" == "${BACKUP_DIGEST}" ]] || fail "Encrypted backup round-trip digest mismatch."
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
  --dbname "${RESTORE_DB_URL}"
RESTORE_COMPLETED_EPOCH="$(date +%s)"

RESTORED_COUNTS="$(snapshot_counts "${RESTORE_DB_URL}")"
RESTORED_SCHEMA_METRICS="$(schema_metrics "${RESTORE_DB_URL}")"

[[ "${SOURCE_COUNTS}" == "${RESTORED_COUNTS}" ]] || fail "Restored core row counts do not match the source snapshot."
[[ "${SOURCE_SCHEMA_METRICS}" == "${RESTORED_SCHEMA_METRICS}" ]] || fail "Restored schema metrics do not match the source snapshot."

MEASURED_RPO_HOURS="$(awk -v end="${DUMP_COMPLETED_EPOCH}" -v snap="${SOURCE_SNAPSHOT_EPOCH}" 'BEGIN { printf "%.4f", (end-snap)/3600 }')"
MEASURED_RTO_HOURS="$(awk -v end="${RESTORE_COMPLETED_EPOCH}" -v start="${RESTORE_STARTED_EPOCH}" 'BEGIN { printf "%.4f", (end-start)/3600 }')"

if ! awk -v measured="${MEASURED_RPO_HOURS}" -v target="${TARGET_RPO_HOURS:-24}" 'BEGIN { exit !(measured <= target) }'; then
  fail "Measured RPO ${MEASURED_RPO_HOURS}h exceeds target ${TARGET_RPO_HOURS}h."
fi

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
    scope: "database_logical_backup_restore",
    reason: $reason,
    backup: {
      encrypted: true,
      digest_sha256: $backup_digest,
      source_snapshot_epoch: ($source_snapshot_epoch | tonumber),
      started_epoch: ($dump_started_epoch | tonumber),
      completed_epoch: ($dump_completed_epoch | tonumber)
    },
    restore: {
      isolated_target: true,
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
      reason: "Database recovery is proven by this workflow; storage/application verification remains separate and must not be fabricated."
    }
  }' > "${OUTPUT_DIR}/evidence.json"

# Remove plaintext dump material before this step can hand control back to Actions artifact upload.
rm -rf "${BACKUP_DIR}" "${RESTORE_DIR}"

echo "Database recovery drill completed: encrypted logical backup restored into an isolated Supabase Postgres target."
echo "Measured RPO: ${MEASURED_RPO_HOURS}h; measured RTO: ${MEASURED_RTO_HOURS}h."
echo "Commercial backup_restore_drill_passed remains false until storage/application scope is separately verified."
