import { describe, expect, it } from "vitest";
import { validateAcademicMutation } from "./operations-model";

describe("validateAcademicMutation", () => {
  it("accepts a timetable slot and rejects reversed times", () => {
    expect(validateAcademicMutation({ action:"create_slot", key:"period_1", labels:{en:"Period 1"}, startsAt:"08:00", endsAt:"08:45", sequence:1 }).errors).toEqual([]);
    expect(validateAcademicMutation({ action:"create_slot", key:"period_1", labels:{en:"Period 1"}, startsAt:"09:00", endsAt:"08:45", sequence:1 }).errors.join(" ")).toContain("times");
  });

  it("requires timetable dates to be valid and bounded in shape", () => {
    const result = validateAcademicMutation({ action:"create_timetable_entry", groupId:2, slotId:1, subjectId:1, teacherPersonId:11, roomKey:"A-1", weekday:1, effectiveFrom:"2026-02-30", effectiveTo:null });
    expect(result.errors.join(" ")).toContain("start date");
  });

  it("requires the correct replacement fields for exceptions", () => {
    expect(validateAcademicMutation({ action:"create_exception", entryId:1, sessionDate:"2026-09-07", exceptionAction:"substitute", replacementDate:null, replacementSlotId:null, replacementTeacherPersonId:null, replacementRoomKey:"", note:"" }).errors.join(" ")).toContain("Substitute teacher");
    expect(validateAcademicMutation({ action:"create_exception", entryId:1, sessionDate:"2026-09-07", exceptionAction:"reschedule", replacementDate:"2026-09-08", replacementSlotId:2, replacementTeacherPersonId:null, replacementRoomKey:"B-2", note:"Moved" }).errors).toEqual([]);
  });

  it("requires exactly one homework target and accepts only staged attachment tokens", () => {
    const base = { action:"create_homework", sessionId:1, subjectId:1, teacherPersonId:11, title:"Read chapter", instructions:"Read and summarize chapter one.", dueAt:"2026-09-05T18:00", priority:"normal", parentVisible:true, studentVisible:true, allowSubmission:false, publish:true };
    expect(validateAcademicMutation({ ...base, groupId:2, studentPersonId:null, attachmentToken:"A".repeat(43) }).errors).toEqual([]);
    expect(validateAcademicMutation({ ...base, groupId:2, studentPersonId:4, attachmentToken:null }).errors.join(" ")).toContain("exactly one");
    expect(validateAcademicMutation({ ...base, groupId:2, studentPersonId:null, attachmentToken:"../raw-storage-path" }).errors.join(" ")).toContain("attachment token");
  });

  it("rejects unsupported browser authority fields", () => {
    const result = validateAcademicMutation({ action:"archive_timetable_entry", entryId:1, tenantId:999, branchId:999 });
    expect(result.errors.join(" ")).toContain("unsupported fields");
  });

  it("validates calendar time ranges and attendance impact", () => {
    const result = validateAcademicMutation({ action:"create_calendar_event", sessionId:1, eventType:"holiday", labels:{en:"Holiday"}, startsAt:"2026-09-10T00:00", endsAt:"2026-09-11T00:00", description:"", location:"", audience:"all", priority:"normal", affectsAttendance:true, attachmentToken:null });
    expect(result.errors).toEqual([]);
  });
});
