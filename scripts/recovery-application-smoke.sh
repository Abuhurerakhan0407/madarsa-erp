#!/usr/bin/env bash
set -Eeuo pipefail

OUTPUT_DIR_INPUT="${RECOVERY_OUTPUT_DIR:-recovery-drill-output}"
OUTPUT_DIR="$(mkdir -p "${OUTPUT_DIR_INPUT}" && cd "${OUTPUT_DIR_INPUT}" && pwd)"
EVIDENCE_FILE="${OUTPUT_DIR}/evidence.json"
APPLICATION_EVIDENCE_FILE="${OUTPUT_DIR}/application-smoke.json"
LOCAL_SUPABASE_WORKDIR="${LOCAL_SUPABASE_WORKDIR:-}"
APP_PORT="${RECOVERY_APP_PORT:-3100}"
STATUS_FILE="$(mktemp)"
BODY_FILE="$(mktemp)"
APP_LOG="$(mktemp)"
APP_PID=""

cleanup() {
  if [[ -n "${APP_PID}" ]] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
  rm -f "${STATUS_FILE}" "${BODY_FILE}" "${APP_LOG}"
}
trap cleanup EXIT

fail() {
  echo "::error::$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required application-recovery command '$1' is not installed."
}

for command_name in supabase pnpm curl jq python3; do
  require_command "${command_name}"
done

[[ -n "${LOCAL_SUPABASE_WORKDIR}" ]] || fail "LOCAL_SUPABASE_WORKDIR is required."
[[ -f "${EVIDENCE_FILE}" ]] || fail "Database recovery evidence must exist before application verification."

# The application may close the commercial recovery gate only after every non-application
# recovery scope has already been proven by the same isolated run.
for prerequisite in database_verified auth_verified managed_role_baseline_verified storage_verified; do
  jq -e --arg key "${prerequisite}" '.restore[$key] == true' "${EVIDENCE_FILE}" > /dev/null || \
    fail "Recovery prerequisite '${prerequisite}' is not verified; application smoke cannot close the gate."
done
jq -e '.restore.storage_blob_restore_required == false' "${EVIDENCE_FILE}" > /dev/null || \
  fail "Storage blob restoration is required for this snapshot; application smoke cannot close the gate."

supabase status -o env --workdir "${LOCAL_SUPABASE_WORKDIR}" > "${STATUS_FILE}"
chmod 600 "${STATUS_FILE}"

read_env_value() {
  local key="$1"
  python3 - "${STATUS_FILE}" "${key}" <<'PY'
import ast
import sys

path, key = sys.argv[1], sys.argv[2]
prefix = f"{key}="
with open(path, "r", encoding="utf-8") as handle:
    for raw_line in handle:
        line = raw_line.strip()
        if not line.startswith(prefix):
            continue
        value = line[len(prefix):].strip()
        if value.startswith(("'", '"')):
            try:
                value = ast.literal_eval(value)
            except (SyntaxError, ValueError):
                raise SystemExit(2)
        if not isinstance(value, str) or not value:
            raise SystemExit(3)
        print(value, end="")
        raise SystemExit(0)
raise SystemExit(1)
PY
}

LOCAL_API_URL="$(read_env_value API_URL)" || fail "Unable to read local Supabase API URL."
LOCAL_ANON_KEY="$(read_env_value ANON_KEY)" || fail "Unable to read local Supabase anon key."
LOCAL_SERVICE_ROLE_KEY="$(read_env_value SERVICE_ROLE_KEY)" || fail "Unable to read local Supabase service-role key."

python3 - "${LOCAL_API_URL}" <<'PY' || fail "Local Supabase API URL must resolve directly to loopback."
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
if parsed.scheme not in {"http", "https"}:
    raise SystemExit(1)
if (parsed.hostname or "").lower() not in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit(1)
PY

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "::add-mask::${LOCAL_ANON_KEY}"
  echo "::add-mask::${LOCAL_SERVICE_ROLE_KEY}"
fi

export NEXT_PUBLIC_SUPABASE_URL="${LOCAL_API_URL}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${LOCAL_ANON_KEY}"
export SUPABASE_SECRET_KEY="${LOCAL_SERVICE_ROLE_KEY}"

# Invoke Next directly. Passing a second `--` through the package script caused the previous
# recovery run to terminate before the HTTP probe could start.
pnpm exec next dev --hostname 127.0.0.1 --port "${APP_PORT}" > "${APP_LOG}" 2>&1 &
APP_PID="$!"

APPLICATION_URL="http://127.0.0.1:${APP_PORT}/apply/abu-school?lang=en"
HTTP_STATUS=""
for _ in $(seq 1 60); do
  if ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
    jq -n '{schema_version: 1, application_verified: false, failure: "application_process_exited_before_probe"}' > "${APPLICATION_EVIDENCE_FILE}"
    fail "Restored application process exited before the read-only recovery probe completed."
  fi

  HTTP_STATUS="$(
    curl --silent --show-error \
      --request GET \
      --output "${BODY_FILE}" \
      --write-out '%{http_code}' \
      "${APPLICATION_URL}" 2>/dev/null || true
  )"

  if [[ "${HTTP_STATUS}" == "200" ]]; then
    break
  fi
  sleep 2
done

[[ "${HTTP_STATUS}" == "200" ]] || fail "Restored application read-only probe did not return HTTP 200."
grep -Fq "Al-Noor Islamic Academy" "${BODY_FILE}" || fail "Restored application response did not contain the expected tenant identity."
grep -Fq "Central Campus" "${BODY_FILE}" || fail "Restored application response did not contain the expected branch identity."

jq -n \
  --arg path "/apply/abu-school?lang=en" \
  --arg http_status "${HTTP_STATUS}" \
  '{
    schema_version: 1,
    method: "GET",
    path: $path,
    http_status: ($http_status | tonumber),
    tenant_identity_verified: true,
    branch_identity_verified: true,
    mutation_performed: false,
    application_verified: true
  }' > "${APPLICATION_EVIDENCE_FILE}"

TMP_EVIDENCE="$(mktemp)"
jq \
  --argjson application_verification "$(cat "${APPLICATION_EVIDENCE_FILE}")" \
  '.restore.application_verified = true
   | .application_verification = $application_verification
   | .launch_gate.backup_restore_drill_passed = true
   | .launch_gate.gate_can_be_closed = true
   | .launch_gate.reason = "Database restore, Auth identity counts, managed Supabase role baseline, current zero-blob Storage applicability/configuration, and a read-only restored application path all passed in the same isolated recovery run."' \
  "${EVIDENCE_FILE}" > "${TMP_EVIDENCE}"
mv "${TMP_EVIDENCE}" "${EVIDENCE_FILE}"

echo "Restored application recovery probe passed: GET /apply/abu-school returned the expected tenant and branch context."
echo "Commercial backup_restore_drill_passed evidence is true for this verified recovery snapshot."