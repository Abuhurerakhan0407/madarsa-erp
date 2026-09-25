import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260915142500_phase5_student_photo_update_runtime.sql", import.meta.url),
  "utf8"
);
const uploadRoute = readFileSync(
  new URL("../../app/api/students/photo/[personId]/upload/route.ts", import.meta.url),
  "utf8"
);
const admissionForm = readFileSync(new URL("../../components/student-create-form-v3.tsx", import.meta.url), "utf8");
const photoPicker = readFileSync(new URL("../../components/student-photo-picker.tsx", import.meta.url), "utf8");

describe("student photo update final-touch contract", () => {
  it("keeps canonical photo replacement permissioned, branch-scoped, audited, and service-role only", () => {
    expect(migration).toContain("create or replace function public.update_student_photo_v1");
    expect(migration).toContain("'people.person.manage', 'students.profile.update'");
    expect(migration).toContain("e.branch_id = p_branch_id");
    expect(migration).toContain("e.status <> 'cancelled'");
    expect(migration).toContain("'students.profile.photo.update'");
    expect(migration).toContain("revoke all on function public.update_student_photo_v1");
    expect(migration).toContain("grant execute on function public.update_student_photo_v1");
    expect(migration).toContain("to service_role");
  });

  it("validates private uploads before swapping the canonical student photo", () => {
    expect(uploadRoute).toContain("isSameOriginRequest(request)");
    expect(uploadRoute).toContain("MAX_PHOTO_BYTES = 5 * 1024 * 1024");
    expect(uploadRoute).toContain("detectPhotoType(bytes)");
    expect(uploadRoute).toContain("operatorHasPermissions(workspace, [\"people.person.manage\", \"students.profile.update\"])");
    expect(uploadRoute).toContain("tenant-documents");
    expect(uploadRoute).toContain("update_student_photo_v1");
    expect(uploadRoute).toContain("await bucket.remove([storagePath])");
    expect(uploadRoute).toContain("previous_storage_path");
    expect(uploadRoute).toContain("expectedPrefix");
    expect(uploadRoute).toContain("await bucket.remove([previousStoragePath])");
  });

  it("requires and stages a verified photo before permanent student creation", () => {
    expect(photoPicker).toContain('capture="user"');
    expect(photoPicker).toContain("image/jpeg,image/png,image/webp");
    expect(admissionForm).toContain("photoRequired");
    expect(admissionForm).toContain('fetch("/api/admissions/staff-photo"');
    expect(admissionForm).toContain("photoToken");
    expect(admissionForm).toContain("photoBound");
    expect(admissionForm).toContain("submissionLock.current");
    expect(admissionForm).toContain("photoUploadLock.current");
  });
});
