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

const i18n = await source("src/lib/i18n/config.ts");
requireMatch("src/lib/i18n/config.ts", i18n, /locales\s*=\s*\["en",\s*"ur"\]/, "release locales must be EN/UR only");

const nav = await source("src/lib/navigation/client-v3-navigation.ts");
forbidMatch("src/lib/navigation/client-v3-navigation.ts", nav, /whatsapp|hostel|transport|library|student\s+portal/i, "retired module leaked into release navigation");

const credentials = await source("src/app/api/portals/credentials/route.ts");
requireMatch("src/app/api/portals/credentials/route.ts", credentials, /PORTAL_CREDENTIALS_RETIRED/, "temporary-password credential API must stay retired");
forbidMatch("src/app/api/portals/credentials/route.ts", credentials, /createUser|updateUserById|temporaryPassword|randomBytes/i, "staff password provisioning/reset logic returned");

const conversion = await source("src/app/api/admissions/convert/route.ts");
requireMatch("src/app/api/admissions/convert/route.ts", conversion, /convert_admission_to_student_v3/, "admission conversion must use claim-only v3 contract");
forbidMatch("src/app/api/admissions/convert/route.ts", conversion, /createUser|temporaryPassword|generatedPassword|password\s*:/i, "admission conversion must never create or return portal passwords");

const portalAdmin = await source("src/components/portal-admin-center.tsx");
requireMatch("src/components/portal-admin-center.tsx", portalAdmin, /Issue claim code/, "Access Center must expose claim-code activation");
forbidMatch("src/components/portal-admin-center.tsx", portalAdmin, /\/api\/portals\/credentials|temporary password|reset password/i, "Access Center must not expose staff password controls");

const claimMigration = await source("supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql");
requireMatch("supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql", claimMigration, /convert_admission_to_student_v3/, "claim-only database contract is missing");

const whatsappRetirement = await source("supabase/migrations/20260918100000_retire_whatsapp_runtime.sql");
requireMatch("supabase/migrations/20260918100000_retire_whatsapp_runtime.sql", whatsappRetirement, /drop function if exists public\.get_whatsapp_center_v1/i, "WhatsApp RPC retirement is missing");

for (const path of [
  "src/app/[locale]/communications/whatsapp/page.tsx",
  "src/app/[locale]/whatsapp/page.tsx",
  "src/app/[locale]/hostel/page.tsx",
  "src/app/[locale]/transport/page.tsx",
  "src/app/[locale]/library/page.tsx",
  "src/app/[locale]/student-portal/page.tsx"
]) await requireMissing(path);

if (failures.length) {
  console.error("Release invariant check failed with " + failures.length + " issue(s):");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log("Release invariants passed: EN/UR, claim-only portals, retired commercial modules.");
}
