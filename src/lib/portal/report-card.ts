import type { ExamReportCard, LocalizedLabels } from "@/lib/exams/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const labels = (value: unknown): LocalizedLabels => {
  const item = object(value);
  return { en: text(item.en) ?? undefined, ur: text(item.ur) ?? undefined, ar: text(item.ar) ?? undefined };
};

export async function getPortalReportCard(
  tenantId: number,
  studentPersonId: number,
  examSeriesId: number
): Promise<ExamReportCard | null> {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || !Number.isSafeInteger(studentPersonId) || studentPersonId <= 0 || !Number.isSafeInteger(examSeriesId) || examSeriesId <= 0) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_guardian_report_card_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId,
    p_student_person_id: studentPersonId,
    p_exam_series_id: examSeriesId
  });
  if (error) throw new Error(`Unable to load guardian report card: ${error.message}`);
  if (!data) return null;

  const row = object(data);
  const student = object(row.student);
  const exam = object(row.exam);
  const result = object(row.result);
  const issue = object(row.issue);
  const personId = number(student.person_id);
  const examId = number(exam.id);
  const snapshotId = number(result.snapshot_id);
  if (!personId || !examId || !snapshotId) return null;

  const subjects = Array.isArray(row.subjects) ? row.subjects.flatMap((value) => {
    const item = object(value);
    const maximumMarks = number(item.maximum_marks);
    if (maximumMarks === null) return [];
    return [{
      subjectName: text(item.subject_name) ?? "Subject",
      labels: labels(item.labels),
      rawMarks: number(item.raw_marks),
      maximumMarks,
      outcome: text(item.outcome) ?? "incomplete",
      gradeKey: text(item.grade_key)
    }];
  }) : [];

  return {
    student: {
      personId,
      name: text(student.name) ?? "Student",
      nameNative: text(student.name_native),
      studentNumber: text(student.student_number) ?? "—"
    },
    exam: {
      id: examId,
      labels: labels(exam.labels),
      state: text(exam.state) ?? "published",
      startsOn: text(exam.starts_on) ?? "",
      endsOn: text(exam.ends_on) ?? ""
    },
    result: {
      snapshotId,
      percentage: number(result.percentage),
      aggregateStatus: text(result.aggregate_status) ?? "incomplete",
      gradeKey: text(result.grade_key),
      rankValue: number(result.rank_value),
      promotionRecommendation: text(result.promotion_recommendation) ?? "none",
      publishedAt: text(result.published_at)
    },    subjects,
    issue: number(issue.id) ? {
      id: number(issue.id)!,
      revision: number(issue.revision) ?? 1,
      templateKey: text(issue.template_key) ?? "standard_report_card",
      issuedAt: text(issue.issued_at),
      verificationCode: text(issue.verification_code) ?? ""
    } : null
  };
}
