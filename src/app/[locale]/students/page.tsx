import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { getStudentRegister } from "@/lib/students/register";

const copy = {
  en: { kicker: "Students", title: "Student register", body: "Search, review and open permanent student records across the institution.", add: "Add student", export: "Export CSV", bulkIds: "Bulk ID cards", total: "Total students", active: "Active", other: "Not active", matching: "Matching records", search: "Search name or student number", filter: "Filter", all: "All statuses", name: "Student", number: "Student ID", program: "Program", group: "Class / group", joined: "Joined", status: "Status", open: "Open", empty: "No students match this view.", previous: "Previous", next: "Next" },
  ur: { kicker: "طلبہ", title: "طلبہ رجسٹر", body: "ادارے کے مستقل طالب علم ریکارڈ تلاش کریں، دیکھیں اور کھولیں۔", add: "طالب علم شامل کریں", export: "CSV ایکسپورٹ", bulkIds: "بلک ID کارڈز", total: "کل طلبہ", active: "فعال", other: "غیر فعال حالت", matching: "ملنے والے ریکارڈ", search: "نام یا طالب علم نمبر تلاش کریں", filter: "فلٹر", all: "تمام حالتیں", name: "طالب علم", number: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", joined: "شمولیت", status: "حالت", open: "کھولیں", empty: "اس منظر میں کوئی طالب علم نہیں ملا۔", previous: "پچھلا", next: "اگلا" },
  ar: { kicker: "الطلاب", title: "سجل الطلاب", body: "ابحث عن سجلات الطلاب الدائمة وافتحها وراجعها.", add: "إضافة طالب", export: "تصدير CSV", bulkIds: "بطاقات جماعية", total: "إجمالي الطلاب", active: "نشط", other: "غير نشط", matching: "السجلات المطابقة", search: "ابحث بالاسم أو رقم الطالب", filter: "تصفية", all: "كل الحالات", name: "الطالب", number: "رقم الطالب", program: "البرنامج", group: "الفصل / المجموعة", joined: "الالتحاق", status: "الحالة", open: "فتح", empty: "لا يوجد طلاب مطابقون لهذا العرض.", previous: "السابق", next: "التالي" }
} as const;

const statusLabels: Record<Locale, Record<string, string>> = {
  en: { active: "Active", paused: "Paused", transferred: "Transferred", completed: "Completed", withdrawn: "Withdrawn", alumni: "Alumni", archived: "Archived" },
  ur: { active: "فعال", paused: "عارضی طور پر رکا", transferred: "منتقل", completed: "مکمل", withdrawn: "دستبردار", alumni: "فارغ / سابق", archived: "آرکائیو" },
  ar: { active: "نشط", paused: "موقوف مؤقتًا", transferred: "منقول", completed: "مكتمل", withdrawn: "منسحب", alumni: "خريج / سابق", archived: "مؤرشف" }
};

function pageHref(locale: Locale, page: number, q?: string, status?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/students${query ? `?${query}` : ""}`;
}

export default async function StudentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const locale = (await params).locale as Locale;
  const query = await searchParams;
  const text = copy[locale];
  const isFiltered = Boolean(query.q?.trim() || (query.status && query.status !== "all"));
  const result = await getStudentRegister({ locale, query: query.q, status: query.status, page: Number(query.page || 1), pageSize: 25 });
  const summary = isFiltered ? await getStudentRegister({ locale, status: "all", page: 1, pageSize: 1 }) : result;
  const thirdValue = isFiltered ? result.total : Math.max(summary.total - summary.active, 0);
  const thirdLabel = isFiltered ? text.matching : text.other;

  return <>
    <section className="page-heading" data-page-section>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div>
      <div className="quick-actions"><a className="action-button" href={`/api/students/export?locale=${locale}`}>{text.export}</a><Link className="action-button" href={`/${locale}/students/id-cards`}>{text.bulkIds}</Link><Link className="action-button action-button-primary" href={`/${locale}/students/new`}>{text.add}</Link></div>
    </section>
    <section className="metric-grid" data-page-section>
      <article className="metric metric-primary"><span>{text.total}</span><strong>{summary.total}</strong></article>
      <article className="metric"><span>{text.active}</span><strong>{summary.active}</strong></article>
      <article className="metric"><span>{thirdLabel}</span><strong>{thirdValue}</strong></article>
    </section>
    <section className="panel" data-page-section>
      <form className="student-filter-bar" method="get">
        <label className="field-label">{text.search}<input className="text-field" name="q" defaultValue={query.q || ""} /></label>
        <label className="field-label">{text.status}<select className="text-field" name="status" defaultValue={query.status || "all"}><option value="all">{text.all}</option>{Object.entries(statusLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button className="action-button" type="submit">{text.filter}</button>
      </form>
      {result.rows.length ? <div className="responsive-table" role="region" aria-label={text.title} tabIndex={0}><table><thead><tr><th scope="col">{text.name}</th><th scope="col">{text.number}</th><th scope="col">{text.program}</th><th scope="col">{text.group}</th><th scope="col">{text.joined}</th><th scope="col">{text.status}</th><th scope="col">{text.open}</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.personId}><td><strong>{row.name}</strong>{row.nativeName ? <><br /><small>{row.nativeName}</small></> : null}</td><td>{row.studentNumber}</td><td>{row.program}</td><td>{row.group}</td><td>{row.joinedOn || "—"}</td><td><span className="status-pill">{statusLabels[locale][row.status] ?? row.status}</span></td><td><Link href={`/${locale}/students/${row.personId}`}>{text.open}</Link></td></tr>)}</tbody></table></div> : <div className="privacy-callout"><strong>{text.empty}</strong></div>}
      <div className="pagination-row"><span>{result.page} / {result.pages}</span><div className="quick-actions">{result.page > 1 ? <Link className="action-button" href={pageHref(locale, result.page - 1, query.q, query.status)}>{text.previous}</Link> : null}{result.page < result.pages ? <Link className="action-button" href={pageHref(locale, result.page + 1, query.q, query.status)}>{text.next}</Link> : null}</div></div>
    </section>
  </>;
}
