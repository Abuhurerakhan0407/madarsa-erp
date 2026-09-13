type Raw=Record<string,unknown>;
export const operationalReportKeys=['daily_attendance','student_strength','teacher_attendance','quran_progress','program_progress','exam_performance','absence_trend','late_trend','new_admissions','group_program_comparison'] as const;
const formats=['screen','csv','json'] as const;
export type OperationalReportKey=typeof operationalReportKeys[number];
export type ReportRunInput={reportKey:OperationalReportKey;parameters:Raw;outputFormat:'screen'|'csv'|'json';requestKey:string};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function validPositiveId(value:unknown){if(value===undefined||value===null||value==='')return true;const number=Number(value);return Number.isInteger(number)&&number>0;}
export function validateReportRun(input:unknown):{value?:ReportRunInput;errors:string[]}{
 const errors:string[]=[];if(!input||typeof input!=='object'||Array.isArray(input))return{errors:['Request body must be an object.']};const r=input as Raw;
 const reportKey=typeof r.reportKey==='string'&&operationalReportKeys.includes(r.reportKey as OperationalReportKey)?r.reportKey as OperationalReportKey:null;
 const outputFormat=typeof r.outputFormat==='string'&&formats.includes(r.outputFormat as typeof formats[number])?r.outputFormat as 'screen'|'csv'|'json':null;
 const requestKey=typeof r.requestKey==='string'?r.requestKey.trim():'';const parameters=r.parameters&&typeof r.parameters==='object'&&!Array.isArray(r.parameters)?r.parameters as Raw:{};
 if(!reportKey)errors.push('Unsupported report.');if(!outputFormat)errors.push('Unsupported report format.');if(requestKey.length<16||requestKey.length>128)errors.push('Valid request key is required.');
 for(const key of ['date_from','date_to','attendance_date'] as const){const value=parameters[key];if(value!==undefined&&value!==null&&value!==''&&(typeof value!=='string'||!datePattern.test(value)))errors.push(`Valid ${key.replaceAll('_',' ')} is required.`);}
 if(typeof parameters.date_from==='string'&&typeof parameters.date_to==='string'&&datePattern.test(parameters.date_from)&&datePattern.test(parameters.date_to)&&parameters.date_from>parameters.date_to)errors.push('Date from cannot be after date to.');
 for(const key of ['session_id','program_id','group_id','student_person_id','teacher_person_id'] as const){if(!validPositiveId(parameters[key]))errors.push(`Invalid ${key.replaceAll('_',' ')} filter.`);}
 if(errors.length||!reportKey||!outputFormat)return{errors};return{errors,value:{reportKey,parameters,outputFormat,requestKey}};
}
