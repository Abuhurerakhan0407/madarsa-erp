import type { Allocation, ChargeBalance, JournalLine, PaymentVerification } from "./model";

export function validateJournal(lines: readonly JournalLine[]): string[] {
  const issues: string[] = [];
  if (lines.length < 2) issues.push("journal_requires_two_lines");
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (line.debitMinor < 0n || line.creditMinor < 0n) issues.push(`negative_amount:${line.accountId}`);
    if ((line.debitMinor > 0n) === (line.creditMinor > 0n)) issues.push(`line_must_have_one_side:${line.accountId}`);
    debit += line.debitMinor;
    credit += line.creditMinor;
  }
  if (debit === 0n || debit !== credit) issues.push("journal_not_balanced");
  return issues;
}

export function canPostOnlinePayment(verification: PaymentVerification): boolean {
  if (verification.mode !== "razorpay") return verification.source === "cashier" || verification.source === "bank_reconciliation";
  return verification.signatureVerified && verification.source === "verified_webhook" && (verification.providerEventId?.trim().length ?? 0) > 0;
}

export function allocateOldestFirst(paymentMinor: bigint, charges: readonly ChargeBalance[]): Allocation[] {
  if (paymentMinor <= 0n) throw new Error("payment_must_be_positive");
  let remainder = paymentMinor;
  const allocations: Allocation[] = [];
  const ordered = [...charges].filter((charge) => charge.outstandingMinor > 0n).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.chargeId.localeCompare(b.chargeId));
  for (const charge of ordered) {
    if (remainder === 0n) break;
    const amountMinor = remainder < charge.outstandingMinor ? remainder : charge.outstandingMinor;
    allocations.push({ chargeId: charge.chargeId, amountMinor });
    remainder -= amountMinor;
  }
  return allocations;
}

export function outstandingMinor(chargedMinor: bigint, adjustmentsMinor: bigint, allocatedMinor: bigint): bigint {
  return chargedMinor + adjustmentsMinor - allocatedMinor;
}

export function validateReversal(originalMinor: bigint, reversedAlreadyMinor: bigint, requestedMinor: bigint, reason?: string): string[] {
  const issues: string[] = [];
  if (requestedMinor <= 0n || reversedAlreadyMinor + requestedMinor > originalMinor) issues.push("reversal_exceeds_original");
  if ((reason?.trim().length ?? 0) < 4) issues.push("reversal_reason_required");
  return issues;
}
