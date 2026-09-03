import type { Locale } from "@/lib/i18n/config";
import { QuranDailyRegister } from "@/components/quran-daily-register";
import { getQuranDailyRegister } from "@/lib/quran/daily-register";

const copy = {
  en: {
    kicker: "Qur'an teaching",
    title: "Qur'an & Hifz",
    body: "Choose the Halaqah and lesson date once, then record the whole class from one fast Sabaq, Sabqi, Manzil and revision roster."
  },
  ur: {
    kicker: "قرآنی تدریس",
    title: "قرآن و حفظ",
    body: "حلقہ اور سبق کی تاریخ ایک بار منتخب کریں، پھر ایک تیز سبق، سبقی، منزل اور نظرِ ثانی رجسٹر سے پوری کلاس درج کریں۔"
  },
  ar: {
    kicker: "تدريس القرآن",
    title: "القرآن والحفظ",
    body: "اختر الحلقة وتاريخ الدرس مرة واحدة، ثم سجّل الفصل كله من سجل سريع للسبق والسبقي والمنزل والمراجعة."
  }
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  const date = typeof query.date === "string" && DATE.test(query.date) ? query.date : null;
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
    <QuranDailyRegister locale={locale} data={data}/>
  </>;
}
