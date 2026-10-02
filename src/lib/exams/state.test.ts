import {describe,expect,it} from 'vitest';
import {getExamActionAvailability} from './state';

const base={canRead:true,canEnter:true,canModerate:true,canApprove:true,canPublish:true,marksComplete:true,analysisAvailable:false};

describe('exam action availability',()=>{
 it('allows normal mark entry and calculation only in the real marks-open state',()=>{
  const open=getExamActionAvailability({...base,state:'marks_open',resultState:null});
  expect(open.enterMarks).toBe(true);expect(open.reviewMarks).toBe(true);expect(open.moderateMarks).toBe(false);expect(open.calculate).toBe(true);
  const incomplete=getExamActionAvailability({...base,state:'marks_open',resultState:null,marksComplete:false});
  expect(incomplete.calculate).toBe(false);
 });
 it('keeps moderation available to a moderator-only role while marks are open',()=>{
  const state=getExamActionAvailability({...base,state:'marks_open',resultState:null,canEnter:false,canModerate:true});
  expect(state.enterMarks).toBe(false);expect(state.reviewMarks).toBe(true);expect(state.moderateMarks).toBe(true);
 });
 it('keeps locked marks reviewable and only approves a calculated locked run',()=>{
  const locked=getExamActionAvailability({...base,state:'marks_locked',resultState:'calculated',analysisAvailable:true});
  expect(locked.enterMarks).toBe(false);expect(locked.reviewMarks).toBe(true);expect(locked.moderateMarks).toBe(true);expect(locked.calculate).toBe(false);expect(locked.approve).toBe(true);
  const inconsistent=getExamActionAvailability({...base,state:'marks_open',resultState:'calculated',analysisAvailable:true});expect(inconsistent.approve).toBe(false);
 });
 it('offers publication only for approved results in results-approved state',()=>{
  const state=getExamActionAvailability({...base,state:'results_approved',resultState:'approved',analysisAvailable:true});expect(state.publish).toBe(true);expect(state.reports).toBe(false);expect(state.moderateMarks).toBe(true);
 });
 it('offers report cards only after publication while preserving read-only marks',()=>{
  const state=getExamActionAvailability({...base,state:'results_published',resultState:'approved',analysisAvailable:true});expect(state.enterMarks).toBe(false);expect(state.reviewMarks).toBe(true);expect(state.moderateMarks).toBe(false);expect(state.publish).toBe(false);expect(state.reports).toBe(true);
 });
 it('allows archived marks to be read but never mutated or recalculated',()=>{
  const state=getExamActionAvailability({...base,state:'archived',resultState:'approved',analysisAvailable:true});expect(state.reviewMarks).toBe(true);expect(state.enterMarks).toBe(false);expect(state.moderateMarks).toBe(false);expect(state.calculate).toBe(false);expect(state.approve).toBe(false);expect(state.publish).toBe(false);
 });
 it('does not expose actions without relevant permission or data',()=>{
  const state=getExamActionAvailability({state:'marks_open',resultState:null,canRead:false,canEnter:false,canModerate:false,canApprove:false,canPublish:false,marksComplete:true,analysisAvailable:false});expect(Object.values(state).some(Boolean)).toBe(false);
 });
});
