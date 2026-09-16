import type { MobileWorkspace } from './mobile-api';
import { supabase } from './supabase';

const apiOrigin = (import.meta.env.VITE_ILMGAAH_API_ORIGIN ?? 'https://madarsa-erp.vercel.app').replace(/\/$/, '');

export type PortalNotice = {
  id: number;
  audience: string;
  title: string;
  body: string;
  publishedAt: string | null;
  expiresAt: string | null;
  isRead: boolean;
};

export type TeacherPortalHome = {
  readOnly: true;
  surface: 'teacher';
  employee: {
    personId: number | null;
    employeeNumber: string | null;
    name: string;
    designation: string | null;
    department: string | null;
    employmentType: string | null;
    joinedOn: string | null;
    status: string | null;
    recentAttendance: Array<{ date: string | null; status: string | null; checkInAt: string | null; checkOutAt: string | null }>;
    recentLeave: Array<{ startsOn: string | null; endsOn: string | null; units: number | null; state: string | null }>;
  };
  notices: PortalNotice[];
};

export type ParentPortalHome = {
  readOnly: true;
  surface: 'parent';
  children: Array<{
    personId: number;
    studentNumber: string | null;
    name: string;
    nativeName: string | null;
    branchId: number | null;
    groupId: number | null;
    enrollmentStatus: string | null;
    attendanceTotal30d: number;
    attendancePresent30d: number;
    latestQuran: Record<string, unknown>;
  }>;
  notices: PortalNotice[];
  overview: {
    urgentNotices: Array<{ id: number | null; title: string; body: string; priority: string | null; publishedAt: string | null }>;
    todaySchedule: Array<{ studentPersonId: number | null; studentName: string | null; subjectName: string; startsAt: string | null; endsAt: string | null; room: string | null; teacherName: string | null }>;
    homework: Array<{ id: number | null; title: string | null; priority: string | null; dueAt: string | null; studentPersonId: number | null; studentName: string | null; teacherName: string | null }>;
    results: Array<{ snapshotId: number | null; studentPersonId: number | null; studentName: string | null; percentage: number | null; status: string | null; grade: string | null; publishedAt: string | null; exam: string }>;
  };
};

export type ParentPortalAttendance = {
  readOnly: true;
  children: Array<{
    personId: number;
    studentNumber: string | null;
    name: string;
    dailyPercent: number;
    weeklyPercent: number;
    monthlyPercent: number;
    trend: Array<{ date: string | null; percent: number; recorded: number }>;
    recent: Array<{ date: string | null; status: string | null; source: string | null; markedAt: string | null }>;
  }>;
};

export type TeacherPortalClasses = {
  readOnly: true;
  groups: Array<{ id: number; name: string; studentCount: number }>;
  students: Array<{
    personId: number;
    groupId: number;
    groupName: string;
    studentNumber: string;
    name: string;
    nativeName: string | null;
    status: string;
    enrollmentStatus: string;
  }>;
};

export type MobilePortalHome = TeacherPortalHome | ParentPortalHome;

async function token() {
  if (!supabase) throw new Error('Mobile authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Your session expired. Sign in again.');
  return data.session.access_token;
}

export async function getMobilePortalHome(workspace: MobileWorkspace): Promise<MobilePortalHome> {
  if (workspace.accessMode !== 'portal' || workspace.surface === 'admin') throw new Error('This workspace does not use portal access.');
  const accessToken = await token();
  const params = new URLSearchParams({ tenantId: String(workspace.tenantId), surface: workspace.surface });
  if (workspace.branchId) params.set('branchId', String(workspace.branchId));

  const response = await fetch(`${apiOrigin}/api/mobile/portal/home?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('Your session expired. Sign in again.');
  if (response.status === 403) throw new Error('This portal workspace is no longer assigned to your account.');
  if (response.status === 404) throw new Error('Native portal access is not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Portal data is temporarily unavailable.');
  return (await response.json()) as MobilePortalHome;
}

export async function getParentPortalAttendance(workspace: MobileWorkspace): Promise<ParentPortalAttendance> {
  if (workspace.accessMode !== 'portal' || workspace.surface !== 'parent') throw new Error('Guardian attendance requires a parent portal workspace.');
  const accessToken = await token();
  const params = new URLSearchParams({ tenantId: String(workspace.tenantId) });
  const response = await fetch(`${apiOrigin}/api/mobile/portal/attendance?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('Your session expired. Sign in again.');
  if (response.status === 403) throw new Error('Guardian access could not be verified.');
  if (response.status === 404) throw new Error('Native guardian attendance is not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Attendance is temporarily unavailable.');
  return (await response.json()) as ParentPortalAttendance;
}

export async function getTeacherPortalClasses(workspace: MobileWorkspace): Promise<TeacherPortalClasses> {
  if (workspace.accessMode !== 'portal' || workspace.surface !== 'teacher' || !workspace.branchId) {
    throw new Error('Teacher classes require an assigned teacher branch.');
  }
  const accessToken = await token();
  const params = new URLSearchParams({ tenantId: String(workspace.tenantId), branchId: String(workspace.branchId) });
  const response = await fetch(`${apiOrigin}/api/mobile/portal/classes?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('Your session expired. Sign in again.');
  if (response.status === 403) throw new Error('Your assigned teaching scope could not be verified.');
  if (response.status === 404) throw new Error('Native teacher classes are not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Assigned classes are temporarily unavailable.');
  return (await response.json()) as TeacherPortalClasses;
}
