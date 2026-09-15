import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 teacher attendance resilience", () => {
  it("keeps core attendance available when noncritical insights fail", () => {
    const source = read("src/lib/hr/workspace.ts");
    expect(source).toContain("rpc('get_hr_attendance_workspace_v1'");
    expect(source).toContain("rpc('get_emergency_manual_attendance_v1'");
    expect(source).toContain("rpc('get_hr_attendance_v2_insights_v1',{p_attendance_date:date}).catch(()=>null)");
    expect(source).toContain("const raw=obj(rawData),summary=obj(raw.summary),emergency=obj(emergencyData),insights=obj(insightsData)");
  });

  it("defaults unavailable analytics to safe zero and empty trend values", () => {
    const source = read("src/lib/hr/workspace.ts");
    expect(source).toContain("dailyPercent:n(insights.daily_percent)??0");
    expect(source).toContain("weeklyPercent:n(insights.weekly_percent)??0");
    expect(source).toContain("monthlyPercent:n(insights.monthly_percent)??0");
    expect(source).toContain("trend:arr(insights.trend)");
  });
});
