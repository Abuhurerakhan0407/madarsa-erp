import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const failures = [];

async function source(path) { return readFile(new URL(path, root), "utf8"); }
function requireMatch(path, content, pattern, message) { if (!pattern.test(content)) failures.push(path + ": " + message); }
function forbidMatch(path, content, pattern, message) { if (pattern.test(content)) failures.push(path + ": " + message); }
async function requireMissing(path) {
  try {
    await access(new URL(path, root));
    failures.push(path + ": retired release surface still exists");
  } catch {}
}
async function requireExists(path) {
  try {
    await access(new URL(path, root));
  } catch {
    failures.push(path + ": required release surface is missing");
  }
}


for (const path of [
  "src/app/[locale]/admissions/page.tsx",
  "src/app/[locale]/students/page.tsx",
  "src/app/[locale]/programs/page.tsx",
  "src/app/[locale]/people-academics/page.tsx",
  "src/app/[locale]/attendance/page.tsx",
  "src/app/[locale]/staff/attendance/page.tsx",
  "src/app/[locale]/attendance/devices/page.tsx",
  "src/app/[locale]/quran/page.tsx",
  "src/app/[locale]/staff/page.tsx",
  "src/app/[locale]/portals/page.tsx",
  "src/app/api/portals/credentials/route.ts",
  "src/app/api/portals/access-state/route.ts",
  "src/app/[locale]/my-students/page.tsx",
  "src/app/[locale]/exams/page.tsx",
  "src/app/[locale]/reports/page.tsx",
  "src/app/[locale]/documents/page.tsx",
  "src/app/[locale]/access/page.tsx",
  "src/app/[locale]/settings/configuration/page.tsx",
  "src/app/[locale]/students/lifecycle/page.tsx",
  "src/app/[locale]/fees/page.tsx",
  "src/app/[locale]/contributions/page.tsx",
  "src/app/[locale]/payroll/page.tsx",
  "src/app/[locale]/assistant/page.tsx",
  "src/app/[locale]/hostel/page.tsx",
  "src/app/global-not-found.tsx",
  "src/app/api/documents/pdf/route.ts",
  "src/app/api/documents/student-status-certificate/[personId]/pdf/route.ts",
  "src/app/api/exams/report-card/[personId]/pdf/route.ts",
  "src/app/api/students/id-cards/pdf/route.ts",
  "src/app/[locale]/fees/receipt/[paymentId]/page.tsx",
  "src/app/[locale]/contributions/receipt/[contributionId]/page.tsx",
  "src/app/[locale]/payroll/payslip/[lineId]/page.tsx",
  "src/lib/attendance/biometric-bridge-agent.test.ts",
  "tools/biometric-bridge/src/core.mjs",
  "tools/biometric-bridge/src/reader.mjs",
  "tools/biometric-bridge/src/agent.mjs",
  "tools/biometric-bridge/build.mjs",
  "tools/biometric-bridge/smoke-test.mjs",
  "tools/biometric-bridge/config.example.json",
  "tools/biometric-bridge/install.ps1",
  "tools/biometric-bridge/status.ps1",
  "tools/biometric-bridge/uninstall.ps1",
  "tools/biometric-bridge/README.md"
]) await requireExists(path);

for (const path of [
  "supabase/migrations/20260903203000_phase10_documents_reports.sql",
  "supabase/migrations/20260915142500_phase5_student_photo_update_runtime.sql",
  "supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql",
  "supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql",
  "supabase/migrations/20260917043000_rescue_daily_ops_quran_privacy_hardening.sql",
  "supabase/migrations/20260917060000_rescue_daily_ops_quran_revision_branch_isolation.sql",
  "supabase/migrations/20260917060001_rescue04_academic_report_branch_isolation.sql",
  "supabase/migrations/20260917113000_portal_guardian_report_card_read.sql",
  "supabase/migrations/20260917114500_portal_guardian_documents.sql",
  "supabase/migrations/20260917174200_attendance_biometric_release_hardening.sql",
  "supabase/migrations/20260920230000_attendance_biometric_auto_apply_arrival.sql",
  "supabase/migrations/20260920234500_attendance_biometric_arrival_lookup_index.sql",
  "supabase/migrations/20260917181000_academic_domain_provenance_reconciliation.sql",
  "supabase/migrations/20260917200000_minimal_fees_runtime.sql",
  "supabase/migrations/20260917200001_minimal_fees_integrity_hardening.sql",
  "supabase/migrations/20260917201000_minimal_contributions_runtime.sql",
  "supabase/migrations/20260917202000_minimal_payroll_runtime.sql",
  "supabase/migrations/20260917202001_minimal_payroll_integrity_hardening.sql",
  "supabase/migrations/20260917203000_access_admin_identity_labels.sql",
  "supabase/migrations/20260917204000_operational_assistant_permission.sql",
  "supabase/migrations/20260917205000_commercial_permission_scope_hardening.sql",
  "supabase/migrations/20260918100000_retire_whatsapp_runtime.sql",
  "supabase/migrations/20260918101500_lock_release_locales_en_ur.sql",
  "supabase/migrations/20260918102000_lock_preferred_locales_en_ur.sql",
  "supabase/migrations/20260918102500_explicit_fail_closed_rls_policies.sql",
  "supabase/migrations/20260928100500_portal_push_deliveries_deny_client_policy.sql"
]) await requireExists(path);

const i18n = await source("src/lib/i18n/config.ts");
requireMatch("src/lib/i18n/config.ts", i18n, /locales\s*=\s*\["en",\s*"ur"\]/, "release locales must be EN/UR only");

const nav = await source("src/lib/navigation/client-v3-navigation.ts");
requireMatch("src/lib/navigation/client-v3-navigation.ts", nav, /item\("hostel",\s*"Hostel & Mess"/i, "Hostel & Mess must be present in release navigation");
forbidMatch("src/lib/navigation/client-v3-navigation.ts", nav, /whatsapp|transport|library|student\s+portal/i, "retired module leaked into release navigation");

const publicHome = await source("public/ilmgaah-home.html");
forbidMatch("public/ilmgaah-home.html", publicHome, /whatsapp|wa\.me/i, "retired WhatsApp dependency leaked into public release UI");

const ingest = await source("src/app/api/attendance/device-ingest/route.ts");
if (!ingest.includes('body.modality !== "biometric"')) failures.push("src/app/api/attendance/device-ingest/route.ts: device ingest must reject non-biometric modalities");
if (ingest.includes('modality !== "nfc"') || ingest.includes('modality === "nfc"')) failures.push("src/app/api/attendance/device-ingest/route.ts: NFC ingest handling returned");

const deviceUi = await source("src/components/attendance-device-center.tsx");
if (deviceUi.includes('value="nfc"') || deviceUi.includes('value="hybrid"')) failures.push("src/components/attendance-device-center.tsx: retired NFC/hybrid device option returned");

const credentials = await source("src/app/api/portals/credentials/route.ts");
for (const [pattern, message] of [
  [/isSameOriginRequest/, "credential mutation must enforce same-origin requests"],
  [/readBoundedJson\(request,\s*8192\)/, "credential request body must stay bounded"],
  [/portal\.credentials\.create/, "credential creation permission gate is missing"],
  [/record_portal_credential_audit_v1/, "credential security audit is missing"],
  [/must_change_password:\s*true/, "temporary credentials must force a password change"],
  [/link_portal_identity_v1/, "portal identity linking contract is missing"],
  [/cache-control[^\n]*no-store/i, "credential responses must remain non-cacheable"]
]) requireMatch("src/app/api/portals/credentials/route.ts", credentials, pattern, message);
forbidMatch("src/app/api/portals/credentials/route.ts", credentials, /randomBytes|Math\.random\s*\(/i, "server-generated password logic returned");

const conversion = await source("src/app/api/admissions/convert/route.ts");
requireMatch("src/app/api/admissions/convert/route.ts", conversion, /convert_admission_to_student_v3/, "admission conversion must use the v3 conversion contract");
forbidMatch("src/app/api/admissions/convert/route.ts", conversion, /createUser|temporaryPassword|generatedPassword|password\s*:/i, "admission conversion must never create or return portal passwords");

for (const path of [
  "src/app/api/portal/claim/route.ts",
  "src/app/api/portals/access/route.ts",
  "src/app/portal/claim/page.tsx",
  "src/components/portal-claim-form.tsx"
]) await requireMissing(path);

const claimMigration = await source("supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql");
requireMatch("supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql", claimMigration, /convert_admission_to_student_v3/, "claim-only database contract is missing");

const whatsappRetirement = await source("supabase/migrations/20260918100000_retire_whatsapp_runtime.sql");
requireMatch("supabase/migrations/20260918100000_retire_whatsapp_runtime.sql", whatsappRetirement, /drop function if exists public\.get_whatsapp_center_v1/i, "WhatsApp RPC retirement is missing");

for (const path of [
  "src/app/[locale]/communications/whatsapp/page.tsx",
  "src/app/[locale]/whatsapp/page.tsx",
  "src/app/[locale]/transport/page.tsx",
  "src/app/[locale]/library/page.tsx",
  "src/app/[locale]/student-portal/page.tsx",
  "src/app/[locale]/empty/page.tsx"
]) await requireMissing(path);

if (failures.length) {
  console.error("Release invariant check failed with " + failures.length + " issue(s):");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log("Release invariants passed: required modules/PDFs/migrations present; EN/UR, managed portal credentials, biometric-only attendance, retired commercial modules enforced.");
}
