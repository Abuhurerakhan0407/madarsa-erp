import { supabase } from './supabase';
import type { MobileWorkspace } from './mobile-api';

const apiOrigin = (import.meta.env.VITE_ILMGAAH_API_ORIGIN ?? 'https://madarsa-erp.vercel.app').replace(/\/$/, '');

export type MobileHomeMetrics = {
  readOnly: true;
  date: string;
  surface: 'admin' | 'teacher';
  metrics: {
    students: { total: number; active: number };
    attendance: { total: number; present: number; absent: number; late: number; unmarked: number; marked: number };
    staff: { total: number; active: number; onLeave: number } | null;
    admissions: { total: number; open: number; accepted: number; converted: number } | null;
  };
};

export async function getMobileHome(workspace: MobileWorkspace, date: string) {
  if (!supabase) throw new Error('Mobile authentication is not configured.');
  if (workspace.surface === 'parent') throw new Error('Parent home data is not available in this preview yet.');

  const { data, error: sessionError } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (sessionError || !token) throw new Error('Your session expired. Sign in again.');

  const params = new URLSearchParams({ tenantId: String(workspace.tenantId), date });
  if (workspace.branchId) params.set('branchId', String(workspace.branchId));

  const response = await fetch(`${apiOrigin}/api/mobile/home?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401) throw new Error('Your Ilmgaah access could not be verified.');
  if (response.status === 404) throw new Error('Native Home API is not enabled on the live ERP yet.');
  if (!response.ok) throw new Error('Dashboard data is temporarily unavailable.');
  return (await response.json()) as MobileHomeMetrics;
}
