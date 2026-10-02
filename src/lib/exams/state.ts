export type ExamActionStateInput={
 state:string;
 resultState:string|null;
 canRead:boolean;
 canEnter:boolean;
 canModerate:boolean;
 canApprove:boolean;
 canPublish:boolean;
 marksComplete:boolean;
 analysisAvailable:boolean;
};

export type ExamActionAvailability={
 enterMarks:boolean;
 reviewMarks:boolean;
 moderateMarks:boolean;
 calculate:boolean;
 approve:boolean;
 publish:boolean;
 reports:boolean;
 exportResults:boolean;
 analysis:boolean;
};

export function getExamActionAvailability(input:ExamActionStateInput):ExamActionAvailability{
 const editable=input.state==='marks_open';
 const readable=['marks_open','marks_locked','results_approved','results_published','archived'].includes(input.state);
 const moderationState=['marks_open','marks_locked','results_approved'].includes(input.state);
 const calculationState=input.state==='marks_open'||input.state==='marks_locked';
 const hasCurrentResult=['calculated','approved','published'].includes(input.resultState??'');
 return{
  enterMarks:input.canEnter&&editable,
  reviewMarks:(input.canRead||input.canEnter||input.canModerate)&&readable,
  moderateMarks:input.canModerate&&moderationState&&(!editable||!input.canEnter),
  calculate:input.canApprove&&calculationState&&input.marksComplete&&!hasCurrentResult,
  approve:input.canApprove&&input.state==='marks_locked'&&input.resultState==='calculated',
  publish:input.canPublish&&input.state==='results_approved'&&input.resultState==='approved',
  reports:input.state==='results_published'&&input.analysisAvailable,
  exportResults:input.analysisAvailable&&hasCurrentResult,
  analysis:input.analysisAvailable&&hasCurrentResult
 };
}
