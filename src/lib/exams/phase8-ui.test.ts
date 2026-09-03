import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");

describe("Phase 8 Exams & Results V2 UI boundaries",()=>{
  it("routes the exams page through the focused six-action hub with exact exam selection",()=>{
    const page=read("src/app/[locale]/exams/page.tsx");
    expect(page).toContain("ExamsResultsV2Hub");
    expect(page).toContain('search.exam');
    expect(page).toContain("getExamWorkspace({examSeriesId:selectedExamId})");
    expect(page).toContain('"create","marks","results","reports","export","analysis"');
  });
  it("keeps result-state mutations on the existing governed APIs",()=>{
    const hub=read("src/components/exams-results-v2-hub.tsx");
    expect(hub).toContain('"/api/exams/mark"');
    expect(hub).toContain('"/api/exams/moderate"');
    expect(hub).toContain('"/api/exams/workflow"');
    expect(hub).toContain('"calculate"|"approve"|"publish"');
  });
  it("offers real selected-exam exports rather than placeholder actions",()=>{
    const hub=read("src/components/exams-results-v2-hub.tsx");
    const csv=read("src/app/api/exams/export/[examId]/route.ts");
    const print=read("src/app/[locale]/exams/print/[examId]/page.tsx");
    expect(hub).toContain("/api/exams/export/");
    expect(hub).toContain("/exams/print/");
    expect(csv).toContain("text/csv");
    expect(print).toContain("getExamWorkspace({examSeriesId:examId})");
  });
  it("carries selected exam id through report card page and PDF",()=>{
    const page=read("src/app/[locale]/exams/report-card/[personId]/page.tsx");
    const pdf=read("src/app/api/exams/report-card/[personId]/pdf/route.ts");
    expect(page).toContain("examSeriesId");
    expect(page).toContain("getExamReportCard(personId,examSeriesId)");
    expect(pdf).toContain('searchParams.get("exam")');
    expect(pdf).toContain("getExamReportCard(personId,examId)");
  });
  it("shows analysis from the server result dataset",()=>{
    const hub=read("src/components/exams-results-v2-hub.tsx");
    expect(hub).toContain("data.analysis?.available");
    expect(hub).toContain("gradeDistribution");
    expect(hub).toContain("data.analysis.subjects");
    expect(hub).toContain("data.analysis.students");
  });
});
