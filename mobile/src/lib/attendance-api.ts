import { supabase } from './supabase';
import type { MobileWorkspace } from './mobile-api';

const apiOrigin = (import.meta.env.VITE_ILMGAAH_API_ORIGIN ?? 'https://madarsa-erp.vercel.app').replace(/\/$/, '');

export type AttendanceRow = {
  enrollmentId?: string;
  studentId?: string;
  rollNo?: string | null;
  studentName?: string;
  status?: string;
  isSaved?: boolean;
  group?: {
    id?: string;
    name?: string;
    label?: string;
    code?: string | null;
  } | null;
};

export type AttendancePayload = {
  date?: string;
  timezone?: string;
  canMark?: boolean;
  rows?: AttendanceRow[];
  pagination?: {
    page?: number;
    pageSize?: number;
    totalRows?: number;
    totalPages?: number;
    start?: number;
    end?: number;
    hasPrevious?: boolean;
    hasNext?: boolean;
  };
};

export type MobileAttendanceResponse = {
  readOnly: true;
  workspace: {
    tenantId: number;
    branchId: number | null;
    surface: 'admin' | 'teacher';
  };
  attendance: AttendancePayload;
};

export async function getMobileAttendance(workspace: MobileWorkspace, date: string) {
  if (!supabase) throw new Error('Mobile authentication is not configured.');
  if (workspace.surface === 'parent') throw new Error('Parent attendance view is not available in this preview yet.');

  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) throw new Error('Your session expired. Sign in again.');

  const params = new URLSearchParams({
    tenantId: String(workspace.tenantId),
    date,
    view: 'student',
    page: '1',
    pageSize: '50',
  });
  if (workspace.branchId) params.set('branchId', String(workspace.branchId));

  const response = await fetch(`${apiOrigin}/api/mobile/attendance?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (response.status === 401) throw new Error('Your Ilmgaah access could not be verified.');
  if (response.status === 404) throw new Error('Native Attendance API is not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Attendance is temporarily unavailable.');

  return (await response.json()) as MobileAttendanceResponse;
}
