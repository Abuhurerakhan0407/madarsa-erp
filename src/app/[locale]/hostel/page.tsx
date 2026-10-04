import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getHostelBoysWorkspace, setStudentResidence } from "@/lib/hostel/boys";
import styles from "./hostel.module.css";

const copy = {
  en: {
    kicker: "Residential students",
    title: "Hostel Boys",
    description: "Manage hostel students through the same student records used across the ERP. Learning program and class / group come from each student's active enrollment.",
    hostelBoys: "Hostel boys",
    programs: "Learning programs",
    classes: "Classes / groups",
    add: "Add existing student",
    addHelp: "Select an existing student to mark the current enrollment as hostel. The student remains the same record in Students.",
    noAvailable: "No day students are available to add.",
    createStudent: "Create student",
    filters: "Filter",
    allPrograms: "All programs",
    allGroups: "All classes / groups",
    apply: "Apply",
    clear: "Clear filters",
    register: "Hostel boys register",
    student: "Student",
    number: "Student number",
    program: "Program",
    group: "Class / group",
    status: "Status",
    open: "Open record",
    remove: "Remove from hostel",
    none: "No hostel boys match these filters.",
    removeConfirm: "This keeps the student in Students and only changes residence to day.",
    active: "Active",
    paused: "Paused"
  },
  ur: {
    kicker: "رہائشی طلبہ",
    title: "ہاسٹل بوائز",
    description: "ہاسٹل طلبہ کو اسی مستقل طالب علم ریکارڈ سے چلائیں جو پورے ERP میں استعمال ہوتا ہے۔ تعلیمی پروگرام اور کلاس / گروپ فعال انرولمنٹ سے آتا ہے۔",
    hostelBoys: "ہاسٹل طلبہ",
    programs: "تعلیمی پروگرامز",
    classes: "کلاسز / گروپس",
    add: "موجودہ طالب علم شامل کریں",
    addHelp: "موجودہ طالب علم منتخب کریں اور اس کی فعال انرولمنٹ کو ہاسٹل کریں۔ طالب علم Students میں وہی ریکارڈ رہے گا۔",
    noAvailable: "شامل کرنے کے لیے کوئی ڈے اسٹوڈنٹ دستیاب نہیں۔",
    createStudent: "طالب علم بنائیں",
    filters: "فلٹر",
    allPrograms: "تمام پروگرامز",
    allGroups: "تمام کلاسز / گروپس",
    apply: "لگائیں",
    clear: "فلٹر ختم کریں",
    register: "ہاسٹل طلبہ رجسٹر",
    student: "طالب علم",
    number: "طالب علم نمبر",
    program: "پروگرام",
    group: "کلاس / گروپ",
    status: "حالت",
    open: "ریکارڈ کھولیں",
    remove: "ہاسٹل سے نکالیں",
    none: "ان فلٹرز کے مطابق کوئی ہاسٹل طالب علم نہیں۔",
    removeConfirm: "یہ طالب علم Students میں موجود رہے گا، صرف رہائش ڈے اسٹوڈنٹ ہو جائے گی۔",
    active: "فعال",
    paused: "عارضی طور پر رکا"
  }
} as const;

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function HostelPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ program?: string; group?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (rawLocale !== "en" && rawLocale !== "ur") notFound();
  const locale = rawLocale;
  const text = copy[locale];
  const query = await searchParams;
  const workspace = await getHostelBoysWorkspace();

  async function residenceAction(formData: FormData) {
    "use server";
    const personId = Number(formData.get("studentPersonId"));
    const residence = String(formData.get("residence") || "");
    const reason = String(formData.get("reason") || "").trim();
    if (!Number.isInteger(personId) || personId <= 0) return;
    if (residence !== "hostel" && residence !== "day") return;
    await setStudentResidence(personId, residence, reason || undefined);
    revalidatePath(`/${locale}/hostel`);
    revalidatePath(`/${locale}/students`);
    revalidatePath(`/${locale}/students/${personId}`);
  }

  const programId = positiveInteger(query.program);
  const requestedGroupId = positiveInteger(query.group);
  const programOptions = Array.from(
    new Map(workspace.students.map((student) => [student.programId, locale === "ur" ? student.programLabelUr : student.programLabel])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], locale));

  const groupOptions = Array.from(
    new Map(
      workspace.students
        .filter((student) => !programId || student.programId === programId)
        .filter((student) => student.groupId)
        .map((student) => [student.groupId as number, locale === "ur" ? student.groupLabelUr : student.groupLabel])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], locale));

  const groupId = groupOptions.some(([id]) => id === requestedGroupId) ? requestedGroupId : undefined;
  const filteredStudents = workspace.students.filter((student) =>
    (!programId || student.programId === programId) &&
    (!groupId || student.groupId === groupId)
  );

  const programCounts = programOptions.map(([id, label]) => ({
    id,
    label,
    count: workspace.students.filter((student) => student.programId === id).length,
    groups: new Set(
      workspace.students
        .filter((student) => student.programId === id && student.groupId)
        .map((student) => student.groupId)
    ).size
  }));

  const formQuery = (nextProgram?: number, nextGroup?: number) => {
    const params = new URLSearchParams();
    if (nextProgram) params.set("program", String(nextProgram));
    if (nextGroup) params.set("group", String(nextGroup));
    const value = params.toString();
    return value ? `/${locale}/hostel?${value}` : `/${locale}/hostel`;
  };

  return (
    <div className={styles.root}>
      <section className={styles.hero} data-page-section>
        <div>
          <p className="state-kicker">{text.kicker}</p>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
        <div className={styles.heroActions}>
          <Link className="action-button" href={`/${locale}/students`}>{text.open}</Link>
          <Link className="action-button action-button-primary" href={`/${locale}/students/new`}>{text.createStudent}</Link>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label={text.kicker}>
        <article className={styles.summaryCardPrimary}>
          <span>{text.hostelBoys}</span>
          <strong>{workspace.students.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>{text.programs}</span>
          <strong>{programOptions.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>{text.classes}</span>
          <strong>{new Set(workspace.students.filter((student) => student.groupId).map((student) => student.groupId)).size}</strong>
        </article>
      </section>

      <section className={styles.addPanel} data-page-section>
        <div>
          <p className="state-kicker">{text.add}</p>
          <h2>{text.add}</h2>
          <p>{text.addHelp}</p>
        </div>
        {workspace.availableStudents.length ? (
          <form action={residenceAction} className={styles.addForm}>
            <select name="studentPersonId" required defaultValue="">
              <option value="" disabled>—</option>
              {workspace.availableStudents.map((student) => (
                <option key={student.personId} value={student.personId}>
                  {student.displayName} · {student.programLabel} · {student.groupLabel}
                </option>
              ))}
            </select>
            <input type="hidden" name="residence" value="hostel" />
            <input type="hidden" name="reason" value="Added from Hostel Boys workspace" />
            <button className="action-button action-button-primary" type="submit">{text.add}</button>
          </form>
        ) : (
          <div className={styles.inlineNote}>
            <span>{text.noAvailable}</span>
            <Link className="action-button" href={`/${locale}/students/new`}>{text.createStudent}</Link>
          </div>
        )}
      </section>

      <section className={styles.filterPanel} data-page-section>
        <div className={styles.sectionHeading}>
          <div>
            <p className="state-kicker">{text.filters}</p>
            <h2>{text.filters}</h2>
          </div>
        </div>
        <form className={styles.filterForm} method="get">
          <label>
            {text.program}
            <select name="program" defaultValue={programId ? String(programId) : ""}>
              <option value="">{text.allPrograms}</option>
              {programOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>
            {text.group}
            <select name="group" defaultValue={groupId ? String(groupId) : ""}>
              <option value="">{text.allGroups}</option>
              {groupOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <button className="action-button action-button-primary" type="submit">{text.apply}</button>
          <Link className="action-button" href={formQuery()}>{text.clear}</Link>
        </form>
      </section>

      <section className={styles.registerPanel} data-page-section>
        <div className={styles.sectionHeading}>
          <div>
            <p className="state-kicker">{text.register}</p>
            <h2>{text.register}</h2>
          </div>
          <span>{filteredStudents.length}</span>
        </div>

        {programCounts.length ? (
          <div className={styles.programStrip}>
            {programCounts.map((program) => (
              <Link
                key={program.id}
                className={`${styles.programChip} ${programId === program.id ? styles.programChipActive : ""}`}
                href={formQuery(program.id)}
              >
                <strong>{program.label}</strong>
                <span>{program.count} · {program.groups}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {filteredStudents.length ? (
          <div className={styles.dataTableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>{text.number}</th>
                  <th>{text.student}</th>
                  <th>{text.program}</th>
                  <th>{text.group}</th>
                  <th>{text.status}</th>
                  <th aria-label={text.open} />
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.personId}>
                    <td><strong>{student.studentNumber ?? "—"}</strong></td>
                    <td>
                      <Link href={`/${locale}/students/${student.personId}`}>
                        <strong>{student.displayName}</strong>
                        {student.nativeName ? <small dir="auto">{student.nativeName}</small> : null}
                      </Link>
                    </td>
                    <td>{locale === "ur" ? student.programLabelUr : student.programLabel}</td>
                    <td>{locale === "ur" ? student.groupLabelUr : student.groupLabel}</td>
                    <td>{student.status === "paused" ? text.paused : text.active}</td>
                    <td>
                      <form action={residenceAction}>
                        <input type="hidden" name="studentPersonId" value={student.personId} />
                        <input type="hidden" name="residence" value="day" />
                        <input type="hidden" name="reason" value="Removed from Hostel Boys workspace" />
                        <button className="action-button" type="submit" title={text.removeConfirm}>{text.remove}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>{text.none}</div>
        )}
      </section>
    </div>
  );
}