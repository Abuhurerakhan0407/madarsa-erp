import {describe,expect,it} from 'vitest';

type Status='present'|'exempt'|'absent'|'incomplete'|'withheld';
type Subject={marks?:number;max:number;pass:number;status:Status};
type Band={key:string;min:number;max:number};
const bands:Band[]=[{key:'A',min:80,max:100},{key:'B',min:60,max:79.99},{key:'C',min:40,max:59.99},{key:'F',min:0,max:39.99}];
function roundValue(value:number,mode:'none'|'floor'|'ceil'|'half_up'|'half_even',places:number){if(mode==='none')return value;const s=10**places,x=value*s;if(mode==='floor')return Math.floor(x)/s;if(mode==='ceil')return Math.ceil(x)/s;if(mode==='half_even'){const f=Math.floor(x),d=x-f;return (d<.5?f:d>.5?f+1:f%2===0?f:f+1)/s;}return Math.round((x+Number.EPSILON))/s;}
function grade(pct:number){return bands.find(b=>pct>=b.min&&pct<=b.max)?.key??null;}
function calculate(subjects:Subject[],mode:'none'|'floor'|'ceil'|'half_up'|'half_even'='half_up',places=2){if(subjects.some(s=>!s.status))throw new Error('missing');const raw=subjects.reduce((n,s)=>n+(s.status==='present'?(s.marks??0):0),0);const max=subjects.reduce((n,s)=>n+(s.status==='exempt'?0:s.max),0);const pct=max?roundValue(raw/max*100,mode,places):null;const fail=subjects.some(s=>s.status==='present'&&(s.marks??0)<s.pass);const status=subjects.some(s=>s.status==='withheld')?'withheld':subjects.some(s=>s.status==='absent'||s.status==='incomplete')?'incomplete':subjects.every(s=>s.status==='exempt')?'exempt':fail?'fail':'pass';return{raw,max,pct,status,grade:pct!==null&&(status==='pass'||status==='fail')?grade(pct):null};}
function ranks(values:number[],enabled:boolean){if(!enabled)return values.map(()=>null);return values.map(v=>1+values.filter(other=>other>v).length);}

describe('Workstream 04 deterministic calculation semantics',()=>{
 it('honors grading boundaries',()=>{expect(grade(80)).toBe('A');expect(grade(79.99)).toBe('B');expect(grade(40)).toBe('C');expect(grade(39.99)).toBe('F');});
 it('honors configured rounding',()=>{expect(roundValue(84.445,'half_up',2)).toBe(84.45);expect(roundValue(84.445,'half_even',2)).toBe(84.44);expect(roundValue(84.449,'floor',2)).toBe(84.44);expect(roundValue(84.441,'ceil',2)).toBe(84.45);expect(roundValue(84.445,'none',2)).toBe(84.445);});
 it('excludes exempt subjects from denominator',()=>{expect(calculate([{marks:80,max:100,pass:40,status:'present'},{max:100,pass:40,status:'exempt'}])).toMatchObject({raw:80,max:100,pct:80,status:'pass',grade:'A'});});
 it('keeps absent/incomplete and withheld distinct',()=>{expect(calculate([{max:100,pass:40,status:'absent'}]).status).toBe('incomplete');expect(calculate([{max:100,pass:40,status:'incomplete'}]).status).toBe('incomplete');expect(calculate([{max:100,pass:40,status:'withheld'}]).status).toBe('withheld');});
 it('ranks only when enabled and gives ties equal rank',()=>{expect(ranks([90,90,80],true)).toEqual([1,1,3]);expect(ranks([90,80],false)).toEqual([null,null]);});
 it('keeps calculated snapshots immutable from later source changes',()=>{const source=[{marks:75,max:100,pass:40,status:'present' as const}];const snapshot=structuredClone(calculate(source));source[0].marks=95;expect(snapshot).toMatchObject({raw:75,pct:75,grade:'B'});expect(calculate(source)).toMatchObject({raw:95,pct:95,grade:'A'});});
});
