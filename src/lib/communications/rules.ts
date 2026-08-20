const forbiddenDirectMessageFields = ["private_note", "full_result", "payroll", "incident_details", "financial_details"] as const;

export function validateTemplate(body: string, requiredVariables: readonly string[], channel: "in_app" | "email" | "whatsapp"): string[] {
  const issues: string[] = [];
  for (const variable of requiredVariables) if (!body.includes(`{{${variable}}}`)) issues.push(`missing_variable:${variable}`);
  for (const field of forbiddenDirectMessageFields) if (body.includes(`{{${field}}}`)) issues.push(`sensitive_variable:${field}`);
  if (channel === "whatsapp" && body.length > 4096) issues.push("whatsapp_body_too_long");
  return issues;
}

export function dispatchKey(tenantId: string, eventId: string, recipientId: string, channel: string, templateVersion: string): string {
  return [tenantId, eventId, recipientId, channel, templateVersion].join(":");
}

export function canDispatch(input: { consent: boolean; optedOut: boolean; blocked: boolean; allowanceUnits: number; prepaidUnits: number; estimatedUnits: number }): boolean {
  return input.consent && !input.optedOut && !input.blocked && input.estimatedUnits <= input.allowanceUnits + input.prepaidUnits;
}

export function previewBulk(audience: number, excluded: number, unitsPerRecipient: number, costPerUnit: number) {
  const recipients = Math.max(0, audience - excluded);
  return { recipients, units: recipients * unitsPerRecipient, cost: recipients * unitsPerRecipient * costPerUnit };
}
