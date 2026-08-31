import Link from 'next/link';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import type {Locale} from '@/lib/i18n/config';
import {documentsCopy} from '@/lib/documents/copy';
import {getDocumentCenter} from '@/lib/documents/workspace';

type SearchParams={q?:string;page?:string};
export default async function DocumentsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<SearchParams>}){
 const [{locale:rawLocale},query]=await Promise.all([params,searchParams]);if(!routing.locales.includes(rawLocale as Locale))notFound();const locale=rawLocale as Locale;const t=documentsCopy[locale];const search=typeof query.q==='string'&&query.q.trim()?query.q.trim():null;const page=Math.max(Number(query.page)||1,1);const data=await getDocumentCenter(search,page,40);const pageCount=Math.max(Math.ceil(data.total/data.pageSize),1);
 return <div className="documents-shell">
  <section className="documents-hero"><div><p className="eyebrow">{t.documents}</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="documents-count"><strong>{data.total}</strong><span>{t.showing}</span></div></section>
  <form className="panel documents-search" method="get"><label className="field-label">{t.search}<input className="text-field" name="q" defaultValue={search??''} placeholder={t.searchPlaceholder}/></label><button className="action-button" type="submit">{t.search}</button>{search?<Link className="secondary-button" href={`/${locale}/documents`}>{t.clear}</Link>:null}</form>
  <section className="documents-list">{data.rows.length?data.rows.map(student=><article className="panel document-student" key={student.personId}><header><div><span>{student.studentNumber}</span><h2>{student.name}</h2>{student.nameNative?<small dir="auto">{student.nameNative}</small>:null}</div><strong>{student.classGroup||'—'}</strong></header><div className="document-actions">
   <div><span>{t.idCard}</span><small>{t.printReady}</small><Link className="secondary-button" href={`/${locale}/students/${student.personId}/id-card`}>{t.open}</Link></div>
   <div><span>{t.profile}</span><small>{t.printReady}</small><Link className="secondary-button" href={`/${locale}/students/${student.personId}`}>{t.open}</Link></div>
   <div><span>{t.statusCertificate}</span><small>{t.issueOrOpen}</small><Link className="secondary-button" href={`/${locale}/documents/student-status/${student.personId}`}>{t.open}</Link></div>
   <div className={!student.quranProgressAvailable?'is-disabled':''}><span>{t.quran}</span><small>{student.quranProgressAvailable?t.printReady:t.notAvailable}</small>{student.quranProgressAvailable?<Link className="secondary-button" href={`/${locale}/quran/${student.personId}`}>{t.open}</Link>:<button className="secondary-button" type="button" disabled>{t.open}</button>}</div>
   <div className={!student.reportCardIssued?'is-disabled':''}><span>{t.reportCard}</span><small>{student.reportCardIssued?t.printReady:t.notIssued}</small>{student.reportCardIssued?<Link className="secondary-button" href={`/${locale}/exams/report-card/${student.personId}`}>{t.open}</Link>:<button className="secondary-button" type="button" disabled>{t.open}</button>}</div>
  </div></article>):<p className="panel empty-state">{t.noStudents}</p>}</section>
  {pageCount>1?<nav className="documents-pagination" aria-label="Pagination">{page>1?<Link className="secondary-button" href={`/${locale}/documents?${new URLSearchParams({...(search?{q:search}:{}),page:String(page-1)})}`}>←</Link>:null}<span>{page} / {pageCount}</span>{page<pageCount?<Link className="secondary-button" href={`/${locale}/documents?${new URLSearchParams({...(search?{q:search}:{}),page:String(page+1)})}`}>→</Link>:null}</nav>:null}
  <section className="panel documents-recent"><header><h2>{t.recent}</h2></header>{data.recentIssued.length?<div>{data.recentIssued.map(item=><article key={item.issueId}><div><strong>{item.studentName}</strong><small>{item.templateKey} · Revision {item.revision}</small></div><Link className="secondary-button" href={`/${locale}/exams/report-card/${item.personId}`}>{t.open}</Link></article>)}</div>:<p className="empty-state">{t.noRecent}</p>}</section>
 </div>;
}