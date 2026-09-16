import type { Locale } from "@/lib/i18n/config";

const copy = {
  en: {
    kicker: "Workspace access",
    title: "Your role is not configured yet",
    body: "This account has an active institution membership, but no usable role permissions are assigned. Ask an institution owner or administrator to review your access."
  },
  ur: {
    kicker: "ورک اسپیس رسائی",
    title: "آپ کا رول ابھی ترتیب نہیں دیا گیا",
    body: "اس اکاؤنٹ کی ادارے میں فعال رکنیت موجود ہے، لیکن قابل استعمال رول اجازتیں مقرر نہیں ہیں۔ ادارے کے مالک یا منتظم سے اپنی رسائی کی جانچ کروائیں۔"
  },
  ar: {
    kicker: "الوصول إلى مساحة العمل",
    title: "لم يتم إعداد دورك بعد",
    body: "لهذا الحساب عضوية نشطة في المؤسسة، ولكن لم تُعيّن له صلاحيات دور قابلة للاستخدام. اطلب من مالك المؤسسة أو المسؤول مراجعة وصولك."
  }
} as const;

export function RestrictedHome({ locale }: { locale: Locale }) {
  const text = copy[locale];
  return <section className="professional-card" data-page-section>
    <p className="state-kicker">{text.kicker}</p>
    <h1>{text.title}</h1>
    <p>{text.body}</p>
  </section>;
}
