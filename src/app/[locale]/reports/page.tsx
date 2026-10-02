import {notFound} from 'next/navigation';
import {ReportsHub} from '@/components/reports-hub';
import {InlineState} from '@/components/workspace-ui';
import {routing} from '@/i18n/routing';
import type {SupportedLocale} from '@/lib/i18n/config';
import {requireOfficeAudience} from '@/lib/navigation/office-gate';
import {getReportsHub} from '@/lib/reports/workspace';
import styles from './page.module.css';

const emptyCopy={
 en:{title:'No reports have been generated yet',body:'Choose a report below, set any useful filters, then preview it. Completed runs will appear in Recent report runs.',action:'Choose a report'},
 ur:{title:'ابھی کوئی رپورٹ تیار نہیں ہوئی',body:'نیچے رپورٹ منتخب کریں، ضروری فلٹرز طے کریں، پھر پیش منظر دیکھیں۔ مکمل رپورٹس حالیہ رپورٹس میں نظر آئیں گی۔',action:'رپورٹ منتخب کریں'}
} as const;

export default async function ReportsPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(!routing.locales.includes(locale as SupportedLocale))notFound();const typedLocale:SupportedLocale=locale==='ur'?'ur':'en';await requireOfficeAudience(typedLocale);const data=await getReportsHub();const t=emptyCopy[typedLocale];
 return <div className={styles.workspace}>{data.recentRuns.length===0?<InlineState title={t.title} body={t.body} action={<a className="action-button action-button-primary" href="#reports-workspace">{t.action}</a>}/>:null}<div id="reports-workspace"><ReportsHub locale={typedLocale} definitions={data.reports} recentRuns={data.recentRuns} localDate={data.localDate} filters={data.filters} institutionName={data.institutionName}/></div></div>;
}
