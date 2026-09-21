export const BRIDGE_VERSION: string;
export const ALLOWED_EVENT_TYPES: Set<string>;
export const FORBIDDEN_BIOMETRIC_COLUMN: RegExp;
export function validateConfig(input: unknown): any;
export function parseCsv(text: string, delimiter?: string, headerRow?: number): Record<string, string>[];
export function toIsoTimestamp(value: unknown, format: any, separateTime?: unknown): string;
export function makeExternalEventId(externalDeviceKey: string, externalSubjectKey: string, occurredAt: string, eventType: string): string;
export function normalizeExportRows(rows: Record<string, unknown>[], config: any, sourceFile: string): { events: any[]; errors: Array<{ row: number; error: string }> };
export function retryDelayMs(attempts: number, config: any): number;
