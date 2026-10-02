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
export type ReportParameterKey='attendance_date'|'date_from'|'date_to'|'program_id'|'group_id'|'student_person_id'|'teacher_person_id';

export const reportParameterSchema:Record<OperationalReportKey,readonly ReportParameterKey[]>={
 student_master:[],
 admission_register:[],
 employee_register:[],
 daily_attendance:['attendance_date','date_from','date_to','program_id','group_id','student_person_id'],
 student_strength:['date_from','date_to','program_id','group_id'],
 teacher_attendance:['date_from','date_to','teacher_person_id'],
 quran_progress:['date_from','date_to','program_id','group_id','student_person_id'],
 program_progress:['date_from','date_to','program_id','group_id','student_person_id'],
 exam_performance:['date_from','date_to','program_id','group_id','student_person_id'],
 absence_trend:['date_from','date_to','program_id','group_id'],
 late_trend:['date_from','date_to','program_id','group_id'],
 new_admissions:['date_from','date_to','program_id','group_id'],
 group_program_comparison:['date_from','date_to','program_id','group_id']
};

export function isOperationalReportKey(value:string):value is OperationalReportKey{
 return supportedOperationalReports.includes(value as OperationalReportKey);
}
export function reportSupportsParameter(reportKey:string,key:ReportParameterKey):boolean{
 return isOperationalReportKey(reportKey)&&reportParameterSchema[reportKey].includes(key);
}

function validIsoDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
}

export function validateReportParameters(reportKey:OperationalReportKey,input:unknown):{value?:Raw;errors:string[]}{
 const parameters=input&&typeof input==='object'&&!Array.isArray(input)?input as Raw:{};
 const allowed=new Set<ReportParameterKey>(reportParameterSchema[reportKey]);
 const errors:string[]=[];
 const value:Raw={};
 for(const [key,raw] of Object.entries(parameters)){
  if(raw===undefined||raw===null||raw==='')continue;
  if(!allowed.has(key as ReportParameterKey)){errors.push(`${key.replaceAll('_',' ')} is not valid for this report.`);continue;}
  if(key==='attendance_date'||key==='date_from'||key==='date_to'){
   if(typeof raw!=='string'||!validIsoDate(raw))errors.push(`Valid ${key.replaceAll('_',' ')} is required.`);
   else value[key]=raw;
   continue;
  }
  const numeric=Number(raw);
  if(!Number.isInteger(numeric)||numeric<=0)errors.push(`Valid ${key.replaceAll('_',' ')} is required.`);
  else value[key]=numeric;
 }
 if(reportKey==='new_admissions'){
  if(typeof value.date_from!=='string')errors.push('From date is required for New Admissions.');
  if(typeof value.date_to!=='string')errors.push('To date is required for New Admissions.');
 }
 if(typeof value.date_from==='string'&&typeof value.date_to==='string'&&value.date_from>value.date_to)errors.push('From date cannot be after To date.');
 return errors.length?{errors}:{errors:[],value};
}

export function validateReportRun(input:unknown):{value?:ReportRunInput;errors:string[]}{
 const errors:string[]=[];
 if(!input||typeof input!=='object'||Array.isArray(input))return{errors:['Request body must be an object.']};
 const r=input as Raw;
 const reportKey=typeof r.reportKey==='string'&&isOperationalReportKey(r.reportKey)?r.reportKey:null;
 const outputFormat=typeof r.outputFormat==='string'&&formats.includes(r.outputFormat as typeof formats[number])?r.outputFormat as 'screen'|'csv'|'json':null;
 const requestKey=typeof r.requestKey==='string'?r.requestKey.trim():'';
 if(!reportKey)errors.push('Unsupported report.');
 if(!outputFormat)errors.push('Unsupported report format.');
 if(requestKey.length<16||requestKey.length>128)errors.push('Valid request key is required.');
 const checked=reportKey?validateReportParameters(reportKey,r.parameters):{errors:[],value:{} as Raw};
 errors.push(...checked.errors);
 if(errors.length||!reportKey||!outputFormat||!checked.value)return{errors};
 return{errors:[],value:{reportKey,parameters:checked.value,outputFormat,requestKey}};
}
