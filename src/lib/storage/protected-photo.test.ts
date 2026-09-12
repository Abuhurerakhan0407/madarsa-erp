import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {isTenantOwnedStoragePath,protectedPhotoResponse} from './protected-photo';

const studentRoute=readFileSync('src/app/api/students/photo/[personId]/route.ts','utf8');
const teacherRoute=readFileSync('src/app/api/teachers/photo/[personId]/route.ts','utf8');
const portalTeacherRoute=readFileSync('src/app/api/portal/teachers/photo/[personId]/route.ts','utf8');

describe('protected photo proxy',()=>{
 it('accepts only storage paths owned by the active tenant',()=>{
  expect(isTenantOwnedStoragePath('42/students/photo.jpg',42)).toBe(true);
  expect(isTenantOwnedStoragePath('42/admissions/intake/photo.webp',42)).toBe(true);
  expect(isTenantOwnedStoragePath('43/students/photo.jpg',42)).toBe(false);
  expect(isTenantOwnedStoragePath('42/../43/photo.jpg',42)).toBe(false);
  expect(isTenantOwnedStoragePath('/42/photo.jpg',42)).toBe(false);
 });
 it('returns CSP-compatible same-origin image bytes with safe headers',async()=>{
  const response=protectedPhotoResponse(new Blob([new Uint8Array([1,2,3])],{type:'image/jpeg'}));
  expect(response).not.toBeNull();
  expect(response?.status).toBe(200);
  expect(response?.headers.get('content-type')).toBe('image/jpeg');
  expect(response?.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response?.headers.get('cache-control')).toContain('private');
  expect(new Uint8Array(await response!.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
  expect(protectedPhotoResponse(new Blob(['<svg/>'],{type:'image/svg+xml'}))).toBeNull();
 });
 it('does not redirect protected photo routes to signed storage URLs',()=>{
  for(const source of [studentRoute,teacherRoute,portalTeacherRoute]){
   expect(source).toContain('.download(path)');
   expect(source).toContain('protectedPhotoResponse');
   expect(source).not.toContain('createSignedUrl');
   expect(source).not.toContain('NextResponse.redirect');
  }
 });
});
