import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentEditForm } from "@/components/student-edit-form";
import type { Locale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
const copy={en:{kicker:"Student profile · Edit",title:"Edit student",body:"Update core identity, language, health and safeguarding information.",back:"Back to profile"},ur:{kicker:"طالب علم پروفائل · ترمیم",title:"طالب علم میں ترمیم",body:"بنیادی شناخت، زبان، صحت اور حفاظتی معلومات اپ ڈیٹ کریں۔",back:"پروفائل پر واپس"},ar:{kicker:"ملف الطالب · تعديل",title:"تعديل الطالب",body:"حدّث بيانات الهوية واللغة والصحة والحماية.",back:"العودة للملف"}} as const;
export default async function EditStudentPage({params}:{params:Promise<{locale:string;personId:string}>}){const raw=await params;const locale=raw.locale as Locale;const personId=Number(raw.personId);if(!Number.isInteger(personId)||personId<=0)notFound();const student=await getStudentDetail(personId,locale);if(!student)notFound();const t=copy[locale];return <><section className="page-heading"><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div><Link className="action-button" href={`/${locale}/students/${personId}`}>{t.back}</Link></section><StudentEditForm locale={locale} student={student}/></>}
