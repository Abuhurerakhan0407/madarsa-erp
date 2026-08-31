export const ID_CARD_BATCH_LIMIT = 250;

export function normalizeIdCardStudentIds(value: string | string[] | undefined): number[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const unique = new Set<number>();
  for (const raw of values) {
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) unique.add(id);
    if (unique.size > ID_CARD_BATCH_LIMIT) throw new Error(`Select no more than ${ID_CARD_BATCH_LIMIT} students.`);
  }
  return [...unique];
}
