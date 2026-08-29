import { describe, expect, it } from "vitest";
import { normalizeEnquiryPhone, validateCompleteFollowUp, validateCreateEnquiry } from "./enquiry-model";

const now = new Date("2026-08-28T12:00:00Z");
const valid = { applicantName: "Test Student", guardianName: "Test Guardian", phone: "+91 98765-43210", email: "", sessionId: 1, programId: 1, preferredLocale: "ur", source: "walk-in", consent: true, notes: "Needs information", nextFollowUpAt: "2026-08-29T12:00:00Z" };

describe("enquiry input", () => {
  it("normalizes phone and a valid multilingual enquiry", () => {
    expect(normalizeEnquiryPhone(valid.phone)).toBe("+919876543210");
    expect(validateCreateEnquiry(valid, now).value).toMatchObject({ phone: "+919876543210", preferredLocale: "ur" });
  });
  it.each([
    [{ ...valid, applicantName: "A" }, "Applicant name"],
    [{ ...valid, phone: "", email: "" }, "phone or email"],
    [{ ...valid, nextFollowUpAt: "2026-08-27T12:00:00Z" }, "Follow-up"],
    [{ ...valid, preferredLocale: "fr" }, "language"],
    [{ ...valid, consent: false }, "Consent"]
  ])("rejects invalid enquiry data", (input, message) => expect(validateCreateEnquiry(input, now).errors.join(" ")).toContain(message));
  it("validates a completed follow-up and rejects a fake channel", () => {
    expect(validateCompleteFollowUp({ enquiryId: 1, outcome: "Interested", channel: "phone", newStatus: "qualified" }, now).value).toBeTruthy();
    expect(validateCompleteFollowUp({ enquiryId: 1, outcome: "Interested", channel: "telegram", newStatus: "contacted" }, now).value).toBeUndefined();
  });
});
