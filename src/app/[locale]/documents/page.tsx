import Link from 'next/link';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import type {Locale} from '@/lib/i18n/config';
import {DocumentCenterV2} from '@/components/document-center-v2';
import {documentsCopy} from '@/lib/documents/copy';
import {clientDocumentTypes,getDocumentCenter,isClientDocumentType} from '@/lib/documents/workspace';
type SearchParams={type?:string;q?:string;page?:string;session?:string;program?:string;group?:string;student?:string};
const positive=(value:unknown)=>{const number=Number(value);return Number.isInteger(number)&&number>0?number:null;};
const localized=(labels:Record<string,unknown>,locale:Locale,fallback:string)=>typeof labels[locale]==='string'?String(labels[locale]):typeof labels.en==='string'?String(labels.en):fallback;
export default async function DocumentsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<SearchParams>}){
 const [{locale:rawLocale},query]=await Promise.all([params,searchParams]);if(!routing.locales.includes(rawLocale as Locale))notFound();const locale=rawLocale as Locale;const t=documentsCopy[locale];const type=isClientDocumentType(query.type)?query.type:'student_id_card';const search=typeof query.q==='string'&&query.q.trim()?query.q.trim().slice(0,160):null;const page=Math.max(Number(query.page)||1,1);const sessionId=positive(query.session),programId=positive(query.program),groupId=positive(query.group),studentPersonId=positive(query.student);const data=await getDocumentCenter({search,page,pageSize:40,sessionId,programId,groupId,studentPersonId});const pageCount=Math.max(Math.ceil(data.total/data.pageSize),1);
 const formBase:Record<string,string>={type:String(type),...(search?{q:search}:{}),...(sessionId?{session:String(sessionId)}:{}),...(programId?{program:String(programId)}:{}),...(groupId?{group:String(groupId)}:{}),...(studentPersonId?{student:String(studentPersonId)}:{})};
 return <div className="documents-shell">
  <section className="documents-hero"><div><p className="eyebrow">{t.documents}</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="documents-count"><strong>{data.total}</strong><span>{t.showing}</span></div></section>
  <section className="panel"><p className="eyebrow">{t.whatGenerate}</p><div className="reports-picker">{clientDocumentTypes.map(key=><Link key={key} className={`report-card ${type===key?'is-selected':''}`} href={`/${locale}/documents?${new URLSearchParams({...formBase,type:key,page:'1'})}`}><strong>{t[key]}</strong></Link>)}</div></section>
  <form className="panel document-filter-grid" method="get"><input type="hidden" name="type" value={type}/>
   <label className="field-label">{t.academicYear}<select className="text-field" name="session" defaultValue={sessionId??''}><option value="">{t.allYears}</option>{data.filters.sessions.map(item=><option key={item.id} value={item.id}>{localized(item.labels,locale,item.key)}</option>)}</select></label>
   <label className="field-label">{t.program}<select className="text-field" name="program" defaultValue={programId??''}><option value="">{t.allPrograms}</option>{data.filters.programs.map(item=><option key={item.id} value={item.id}>{localized(item.labels,locale,item.key)}</option>)}</select></label>
   <label className="field-label">{t.group}<select className="text-field" name="group" defaultValue={groupId??''}><option value="">{t.allGroups}</option>{data.filters.groups.filter(item=>!programId||item.programId===programId).map(item=><option key={item.id} value={item.id}>{localized(item.labels,locale,item.key)}</option>)}</select></label>
   <label className="field-label">{t.student}<select className="text-field" name="student" defaultValue={studentPersonId??''}><option value="">{t.allStudents}</option>{data.filters.students.map(item=><option key={item.personId} value={item.personId}>{item.name} · {item.studentNumber}</option>)}</select></label>
   <label className="field-label document-search-wide">{t.search}<input className="text-field" name="q" defaultValue={search??''} placeholder={t.searchPlaceholder}/></label><div className="quick-actions"><button className="action-button" type="submit">{t.apply}</button><Link className="secondary-button" href={`/${locale}/documents?type=${type}`}>{t.clear}</Link></div>
  </form>
  <DocumentCenterV2 locale={locale} type={type} rows={data.rows} total={data.total} selectionLimit={data.selectionLimit} filters={{sessionId,programId,groupId,studentPersonId,search}}/>
  {pageCount>1?<nav className="documents-pagination" aria-label="Pagination">{page>1?<Link className="secondary-button" href={`/${locale}/documents?${new URLSearchParams({...formBase,page:String(page-1)})}`}>←</Link>:null}<span>{page} / {pageCount}</span>{page<pageCount?<Link className="secondary-button" href={`/${locale}/documents?${new URLSearchParams({...formBase,page:String(page+1)})}`}>→</Link>:null}</nav>:null}
  <section className="panel documents-recent"><header><h2>{t.recent}</h2></header>{data.recentIssued.length?<div>{data.recentIssued.map(item=><article key={item.issueId}><div><strong>{item.studentName}</strong><small>{item.templateKey} · Revision {item.revision}</small></div><Link className="secondary-button" href={`/${locale}/exams/report-card/${item.personId}`}>{t.preview}</Link></article>)}</div>:<p className="empty-state">{t.noRecent}</p>}</section>
 </div>;
}
