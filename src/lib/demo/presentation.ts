import type { DemoMetric, DemoModule, LocalizedText } from "./modules";

const l = (en: string, ur: string, ar: string): LocalizedText => ({ en, ur, ar });
const metric = (label: LocalizedText, value: string): DemoMetric => ({ label, value });

export type DemoPresentation = Pick<DemoModule, "title" | "description" | "metrics">;

export function getDemoPresentation(module: DemoModule): DemoPresentation {
  if (module.id === "fees") {
    return {
      title: l(
        "Fees & Accounting · Deferred demo",
        "فیس و اکاؤنٹنگ · موخر ڈیمو",
        "الرسوم والمحاسبة · عرض مؤجل"
      ),
      description: l(
        "Deferred scripted demo only. Fee collection, reconciliation and institutional accounting are not production-enabled yet.",
        "صرف موخر اسکرپٹڈ ڈیمو۔ فیس وصولی، ریکنسائلیشن اور ادارہ اکاؤنٹنگ ابھی پروڈکشن میں فعال نہیں۔",
        "عرض تجريبي مؤجل فقط. تحصيل الرسوم والمطابقة والمحاسبة المؤسسية غير مفعلة للإنتاج بعد."
      ),
      metrics: module.metrics
    };
  }

  if (module.id === "donations") {
    return {
      title: l(
        "Donations, Zakat & Sponsorships · Deferred demo",
        "عطیات، زکوٰۃ و کفالت · موخر ڈیمو",
        "التبرعات والزكاة والكفالات · عرض مؤجل"
      ),
      description: l(
        "Deferred scripted demo only. Donation receipts, fund accounting and payment workflows are not production-enabled yet.",
        "صرف موخر اسکرپٹڈ ڈیمو۔ عطیہ رسیدیں، فنڈ اکاؤنٹنگ اور ادائیگی ورک فلو ابھی پروڈکشن میں فعال نہیں۔",
        "عرض تجريبي مؤجل فقط. إيصالات التبرعات ومحاسبة الصناديق ومسارات الدفع غير مفعلة للإنتاج بعد."
      ),
      metrics: module.metrics
    };
  }

  if (module.id === "staff") {
    return {
      title: l(
        "HR & Staff · Payroll demo",
        "HR و عملہ · پے رول ڈیمو",
        "الموارد البشرية والموظفون · عرض الرواتب"
      ),
      description: l(
        "Live staff records, attendance and leave workflows, with payroll shown only as scripted demo data.",
        "عملہ ریکارڈ، حاضری اور چھٹی کے ورک فلو لائیو ہیں؛ پے رول صرف اسکرپٹڈ ڈیمو ڈیٹا کے طور پر دکھایا گیا ہے۔",
        "سجلات الموظفين والحضور والإجازات تعمل فعلياً؛ الرواتب معروضة كبيانات تجريبية فقط."
      ),
      metrics: module.metrics
    };
  }

  if (module.id === "ai") {
    return {
      title: l(
        "AI Assistant & Intelligence · Preview",
        "AI معاون و انٹیلیجنس · پری ویو",
        "مساعد الذكاء الاصطناعي والذكاء التشغيلي · معاينة"
      ),
      description: l(
        "Preview concept only. No production AI model or provider is connected; examples below show intended governed behavior.",
        "صرف پری ویو تصور۔ کوئی پروڈکشن AI ماڈل یا پرووائیڈر منسلک نہیں؛ نیچے مثالیں مطلوبہ منظم رویہ دکھاتی ہیں۔",
        "مفهوم للمعاينة فقط. لا يوجد نموذج أو مزود ذكاء اصطناعي إنتاجي متصل؛ الأمثلة أدناه توضح السلوك المحكوم المقصود."
      ),
      metrics: [
        metric(l("Provider", "پرووائیڈر", "المزود"), "Not connected"),
        metric(l("Model access", "ماڈل رسائی", "وصول النموذج"), "Disabled"),
        metric(l("Production actions", "پروڈکشن ایکشن", "إجراءات الإنتاج"), "0"),
        metric(l("Status", "حالت", "الحالة"), "Preview")
      ]
    };
  }

  return {
    title: module.title,
    description: module.description,
    metrics: module.metrics
  };
}
