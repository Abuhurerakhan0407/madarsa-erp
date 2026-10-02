"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProgramsSyllabusWorkspace } from "@/lib/programs-syllabus/runtime";
import { progressMethods, programTemplateKeys, programTypes, subjectTypes, unitStructures } from "@/lib/programs-syllabus/model";

type Locale = "en" | "ur";
type Props = { locale: Locale; data: ProgramsSyllabusWorkspace };

type Copy = {
  program: string;
  createProgram: string;
  programName: string;
  nativeName: string;
  description: string;
  key: string;
  type: string;
  template: string;
  levels: string;
  addLevel: string;
  levelName: string;
  sequence: string;
  components: string;
  addComponent: string;
  subjectName: string;
  level: string;
  subjectType: string;
  progressMethod: string;
  unitStructure: string;
  units: string;
  addUnit: string;
  component: string;
  parentUnit: string;
  unitName: string;
  expectedPeriods: string;
  publish: string;
  publishHelp: string;
  published: string;
  draft: string;
  assignments: string;
  assign: string;
  session: string;
  target: string;
  group: string;
  student: string;
  teacher: string;
  startDate: string;
  endDate: string;
  progress: string;
  recordProgress: string;
  state: string;
  score: string;
  maximum: string;
  percent: string;
  rating: string;
  notes: string;
  none: string;
  choose: string;
  saving: string;
  success: string;
  error: string;
  search: string;
  open: string;
  back: string;
  classesGroups: string;
  syllabus: string;
  advanced: string;
  teachingSetup: string;
  noPrograms: string;
  noGroups: string;
  noSyllabus: string;
  students: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    program:"Program", createProgram:"Create program", programName:"Program name", nativeName:"Urdu name", description:"Description",
    key:"Internal key", type:"Program type", template:"Starting template", levels:"Classes / levels", addLevel:"Add class / level",
    levelName:"Class / level name", sequence:"Sequence", components:"Subjects", addComponent:"Add subject", subjectName:"Subject name",
    level:"Class / level", subjectType:"Subject type", progressMethod:"Progress method", unitStructure:"Unit structure", units:"Lessons / units",
    addUnit:"Add lesson / unit", component:"Subject", parentUnit:"Parent unit", unitName:"Lesson / unit name", expectedPeriods:"Expected periods",
    publish:"Publish syllabus", publishHelp:"Publishing freezes this syllabus version for assignments and historical references.",
    published:"Published", draft:"Draft", assignments:"Teaching assignments", assign:"Assign teacher", session:"Academic session",
    target:"Target", group:"Class / group", student:"Student", teacher:"Teacher", startDate:"Start date", endDate:"End date",
    progress:"Student progress", recordProgress:"Record progress", state:"State", score:"Score", maximum:"Maximum", percent:"Percent",
    rating:"Rating 1–5", notes:"Notes", none:"None", choose:"Choose", saving:"Saving…", success:"Saved successfully.",
    error:"Unable to save this change.", search:"Search programs", open:"Open", back:"Back to programs", classesGroups:"Classes / groups",
    syllabus:"Syllabus structure", advanced:"Edit syllabus structure", teachingSetup:"Teaching setup", noPrograms:"No programs match this search.",
    noGroups:"No active classes or groups are linked to this program yet.", noSyllabus:"No syllabus subjects are configured yet.", students:"students"
  },
  ur: {
    program:"پروگرام", createProgram:"پروگرام بنائیں", programName:"پروگرام نام", nativeName:"اردو نام", description:"تفصیل",
    key:"اندرونی کلید", type:"پروگرام قسم", template:"ابتدائی ٹیمپلیٹ", levels:"کلاسز / لیولز", addLevel:"کلاس / لیول شامل کریں",
    levelName:"کلاس / لیول نام", sequence:"ترتیب", components:"مضامین", addComponent:"مضمون شامل کریں", subjectName:"مضمون نام",
    level:"کلاس / لیول", subjectType:"مضمون قسم", progressMethod:"پیش رفت طریقہ", unitStructure:"یونٹ ساخت", units:"اسباق / یونٹس",
    addUnit:"سبق / یونٹ شامل کریں", component:"مضمون", parentUnit:"والد یونٹ", unitName:"سبق / یونٹ نام", expectedPeriods:"متوقع پیریڈز",
    publish:"نصاب شائع کریں", publishHelp:"شائع ہونے پر یہ نصاب ورژن اسائنمنٹس اور تاریخی حوالوں کے لیے محفوظ رہتا ہے۔",
    published:"شائع شدہ", draft:"مسودہ", assignments:"تدریسی اسائنمنٹس", assign:"استاد مقرر کریں", session:"تعلیمی سال",
    target:"ہدف", group:"کلاس / گروپ", student:"طالب علم", teacher:"استاد", startDate:"شروع تاریخ", endDate:"اختتامی تاریخ",
    progress:"طالب علم پیش رفت", recordProgress:"پیش رفت درج کریں", state:"حالت", score:"نمبر", maximum:"کل نمبر", percent:"فیصد",
    rating:"ریٹنگ 1–5", notes:"نوٹس", none:"کوئی نہیں", choose:"منتخب کریں", saving:"محفوظ ہو رہا ہے…", success:"کامیابی سے محفوظ ہوا۔",
    error:"تبدیلی محفوظ نہیں ہو سکی۔", search:"پروگرام تلاش کریں", open:"کھولیں", back:"پروگرامز پر واپس", classesGroups:"کلاسز / گروپس",
    syllabus:"نصاب کی ساخت", advanced:"نصاب کی ساخت میں ترمیم", teachingSetup:"تدریسی سیٹ اپ", noPrograms:"اس تلاش سے کوئی پروگرام نہیں ملا۔",
    noGroups:"اس پروگرام سے ابھی کوئی فعال کلاس یا گروپ منسلک نہیں۔", noSyllabus:"ابھی کوئی نصابی مضمون ترتیب نہیں دیا گیا۔", students:"طلبہ"
  }
};

const urEnums: Record<string, string> = {
  completion:"مکمل ہونا", percentage:"فیصد", rating:"درجہ", score:"اسکور", marks:"نمبر", memorization:"حفظ",
  range:"حد", checklist:"چیک لسٹ", rubric:"معیار", pass_repeat:"کامیاب / دہرائیں", lesson:"سبق", topic:"موضوع",
  chapter:"باب", book:"کتاب", juz:"پارہ", surah:"سورہ", ayah_range:"آیات", custom_unit:"حسب ضرورت یونٹ",
  custom:"حسب ضرورت", academic:"تعلیمی", language:"زبان", quran:"قرآن", traditional:"روایتی", activity:"سرگرمی",
  general:"عام", hifz:"حفظ", nazra:"ناظرہ", qaida:"قاعدہ", dars_e_nizami:"درس نظامی", amma_para:"عم پارہ",
  deeniyat:"دینیات", kitab:"کتاب", general_academic:"عام تعلیم", blank_custom:"خالی حسب ضرورت",
  in_progress:"جاری", completed:"مکمل", passed:"کامیاب", repeat:"دہرائیں", needs_support:"مزید مدد", skipped:"چھوڑا گیا"
};

function enumLabel(value: string, locale: Locale) {
  if (locale === "ur") return urEnums[value] ?? value.replaceAll("_", " ");
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function safeKey(value: string) {
  let normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  if (!/^[a-z]/.test(normalized)) normalized = `program_${normalized || "new"}`.slice(0, 64);
  if (normalized.length < 2) normalized = `${normalized}_1`;
  return normalized.slice(0, 64);
}

export function ProgramsSyllabusManager({ locale, data }: Props) {
  const router = useRouter();
  const text = copy[locale];
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<"group" | "student">("group");
  const [assignmentItemId, setAssignmentItemId] = useState(0);
  const [progressAssignmentId, setProgressAssignmentId] = useState(0);

  const selectedProgram = data.programs.find((program) => program.id === selectedProgramId) ?? null;
  const programLevels = data.levels.filter((level) => level.programId === selectedProgramId);
  const programVersions = data.versions.filter((version) => version.programId === selectedProgramId);
  const draftVersion = programVersions.find((version) => version.state === "draft") ?? null;
  const publishedVersion = programVersions.find((version) => version.state === "published") ?? null;
  const draftItems = data.items.filter((item) => item.curriculumVersionId === draftVersion?.id);
  const publishedItems = data.items.filter((item) => item.curriculumVersionId === publishedVersion?.id);
  const syllabusItems = draftItems.length ? draftItems : publishedItems;
  const selectedAssignmentItem = publishedItems.find((item) => item.id === assignmentItemId) ?? publishedItems[0] ?? null;
  const programGroups = data.groups.filter((group) => group.programId === selectedProgramId);
  const programStudents = data.students.filter((student) => student.programId === selectedProgramId);
  const programAssignments = data.assignments.filter((assignment) => assignment.programId === selectedProgramId);
  const selectedProgressAssignment = programAssignments.find((assignment) => assignment.id === progressAssignmentId) ?? programAssignments[0] ?? null;
  const progressItem = data.items.find((item) => item.id === selectedProgressAssignment?.curriculumItemId) ?? null;
  const progressUnits = data.units.filter((unit) => unit.curriculumItemId === progressItem?.id);
  const progressStudents = !selectedProgressAssignment
    ? []
    : selectedProgressAssignment.studentPersonId
      ? programStudents.filter((student) => student.personId === selectedProgressAssignment.studentPersonId)
      : programStudents.filter((student) => student.groupId === selectedProgressAssignment.groupId && student.sessionId === selectedProgressAssignment.sessionId);

  const normalizedSearch = search.trim().toLocaleLowerCase(locale === "ur" ? "ur" : "en");
  const visiblePrograms = data.programs.filter((program) => {
    if (!normalizedSearch) return true;
    return [program.label, program.nativeLabel, program.description, program.key]
      .some((value) => value.toLocaleLowerCase(locale === "ur" ? "ur" : "en").includes(normalizedSearch));
  });

  async function mutate(payload: Record<string, unknown>) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || text.error);
      setMessage({ tone: "success", text: text.success });
      router.refresh();
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : text.error });
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function labelsFrom(form: FormData, prefix: string) {
    return { en: String(form.get(`${prefix}En`) ?? ""), ur: String(form.get(`${prefix}Ur`) ?? "") };
  }

  async function submitProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nameEn = String(form.get("nameEn") ?? "");
    const ok = await mutate({
      action:"create_program",
      key:String(form.get("key") || safeKey(nameEn)),
      labels:labelsFrom(form,"name"),
      descriptions:{ en:String(form.get("description") ?? ""), ur:"" },
      programType:String(form.get("programType") || "custom"),
      templateKey:String(form.get("templateKey") || "blank_custom")
    });
    if (ok) event.currentTarget.reset();
  }

  async function submitLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nameEn = String(form.get("nameEn") ?? "");
    await mutate({
      action:"add_level",
      programId:selectedProgramId,
      key:String(form.get("key") || safeKey(nameEn)),
      labels:labelsFrom(form,"name"),
      sequence:Number(form.get("sequence") ?? programLevels.length)
    });
  }

  async function submitComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const levelRaw = String(form.get("levelId") ?? "");
    const nameEn = String(form.get("nameEn") ?? "");
    await mutate({
      action:"add_component",
      programId:selectedProgramId,
      levelId:levelRaw ? Number(levelRaw) : null,
      subjectKey:String(form.get("key") || safeKey(nameEn)),
      subjectLabels:labelsFrom(form,"name"),
      subjectType:String(form.get("subjectType") || "custom"),
      progressMethod:String(form.get("progressMethod") || "completion"),
      unitStructure:String(form.get("unitStructure") || "lesson")
    });
  }

  async function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parent = String(form.get("parentUnitId") ?? "");
    const expected = String(form.get("expectedPeriods") ?? "");
    const nameEn = String(form.get("nameEn") ?? "");
    await mutate({
      action:"add_unit",
      curriculumItemId:Number(form.get("curriculumItemId")),
      parentUnitId:parent ? Number(parent) : null,
      key:String(form.get("key") || safeKey(nameEn)),
      labels:labelsFrom(form,"name"),
      sequence:Number(form.get("sequence") ?? 0),
      expectedPeriods:expected ? Number(expected) : null
    });
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetId = Number(form.get("targetId"));
    const itemId = Number(form.get("curriculumItemId"));
    const item = data.items.find((entry) => entry.id === itemId);
    await mutate({
      action:"assign",
      sessionId:Number(form.get("sessionId")),
      curriculumItemId:itemId,
      groupId:assignmentTarget === "group" ? targetId : null,
      studentPersonId:assignmentTarget === "student" ? targetId : null,
      teacherPersonId:Number(form.get("teacherPersonId")),
      evaluationMethod:item?.progressMethod ?? "completion",
      startsOn:String(form.get("startsOn") ?? ""),
      endsOn:String(form.get("endsOn") ?? "") || null
    });
  }

  async function submitProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProgressAssignment || !progressItem) return;
    const form = new FormData(event.currentTarget);
    const progressValue: Record<string, unknown> = {};
    if (progressItem.progressMethod === "percentage") progressValue.percent = Number(form.get("percent"));
    if (progressItem.progressMethod === "rating") progressValue.rating = Number(form.get("rating"));
    if (progressItem.progressMethod === "score" || progressItem.progressMethod === "marks") {
      progressValue.score = Number(form.get("score"));
      progressValue.max = Number(form.get("maximum"));
    }
    await mutate({
      action:"record_progress",
      assignmentId:selectedProgressAssignment.id,
      studentPersonId:Number(form.get("studentPersonId")),
      curriculumUnitId:Number(form.get("curriculumUnitId")),
      teacherPersonId:selectedProgressAssignment.teacherPersonId,
      state:String(form.get("state") ?? "in_progress"),
      progressValue,
      notes:String(form.get("notes") ?? "")
    });
  }

  function openProgram(programId: number) {
    setSelectedProgramId(programId);
    setAssignmentItemId(0);
    setProgressAssignmentId(0);
    setMessage(null);
  }

  const dateToday = new Date().toISOString().slice(0, 10);

  if (!selectedProgram) {
    return (
      <div className="flow-stack" data-page-section>
        {message ? <div className={message.tone === "success" ? "workspace-success" : "workspace-inline-state"} role={message.tone === "error" ? "alert" : "status"}><strong>{message.text}</strong></div> : null}
        <section className="workspace-task-section">
          <header className="workspace-section-heading"><h2>{text.program}</h2></header>
          <div className="workspace-filter-bar">
            <label className="workspace-field workspace-field-wide">
              <span>{text.search}</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" autoComplete="off" />
            </label>
          </div>
          <div className="workspace-task-list">
            {visiblePrograms.length ? visiblePrograms.map((program) => {
              const groups = data.groups.filter((group) => group.programId === program.id).length;
              const items = data.items.filter((item) => item.programId === program.id).length;
              return (
                <div className="workspace-task-row" key={program.id}>
                  <div>
                    <strong>{program.label}</strong>
                    {program.nativeLabel && program.nativeLabel !== program.label ? <p dir="auto">{program.nativeLabel}</p> : null}
                    <small>{groups} {text.classesGroups.toLocaleLowerCase()} · {items} {text.components.toLocaleLowerCase()}</small>
                  </div>
                  <button className="action-button" type="button" onClick={() => openProgram(program.id)}>{text.open}</button>
                </div>
              );
            }) : <div className="workspace-inline-state"><strong>{text.noPrograms}</strong></div>}
          </div>
        </section>

        <details className="workspace-task-section">
          <summary className="action-button action-button-primary">{text.createProgram}</summary>
          <form className="workspace-filter-bar" onSubmit={submitProgram}>
            <label className="workspace-field"><span>{text.programName} (EN)</span><input name="nameEn" required maxLength={120} /></label>
            <label className="workspace-field"><span>{text.nativeName}</span><input name="nameUr" maxLength={120} dir="rtl" /></label>
            <label className="workspace-field workspace-field-wide"><span>{text.description}</span><input name="description" required maxLength={1000} /></label>
            <details className="workspace-field workspace-field-wide">
              <summary className="quiet-link">{text.advanced}</summary>
              <div className="workspace-filter-bar">
                <label className="workspace-field"><span>{text.key}</span><input name="key" pattern="[a-z][a-z0-9_]{1,63}" /></label>
                <label className="workspace-field"><span>{text.type}</span><select name="programType" defaultValue="custom">{programTypes.map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
                <label className="workspace-field"><span>{text.template}</span><select name="templateKey" defaultValue="blank_custom">{programTemplateKeys.map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
              </div>
            </details>
            <button className="action-button action-button-primary" disabled={busy} type="submit">{busy ? text.saving : text.createProgram}</button>
          </form>
        </details>
      </div>
    );
  }

  return (
    <div className="flow-stack" data-page-section>
      <button className="quiet-link" type="button" onClick={() => { setSelectedProgramId(null); setMessage(null); }}>{text.back}</button>
      {message ? <div className={message.tone === "success" ? "workspace-success" : "workspace-inline-state"} role={message.tone === "error" ? "alert" : "status"}><strong>{message.text}</strong></div> : null}

      <section className="workspace-task-section">
        <header className="workspace-section-heading">
          <div>
            <h2>{selectedProgram.label}</h2>
            {selectedProgram.nativeLabel && selectedProgram.nativeLabel !== selectedProgram.label ? <p dir="auto">{selectedProgram.nativeLabel}</p> : null}
          </div>
          <small>{selectedProgram.description || selectedProgram.key}</small>
        </header>
      </section>

      <section className="workspace-task-section">
        <header className="workspace-section-heading"><h2>{text.classesGroups}</h2></header>
        <div className="workspace-task-list">
          {programGroups.length ? programGroups.map((group) => {
            const session = data.sessions.find((entry) => entry.id === group.sessionId);
            const students = programStudents.filter((student) => student.groupId === group.id).length;
            return (
              <div className="workspace-task-row" key={group.id}>
                <div><strong>{group.label}</strong><p>{session?.label ?? text.session} · {students} {text.students}</p></div>
              </div>
            );
          }) : <div className="workspace-inline-state"><strong>{text.noGroups}</strong></div>}
        </div>
      </section>

      <section className="workspace-task-section">
        <header className="workspace-section-heading">
          <h2>{text.syllabus}</h2>
          <p>{draftVersion ? `${text.draft} v${draftVersion.version}` : publishedVersion ? `${text.published} v${publishedVersion.version}` : ""}</p>
        </header>
        <div className="workspace-task-list">
          {syllabusItems.length ? syllabusItems.map((item) => {
            const itemLevel = programLevels.find((level) => level.id === item.levelId);
            const units = data.units.filter((unit) => unit.curriculumItemId === item.id).length;
            return (
              <div className="workspace-task-row" key={item.id}>
                <div>
                  <strong>{item.subjectLabel}</strong>
                  <p>{itemLevel?.label ?? text.level} · {enumLabel(item.progressMethod, locale)} · {units} {text.units.toLocaleLowerCase()}</p>
                </div>
              </div>
            );
          }) : <div className="workspace-inline-state"><strong>{text.noSyllabus}</strong></div>}
        </div>
      </section>

      {programAssignments.length ? <section className="workspace-task-section">
        <header className="workspace-section-heading"><h2>{text.assignments}</h2></header>
        <div className="workspace-task-list">
          {programAssignments.map((assignment) => {
            const item = data.items.find((entry) => entry.id === assignment.curriculumItemId);
            const teacher = data.teachers.find((entry) => entry.personId === assignment.teacherPersonId);
            const group = data.groups.find((entry) => entry.id === assignment.groupId);
            const student = data.students.find((entry) => entry.personId === assignment.studentPersonId);
            return <div className="workspace-task-row" key={assignment.id}><div><strong>{item?.subjectLabel ?? text.component}</strong><p>{teacher?.name ?? text.teacher} · {group?.label ?? student?.name ?? text.target}</p></div></div>;
          })}
        </div>
      </section> : null}

      <details className="workspace-task-section">
        <summary className="action-button">{text.advanced}</summary>
        <div className="flow-stack">
          <section>
            <header className="workspace-section-heading"><h3>{text.levels}</h3></header>
            <div className="workspace-task-list">{programLevels.map((level) => <div className="workspace-task-row" key={level.id}><div><strong>{level.label}</strong><p>{level.key} · #{level.sequence}</p></div></div>)}</div>
            <form className="workspace-filter-bar" onSubmit={submitLevel}>
              <label className="workspace-field"><span>{text.levelName} (EN)</span><input name="nameEn" required maxLength={120} /></label>
              <label className="workspace-field"><span>UR</span><input name="nameUr" maxLength={120} dir="rtl" /></label>
              <label className="workspace-field"><span>{text.sequence}</span><input name="sequence" type="number" min={0} defaultValue={programLevels.length} /></label>
              <label className="workspace-field"><span>{text.key}</span><input name="key" pattern="[a-z][a-z0-9_]{1,63}" /></label>
              <button className="action-button" disabled={busy}>{busy ? text.saving : text.addLevel}</button>
            </form>
          </section>

          <section>
            <header className="workspace-section-heading"><h3>{text.components}</h3></header>
            <form className="workspace-filter-bar" onSubmit={submitComponent}>
              <label className="workspace-field"><span>{text.subjectName} (EN)</span><input name="nameEn" required maxLength={120} /></label>
              <label className="workspace-field"><span>UR</span><input name="nameUr" maxLength={120} dir="rtl" /></label>
              <label className="workspace-field"><span>{text.level}</span><select name="levelId"><option value="">{text.none}</option>{programLevels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
              <label className="workspace-field"><span>{text.key}</span><input name="key" pattern="[a-z][a-z0-9_]{1,63}" /></label>
              <label className="workspace-field"><span>{text.subjectType}</span><select name="subjectType" defaultValue="custom">{subjectTypes.map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
              <label className="workspace-field"><span>{text.progressMethod}</span><select name="progressMethod" defaultValue="completion">{progressMethods.map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
              <label className="workspace-field"><span>{text.unitStructure}</span><select name="unitStructure" defaultValue="lesson">{unitStructures.map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
              <button className="action-button" disabled={busy}>{busy ? text.saving : text.addComponent}</button>
            </form>
          </section>

          {draftItems.length ? <section>
            <header className="workspace-section-heading"><h3>{text.units}</h3></header>
            <form className="workspace-filter-bar" onSubmit={submitUnit}>
              <label className="workspace-field"><span>{text.component}</span><select name="curriculumItemId" required>{draftItems.map((item) => <option key={item.id} value={item.id}>{item.subjectLabel}</option>)}</select></label>
              <label className="workspace-field"><span>{text.parentUnit}</span><select name="parentUnitId"><option value="">{text.none}</option>{data.units.filter((unit) => draftItems.some((item) => item.id === unit.curriculumItemId)).map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
              <label className="workspace-field"><span>{text.unitName} (EN)</span><input name="nameEn" required maxLength={160} /></label>
              <label className="workspace-field"><span>UR</span><input name="nameUr" maxLength={160} dir="rtl" /></label>
              <label className="workspace-field"><span>{text.key}</span><input name="key" /></label>
              <label className="workspace-field"><span>{text.sequence}</span><input name="sequence" type="number" min={0} defaultValue={0} /></label>
              <label className="workspace-field"><span>{text.expectedPeriods}</span><input name="expectedPeriods" type="number" min={0} step="0.5" /></label>
              <button className="action-button" disabled={busy}>{busy ? text.saving : text.addUnit}</button>
            </form>
          </section> : null}

          {draftVersion ? <section>
            <header className="workspace-section-heading"><h3>{text.publish}</h3><p>{text.publishHelp}</p></header>
            <button className="action-button action-button-primary" type="button" disabled={busy} onClick={() => void mutate({ action:"publish", programId:selectedProgramId })}>{busy ? text.saving : `${text.publish} · v${draftVersion.version}`}</button>
          </section> : null}
        </div>
      </details>

      {publishedVersion && publishedItems.length ? <details className="workspace-task-section">
        <summary className="action-button">{text.teachingSetup}</summary>
        <div className="flow-stack">
          <form className="workspace-filter-bar" onSubmit={submitAssignment}>
            <label className="workspace-field"><span>{text.component}</span><select name="curriculumItemId" value={assignmentItemId || publishedItems[0]?.id || 0} onChange={(event) => setAssignmentItemId(Number(event.target.value))}>{publishedItems.map((item) => <option key={item.id} value={item.id}>{item.subjectLabel} · {enumLabel(item.progressMethod, locale)}</option>)}</select></label>
            <label className="workspace-field"><span>{text.session}</span><select name="sessionId">{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}</select></label>
            <label className="workspace-field"><span>{text.target}</span><select value={assignmentTarget} onChange={(event) => setAssignmentTarget(event.target.value as "group" | "student")}><option value="group">{text.group}</option><option value="student">{text.student}</option></select></label>
            <label className="workspace-field"><span>{assignmentTarget === "group" ? text.group : text.student}</span><select name="targetId" required>{(assignmentTarget === "group" ? programGroups : programStudents).map((target) => <option key={"id" in target ? target.id : target.personId} value={"id" in target ? target.id : target.personId}>{"label" in target ? target.label : target.name}</option>)}</select></label>
            <label className="workspace-field"><span>{text.teacher}</span><select name="teacherPersonId" required>{data.teachers.map((teacher) => <option key={teacher.personId} value={teacher.personId}>{teacher.name} · {teacher.employeeNumber}</option>)}</select></label>
            <label className="workspace-field"><span>{text.startDate}</span><input name="startsOn" type="date" defaultValue={dateToday} required /></label>
            <label className="workspace-field"><span>{text.endDate}</span><input name="endsOn" type="date" /></label>
            <button className="action-button action-button-primary" disabled={busy || !selectedAssignmentItem}>{busy ? text.saving : text.assign}</button>
          </form>

          {programAssignments.length ? <details>
            <summary className="quiet-link">{text.progress}</summary>
            <form className="workspace-filter-bar" onSubmit={submitProgress}>
              <label className="workspace-field"><span>{text.assignments}</span><select value={progressAssignmentId || programAssignments[0]?.id || 0} onChange={(event) => setProgressAssignmentId(Number(event.target.value))}>{programAssignments.map((assignment) => { const item = data.items.find((entry) => entry.id === assignment.curriculumItemId); return <option key={assignment.id} value={assignment.id}>{item?.subjectLabel ?? `#${assignment.id}`}</option>; })}</select></label>
              <label className="workspace-field"><span>{text.student}</span><select name="studentPersonId" required>{progressStudents.map((student) => <option key={student.personId} value={student.personId}>{student.name}</option>)}</select></label>
              <label className="workspace-field"><span>{text.units}</span><select name="curriculumUnitId" required>{progressUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
              <label className="workspace-field"><span>{text.state}</span><select name="state" defaultValue="in_progress">{["in_progress","completed","passed","repeat","needs_support","skipped"].map((value) => <option key={value} value={value}>{enumLabel(value, locale)}</option>)}</select></label>
              {progressItem?.progressMethod === "percentage" ? <label className="workspace-field"><span>{text.percent}</span><input name="percent" type="number" min={0} max={100} required /></label> : null}
              {progressItem?.progressMethod === "rating" ? <label className="workspace-field"><span>{text.rating}</span><input name="rating" type="number" min={1} max={5} required /></label> : null}
              {progressItem && ["score","marks"].includes(progressItem.progressMethod) ? <><label className="workspace-field"><span>{text.score}</span><input name="score" type="number" min={0} required /></label><label className="workspace-field"><span>{text.maximum}</span><input name="maximum" type="number" min={1} required /></label></> : null}
              <label className="workspace-field"><span>{text.notes}</span><input name="notes" maxLength={2000} /></label>
              <button className="action-button" disabled={busy || !selectedProgressAssignment || !progressUnits.length || !progressStudents.length}>{busy ? text.saving : text.recordProgress}</button>
            </form>
          </details> : null}
        </div>
      </details> : null}
    </div>
  );
}
