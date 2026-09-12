import {notFound} from 'next/navigation';
import {ReportsHub} from '@/components/reports-hub';
import {InlineState} from '@/components/workspace-ui';
import {routing} from '@/i18n/routing';
import type {Locale} from '@/lib/i18n/config';
import {getReportsHub} from '@/lib/reports/workspace';

const emptyCopy={
 en:{title:'No reports have been generated yet',body:'Choose a report below, set any useful filters, then run it on screen. Completed runs will appear in Recent report runs.',action:'Choose a report'},
 ur:{title:'ابھی کوئی رپورٹ تیار نہیں ہوئی',body:'نیچے رپورٹ منتخب کریں، ضروری فلٹرز طے کریں، پھر اسکرین پر چلائیں۔ مکمل رپورٹس حالیہ رپورٹس میں نظر آئیں گی۔',action:'رپورٹ منتخب کریں'},
 ar:{title:'لم يتم إنشاء تقارير بعد',body:'اختر تقريراً أدناه واضبط المرشحات المفيدة ثم شغّله على الشاشة. ستظهر العمليات المكتملة في التقارير الأخيرة.',action:'اختيار تقرير'}
} as const;

export default async function ReportsPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(!routing.locales.includes(locale as Locale))notFound();const typedLocale=locale as Locale;const data=await getReportsHub();const t=emptyCopy[typedLocale];
 return <>{data.recentRuns.length===0?<InlineState title={t.title} body={t.body} action={<a className="action-button action-button-primary" href="#reports-workspace">{t.action}</a>}/>:null}<div id="reports-workspace"><ReportsHub locale={typedLocale} definitions={data.reports} recentRuns={data.recentRuns} localDate={data.localDate} filters={data.filters}/></div></>;
}
