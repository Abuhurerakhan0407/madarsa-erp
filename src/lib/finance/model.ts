export type JournalLine = {
  accountId: string;
  debitMinor: bigint;
  creditMinor: bigint;
};

export type ChargeBalance = {
  chargeId: string;
  dueOn: string;
  outstandingMinor: bigint;
};

export type Allocation = {
  chargeId: string;
  amountMinor: bigint;
};

export type PaymentVerification = {
  mode: "cash" | "bank_transfer" | "cheque" | "upi" | "razorpay" | "credit" | "sponsorship" | "custom";
  providerEventId?: string;
  signatureVerified: boolean;
  source: "browser_redirect" | "verified_webhook" | "cashier" | "bank_reconciliation";
};
