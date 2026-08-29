import { DemoModulePage } from "@/components/demo-module-page";
import type { DemoModule, LocalizedText } from "@/lib/demo/modules";
import type { Locale } from "@/lib/i18n/config";

const l = (en: string, ur: string, ar: string): LocalizedText => ({ en, ur, ar });

const transportModule: DemoModule = {
  id: "branches",
  code: "TR",
  title: l("Transport & Route Management", "ٹرانسپورٹ و روٹ مینجمنٹ", "النقل وإدارة المسارات"),
  description: l(
    "Routes, vehicles, stops, student assignments, driver records, pickup visibility and transport-fee linkage for day scholars.",
    "روٹس، گاڑیاں، اسٹاپ، طالب علم الاٹمنٹ، ڈرائیور ریکارڈ، پک اپ ویژبلٹی اور ٹرانسپورٹ فیس لنک۔",
    "المسارات والمركبات والمحطات وتعيين الطلاب وسجلات السائقين وتتبع الاستلام وربط رسوم النقل."
  ),
  metrics: [
    { label: l("Routes", "روٹس", "المسارات"), value: "22" },
    { label: l("Vehicles", "گاڑیاں", "المركبات"), value: "28" },
    { label: l("Students assigned", "طلبہ الاٹ", "الطلاب المعيّنون"), value: "1,386" },
    { label: l("Trips today", "آج ٹرپس", "رحلات اليوم"), value: "56" }
  ],
  workflow: [
    l("Create route & stops", "روٹ و اسٹاپ بنائیں", "إنشاء المسار والمحطات"),
    l("Assign vehicle & driver", "گاڑی و ڈرائیور دیں", "تعيين المركبة والسائق"),
    l("Assign students", "طلبہ الاٹ کریں", "تعيين الطلاب"),
    l("Track trip & exceptions", "ٹرپ و استثنا ٹریک", "تتبع الرحلة والاستثناءات")
  ],
  features: [
    l("Route, stop and pickup-point management", "روٹ، اسٹاپ اور پک اپ پوائنٹ", "إدارة المسارات والمحطات ونقاط الاستلام"),
    l("Vehicle, driver and document records", "گاڑی، ڈرائیور اور دستاویز ریکارڈ", "سجلات المركبات والسائقين والمستندات"),
    l("Student route assignment and seat capacity", "طالب علم روٹ الاٹمنٹ اور سیٹ گنجائش", "تعيين الطلاب وسعة المقاعد"),
    l("Pickup/drop attendance and exception log", "پک اپ/ڈراپ حاضری اور استثنا لاگ", "حضور الصعود/النزول وسجل الاستثناءات"),
    l("Transport fee linkage and due tracking", "ٹرانسپورٹ فیس لنک اور بقایا", "ربط رسوم النقل وتتبع المستحقات"),
    l("Parent WhatsApp delay / route-change alerts", "والدین واٹس ایپ تاخیر / روٹ تبدیلی الرٹ", "تنبيهات واتساب للتأخير / تغيير المسار")
  ],
  table: {
    columns: [
      l("Route", "روٹ", "المسار"),
      l("Vehicle", "گاڑی", "المركبة"),
      l("Students", "طلبہ", "الطلاب"),
      l("Status", "حالت", "الحالة")
    ],
    rows: [
      ["Kurla East", "MH-02-AB-4102", "68", "On time"],
      ["Govandi", "MH-02-CD-2188", "61", "On time"],
      ["Mumbra", "MH-04-EF-7621", "54", "8 min delay"],
      ["Bhiwandi", "MH-04-GH-3350", "58", "On time"]
    ]
  }
};

type PageProps = { params: Promise<{ locale: string }> };

export default async function TransportDemoPage({ params }: PageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  return <DemoModulePage module={transportModule} locale={typedLocale} />;
}
