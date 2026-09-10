import { NextResponse } from "next/server";

import {
  furkaniaDeeniyatLevels,
  furkaniaDeeniyatProgram,
  furkaniaDeeniyatSubjects
} from "@/lib/client-profiles/furkania-deeniyat";
import { furkaniaProfile } from "@/lib/client-profiles/furkania";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type RpcObject = Record<string, unknown>;

const FURKANIA_TENANT_SLUG = "madrasa-e-furkania";

function asRpcObject(value: unknown): RpcObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RpcObject;
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function runtimeError(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "You do not have permission to configure Madrasa-e-Furkania academics." };
  }
  if (normalized.includes("invalid") || normalized.includes("required")) {
    return { status: 400, error: message };
  }
  return { status: 500, error: "Unable to bootstrap the Madrasa-e-Furkania Deeniyat structure." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }
  if (workspace.tenantSlug !== FURKANIA_TENANT_SLUG) {
    return NextResponse.json({ error: "This setup is not available in the active tenant." }, { status: 404 });
  }
  if (!workspace.branchId) {
    return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });
  }

  const admin = createAdminClient();
  const created = {
    program: false,
    levels: [] as string[],
    components: [] as string[]
  };
  const skipped = {
    program: false,
    levels: [] as string[],
    components: [] as string[]
  };

  const existingProgramResult = await admin
    .from("programs")
    .select("id,key,status")
    .eq("tenant_id", workspace.tenantId)
    .eq("key", furkaniaDeeniyatProgram.key)
    .maybeSingle();

  if (existingProgramResult.error) {
    return NextResponse.json(
      { error: "Unable to check the existing Deeniyat program." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  let programId = positiveId(existingProgramResult.data?.id);

  if (programId) {
    if (String(existingProgramResult.data?.status) !== "active") {
      return NextResponse.json(
        { error: "The existing Deeniyat Primary program is not active. Reactivate it before bootstrap." },
        { status: 409, headers: { "cache-control": "no-store" } }
      );
    }
    skipped.program = true;
  } else {
    const programResult = await admin.rpc("create_teaching_program_v1", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_key: furkaniaDeeniyatProgram.key,
      p_labels: furkaniaDeeniyatProgram.labels,
      p_descriptions: furkaniaDeeniyatProgram.descriptions,
      p_program_type: furkaniaDeeniyatProgram.programType,
      p_template_key: furkaniaDeeniyatProgram.templateKey
    });

    if (programResult.error) {
      const mapped = runtimeError(programResult.error.message);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: { "cache-control": "no-store" } });
    }

    programId = positiveId(asRpcObject(programResult.data)?.program_id);
    if (!programId) {
      return NextResponse.json(
        { error: "Deeniyat program creation returned an invalid program id." },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }
    created.program = true;
  }

  const levelsResult = await admin
    .from("academic_levels")
    .select("id,key,status")
    .eq("tenant_id", workspace.tenantId)
    .eq("program_id", programId);

  if (levelsResult.error) {
    return NextResponse.json(
      { error: "Unable to check existing Deeniyat courses." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const levelIdByKey = new Map<string, number>();
  for (const row of levelsResult.data ?? []) {
    const id = positiveId(row.id);
    if (id && String(row.status) === "active") levelIdByKey.set(String(row.key), id);
  }

  for (const level of furkaniaDeeniyatLevels) {
    const existingId = levelIdByKey.get(level.key);
    if (existingId) {
      skipped.levels.push(level.key);
      continue;
    }

    const levelResult = await admin.rpc("add_program_level_v1", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_program_id: programId,
      p_key: level.key,
      p_labels: level.labels,
      p_sequence: level.sequence
    });

    if (levelResult.error) {
      const mapped = runtimeError(levelResult.error.message);
      return NextResponse.json(
        { error: mapped.error, partial: { created, skipped } },
        { status: mapped.status, headers: { "cache-control": "no-store" } }
      );
    }

    const levelId = positiveId(asRpcObject(levelResult.data)?.level_id);
    if (!levelId) {
      return NextResponse.json(
        { error: `Course setup returned an invalid id for ${level.key}.`, partial: { created, skipped } },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }
    levelIdByKey.set(level.key, levelId);
    created.levels.push(level.key);
  }

  const subjectsResult = await admin
    .from("subjects")
    .select("id,key")
    .eq("tenant_id", workspace.tenantId)
    .eq("status", "active");

  if (subjectsResult.error) {
    return NextResponse.json(
      { error: "Unable to check existing Deeniyat subjects.", partial: { created, skipped } },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const subjectIdByKey = new Map<string, number>();
  for (const row of subjectsResult.data ?? []) {
    const id = positiveId(row.id);
    if (id) subjectIdByKey.set(String(row.key), id);
  }

  // add_curriculum_component_v1 creates a draft by cloning the latest published
  // curriculum when no draft exists. Check the same effective source first so
  // a bootstrap after publication does not duplicate cloned components.
  const versionsResult = await admin
    .from("curriculum_versions")
    .select("id,state,version")
    .eq("tenant_id", workspace.tenantId)
    .eq("program_id", programId)
    .order("version", { ascending: false });

  if (versionsResult.error) {
    return NextResponse.json(
      { error: "Unable to inspect the Deeniyat curriculum version.", partial: { created, skipped } },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const versions = versionsResult.data ?? [];
  const effectiveVersion = versions.find((row) => String(row.state) === "draft")
    ?? versions.find((row) => String(row.state) === "published")
    ?? null;
  const effectiveVersionId = positiveId(effectiveVersion?.id);

  const existingComponentPairs = new Set<string>();
  if (effectiveVersionId) {
    const itemsResult = await admin
      .from("curriculum_version_items")
      .select("level_id,subject_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("curriculum_version_id", effectiveVersionId);

    if (itemsResult.error) {
      return NextResponse.json(
        { error: "Unable to inspect existing Deeniyat curriculum components.", partial: { created, skipped } },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    for (const item of itemsResult.data ?? []) {
      const levelId = positiveId(item.level_id);
      const subjectId = positiveId(item.subject_id);
      if (levelId && subjectId) existingComponentPairs.add(`${levelId}:${subjectId}`);
    }
  }

  for (const level of furkaniaDeeniyatLevels) {
    const levelId = levelIdByKey.get(level.key);
    if (!levelId) continue;

    for (const subject of furkaniaDeeniyatSubjects) {
      const knownSubjectId = subjectIdByKey.get(subject.key);
      const pair = knownSubjectId ? `${levelId}:${knownSubjectId}` : null;
      const componentKey = `${level.key}:${subject.key}`;

      if (pair && existingComponentPairs.has(pair)) {
        skipped.components.push(componentKey);
        continue;
      }

      const componentResult = await admin.rpc("add_curriculum_component_v1", {
        p_identity_id: identity.id,
        p_tenant_id: workspace.tenantId,
        p_branch_id: workspace.branchId,
        p_program_id: programId,
        p_level_id: levelId,
        p_subject_key: subject.key,
        p_subject_labels: subject.labels,
        p_subject_type: subject.subjectType,
        p_progress_method: subject.progressMethod,
        p_unit_structure: subject.unitStructure
      });

      if (componentResult.error) {
        const mapped = runtimeError(componentResult.error.message);
        return NextResponse.json(
          { error: mapped.error, partial: { created, skipped } },
          { status: mapped.status, headers: { "cache-control": "no-store" } }
        );
      }

      const rpcData = asRpcObject(componentResult.data);
      const subjectId = positiveId(rpcData?.subject_id);
      if (subjectId) {
        subjectIdByKey.set(subject.key, subjectId);
        existingComponentPairs.add(`${levelId}:${subjectId}`);
      }
      created.components.push(componentKey);
    }
  }

  const changed = created.program || created.levels.length > 0 || created.components.length > 0;

  return NextResponse.json(
    {
      client: furkaniaProfile.displayName,
      programId,
      changed,
      created,
      skipped,
      timetableCreated: false,
      timetableStatus: "blocked_until_exact_shift_times_are_confirmed",
      pendingClientDetails: furkaniaProfile.pendingClientDetails
    },
    { status: changed ? 201 : 200, headers: { "cache-control": "no-store" } }
  );
}
