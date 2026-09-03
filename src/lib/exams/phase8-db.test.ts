import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8").toLowerCase();
const core=read("supabase/migrations/20260903120000_client_v2_phase8_exams_results_v2.sql");
const report=read("supabase/migrations/20260903120500_client_v2_phase8_report_card_selection.sql");
const publishedAnalysis=read("supabase/migrations/20260903121000_client_v2_phase8_analysis_published_snapshots.sql");

describe("Phase 8 Exams & Results V2 database contracts",()=>{
  it("keeps exam setup configurable without replacing the governed result engine",()=>{
    expect(core).toContain("create_exam_series_v2");
    expect(core).toContain("p_exam_type text");
    expect(core).toContain("p_maximum_marks numeric default 100");
    expect(core).toContain("p_pass_marks numeric default 40");
    expect(core).toContain("p_grading_scale_version_id bigint default null");
    expect(core).toContain("p_ranking_enabled boolean default false");
    expect(core).toContain("'marks_open'");
  });
  it("selects a specific exam only inside the active branch",()=>{
    expect(core).toContain("get_exam_results_workspace_v3");
    expect(core).toContain("p_exam_series_id bigint default null");
    expect(core).toContain("es.branch_id=p_branch_id and es.id=p_exam_series_id");
    expect(core).toContain("exam series not available in this branch");
  });
  it("exposes read-only result analysis from immutable result snapshots",()=>{
    expect(core).toContain("get_exam_results_analysis_v1");
    expect(core).toContain("result_snapshots");
    expect(core).toContain("result_subject_snapshots");
    expect(core).toContain("grade_distribution");
    expect(core).toContain("pass_rate");
  });
  it("keeps published snapshots visible in analysis after publication",()=>{
    expect(publishedAnalysis).toContain("get_exam_results_analysis_v1");
    expect(publishedAnalysis).toContain("rs.state in('approved','published')");
    expect(publishedAnalysis).toContain("result_subject_snapshots");
  });
  it("keeps new public RPCs service-role-only",()=>{
    for(const fn of ["create_exam_series_v2","get_exam_setup_options_v2","get_exam_results_workspace_v3","get_exam_results_analysis_v1"]){
      expect(core).toContain(`revoke all on function public.${fn}`);
      expect(core).toContain(`grant execute on function public.${fn}`);
    }
    expect(publishedAnalysis).toContain("revoke all on function public.get_exam_results_analysis_v1");
    expect(publishedAnalysis).toContain("grant execute on function public.get_exam_results_analysis_v1");
    expect(report).toContain("revoke all on function public.get_exam_report_card_v2");
    expect(report).toContain("grant execute on function public.get_exam_report_card_v2");
  });
  it("binds report cards to the explicitly selected exam",()=>{
    expect(report).toContain("p_exam_series_id bigint");
    expect(report).toContain("rr.exam_series_id=p_exam_series_id");
    expect(report).toContain("rs.state='published'");
    expect(report).toContain("case when es.ranking_enabled then rs.rank_value else null end");
  });
});
