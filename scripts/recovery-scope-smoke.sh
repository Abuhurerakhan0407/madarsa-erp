#!/usr/bin/env bash
set -Eeuo pipefail

OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-recovery-drill-output}"
OUTPUT_DIR="$(mkdir -p "${OUTPUT_DIR_INPUT}" && cd "${OUTPUT_DIR_INPUT}" && pwd)"
EVIDENCE_FILE="${OUTPUT_DIR}/evidence.json"
SCOPE_EVIDENCE_FILE="${OUTPUT_DIR}/recovery-scope-smoke.json"
STORAGE_CONTRACT="database/contracts/phase2_storage.sql"
FUNCTION_ACL_CONTRACT="database/contracts/function_execution_acl.sql"

fail() {
  echo "::error::$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required recovery-scope command '$1' is not installed."
}

for command_name in psql jq sha256sum; do
  require_command "${command_name}"
done

[[ -n "${SOURCE_DB_URL:-}" ]] || fail "SOURCE_DB_URL is required."
[[ -n "${RESTORE_DB_URL:-}" ]] || fail "RESTORE_DB_URL is required."
[[ -f "${EVIDENCE_FILE}" ]] || fail "Database recovery evidence must exist before recovery-scope verification."
[[ -f "${STORAGE_CONTRACT}" ]] || fail "Storage recovery contract is missing."
[[ -f "${FUNCTION_ACL_CONTRACT}" ]] || fail "Function execution ACL recovery contract is missing."

query_value() {
  local db_url="$1"
  local sql="$2"
  psql "${db_url}" -X -v ON_ERROR_STOP=1 -Atc "${sql}"
}

canonical_json() {
  printf '%s' "$1" | jq -cS .
}

sha256_text() {
  printf '%s' "$1" | sha256sum | awk '{print $1}'
}

AUTH_SQL="select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'identities', (select count(*) from auth.identities)
)::text;"

ROLE_SQL="select coalesce(jsonb_agg(rolname order by rolname), '[]'::jsonb)::text
from pg_roles
where rolname in ('anon','authenticated','service_role','supabase_auth_admin','supabase_storage_admin');"

FUNCTION_ACL_SQL="select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'signature', format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
      'service_role_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'public_execute', has_function_privilege('public', p.oid, 'EXECUTE')
    ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  ),
  '[]'::jsonb
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private');"

PRIVILEGED_RPC_SQL="select coalesce(jsonb_build_object(
  'rpc', 'bootstrap_tenant',
  'service_role_execute', bool_or(has_function_privilege('service_role', p.oid, 'EXECUTE')),
  'anon_execute', bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')),
  'authenticated_execute', bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'public_execute', bool_or(has_function_privilege('public', p.oid, 'EXECUTE'))
), '{}'::jsonb)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'bootstrap_tenant';"

BUCKET_SQL="select coalesce((
  select jsonb_build_object(
    'id', id,
    'name', name,
    'public', public,
    'file_size_limit', file_size_limit,
    'allowed_mime_types', allowed_mime_types
  )
  from storage.buckets
  where id = 'tenant-documents'
), '{}'::jsonb)::text;"

POLICY_SQL="select coalesce(jsonb_agg(
  jsonb_build_object(
    'policyname', policyname,
    'cmd', cmd,
    'roles', roles,
    'qual', coalesce(qual, ''),
    'with_check', coalesce(with_check, '')
  ) order by policyname
), '[]'::jsonb)::text
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'tenant_documents_%';"

SOURCE_AUTH="$(query_value "${SOURCE_DB_URL}" "${AUTH_SQL}")"
RESTORED_AUTH="$(query_value "${RESTORE_DB_URL}" "${AUTH_SQL}")"
[[ "$(canonical_json "${SOURCE_AUTH}")" == "$(canonical_json "${RESTORED_AUTH}")" ]] || \
  fail "Restored Supabase Auth user/identity counts do not match production."

EXPECTED_ROLES='["anon","authenticated","service_role","supabase_auth_admin","supabase_storage_admin"]'
SOURCE_ROLES="$(query_value "${SOURCE_DB_URL}" "${ROLE_SQL}")"
RESTORED_ROLES="$(query_value "${RESTORE_DB_URL}" "${ROLE_SQL}")"
[[ "$(canonical_json "${SOURCE_ROLES}")" == "$(canonical_json "${EXPECTED_ROLES}")" ]] || \
  fail "Production is missing the required managed Supabase role baseline."
[[ "$(canonical_json "${RESTORED_ROLES}")" == "$(canonical_json "${EXPECTED_ROLES}")" ]] || \
  fail "Initialized recovery target is missing the required managed Supabase role baseline."

# The logical schema dump intentionally does not reproduce application EXECUTE ACLs. Reconstruct
# that reviewed security boundary from version control, then prove the complete public/private
# function matrix is identical to production. This fails closed if production ACLs drift from the
# reviewed contract or if any function remains broader after restore.
SOURCE_FUNCTION_ACL="$(query_value "${SOURCE_DB_URL}" "${FUNCTION_ACL_SQL}")"
SOURCE_FUNCTION_ACL_CANON="$(canonical_json "${SOURCE_FUNCTION_ACL}")"

[[ "$(printf '%s' "${SOURCE_FUNCTION_ACL}" | jq '[.[] | select(.public_execute == true or .anon_execute == true)] | length')" == "0" ]] || \
  fail "Production function ACL boundary exposes application functions to PUBLIC or anon; recovery gate cannot close."
[[ "$(printf '%s' "${SOURCE_FUNCTION_ACL}" | jq '[.[] | select(.schema == "public" and (.service_role_execute != true or .authenticated_execute == true))] | length')" == "0" ]] || \
  fail "Production public RPC boundary no longer matches the approved service-role-only convention."

if ! psql "${RESTORE_DB_URL}" -X -v ON_ERROR_STOP=1 -f "${FUNCTION_ACL_CONTRACT}" > /dev/null 2>&1; then
  fail "Unable to reconstruct the version-controlled function execution ACL contract in the isolated recovery target."
fi

RESTORED_FUNCTION_ACL="$(query_value "${RESTORE_DB_URL}" "${FUNCTION_ACL_SQL}")"
RESTORED_FUNCTION_ACL_CANON="$(canonical_json "${RESTORED_FUNCTION_ACL}")"
[[ "${SOURCE_FUNCTION_ACL_CANON}" == "${RESTORED_FUNCTION_ACL_CANON}" ]] || \
  fail "Restored application function execution ACL matrix does not match production."

EXPECTED_PRIVILEGED_RPC='{"rpc":"bootstrap_tenant","service_role_execute":true,"anon_execute":false,"authenticated_execute":false,"public_execute":false}'
SOURCE_PRIVILEGED_RPC="$(query_value "${SOURCE_DB_URL}" "${PRIVILEGED_RPC_SQL}")"
RESTORED_PRIVILEGED_RPC="$(query_value "${RESTORE_DB_URL}" "${PRIVILEGED_RPC_SQL}")"
[[ "$(canonical_json "${SOURCE_PRIVILEGED_RPC}")" == "$(canonical_json "${EXPECTED_PRIVILEGED_RPC}")" ]] || \
  fail "Production privileged RPC execution boundary does not match the approved service-role-only contract."
[[ "$(canonical_json "${RESTORED_PRIVILEGED_RPC}")" == "$(canonical_json "${EXPECTED_PRIVILEGED_RPC}")" ]] || \
  fail "Restored privileged RPC execution boundary does not match production."

FUNCTION_ACL_COUNT="$(printf '%s' "${SOURCE_FUNCTION_ACL}" | jq 'length')"
FUNCTION_ACL_DIGEST="$(sha256_text "${SOURCE_FUNCTION_ACL_CANON}")"

SOURCE_STORAGE_OBJECT_COUNT="$(query_value "${SOURCE_DB_URL}" "select count(*) from storage.objects where bucket_id = 'tenant-documents';")"
[[ "${SOURCE_STORAGE_OBJECT_COUNT}" =~ ^[0-9]+$ ]] || fail "Unable to establish production Storage object count."
if [[ "${SOURCE_STORAGE_OBJECT_COUNT}" != "0" ]]; then
  fail "Production Storage contains ${SOURCE_STORAGE_OBJECT_COUNT} tenant document object(s); blob backup/restore must be implemented and proven before this commercial recovery gate can close."
fi

SOURCE_BUCKET="$(query_value "${SOURCE_DB_URL}" "${BUCKET_SQL}")"
SOURCE_POLICIES="$(query_value "${SOURCE_DB_URL}" "${POLICY_SQL}")"
[[ "$(printf '%s' "${SOURCE_BUCKET}" | jq -r '.id // empty')" == "tenant-documents" ]] || \
  fail "Production tenant-documents Storage bucket is missing."
[[ "$(printf '%s' "${SOURCE_POLICIES}" | jq 'length')" == "4" ]] || \
  fail "Production tenant-documents Storage policy set is incomplete."

# Database logical dumps do not restore Storage blob bytes. Because production currently contains
# zero tenant-document blobs, reconstruct only the version-controlled bucket/policy contract in the
# isolated Supabase target and prove exact applicability. If blobs ever exist, the check above fails
# closed and requires a real blob backup/restore mechanism instead of synthetic evidence.
if ! psql "${RESTORE_DB_URL}" -X -v ON_ERROR_STOP=1 -f "${STORAGE_CONTRACT}" > /dev/null 2>&1; then
  fail "Unable to reconstruct the version-controlled Storage bucket/policy contract in the isolated recovery target."
fi

RESTORED_STORAGE_OBJECT_COUNT="$(query_value "${RESTORE_DB_URL}" "select count(*) from storage.objects where bucket_id = 'tenant-documents';")"
RESTORED_BUCKET="$(query_value "${RESTORE_DB_URL}" "${BUCKET_SQL}")"
RESTORED_POLICIES="$(query_value "${RESTORE_DB_URL}" "${POLICY_SQL}")"

[[ "${RESTORED_STORAGE_OBJECT_COUNT}" == "0" ]] || fail "Isolated recovery target unexpectedly contains tenant document blobs."
[[ "$(canonical_json "${SOURCE_BUCKET}")" == "$(canonical_json "${RESTORED_BUCKET}")" ]] || \
  fail "Recovered Storage bucket configuration does not match production."
[[ "$(canonical_json "${SOURCE_POLICIES}")" == "$(canonical_json "${RESTORED_POLICIES}")" ]] || \
  fail "Recovered Storage policy definitions do not match production."

jq -n \
  --argjson source_auth "${SOURCE_AUTH}" \
  --argjson restored_auth "${RESTORED_AUTH}" \
  --argjson managed_roles "${RESTORED_ROLES}" \
  --argjson privileged_rpc "${RESTORED_PRIVILEGED_RPC}" \
  --arg function_acl_count "${FUNCTION_ACL_COUNT}" \
  --arg function_acl_digest "${FUNCTION_ACL_DIGEST}" \
  --argjson source_bucket "${SOURCE_BUCKET}" \
  --argjson restored_bucket "${RESTORED_BUCKET}" \
  --argjson source_policies "${SOURCE_POLICIES}" \
  --argjson restored_policies "${RESTORED_POLICIES}" \
  --arg source_object_count "${SOURCE_STORAGE_OBJECT_COUNT}" \
  '{
    schema_version: 3,
    auth: {
      source: $source_auth,
      restored: $restored_auth,
      counts_match: true,
      managed_role_baseline: $managed_roles,
      managed_role_baseline_verified: true,
      function_acl_matrix: {
        function_count: ($function_acl_count | tonumber),
        sha256: $function_acl_digest,
        source_restored_match: true,
        public_or_anon_execute_count: 0
      },
      privileged_rpc_boundary: $privileged_rpc,
      privileged_rpc_boundary_verified: true
    },
    storage: {
      bucket: "tenant-documents",
      source_object_count: ($source_object_count | tonumber),
      blob_restore_required_for_snapshot: false,
      source_bucket: $source_bucket,
      restored_bucket: $restored_bucket,
      source_policies: $source_policies,
      restored_policies: $restored_policies,
      configuration_match: true,
      storage_verified: true
    }
  }' > "${SCOPE_EVIDENCE_FILE}"

TMP_EVIDENCE="$(mktemp)"
jq \
  --argjson scope_verification "$(cat "${SCOPE_EVIDENCE_FILE}")" \
  '.restore.database_verified = true
   | .restore.auth_verified = true
   | .restore.managed_role_baseline_verified = true
   | .restore.function_acl_matrix_verified = true
   | .restore.privileged_rpc_boundary_verified = true
   | .restore.storage_verified = true
   | .restore.storage_blob_restore_required = false
   | .recovery_scope_verification = $scope_verification
   | .launch_gate.backup_restore_drill_passed = false
   | .launch_gate.gate_can_be_closed = false
   | .launch_gate.reason = "Database, Auth identity counts, managed-role baseline, complete application function ACL matrix, privileged RPC boundary, and current zero-blob Storage applicability are verified; restored application verification remains required."' \
  "${EVIDENCE_FILE}" > "${TMP_EVIDENCE}"
mv "${TMP_EVIDENCE}" "${EVIDENCE_FILE}"

echo "Recovery scope verification passed: Auth identities, managed roles, complete application function ACLs, privileged RPC access boundary, and current zero-blob Storage configuration match production."
echo "Commercial backup_restore_drill_passed remains false until restored application/module verification also passes."
