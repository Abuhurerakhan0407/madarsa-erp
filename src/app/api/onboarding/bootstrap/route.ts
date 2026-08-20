import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const branchCodePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;

type BootstrapBody = {
  displayName?: unknown;
  institutionName?: unknown;
  slug?: unknown;
  branchName?: unknown;
  branchCode?: unknown;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const identity = await getVerifiedIdentity();

  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: BootstrapBody;

  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const displayName = cleanText(body.displayName);
  const institutionName = cleanText(body.institutionName);
  const slug = cleanText(body.slug).toLowerCase();
  const branchName = cleanText(body.branchName);
  const branchCode = (cleanText(body.branchCode) || "MAIN").toUpperCase();

  if (displayName.length < 2 || displayName.length > 160) {
    return NextResponse.json(
      { error: "Enter a valid display name." },
      { status: 400 }
    );
  }

  if (institutionName.length < 2 || institutionName.length > 160) {
    return NextResponse.json(
      { error: "Enter a valid institution name." },
      { status: 400 }
    );
  }

  if (!slugPattern.test(slug)) {
    return NextResponse.json(
      { error: "Institution URL can use lowercase letters, numbers, and hyphens only." },
      { status: 400 }
    );
  }

  if (branchName.length < 2 || branchName.length > 160) {
    return NextResponse.json(
      { error: "Enter a valid branch name." },
      { status: 400 }
    );
  }

  if (!branchCodePattern.test(branchCode)) {
    return NextResponse.json(
      { error: "Branch code can use A-Z, 0-9, underscore, and hyphen." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("bootstrap_tenant", {
    p_identity_id: identity.id,
    p_display_name: displayName,
    p_institution_name: institutionName,
    p_slug: slug,
    p_branch_name: branchName,
    p_branch_code: branchCode
  });

  if (error) {
    const duplicateSlug = error.code === "23505" && error.message.includes("slug");
    const alreadyOnboarded = error.message.includes("already onboarded");

    if (duplicateSlug) {
      return NextResponse.json(
        { error: "That institution URL is already taken." },
        { status: 409 }
      );
    }

    if (alreadyOnboarded) {
      return NextResponse.json(
        { error: "This account is already connected to an institution." },
        { status: 409 }
      );
    }

    console.error("Tenant bootstrap failed", {
      code: error.code,
      details: error.details,
      hint: error.hint
    });

    return NextResponse.json(
      { error: "Institution setup failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, context: data });
}
