import Link from "next/link";
import { FieldGroup, FilterBar, InlineState, TableFrame, WorkspacePageHeader } from "@/components/workspace-ui";
import type { Locale } from "@/lib/i18n/config";
import { getStudentRegister } from "@/lib/students/register";

const copy = {
  en: { kicker: "Students", title: "Student register", body: "Search, review and open permanent student records across the institution.", add: "Add student", export: "Export CSV", bulkIds: "Bulk ID cards", total: "Total students", active: "Active", other: "Not active", matching: "Matching records", search: "Search name or student number", filter: "Apply filters", all: "All statuses", name: "Student", number: "Student ID", program: "Program", group: "Class / group", joined: "Joined", status: "Status", open: "Open", empty: "No students match this view.", emptyFirst: "No students yet", emptyBody: "Add the first student after the academic year, program and class are ready.", emptyAction: "Add first student", clear: "Clear filters", previous: "Previous", next: "Next" },
  ur: { kicker: "طلبہ", title: "طلبہ رجسٹر", body: "ادارے کے مستقل طالب علم ریکارڈ تلاش کریں، دیکھیں اور کھولیں۔", add: "طالب علم شامل کریں", export: "CSV ایکسپورٹ", bulkIds: "بلک ID کارڈز", total: "کل طلبہ", active: "فعال", other: "غیر فعال حالت", matching: "ملنے والے ریکارڈ", search: "نام یا طالب علم نمبر تلاش کریں", filter: "فلٹر لگائیں", all: "تمام حالتیں", name: "طالب علم", number: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", joined: "شمولیت", status: "حالت", open: "کھولیں", empty: "اس منظر میں کوئی طالب علم نہیں ملا۔", emptyFirst: "ابھی کوئی طالب علم نہیں", emptyBody: "تعلیمی سال، پروگرام اور کلاس تیار ہونے کے بعد پہلا طالب علم شامل کریں۔", emptyAction: "پہلا طالب علم شامل کریں", clear: "فلٹر ختم کریں", previous: "پچھلا", next: "اگلا" },
  ar: { kicker: "الطلاب", title: "سجل الطلاب", body: "ابحث عن سجلات الطلاب الدائمة وافتحها وراجعها.", add: "إضافة طالب", export: "تصدير CSV", bulkIds: "بطاقات جماعية", total: "إجمالي الطلاب", active: "نشط", other: "غير نشط", matching: "السجلات المطابقة", search: "ابحث بالاسم أو رقم الطالب", filter: "تطبيق التصفية", all: "كل الحالات", name: "الطالب", number: "رقم الطالب", program: "البرنامج", group: "الفصل / المجموعة", joined: "الالتحاق", status: "الحالة", open: "فتح", empty: "لا يوجد طلاب مطابقون لهذا العرض.", emptyFirst: "لا يوجد طلاب بعد", emptyBody: "أضف أول طالب بعد تجهيز العام الدراسي والبرنامج والفصل.", emptyAction: "إضافة أول طالب", clear: "مسح عوامل التصفية", previous: "السابق", next: "التالي" }
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
    <WorkspacePageHeader
      eyebrow={text.kicker}
      title={text.title}
      description={text.body}
      actions={[
        { label: text.export, href: `/api/students/export?locale=${locale}`, native: true },
        { label: text.bulkIds, href: `/${locale}/students/id-cards` },
        { label: text.add, href: `/${locale}/students/new`, kind: "primary" }
      ]}
    />
    <section className="metric-grid" data-page-section>
      <article className="metric metric-primary"><span>{text.total}</span><strong>{summary.total}</strong></article>
      <article className="metric"><span>{text.active}</span><strong>{summary.active}</strong></article>
      <article className="metric"><span>{thirdLabel}</span><strong>{thirdValue}</strong></article>
    </section>
    <section data-page-section>
      <form method="get">
        <FilterBar label={text.filter}>
          <FieldGroup label={text.search}><input name="q" defaultValue={query.q || ""} /></FieldGroup>
          <FieldGroup label={text.status}><select name="status" defaultValue={query.status || "all"}><option value="all">{text.all}</option>{Object.entries(statusLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></FieldGroup>
          <button className="action-button action-button-primary" type="submit">{text.filter}</button>
        </FilterBar>
      </form>
      {result.rows.length ? <TableFrame label={text.title}><table><thead><tr><th scope="col">{text.name}</th><th scope="col">{text.number}</th><th scope="col">{text.program}</th><th scope="col">{text.group}</th><th scope="col">{text.joined}</th><th scope="col">{text.status}</th><th scope="col">{text.open}</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.personId}><td><strong>{row.name}</strong>{row.nativeName ? <><br /><small>{row.nativeName}</small></> : null}</td><td>{row.studentNumber}</td><td>{row.program}</td><td>{row.group}</td><td>{row.joinedOn || "—"}</td><td><span className="status-pill">{statusLabels[locale][row.status] ?? row.status}</span></td><td><Link href={`/${locale}/students/${row.personId}`}>{text.open}</Link></td></tr>)}</tbody></table></TableFrame> : isFiltered ? <InlineState title={text.empty} body={text.clear} action={<Link className="action-button" href={`/${locale}/students`}>{text.clear}</Link>} /> : <InlineState title={text.emptyFirst} body={text.emptyBody} action={<Link className="action-button action-button-primary" href={`/${locale}/students/new`}>{text.emptyAction}</Link>} />}
      <div className="pagination-row"><span>{result.page} / {result.pages}</span><div className="quick-actions">{result.page > 1 ? <Link className="action-button" href={pageHref(locale, result.page - 1, query.q, query.status)}>{text.previous}</Link> : null}{result.page < result.pages ? <Link className="action-button" href={pageHref(locale, result.page + 1, query.q, query.status)}>{text.next}</Link> : null}</div></div>
    </section>
  </>;
}
