type AuditValue = boolean | number | string | null | AuditValue[] | { [key: string]: AuditValue };

export type AuditOutcome = "allowed" | "denied" | "failed" | "succeeded";

export type SecurityEventInput = {
  id: string;
  occurredAt: Date;
  tenantId: string | null;
  branchId?: string;
  actorIdentityId: string;
  actorMembershipId?: string;
  impersonatorIdentityId?: string;
  impersonationReason?: string;
  action: string;
  outcome: AuditOutcome;
  entityType?: string;
  entityId?: string;
  correlationId: string;
  metadata?: Record<string, AuditValue>;
};

export type SecurityEvent = Readonly<
  Omit<SecurityEventInput, "occurredAt" | "metadata"> & {
    occurredAt: string;
    metadata: Readonly<Record<string, AuditValue>>;
  }
>;

const secretKeyPattern = /password|secret|token|credential|cookie/i;

function sanitizeValue(value: AuditValue): AuditValue {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return sanitizeAuditMetadata(value);
  }

  return value;
}

export function sanitizeAuditMetadata(
  metadata: Record<string, AuditValue>
): Record<string, AuditValue> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      secretKeyPattern.test(key) ? "[REDACTED]" : sanitizeValue(value)
    ])
  );
}

export function createSecurityEvent(input: SecurityEventInput): SecurityEvent {
  if (input.impersonatorIdentityId && !input.impersonationReason) {
    throw new Error("Impersonation events require a reason");
  }

  return Object.freeze({
    ...input,
    occurredAt: input.occurredAt.toISOString(),
    metadata: Object.freeze(sanitizeAuditMetadata(input.metadata ?? {}))
  });
}
