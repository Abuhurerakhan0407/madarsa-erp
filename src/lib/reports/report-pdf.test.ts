import { describe, expect, it } from "vitest";
import { supportedOperationalReports } from "./model";
import { createOperationalReportPdf, supportsOperationalReportPdf } from "./report-pdf";
import type { ReportResult } from "./workspace";

function result(reportKey: string, columns:string[], rows: Record<string, unknown>[], parameters:Record<string,unknown>={}): ReportResult {
 return { runId: 42, reportKey, labels: { en: reportKey.replaceAll("_"," ") }, columns, rows, rowCount: rows.length, parameters, outputFormat: "json" };
}

describe("operational report PDF", () => {
 it("renders supported reports across landscape pages", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({
   attendance_date:"2026-08-31",
   student_number:`STU-${index+1}`,
   name:`Student ${index+1}`,
   program:"Dars-e-Nizami",
   class_group:"Group A",
   status:"present",
   source:"biometric",
   marked_at:"2026-08-31T10:00:00Z"
  }));
  const pdf = createOperationalReportPdf(result("daily_attendance",["attendance_date","student_number","name","program","class_group","status","source","marked_at"], rows), { institutionName: "Al-Noor Islamic Academy", branchName: "Central Campus" });
  const text = new TextDecoder().decode(pdf);
  expect(text.startsWith("%PDF-1.4")).toBe(true);
  expect(text).toContain("/MediaBox [0 0 842 595]");
  expect(text).toContain("/Count 2");
  expect(text).toContain("Student 25");
 });

 it("prints applied filters and generation metadata", () => {
  const pdf=createOperationalReportPdf(result("new_admissions",["student_name"],[{student_name:"Amina"}],{date_from:"2026-09-01",date_to:"2026-09-25",program_id:2}),{institutionName:"Ilmgaah Test",branchName:"Main"});
  const text=new TextDecoder().decode(pdf);
  expect(text).toContain("From: 2026-09-01");
  expect(text).toContain("To: 2026-09-25");
  expect(text).toContain("Generated:");
 });

 it("supports the same report set as the runtime contract", () => {
  for(const key of supportedOperationalReports) expect(supportsOperationalReportPdf(key),key).toBe(true);
  expect(supportsOperationalReportPdf("fees_collection")).toBe(false);
 });
});
