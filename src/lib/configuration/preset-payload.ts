import type { AttendanceStatus } from "../attendance/model";
import { releaseConfigurationLocales, type ConfigurationPreset } from "./model";

export type TerminologyPresetRow = {
  concept_key: string;
  locale: string;
  singular_label: string;
  plural_label: string;
};

const attendanceStatusTemplates: Readonly<Record<string, AttendanceStatus>> = {
  present: { key: "present", category: "present", presenceRatio: 1, triggersAlert: false },
  absent: { key: "absent", category: "absent", presenceRatio: 0, triggersAlert: true },
  late: { key: "late", category: "late", presenceRatio: 1, triggersAlert: false },
  leave: { key: "leave", category: "leave", presenceRatio: 0, triggersAlert: false },
  excused: { key: "excused", category: "excused", presenceRatio: 0, triggersAlert: false },
  half_day: { key: "half_day", category: "present", presenceRatio: 0.5, triggersAlert: false }
};

export function buildPresetDraftPayload(preset: ConfigurationPreset) {
  const terminology: TerminologyPresetRow[] = preset.terminology.flatMap((entry) =>
    releaseConfigurationLocales.map((locale) => ({
      concept_key: entry.conceptKey,
      locale,
      singular_label: entry.singular[locale],
      plural_label: entry.plural[locale]
    }))
  );

  const attendanceStatuses = preset.defaultAttendanceStatuses.map((key) => {
    const status = attendanceStatusTemplates[key];
    if (!status) {
      throw new Error(`Unsupported preset attendance status: ${key}`);
    }
    return status;
  });

  return { terminology, attendanceStatuses } as const;
}
