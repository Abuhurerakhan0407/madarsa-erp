"use client";

import {useMemo,useRef,useState} from 'react';
import type {Locale} from '@/lib/i18n/config';
import {reportsCopy} from '@/lib/reports/copy';
import {reportSupportsParameter,type ReportParameterKey} from '@/lib/reports/model';
import {formatReportCell} from '@/lib/reports/presentation';
import type {ReportFilterOption,ReportPersonFilter} from '@/lib/reports/workspace';

type Raw=Record<string,unknown>;
type Definition={id:number;key:string;labels:Raw;domain:string;parameterSchema:Raw;allowedColumns:string[]};
type Recent={id:number;reportKey:string;labels:Raw;parameters:Raw;outputFormat:string;state:string;rowCount:number;createdAt:string;completedAt:string|null};
type Result={run_id:number;report_key:string;labels:Raw;columns:string[];rows:Raw[];row_count:number;parameters:Raw;output_format:string};
type Filters={sessions:ReportFilterOption[];programs:ReportFilterOption[];groups:ReportFilterOption[];students:ReportPersonFilter[];teachers:ReportPersonFilter[]};
type UiLocale='en'|'ur';

const label=(labels:Raw,locale:Locale,fallback:string)=>typeof labels[locale]==='string'?String(labels[locale]):typeof labels.en==='string'?String(labels.en):fallback;
const titleize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const cell=(v:unknown)=>v===null||v===undefined||v===''?'—':typeof v==='object'?JSON.stringify(v):String(v);
function safeCsvCell(v:unknown){let s=cell(v);if(/^[=+\-@]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;}
function triggerDownload(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();window.setTimeout(()=>{a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);},2000);}
function filenamePart(value:string){const safe=value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return safe||'ilmgaah';}
function downloadCsv(result:Result,institutionName:string,dateSuffix:string){const header=result.columns.map(safeCsvCell).join(',');const rows=result.rows.map(row=>result.columns.map(c=>safeCsvCell(row[c])).join(',')).join('\r\n');const blob=new Blob(['\ufeff',header,'\r\n',rows],{type:'text/csv;charset=utf-8'});triggerDownload(blob,`${filenamePart(institutionName)}-${filenamePart(result.report_key)}-${dateSuffix}.csv`);}
function minusDays(date:string,days:number){const d=new Date(`${date}T00:00:00Z`);if(Number.isNaN(d.valueOf()))return date;d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);}
const idValue=(value:string)=>value?Number(value):null;
const uiLocale=(locale:Locale):UiLocale=>locale==='ur'?'ur':'en';

const columnCopy:Record<UiLocale,Record<string,string>>={
 en:{student_number:'Student number',name:'Name',gender:'Gender',date_of_birth:'Date of birth',program:'Program',class_group:'Class / group',status:'Status',joined_on:'Joined on',application_id:'Application ID',applicant_name:'Applicant name',guardian_name:'Guardian name',state:'State',submitted_at:'Submitted at',converted_at:'Converted at',source:'Source',marked_at:'Marked at',note:'Note',latest_category:'Latest category',latest_portion:'Latest portion',latest_score:'Latest score',latest_outcome:'Latest outcome',attempts:'Attempts',revision_due:'Revision due',exam:'Exam',subject:'Subject',student_name:'Student name',marks:'Marks',maximum_marks:'Maximum marks',percentage:'Percentage',employee_number:'Employee number',department:'Department',designation:'Designation',contract_type:'Contract type',attendance_today:'Attendance today',academic_session:'Academic year',students:'Students',capacity:'Capacity',utilization_pct:'Utilization',attendance_date:'Attendance date',teacher_id:'Teacher ID',teacher_name:'Teacher name',check_in:'Check in',check_out:'Check out',component:'Component',unit:'Unit',progress_method:'Progress method',progress_value:'Progress value',occurred_at:'Recorded at',absent:'Absent',recorded:'Recorded',absence_rate:'Absence rate',late:'Late',late_rate:'Late rate',admission_number:'Admission number',attendance_records:'Attendance records',present:'Present',attendance_rate:'Attendance rate',progress_events:'Progress events',exam_average:'Exam average'},
 ur:{student_number:'طالب علم نمبر',name:'نام',gender:'جنس',date_of_birth:'تاریخ پیدائش',program:'پروگرام',class_group:'کلاس / گروپ',status:'حیثیت',joined_on:'تاریخ شمولیت',application_id:'درخواست ID',applicant_name:'درخواست گزار کا نام',guardian_name:'سرپرست کا نام',state:'حالت',submitted_at:'درخواست کی تاریخ',converted_at:'تبدیلی کی تاریخ',source:'ذریعہ',marked_at:'حاضری درج ہونے کا وقت',note:'نوٹ',latest_category:'تازہ زمرہ',latest_portion:'تازہ حصہ',latest_score:'تازہ اسکور',latest_outcome:'تازہ نتیجہ',attempts:'کوششیں',revision_due:'دہرائی کی تاریخ',exam:'امتحان',subject:'مضمون',student_name:'طالب علم کا نام',marks:'نمبر',maximum_marks:'کل نمبر',percentage:'فیصد',employee_number:'ملازم نمبر',department:'شعبہ',designation:'عہدہ',contract_type:'معاہدے کی قسم',attendance_today:'آج کی حاضری',academic_session:'تعلیمی سال',students:'طلبہ',capacity:'گنجائش',utilization_pct:'گنجائش کا استعمال',attendance_date:'حاضری کی تاریخ',teacher_id:'استاد ID',teacher_name:'استاد کا نام',check_in:'آمد',check_out:'روانگی',component:'جزو',unit:'یونٹ',progress_method:'پیش رفت طریقہ',progress_value:'پیش رفت',occurred_at:'ریکارڈ ہونے کا وقت',absent:'غیر حاضر',recorded:'ریکارڈ شدہ',absence_rate:'غیر حاضری شرح',late:'تاخیر',late_rate:'تاخیر شرح',admission_number:'داخلہ نمبر',attendance_records:'حاضری ریکارڈ',present:'حاضر',attendance_rate:'حاضری شرح',progress_events:'پیش رفت ریکارڈ',exam_average:'امتحانی اوسط'}
};

function columnLabel(column:string,locale:Locale){const language=uiLocale(locale);return columnCopy[language][column]??(language==='ur'?`فیلڈ: ${column}`:titleize(column));}
function outputFormatLabel(format:string,locale:Locale){if(format==='screen')return reportsCopy[locale].screen;if(format==='csv')return 'CSV';if(format==='pdf')return 'PDF';return format.toUpperCase();}

export function ReportsHub({locale,definitions,recentRuns,localDate,filters,institutionName}:{locale:Locale;definitions:Definition[];recentRuns:Recent[];localDate:string;filters:Filters;institutionName:string}){
 const t=reportsCopy[locale];
 const [selected,setSelected]=useState(definitions[0]?.key??'');
 const [dateFrom,setDateFrom]=useState(minusDays(localDate,29));
 const [dateTo,setDateTo]=useState(localDate);
 const [program,setProgram]=useState('');
 const [group,setGroup]=useState('');
 const [person,setPerson]=useState('');
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const requestVersion=useRef(0);
 const actionLock=useRef(false);
 const active=useMemo(()=>definitions.find(d=>d.key===selected)??null,[definitions,selected]);
 const supports=(key:ReportParameterKey)=>reportSupportsParameter(selected,key);
 const isTeacher=selected==='teacher_attendance';
 const people=isTeacher?filters.teachers:filters.students;
 const groups=useMemo(()=>filters.groups.filter(item=>!program||item.programId===Number(program)),[filters.groups,program]);
 const parameters=()=>{const value:Raw={};if(supports('date_from'))value.date_from=dateFrom;if(supports('date_to'))value.date_to=dateTo;if(supports('program_id')&&program)value.program_id=idValue(program);if(supports('group_id')&&group)value.group_id=idValue(group);if(isTeacher&&supports('teacher_person_id')&&person)value.teacher_person_id=idValue(person);if(!isTeacher&&supports('student_person_id')&&person)value.student_person_id=idValue(person);return value;};
 const activeTitle=active?label(active.labels,locale,t[active.key]??titleize(active.key)):'';
 const activeDescription=active?t[`${active.key}_description`]??'':'';
 const activeDomain=active?t[`domain_${active.domain}`]??t.report:'';
 const exportDateSuffix=supports('date_from')&&supports('date_to')?`${dateFrom}-to-${dateTo}`:localDate;
 const canExport=Boolean(result&&result.report_key===selected);

 function resetOutput(){requestVersion.current+=1;setResult(null);setError(null);}
 function selectReport(key:string){if(busy)return;resetOutput();setSelected(key);setPerson('');setProgram('');setGroup('');}
 function changeProgram(value:string){resetOutput();setProgram(value);setGroup('');setPerson('');}
 function changeGroup(value:string){resetOutput();setGroup(value);setPerson('');}
 function changePerson(value:string){resetOutput();setPerson(value);}
 function changeDateFrom(value:string){resetOutput();setDateFrom(value);}
 function changeDateTo(value:string){resetOutput();setDateTo(value);}

 async function run(output:'screen'|'csv'='screen'){
  if(!selected||actionLock.current||(output==='csv'&&!canExport))return;
  actionLock.current=true;
  const requestId=++requestVersion.current;
  const submittedReport=selected;
  const submittedParameters=parameters();
  setBusy(true);setError(null);
  try{
   const response=await fetch('/api/reports/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportKey:submittedReport,parameters:submittedParameters,outputFormat:output,requestKey:crypto.randomUUID()})});
   const payload=await response.json().catch(()=>({})) as {result?:Result;error?:string};
   if(requestId!==requestVersion.current)return;
   if(!response.ok||!payload.result){setError(locale==='ur'?t.error:(payload.error||t.error));return;}
   setResult(payload.result);
   if(output==='csv')downloadCsv(payload.result,institutionName,exportDateSuffix);
  }catch{
   if(requestId===requestVersion.current)setError(t.error);
  }finally{
   actionLock.current=false;
   if(requestId===requestVersion.current)setBusy(false);
  }
 }

 async function downloadPdf(){
  if(!selected||!canExport||actionLock.current)return;
  actionLock.current=true;
  const requestId=++requestVersion.current;
  const submittedReport=selected;
  const submittedParameters=parameters();
  setBusy(true);setError(null);
  try{
   const response=await fetch('/api/reports/pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportKey:submittedReport,parameters:submittedParameters})});
   if(requestId!==requestVersion.current)return;
   if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};setError(locale==='ur'?t.error:(payload.error||t.error));return;}
   const blob=await response.blob();
   if(requestId!==requestVersion.current)return;
   triggerDownload(blob,`${filenamePart(institutionName)}-${filenamePart(submittedReport)}-${exportDateSuffix}.pdf`);
  }catch{
   if(requestId===requestVersion.current)setError(t.error);
  }finally{
   actionLock.current=false;
   if(requestId===requestVersion.current)setBusy(false);
  }
 }

 return <div className="reports-shell">
  <section className="reports-hero"><div><p className="eyebrow">{t.report}</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="reports-hero-count"><strong>{definitions.length}</strong><span>{t.report}</span></div></section>
  {error?<p className="form-message form-error" role="alert">{error}</p>:null}
  <section className="panel report-controls" aria-busy={busy||undefined}>
   <div className="report-control-main">
    <label className="field-label">{t.chooseReport}<select className="text-field" value={selected} disabled={busy||!definitions.length} onChange={e=>selectReport(e.target.value)}>{definitions.map(d=><option key={d.key} value={d.key}>{label(d.labels,locale,t[d.key]??titleize(d.key))}</option>)}</select></label>
    {active?<div className="report-selected-summary"><span className="state-kicker">{activeDomain}</span><h2>{activeTitle}</h2>{activeDescription?<p>{activeDescription}</p>:null}<small>{active.allowedColumns.length} {t.fields}</small></div>:null}
    {supports('date_from')?<label className="field-label">{t.dateFrom}<input className="text-field" type="date" value={dateFrom} max={dateTo} disabled={busy} onChange={e=>changeDateFrom(e.target.value)}/></label>:null}
    {supports('date_to')?<label className="field-label">{t.dateTo}<input className="text-field" type="date" value={dateTo} min={dateFrom} disabled={busy} onChange={e=>changeDateTo(e.target.value)}/></label>:null}
    {supports('program_id')?<label className="field-label">{t.program}<select className="text-field" value={program} disabled={busy} onChange={e=>changeProgram(e.target.value)}><option value="">{t.allPrograms}</option>{filters.programs.map(item=><option key={item.id} value={item.id}>{label(item.labels,locale,item.key)}</option>)}</select></label>:null}
    {supports('group_id')?<label className="field-label">{t.group}<select className="text-field" value={group} disabled={busy} onChange={e=>changeGroup(e.target.value)}><option value="">{t.allGroups}</option>{groups.map(item=><option key={item.id} value={item.id}>{label(item.labels,locale,item.key)}</option>)}</select></label>:null}
    {(supports('student_person_id')||supports('teacher_person_id'))?<label className="field-label">{t.studentTeacher}<select className="text-field" value={person} disabled={busy} onChange={e=>changePerson(e.target.value)}><option value="">{isTeacher?t.teachers:t.students} · {t.allPeople}</option>{people.map(item=><option key={item.personId} value={item.personId}>{item.name}{item.reference?` · ${item.reference}`:''}</option>)}</select></label>:null}
   </div>
   <div className="report-actions"><button type="button" className="action-button" disabled={busy||!active} aria-busy={busy||undefined} onClick={()=>void run('screen')}>{busy?<><span className="inline-spinner" aria-hidden="true"/>{t.loading}</>:t.generate}</button><button type="button" className="secondary-button" disabled={busy||!active||!canExport} onClick={()=>void run('csv')}>{t.exportCsv}</button><button type="button" className="secondary-button" disabled={busy||!active||!canExport} onClick={()=>void downloadPdf()}>{t.exportPdf}</button>{result?<button type="button" className="secondary-button" disabled={busy} onClick={()=>window.print()}>{t.print}</button>:null}</div>
  </section>
  {result?<section className="panel report-output" aria-live="polite"><header><div><p className="eyebrow">#{result.run_id}</p><h2>{label(result.labels,locale,t[result.report_key]??titleize(result.report_key))}</h2></div><strong>{result.row_count} {t.rows}</strong></header>{result.rows.length?<div className="table-scroll"><table className="data-table reports-table"><thead><tr>{result.columns.map(c=><th key={c}>{columnLabel(c,locale)}</th>)}</tr></thead><tbody>{result.rows.map((row,i)=><tr key={i}>{result.columns.map(c=><td key={c} data-label={columnLabel(c,locale)}>{formatReportCell(c,row[c],locale)}</td>)}</tr>)}</tbody></table></div>:<p className="empty-state">{t.noRows}</p>}</section>:null}
  <section className="panel reports-recent"><header><h2>{t.recent}</h2></header>{recentRuns.length?<div className="reports-run-list">{recentRuns.map(r=><article key={r.id}><div><strong>{label(r.labels,locale,t[r.reportKey]??titleize(r.reportKey))}</strong><small>#{r.id} · {outputFormatLabel(r.outputFormat,locale)}</small></div><span>{r.rowCount} {t.rows}</span></article>)}</div>:<p className="empty-state">{t.noRuns}</p>}</section>
 </div>;
}
