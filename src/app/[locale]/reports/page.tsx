import {notFound} from 'next/navigation';
import {ReportsHub} from '@/components/reports-hub';
import {routing} from '@/i18n/routing';
import type {Locale} from '@/lib/i18n/config';
import {getReportsHub} from '@/lib/reports/workspace';
export default async function ReportsPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!routing.locales.includes(locale as Locale))notFound();const data=await getReportsHub();return <ReportsHub locale={locale as Locale} definitions={data.reports} recentRuns={data.recentRuns} localDate={data.localDate}/>;}