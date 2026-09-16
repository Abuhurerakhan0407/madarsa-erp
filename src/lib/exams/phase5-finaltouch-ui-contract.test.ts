import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");

describe("Phase 5 Exams final-touch UI contract",()=>{
  it("surfaces the selected exam and makes published results/report cards the primary path",()=>{
    const page=read("src/app/[locale]/exams/page.tsx");
    expect(page).toContain('data-testid="exam-selected-context"');
    expect(page).toContain('selectedExam?.state==="results_published"');
    expect(page).toContain('view=reports&exam=${selectedExam.id}');
    expect(page).toContain('view=results&exam=${selectedExam.id}');
    expect(page).toContain('view=analysis&exam=${selectedExam.id}');
    expect(page).toContain('view=export&exam=${selectedExam.id}');
  });

  it("compacts the action hub and removes Enter Marks from the published-exam primary path",()=>{
    const css=read("src/app/[locale]/exams/page.module.css");
    expect(css).toContain("repeat(6, minmax(0, 1fr))");
    expect(css).toContain('view=marks');
    expect(css).toContain("nth-child(-n+3)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("preserves the governed marks-open lock in the existing client workspace",()=>{
    const hub=read("src/components/exams-results-v2-hub.tsx");
    expect(hub).toContain('selectedExam.state!=="marks_open"');
    expect(hub).toContain('selectedExam.state==="marks_open"');
    expect(hub).toContain('selectedExam.state!=="results_published"');
  });
});
