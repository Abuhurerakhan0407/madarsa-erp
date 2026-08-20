import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase11_operations.sql", import.meta.url), "utf8");
const required = ["hr_employments","hr_attendance_records","salary_structure_versions","payroll_runs","payroll_entries","payroll_component_results","payslips","hostels","hostel_beds","hostel_allocations","hostel_visitors","hostel_incidents","mess_units","mess_meal_services","library_titles","library_copies","library_loans","transport_vehicles","transport_routes","transport_stops","transport_assignments"] as const;

describe("Phase 11 database contract", () => {
  it("declares HR, payroll, and operational records", () => {
    for (const table of required) expect(contract).toContain(`create table public.${table}`);
  });
  it("prevents duplicate payroll and active resource use", () => {
    expect(contract).toContain("unique (tenant_id, payroll_run_id, employment_id)");
    expect(contract).toContain("hostel_bed_active_idx");
    expect(contract).toContain("library_copy_active_loan_idx");
  });
  it("keeps sensitive incidents restricted", () => {
    expect(contract).toContain("private.has_permission(tenant_id, 'hostel.security.manage'");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});
