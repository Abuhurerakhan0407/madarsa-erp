import { NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/config";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getStudentRegister } from "@/lib/students/register";
import { getTenantContext } from "@/lib/tenancy/context";

export async function GET(request: Request) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403, headers: { "cache-control": "no-store" } });
  if (await getNavigationAudience(workspace) !== "office") return NextResponse.json({ error: "Student search is not available for this account." }, { status: 403, headers: { "cache-control": "no-store" } });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const requestedLocale = url.searchParams.get("locale") ?? "en";
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  if (query.length < 2) return NextResponse.json({ results: [] }, { headers: { "cache-control": "no-store" } });

  try {
    const data = await getStudentRegister({ locale, query, status: "all", page: 1, pageSize: 8 });
    return NextResponse.json({ results: data.rows.map((row) => ({ personId: row.personId, name: row.name, nativeName: row.nativeName, studentNumber: row.studentNumber, status: row.status, program: row.program, group: row.group })) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Student search failed.";
    if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("active branch")) return NextResponse.json({ error: "Student search is not available for this account." }, { status: 403, headers: { "cache-control": "no-store" } });
    return NextResponse.json({ error: "Unable to search students." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
