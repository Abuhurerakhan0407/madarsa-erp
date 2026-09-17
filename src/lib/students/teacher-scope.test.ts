import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getTeacherAssignedEnrollment,
  getTeacherAssignedEnrollments,
  getTeacherAssignmentScope,
  getVerifiedTeacherPersonId,
  type TeacherScopeWorkspace
} from "./teacher-scope";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type QueryResult = { data: Row[]; error: null };
type AdminClient = NonNullable<Parameters<typeof getTeacherAssignmentScope>[2]>;
type Filter = (row: Row) => boolean;

class FakeQuery implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private maxRows: number | null = null;

  constructor(private readonly rows: Row[]) {}

  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  limit(value: number) {
    this.maxRows = value;
    return this;
  }

  private resultRows() {
    const rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    return this.maxRows === null ? rows : rows.slice(0, this.maxRows);
  }

  maybeSingle() {
    return Promise.resolve({ data: this.resultRows()[0] ?? null, error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resultRows(), error: null }).then(onfulfilled, onrejected);
  }
}

function fakeAdmin(tables: Tables): AdminClient {
  return {
    from(table: string) {
      return new FakeQuery(tables[table] ?? []);
    }
  } as unknown as AdminClient;
}

const workspace: TeacherScopeWorkspace = { tenantId: 1, branchId: 10, identityId: "teacher-identity" };
const teacherPersonId = 900;
const studentPersonId = 501;

function baseTables(): Tables {
  return {
    identity_person_links: [
      { tenant_id: 1, identity_id: "teacher-identity", link_type: "employee", status: "verified", person_id: teacherPersonId }
    ],
    academic_groups: [],
    curriculum_teaching_assignments: [],
    timetable_entries: [],
    enrollments: []
  };
}

function activeGroup(id: number, overrides: Row = {}): Row {
  return {
    id,
    tenant_id: 1,
    branch_id: 10,
    session_id: 71,
    program_id: 81,
    status: "active",
    primary_teacher_person_id: 999,
    ...overrides
  };
}

function activeEnrollment(groupId: number, overrides: Row = {}): Row {
  return {
    id: 7001,
    tenant_id: 1,
    branch_id: 10,
    student_person_id: studentPersonId,
    session_id: 71,
    program_id: 81,
    group_id: groupId,
    status: "active",
    ...overrides
  };
}

async function expectListAndDetailPermit(tables: Tables) {
  const admin = fakeAdmin(tables);
  expect(await getVerifiedTeacherPersonId(workspace, admin)).toBe(teacherPersonId);
  const listRows = await getTeacherAssignedEnrollments(workspace, teacherPersonId, admin);
  expect(listRows.map((row) => row.student_person_id)).toContain(studentPersonId);
  const detailRow = await getTeacherAssignedEnrollment(workspace, teacherPersonId, studentPersonId, admin);
  expect(detailRow?.student_person_id).toBe(studentPersonId);
}

describe("teacher assignment authorization contract", () => {
  it("A: primary-teacher-only assignment permits the same student in My Students and Student Detail", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(41, { primary_teacher_person_id: teacherPersonId })];
    tables.enrollments = [activeEnrollment(41)];
    await expectListAndDetailPermit(tables);
  });

  it("B: curriculum-group-only assignment permits the same student in My Students and Student Detail", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(42)];
    tables.curriculum_teaching_assignments = [
      { tenant_id: 1, teacher_person_id: teacherPersonId, session_id: 71, program_id: 81, group_id: 42, student_person_id: null, status: "active" }
    ];
    tables.enrollments = [activeEnrollment(42)];
    await expectListAndDetailPermit(tables);
  });

  it("B2: direct curriculum student assignment is accepted only for the matching active enrollment", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(44)];
    tables.curriculum_teaching_assignments = [
      { tenant_id: 1, teacher_person_id: teacherPersonId, session_id: 71, program_id: 81, group_id: null, student_person_id: studentPersonId, status: "active" }
    ];
    tables.enrollments = [activeEnrollment(44)];
    await expectListAndDetailPermit(tables);
  });

  it("B3: direct curriculum assignment does not leak across another active program enrollment", async () => {
    const tables = baseTables();
    tables.curriculum_teaching_assignments = [
      { tenant_id: 1, teacher_person_id: teacherPersonId, session_id: 71, program_id: 81, group_id: null, student_person_id: studentPersonId, status: "active" }
    ];
    tables.enrollments = [activeEnrollment(44, { program_id: 82 })];
    const admin = fakeAdmin(tables);
    expect(await getTeacherAssignedEnrollments(workspace, teacherPersonId, admin)).toEqual([]);
    expect(await getTeacherAssignedEnrollment(workspace, teacherPersonId, studentPersonId, admin)).toBeNull();
  });

  it("C: timetable-only assignment permits the same student in My Students and Student Detail", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(43)];
    tables.timetable_entries = [
      { tenant_id: 1, branch_id: 10, teacher_person_id: teacherPersonId, group_id: 43, status: "active" }
    ];
    tables.enrollments = [activeEnrollment(43)];
    await expectListAndDetailPermit(tables);
  });

  it("D: teacher with no valid assignment is denied the student", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(45)];
    tables.enrollments = [activeEnrollment(45)];
    const admin = fakeAdmin(tables);
    expect(await getTeacherAssignmentScope(workspace, teacherPersonId, admin)).toEqual({ groupIds: [], studentPersonIds: [], studentAssignments: [] });
    expect(await getTeacherAssignedEnrollments(workspace, teacherPersonId, admin)).toEqual([]);
    expect(await getTeacherAssignedEnrollment(workspace, teacherPersonId, studentPersonId, admin)).toBeNull();
  });

  it("null branch fails closed before assignment resolution", async () => {
    const tables = baseTables();
    tables.academic_groups = [activeGroup(48, { primary_teacher_person_id: teacherPersonId })];
    tables.enrollments = [activeEnrollment(48)];
    const nullBranch = { ...workspace, branchId: null };
    const admin = fakeAdmin(tables);
    expect(await getTeacherAssignmentScope(nullBranch, teacherPersonId, admin)).toEqual({ groupIds: [], studentPersonIds: [], studentAssignments: [] });
    expect(await getTeacherAssignedEnrollments(nullBranch, teacherPersonId, admin)).toEqual([]);
    expect(await getTeacherAssignedEnrollment(nullBranch, teacherPersonId, studentPersonId, admin)).toBeNull();
  });

  it("E: cross-branch and cross-tenant assignment sources remain denied", async () => {
    const tables = baseTables();
    tables.academic_groups = [
      activeGroup(46, { branch_id: 20, primary_teacher_person_id: teacherPersonId }),
      activeGroup(47, { tenant_id: 2, primary_teacher_person_id: teacherPersonId })
    ];
    tables.curriculum_teaching_assignments = [
      { tenant_id: 1, teacher_person_id: teacherPersonId, session_id: 71, program_id: 81, group_id: 46, student_person_id: null, status: "active" },
      { tenant_id: 2, teacher_person_id: teacherPersonId, session_id: 71, program_id: 81, group_id: 47, student_person_id: null, status: "active" }
    ];
    tables.timetable_entries = [
      { tenant_id: 1, branch_id: 20, teacher_person_id: teacherPersonId, group_id: 46, status: "active" },
      { tenant_id: 2, branch_id: 10, teacher_person_id: teacherPersonId, group_id: 47, status: "active" }
    ];
    tables.enrollments = [
      activeEnrollment(46, { branch_id: 20 }),
      activeEnrollment(47, { tenant_id: 2 })
    ];
    const admin = fakeAdmin(tables);
    expect(await getTeacherAssignmentScope(workspace, teacherPersonId, admin)).toEqual({ groupIds: [], studentPersonIds: [], studentAssignments: [] });
    expect(await getTeacherAssignedEnrollment(workspace, teacherPersonId, studentPersonId, admin)).toBeNull();

    const crossTenantIdentity = baseTables();
    crossTenantIdentity.identity_person_links = [
      { tenant_id: 2, identity_id: "teacher-identity", link_type: "employee", status: "verified", person_id: teacherPersonId }
    ];
    expect(await getVerifiedTeacherPersonId(workspace, fakeAdmin(crossTenantIdentity))).toBeNull();
  });
});

describe("My Students / Student Detail integration contract", () => {
  const myStudentsSource = readFileSync(resolve(process.cwd(), "src/lib/students/my-students.ts"), "utf8");
  const detailSource = readFileSync(resolve(process.cwd(), "src/lib/students/detail.ts"), "utf8");
  const photoSource = readFileSync(resolve(process.cwd(), "src/app/api/students/photo/[personId]/route.ts"), "utf8");
  const pageSource = readFileSync(resolve(process.cwd(), "src/app/[locale]/my-students/page.tsx"), "utf8");

  it("uses the shared server-side teacher scope for list, detail, and student photo reads", () => {
    expect(myStudentsSource).toContain('from "@/lib/students/teacher-scope"');
    expect(myStudentsSource).toContain("getTeacherAssignedEnrollments(workspace, teacherPersonId, admin)");
    expect(detailSource).toContain('from "@/lib/students/teacher-scope"');
    expect(detailSource).toContain("getTeacherAssignedEnrollment(workspace, teacherPersonId, personId, admin)");
    expect(photoSource).toContain('from "@/lib/students/teacher-scope"');
    expect(photoSource).toContain("getTeacherAssignedEnrollment(workspace, teacherPersonId, personId, admin)");
    expect(detailSource).not.toContain('.from("timetable_entries")');
    expect(photoSource).not.toContain('.from("timetable_entries")');
  });

  it("F: My Students links use resolved numeric person IDs, never literal dynamic placeholders", () => {
    expect(pageSource).toContain('`/${locale}/students/${s.personId}`');
    expect(pageSource).not.toContain("/students/[personId]");
    expect(pageSource).not.toContain("/students/{personId}");
  });
});
