import { furkaniaProfile } from "./furkania";

export type FurkaniaReadiness = {
  client: string;
  confirmed: {
    studentCount: number;
    ageRange: { min: number; max: number };
    curriculum: string;
    courses: readonly number[];
    shifts: readonly string[];
  };
  pending: readonly string[];
  readyForCoreSetup: boolean;
  readyForTimetableActivation: boolean;
};

export function getFurkaniaReadiness(): FurkaniaReadiness {
  const profile = furkaniaProfile;

  return {
    client: profile.displayName,
    confirmed: {
      studentCount: profile.students.currentCount,
      ageRange: profile.students.approximateAgeRange,
      curriculum: profile.curriculum.family,
      courses: profile.curriculum.courses,
      shifts: profile.scheduling.shifts,
    },
    pending: profile.pendingClientDetails,
    // We can safely configure the tenant, programs, levels and subject taxonomy
    // without inventing operational rules.
    readyForCoreSetup: true,
    // Exact timetable records must wait for real start/end times.
    readyForTimetableActivation: profile.scheduling.exactShiftTimes !== null,
  };
}
