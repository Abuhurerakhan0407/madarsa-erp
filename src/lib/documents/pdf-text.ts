const smartPunctuation: Array<[RegExp,string]> = [
  [/\u00a0/g,' '],
  [/[\u2018\u2019\u201a\u201b\u2032\u02bc]/g,"'"],
  [/[\u201c\u201d\u201e\u201f\u2033]/g,'"'],
  [/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g,'-'],
  [/\u2026/g,'...'],
  [/[\u00b7\u2022\u2027]/g,' - ']
];

export function normalizePdfAsciiText(value:string):string{
  let normalized=value;
  for(const [pattern,replacement] of smartPunctuation) normalized=normalized.replace(pattern,replacement);
  return normalized
    .normalize('NFKD')
    .replace(/\p{M}/gu,'')
    .replace(/[^\x20-\x7E]/g,'?')
    .replace(/\s{2,}/g,' ');
}

export function escapePdfLiteralText(value:string):string{
  return normalizePdfAsciiText(value)
    .replace(/\\/g,'\\\\')
    .replace(/\(/g,'\\(')
    .replace(/\)/g,'\\)');
}
