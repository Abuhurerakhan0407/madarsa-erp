import Link from "next/link";
import { StudentCreateForm } from "@/components/student-create-form";
import type { Locale } from "@/lib/i18n/config";
import { getStudentCreateOptions } from "@/lib/students/register";

const copy = {
  en: { kicker: "Students · New", title: "Add student", body: "Create the permanent student record, academic placement and primary guardian in one guided workflow.", back: "Back to students", warning: "Academic session and program must already be configured. Class/group assignment is optional and can be added later." },
  ur: { kicker: "طلبہ · نیا", title: "طالب علم شامل کریں", body: "مستقل طالب علم ریکارڈ، تعلیمی تعیناتی اور بنیادی سرپرست ایک ہی ورک فلو میں بنائیں۔", back: "طلبہ پر واپس", warning: "تعلیمی سال اور پروگرام پہلے سے کنفیگر ہونا ضروری ہے۔ کلاس / گروپ بعد میں بھی شامل کیا جا سکتا ہے۔" },
  ar: { kicker: "الطلاب · جديد", title: "إضافة طالب", body: "أنشئ سجل الطالب الدائم والتسجيل الأكاديمي وولي الأمر الأساسي في مسار واحد.", back: "العودة للطلاب", warning: "يجب إعداد العام الدراسي والبرنامج مسبقًا. تعيين الفصل أو المجموعة اختياري ويمكن إضافته لاحقًا." }
} as const;

export default async function NewStudentPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const text = copy[locale];
  const options = await getStudentCreateOptions(locale);
  return <>
    <section className="page-heading" data-page-section><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="action-button" href={`/${locale}/students`}>{text.back}</Link></section>
    <div className="privacy-callout" data-page-section><strong>{text.warning}</strong></div>
    <StudentCreateForm locale={locale} sessions={options.sessions} programs={options.programs} groups={options.groups} />
  </>;
}
