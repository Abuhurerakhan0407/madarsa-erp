export const clientDocumentTypes = [
  'student_id_card',
  'student_profile',
  'status_certificate',
  'exam_report_card',
  'quran_progress_report'
] as const;

export type ClientDocumentType = typeof clientDocumentTypes[number];

export type DocumentStudent = {
  personId: number;
  studentNumber: string;
  admissionNumber: string | null;
  name: string;
  nameNative: string | null;
  sessionId: number | null;
  programId: number | null;
  groupId: number | null;
  academicYear: string | null;
  program: string | null;
  classGroup: string | null;
  photoAvailable: boolean;
  idCardAvailable: boolean;
  profileAvailable: boolean;
  quranProgressAvailable: boolean;
  reportCardIssued: boolean;
  reportCardIssuedAt: string | null;
};

export function isClientDocumentType(value: unknown): value is ClientDocumentType {
  return typeof value === 'string' && clientDocumentTypes.includes(value as ClientDocumentType);
}

export function documentAvailable(student: DocumentStudent, type: ClientDocumentType): boolean {
  if (type === 'student_id_card') return student.idCardAvailable;
  if (type === 'student_profile') return student.profileAvailable;
  if (type === 'quran_progress_report') return student.quranProgressAvailable;
  if (type === 'exam_report_card') return student.reportCardIssued;
  return true;
}
