import Link from "next/link";
import { GetFilterForm, GetFilterSubmitButton } from "@/components/get-filter-form";
import { FieldGroup, FilterBar, InlineState, WorkspacePageHeader } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";
import {
  getStudentRegisterByGroup,
  getStudentRegisterGroupOptions
} from "@/lib/students/register";

const copy = {
  en: {
    kicker: "Students",
    title: "Students",
    body: "Open permanent student records by class or group.",
    create: "Create Admission",
    export: "Export CSV",
    import: "Import Students",
    bulkIds: "Bulk ID cards",
    group: "Class / group",
    allGroups: "All classes / groups",
    apply: "Apply",
    applying: "Loading…",
    emptyGroup: "No students are enrolled in this class or group.",
    emptyGroupBody: "Choose another class/group or clear the filter.",
    emptyFirst: "No students yet",
    emptyBody: "Create the first admission after the academic year, program and class are ready.",
    clear: "Show all students",
    previous: "Previous",
    next: "Next",
    studentRecord: "Open student record",
    otherStatus: "Other status"
  },
  ur: {
    kicker: "طلبہ",
    title: "طلبہ",
    body: "کلاس یا گروپ کے مطابق مستقل طالب علم ریکارڈ کھولیں۔",
    create: "داخلہ بنائیں",
    export: "CSV ایکسپورٹ",
    import: "طلبہ امپورٹ کریں",
    bulkIds: "بلک ID کارڈز",
    group: "کلاس / گروپ",
    allGroups: "تمام کلاسیں / گروپس",
    apply: "لگائیں",
    applying: "لوڈ ہو رہا ہے…",
    emptyGroup: "اس کلاس یا گروپ میں کوئی طالب علم موجود نہیں۔",
    emptyGroupBody: "دوسری کلاس/گروپ منتخب کریں یا فلٹر ختم کریں۔",
    emptyFirst: "ابھی کوئی طالب علم نہیں",
    emptyBody: "تعلیمی سال، پروگرام اور کلاس تیار ہونے کے بعد پہلا داخلہ بنائیں۔",
    clear: "تمام طلبہ دکھائیں",
    previous: "پچھلا",
    next: "اگلا",
    studentRecord: "طالب علم ریکارڈ کھولیں",
    otherStatus: "دیگر حالت"
  }
} as const;

const statusLabels: Record<SupportedLocale, Record<string, string>> = {
  en: {
    active: "Active",
    paused: "Paused",
    transferred: "Transferred",
    completed: "Completed",
    withdrawn: "Withdrawn",
    alumni: "Alumni",
    archived: "Archived"
  },
  ur: {
    active: "فعال",
    paused: "عارضی طور پر رکا",
    transferred: "منتقل",
    completed: "مکمل",
    withdrawn: "دستبردار",
    alumni: "فارغ / سابق",
    archived: "آرکائیو"
  }
};

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function pageHref(locale: SupportedLocale, page: number, groupId?: number) {
  const params = new URLSearchParams();
  if (groupId) params.set("group", String(groupId));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/students${query ? `?${query}` : ""}`;
}

export default async function StudentsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string; page?: string }>;
}) {
  const locale = (await params).locale as SupportedLocale;
  await requireOfficeSurface(locale);
  const query = await searchParams;
  const text = copy[locale];

  const groups = await getStudentRegisterGroupOptions(locale);
  const requestedGroupId = positiveInteger(query.group);
  const groupId = groups.some((group) => group.id === requestedGroupId)
    ? requestedGroupId
    : undefined;
  const result = await getStudentRegisterByGroup({
    locale,
    groupId,
    page: Number(query.page || 1),
    pageSize: 25
  });

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.kicker}
        title={text.title}
        description={text.body}
        actions={[
          { label: text.import, href: `/${locale}/students/lifecycle` },
          { label: text.export, href: `/api/students/export?locale=${locale}`, native: true },
          { label: text.bulkIds, href: `/${locale}/students/id-cards` },
          { label: text.create, href: `/${locale}/students/new`, kind: "primary" }
        ]}
      />

      <section className="student-register-section" data-page-section>
        <GetFilterForm>
          <FilterBar label={text.group}>
            <FieldGroup label={text.group}>
              <select name="group" defaultValue={groupId ? String(groupId) : ""}>
                <option value="">{text.allGroups}</option>
                {groups.map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <GetFilterSubmitButton
              className="action-button action-button-primary"
              label={text.apply}
              pendingLabel={text.applying}
            />
          </FilterBar>
        </GetFilterForm>

        {result.rows.length ? (
          <div className="student-register-list" role="list" aria-label={text.title}>
            {result.rows.map((row) => {
              const status = statusLabels[locale][row.status] ?? text.otherStatus;
              return (
                <Link
                  key={row.personId}
                  role="listitem"
                  className="student-register-card"
                  href={`/${locale}/students/${row.personId}`}
                  aria-label={`${text.studentRecord}: ${row.name}`}
                >
                  <span className="student-register-avatar" aria-hidden="true">
                    {row.name.trim().charAt(0).toUpperCase() || "S"}
                  </span>
                  <span className="student-register-main">
                    <strong>{row.name}</strong>
                    {row.nativeName ? <small dir="auto">{row.nativeName}</small> : null}
                    <span className="student-register-meta">
                      <span>{row.studentNumber}</span>
                      <span aria-hidden="true">•</span>
                      <span>{row.program}</span>
                      <span aria-hidden="true">•</span>
                      <span>{row.group}</span>
                    </span>
                  </span>
                  <span className="student-register-side">
                    <span className="status-pill">{status}</span>
                    <span className="student-register-chevron" aria-hidden="true">
                      {locale === "ur" ? "‹" : "›"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : groupId ? (
          <InlineState
            title={text.emptyGroup}
            body={text.emptyGroupBody}
            action={
              <Link className="action-button" href={`/${locale}/students`}>
                {text.clear}
              </Link>
            }
          />
        ) : (
          <InlineState
            title={text.emptyFirst}
            body={text.emptyBody}
            action={
              <Link className="action-button action-button-primary" href={`/${locale}/students/new`}>
                {text.create}
              </Link>
            }
          />
        )}

        <div className="pagination-row">
          <span>
            {result.page} / {result.pages}
          </span>
          <div className="quick-actions">
            {result.page > 1 ? (
              <Link className="action-button" href={pageHref(locale, result.page - 1, groupId)}>
                {text.previous}
              </Link>
            ) : null}
            {result.page < result.pages ? (
              <Link className="action-button" href={pageHref(locale, result.page + 1, groupId)}>
                {text.next}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
