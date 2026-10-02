import {describe,expect,it} from 'vitest';
import {examStateLabel,examsCopy} from './copy';

describe('exam state labels',()=>{
 it('localizes every implemented exam state used by the workflow',()=>{
  const states=['draft','scheduled','timetable_published','marks_open','marks_locked','results_approved','results_published','archived'];
  for(const state of states){
   expect(examStateLabel(state,examsCopy.en)).not.toBe(state.replaceAll('_',' '));
   expect(examStateLabel(state,examsCopy.ur)).not.toBe(state.replaceAll('_',' '));
   expect(examStateLabel(state,examsCopy.ar)).not.toBe(state.replaceAll('_',' '));
  }
 });
});
