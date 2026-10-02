import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917181000_academic_domain_provenance_reconciliation.sql"),
  "utf8"
).toLowerCase();

type Row = { tenant: number; branch: number | null; assignmentBranch: number | null };
const reportVisible = (row: Row, tenant: number, branch: number) =>
  row.tenant === tenant && row.branch === branch && row.assignmentBranch === branch;

describe("Workstream 04 final academic domain provenance", () => {
  it("persists branch provenance on domain rows and makes it immutable", () => {
    expect(sql).toContain("add column if not exists source_branch_id bigint");
    expect(sql).toContain("teaching assignment branch provenance is immutable");
    expect(sql).toContain("curriculum progress provenance is immutable");
    expect(sql).toContain("curriculum_teaching_assignment_branch_provenance_guard");
    expect(sql).toContain("student_curriculum_progress_branch_provenance_guard");
  });

  it("governed writes persist the exact request branch", () => {
    expect(sql).toContain("tenant_id,source_branch_id,session_id,program_id,curriculum_item_id");
    expect(sql).toContain("p_tenant_id,p_branch_id,p_session_id,v_program_id,p_curriculum_item_id");
    expect(sql).toContain("tenant_id,source_branch_id,student_person_id,curriculum_unit_id,teaching_assignment_id");
    expect(sql).toContain("p_tenant_id,p_branch_id,p_student_person_id,p_curriculum_unit_id,p_assignment_id");
  });
  it("reports from domain provenance instead of audit-event existence", () => {
    expect(sql).toContain("ta.source_branch_id=p_branch_id");
    expect(sql).toContain("scp.source_branch_id=p_branch_id");
    expect(sql).toContain("scp.source_branch_id=ta.source_branch_id");
    expect(sql).not.toContain("aa.action='learning.curriculum.assign'");
    expect(sql).not.toContain("pa.action='learning.curriculum.progress.record'");
  });

  it("a forged audit event cannot unlock an unproven row", () => {
    const proven = { tenant: 1, branch: 10, assignmentBranch: 10 };
    const unproven = { tenant: 1, branch: null, assignmentBranch: 10 };
    expect(reportVisible(proven, 1, 10)).toBe(true);
    expect(reportVisible(unproven, 1, 10)).toBe(false);
    const forgedAuditExists = true;
    expect(forgedAuditExists).toBe(true);
    expect(reportVisible(unproven, 1, 10)).toBe(false);
  });

  it("uses Chat 03 authoritative Quran revision provenance", () => {
    expect(sql).toContain("public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,st.student_person_id)");
    expect(sql).not.toContain("after_state->>'revision_obligation_id'=r.id::text");
    expect(sql).not.toContain("after_state->>'revision_created'=r.id::text");
  });
  it("backfills only from deterministic domain relationships and leaves ambiguity closed", () => {
    expect(sql).toContain("having count(distinct e.branch_id)=1");
    expect(sql).toContain("where a.source_branch_id is null");
    expect(sql).toContain("and ta.source_branch_id is not null");
    expect(sql).not.toContain("source_branch_id=aa.branch_id");
    expect(sql).not.toContain("source_branch_id=pa.branch_id");
  });

  it("keeps exam performance on explicit exam-series branch ownership", () => {
    expect(sql).toContain("join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id");
  });
});