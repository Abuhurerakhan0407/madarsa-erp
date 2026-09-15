import type { MobileSurface } from './lib/mobile-api';

export type MobileModule = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
};

const admin: MobileModule[] = [
  { id: 'home', label: 'Dashboard', shortLabel: 'Home', description: 'Institution overview and actions.' },
  { id: 'students', label: 'Students', shortLabel: 'Students', description: 'Student profiles and enrollment.' },
  { id: 'teachers', label: 'Teachers', shortLabel: 'Teachers', description: 'Staff and teaching assignments.' },
  { id: 'attendance', label: 'Attendance', shortLabel: 'Attendance', description: 'Daily attendance operations.' },
  { id: 'fees', label: 'Fees', shortLabel: 'Fees', description: 'Fee status, receipts and follow-up.' },
  { id: 'timetable', label: 'Timetable', shortLabel: 'Schedule', description: 'Classes, rooms and teaching schedule.' },
  { id: 'exams', label: 'Exams & results', shortLabel: 'Exams', description: 'Assessments, marks and publishing.' },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', description: 'Operational reports and exports.' },
  { id: 'notifications', label: 'Notifications', shortLabel: 'Alerts', description: 'Institution notices and delivery.' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', description: 'Institution and access settings.' },
];

const teacher: MobileModule[] = [
  { id: 'home', label: 'Today', shortLabel: 'Home', description: 'Classes and teaching tasks for today.' },
  { id: 'classes', label: 'My classes', shortLabel: 'Classes', description: 'Assigned groups and students.' },
  { id: 'attendance', label: 'Attendance', shortLabel: 'Attendance', description: 'Mark attendance for assigned groups.' },
  { id: 'students', label: 'Students', shortLabel: 'Students', description: 'Students within assigned teaching scope.' },
  { id: 'courses', label: 'Courses', shortLabel: 'Courses', description: 'Course and Deeniyat progress.' },
  { id: 'homework', label: 'Homework', shortLabel: 'Homework', description: 'Assigned learning work where enabled.' },
  { id: 'exams', label: 'Marks & exams', shortLabel: 'Exams', description: 'Assessment work within teacher scope.' },
  { id: 'timetable', label: 'Timetable', shortLabel: 'Schedule', description: 'Personal teaching timetable.' },
  { id: 'notifications', label: 'Notifications', shortLabel: 'Alerts', description: 'Institution notices.' },
];

const parent: MobileModule[] = [
  { id: 'home', label: 'My child', shortLabel: 'Home', description: 'Child overview and important updates.' },
  { id: 'attendance', label: 'Attendance', shortLabel: 'Attendance', description: 'Attendance visible for linked children.' },
  { id: 'courses', label: 'Course progress', shortLabel: 'Courses', description: 'Learning progress visible to guardians.' },
  { id: 'homework', label: 'Homework', shortLabel: 'Homework', description: 'Assigned work visible to guardians.' },
  { id: 'results', label: 'Results', shortLabel: 'Results', description: 'Published assessment results.' },
  { id: 'fees', label: 'Fees', shortLabel: 'Fees', description: 'Fee information visible to guardians.' },
  { id: 'timetable', label: 'Timetable', shortLabel: 'Schedule', description: 'Child timetable.' },
  { id: 'notifications', label: 'Announcements', shortLabel: 'Alerts', description: 'Institution notices and updates.' },
];

export const modulesBySurface: Record<MobileSurface, MobileModule[]> = {
  admin,
  teacher,
  parent,
};
