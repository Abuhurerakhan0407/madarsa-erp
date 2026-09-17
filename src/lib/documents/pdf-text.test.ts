import {describe,expect,it} from 'vitest';
import {escapePdfLiteralText,normalizePdfAsciiText} from './pdf-text';

describe('shared PDF text normalization',()=>{
 it('keeps common publishing punctuation readable instead of replacing it with question marks',()=>{
  const value=normalizePdfAsciiText('Qur’an · Hifz — Progress…');
  expect(value).toBe("Qur'an - Hifz - Progress...");
  expect(value).not.toContain('?');
 });

 it('folds Latin accents before the ASCII transport layer',()=>{
  expect(normalizePdfAsciiText('José')).toBe('Jose');
 });

 it('escapes PDF literal-string delimiters after normalization',()=>{
  expect(escapePdfLiteralText('Ayaan (Year 1) \\ verified')).toBe('Ayaan \\(Year 1\\) \\\\ verified');
 });
});
