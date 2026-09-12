import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { QuranDailyRegister } from "@/components/quran-daily-register";
import { InlineState } from "@/components/workspace-ui";
import { getQuranDailyRegister } from "@/lib/quran/daily-register";

const copy = {
  en: {
    kicker: "Qur'an teaching",
    title: "Qur'an & Hifz",
    body: "Choose the Halaqah and lesson date once, then record the whole class from one fast Sabaq, Sabqi, Manzil and revision roster.",
    empty: "No Qur'an class is ready yet",
    emptyBody: "Create an academic class and enroll students before opening the daily Qur'an register.",
    setup: "Complete institution setup"
  },
  ur: {
    kicker: "قرآنی تدریس",
    title: "قرآن و حفظ",
    body: "حلقہ اور سبق کی تاریخ ایک بار منتخب کریں، پھر ایک تیز سبق، سبقی، منزل اور نظرِ ثانی رجسٹر سے پوری کلاس درج کریں۔",
    empty: "ابھی کوئی قرآن کلاس تیار نہیں",
    emptyBody: "روزانہ قرآن رجسٹر کھولنے سے پہلے کلاس بنائیں اور طلبہ شامل کریں۔",
    setup: "ادارے کا سیٹ اپ مکمل کریں"
  },
  ar: {
    kicker: "تدريس القرآن",
    title: "القرآن والحفظ",
    body: "اختر الحلقة وتاريخ الدرس مرة واحدة، ثم سجّل الفصل كله من سجل سريع للسبق والسبقي والمنزل والمراجعة.",
    empty: "لا يوجد فصل قرآن جاهز بعد",
    emptyBody: "أنشئ فصلاً دراسياً وسجّل الطلاب قبل فتح سجل القرآن اليومي.",
    setup: "إكمال إعداد المؤسسة"
  }
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10) !== value) return null;
  return value;
}

export default async function QuranPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string; date?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as Locale;
  const parsedGroup = Number(query.group);
  const groupId = Number.isInteger(parsedGroup) && parsedGroup > 0 ? parsedGroup : null;
  const date = validDate(query.date);
  const data = await getQuranDailyRegister({ groupId, date });
  const text = copy[locale];

  return <>
    <section className="page-heading" data-page-section>
      <div>
        <p className="state-kicker">{text.kicker}</p>
        <h1>{text.title}</h1>
        <p>{text.body}</p>
      </div>
      <time dateTime={data.selectedDate}>{data.selectedDate}</time>
    </section>
    {data.groups.length === 0 ? <InlineState title={text.empty} body={text.emptyBody} action={<Link className="action-button action-button-primary" href={`/${locale}/setup`}>{text.setup}</Link>} /> : <QuranDailyRegister locale={locale} data={data}/>} 
  </>;
}
