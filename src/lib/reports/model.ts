type Raw=Record<string,unknown>;

export const supportedOperationalReports=[
 'student_master',
 'admission_register',
 'employee_register',
 'daily_attendance',
 'student_strength',
 'teacher_attendance',
 'quran_progress',
 'program_progress',
 'exam_performance',
 'absence_trend',
 'late_trend',
 'new_admissions',
 'group_program_comparison'
] as const;

const formats=['screen','csv','json'] as const;
export type OperationalReportKey=typeof supportedOperationalReports[number];
export type ReportRunInput={reportKey:OperationalReportKey;parameters:Raw;outputFormat:'screen'|'csv'|'json';requestKey:string};

export function validateReportRun(input:unknown):{value?:ReportRunInput;errors:string[]}{
 const errors:string[]=[];
 if(!input||typeof input!=='object'||Array.isArray(input))return{errors:['Request body must be an object.']};
 const r=input as Raw;
 const reportKey=typeof r.reportKey==='string'&&supportedOperationalReports.includes(r.reportKey as OperationalReportKey)?r.reportKey as OperationalReportKey:null;
 const outputFormat=typeof r.outputFormat==='string'&&formats.includes(r.outputFormat as typeof formats[number])?r.outputFormat as 'screen'|'csv'|'json':null;
 const requestKey=typeof r.requestKey==='string'?r.requestKey.trim():'';
 const parameters=r.parameters&&typeof r.parameters==='object'&&!Array.isArray(r.parameters)?r.parameters as Raw:{};
 if(!reportKey)errors.push('Unsupported report.');
 if(!outputFormat)errors.push('Unsupported report format.');
 if(requestKey.length<16||requestKey.length>128)errors.push('Valid request key is required.');
 for(const key of ['attendance_date','date_from','date_to'] as const){
  const value=parameters[key];
  if(value!==undefined&&value!==null&&value!==''){
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))errors.push(`Valid ${key.replaceAll('_',' ')} is required.`);
  }
 }
 for(const key of ['session_id','program_id','group_id','student_person_id','teacher_person_id'] as const){
  const value=parameters[key];
  if(value!==undefined&&value!==null&&value!==''){
   const numeric=Number(value);
   if(!Number.isInteger(numeric)||numeric<=0)errors.push(`Valid ${key.replaceAll('_',' ')} is required.`);
  }
 }
 if(errors.length||!reportKey||!outputFormat)return{errors};
 return{errors,value:{reportKey,parameters,outputFormat,requestKey}};
}
