import { supabase } from './supabase';
import type { MobileWorkspace } from './mobile-api';

const apiOrigin = (import.meta.env.VITE_ILMGAAH_API_ORIGIN ?? 'https://madarsa-erp.vercel.app').replace(/\/$/, '');

export type MobileStudent = {
  personId: number;
  studentNumber: string;
  name: string;
  nativeName: string | null;
  status: string;
  joinedOn: string | null;
  program: string;
  group: string;
};

export type MobileStudentsResponse = {
  readOnly: true;
  total: number;
  active: number;
  page: number;
  pageSize: number;
  pages: number;
  rows: MobileStudent[];
};

export type MobileStudentProfileResponse = {
  readOnly: true;
  student: MobileStudent & { admissionNumber: string | null };
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  quranAttempts: number | null;
  resultCount: number | null;
};

async function authenticatedToken() {
  if (!supabase) throw new Error('Mobile authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Your session expired. Sign in again.');
  return token;
}

function workspaceParams(workspace: MobileWorkspace) {
  const params = new URLSearchParams({ tenantId: String(workspace.tenantId) });
  if (workspace.branchId) params.set('branchId', String(workspace.branchId));
  return params;
}

export async function getMobileStudents(
  workspace: MobileWorkspace,
  options: { page?: number; pageSize?: number; search?: string; status?: string } = {},
) {
  if (workspace.surface === 'parent') throw new Error('Guardian student profiles use a separate child-scoped API.');
  const token = await authenticatedToken();

  const params = workspaceParams(workspace);
  params.set('page', String(options.page ?? 1));
  params.set('pageSize', String(options.pageSize ?? 30));
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.status?.trim()) params.set('status', options.status.trim());

  const response = await fetch(`${apiOrigin}/api/mobile/students?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw new Error('Your Ilmgaah access could not be verified.');
  if (response.status === 404) throw new Error('Native Students API is not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Student records are temporarily unavailable.');
  return (await response.json()) as MobileStudentsResponse;
}

export async function getMobileStudentProfile(workspace: MobileWorkspace, personId: number) {
  if (workspace.surface === 'parent') throw new Error('Guardian child profiles use a separate child-scoped API.');
  const token = await authenticatedToken();
  const params = workspaceParams(workspace);

  const response = await fetch(`${apiOrigin}/api/mobile/students/${personId}?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw new Error('Your Ilmgaah access could not be verified.');
  if (response.status === 404) throw new Error('This student is not available in the active workspace.');
  if (!response.ok) throw new Error('Student profile is temporarily unavailable.');
  return (await response.json()) as MobileStudentProfileResponse;
}
