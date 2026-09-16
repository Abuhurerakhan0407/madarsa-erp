export type MobileSurface = 'admin' | 'teacher' | 'parent';
export type MobileAccessMode = 'membership' | 'portal';

export type MobileWorkspace = {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  branchId: number | null;
  branchName: string | null;
  surface: MobileSurface;
  roleKeys: string[];
  accessMode: MobileAccessMode;
};

export type MobileBootstrap = {
  identity: {
    id: string;
    email: string | null;
    displayName: string;
  };
  workspaces: MobileWorkspace[];
};

const apiOrigin = (
  import.meta.env.VITE_ILMGAAH_API_ORIGIN ?? 'https://madarsa-erp.vercel.app'
).replace(/\/$/, '');

export async function getMobileBootstrap(accessToken: string): Promise<MobileBootstrap> {
  const response = await fetch(`${apiOrigin}/api/mobile/bootstrap`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 401) throw new Error('Your session is no longer valid. Sign in again.');
  if (!response.ok) throw new Error('Unable to open your Ilmgaah workspace right now.');

  const payload = (await response.json()) as MobileBootstrap;
  if (!payload.identity || !Array.isArray(payload.workspaces)) {
    throw new Error('Ilmgaah returned an invalid workspace response.');
  }
  return payload;
}
