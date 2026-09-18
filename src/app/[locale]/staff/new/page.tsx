import type {SupportedLocale} from '@/lib/i18n/config';
import {hrCopy} from '@/lib/hr/copy';
import {HrEmployeeForm} from '@/components/hr-employee-form';
export default async function NewEmployeePage({params}:{params:Promise<{locale:string}>}){const {locale:raw}=await params;const locale:SupportedLocale=raw==='ur'?'ur':'en';const t=hrCopy[locale];return <><section className="page-heading"><div><p className="state-kicker">{t.kicker}</p><h1>{t.createTitle}</h1><p>{t.createBody}</p></div></section><HrEmployeeForm locale={locale}/></>;}