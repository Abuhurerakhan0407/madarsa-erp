#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"
OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-operator-backup-output}"
mkdir -p "${OUTPUT_DIR_INPUT}"
OUTPUT_DIR="$(cd "${OUTPUT_DIR_INPUT}" && pwd)"
WORK_DIR="$(mktemp -d)"
BACKUP_DIR="${WORK_DIR}/backup"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT
umask 077
mkdir -p "${BACKUP_DIR}"

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ -n "${MADARSA_ERP_DATABASE_URL:-}" ]] || fail "Missing required environment variable MADARSA_ERP_DATABASE_URL."
[[ -n "${MADARSA_ERP_RECOVERY_PASSPHRASE:-}" ]] || fail "Missing required environment variable MADARSA_ERP_RECOVERY_PASSPHRASE."
[[ ${#MADARSA_ERP_RECOVERY_PASSPHRASE} -ge 24 ]] || fail "Recovery passphrase must be at least 24 characters."
[[ "${MADARSA_ERP_DATABASE_URL}" == *"${EXPECTED_PROJECT_REF}"* ]] || fail "Database URL does not point to the Madarsa ERP Supabase project."

echo "Starting operator backup. Environment variables validated."

DUMP_STARTED_EPOCH="$(date +%s)"
# Capture output but do not print secrets. If it fails, supabase prints to stderr.
supabase db dump --db-url "${MADARSA_ERP_DATABASE_URL}" -f "${BACKUP_DIR}/roles.sql" --role-only > /dev/null
supabase db dump --db-url "${MADARSA_ERP_DATABASE_URL}" -f "${BACKUP_DIR}/schema.sql" > /dev/null
supabase db dump --db-url "${MADARSA_ERP_DATABASE_URL}" -f "${BACKUP_DIR}/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes" > /dev/null
DUMP_COMPLETED_EPOCH="$(date +%s)"

(
  cd "${BACKUP_DIR}"
  sha256sum roles.sql schema.sql data.sql > "${OUTPUT_DIR}/checksums.sha256"
)

tar -C "${BACKUP_DIR}" -czf "${WORK_DIR}/database-backup.tar.gz" roles.sql schema.sql data.sql
BACKUP_DIGEST="$(sha256sum "${WORK_DIR}/database-backup.tar.gz" | awk '{print $1}')"

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:MADARSA_ERP_RECOVERY_PASSPHRASE \
  -in "${WORK_DIR}/database-backup.tar.gz" \
  -out "${OUTPUT_DIR}/database-backup.tar.gz.enc"

rm -f "${WORK_DIR}/database-backup.tar.gz"

echo "Backup completed successfully."
echo "Encrypted backup saved to: ${OUTPUT_DIR}/database-backup.tar.gz.enc"
echo "Digest: ${BACKUP_DIGEST}"
echo "Started at epoch: ${DUMP_STARTED_EPOCH}, completed at epoch: ${DUMP_COMPLETED_EPOCH}."
echo ""
echo "Next steps:"
echo "1. Upload ${OUTPUT_DIR}/database-backup.tar.gz.enc to secure cold storage."
echo "2. Add a record in the 'backup_evidence' table if this is an official backup run."
echo "   Do NOT fabricate evidence in production."
