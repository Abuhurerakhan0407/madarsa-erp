"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProgramsSyllabusWorkspace } from "@/lib/programs-syllabus/runtime";
import { progressMethods, programTemplateKeys, programTypes, subjectTypes, unitStructures } from "@/lib/programs-syllabus/model";

type Locale = "en" | "ur";

type Props = { locale: Locale; data: ProgramsSyllabusWorkspace };

type Copy = {
  program: string; createProgram: string; programName: string; nativeName: string; description: string; key: string; type: string; template: string;
  levels: string; addLevel: string; levelName: string; sequence: string; components: string; addComponent: string; subjectName: string; level: string;
  subjectType: string; progressMethod: string; unitStructure: string; units: string; addUnit: string; component: string; parentUnit: string; unitName: string;
  expectedPeriods: string; publish: string; publishHelp: string; published: string; draft: string; assignments: string; assign: string; session: string;
  target: string; group: string; student: string; teacher: string; startDate: string; endDate: string; progress: string; recordProgress: string; state: string;
  score: string; maximum: string; percent: string; rating: string; notes: string; none: string; choose: string; saving: string; success: string; error: string;
};

const copy: Record<Locale, Copy> = {
  en: { program:"Program",createProgram:"Create teaching program",programName:"Program name",nativeName:"Urdu name",description:"Description",key:"Key",type:"Program type",template:"Starting template",levels:"Stages / levels",addLevel:"Add level",levelName:"Level name",sequence:"Sequence",components:"Components / subjects",addComponent:"Add component",subjectName:"Subject / component name",level:"Level",subjectType:"Subject type",progressMethod:"Progress method",unitStructure:"Unit structure",units:"Units / lessons",addUnit:"Add unit",component:"Component",parentUnit:"Parent unit",unitName:"Unit / lesson name",expectedPeriods:"Expected periods",publish:"Publish syllabus",publishHelp:"Publishing freezes this version for assignments and historical assessment references.",published:"Published",draft:"Draft",assignments:"Teaching assignments",assign:"Assign teaching",session:"Academic session",target:"Target",group:"Group",student:"Student",teacher:"Teacher",startDate:"Start date",endDate:"End date",progress:"Student progress",recordProgress:"Record progress",state:"State",score:"Score",maximum:"Maximum",percent:"Percent",rating:"Rating 1–5",notes:"Notes",none:"None",choose:"Choose",saving:"Saving…",success:"Saved successfully.",error:"Unable to save this change." },
  ur: { program:"پروگرام",createProgram:"تدریسی پروگرام بنائیں",programName:"پروگرام نام",nativeName:"اردو / عربی نام",description:"تفصیل",key:"کلید",type:"پروگرام قسم",template:"ابتدائی ٹیمپلیٹ",levels:"مراحل / لیول",addLevel:"لیول شامل کریں",levelName:"لیول نام",sequence:"ترتیب",components:"اجزاء / مضامین",addComponent:"جزو شامل کریں",subjectName:"مضمون / جزو نام",level:"لیول",subjectType:"مضمون قسم",progressMethod:"پیش رفت طریقہ",unitStructure:"یونٹ ساخت",units:"یونٹس / اسباق",addUnit:"یونٹ شامل کریں",component:"جزو",parentUnit:"والد یونٹ",unitName:"یونٹ / سبق نام",expectedPeriods:"متوقع پیریڈز",publish:"نصاب شائع کریں",publishHelp:"شائع شدہ ورژن اسائنمنٹس اور تاریخی امتحانی حوالوں کے لیے محفوظ رہتا ہے۔",published:"شائع شدہ",draft:"مسودہ",assignments:"تدریسی اسائنمنٹس",assign:"تدریس مقرر کریں",session:"تعلیمی سال",target:"ہدف",group:"گروپ",student:"طالب علم",teacher:"استاد",startDate:"شروع تاریخ",endDate:"اختتامی تاریخ",progress:"طالب علم پیش رفت",recordProgress:"پیش رفت درج کریں",state:"حالت",score:"نمبر",maximum:"کل نمبر",percent:"فیصد",rating:"ریٹنگ 1–5",notes:"نوٹس",none:"کوئی نہیں",choose:"منتخب کریں",saving:"محفوظ ہو رہا ہے…",success:"کامیابی سے محفوظ ہوا۔",error:"تبدیلی محفوظ نہیں ہو سکی۔" },
  ar: { program:"البرنامج",createProgram:"إنشاء برنامج تعليمي",programName:"اسم البرنامج",nativeName:"الاسم بالأردية / العربية",description:"الوصف",key:"المفتاح",type:"نوع البرنامج",template:"القالب المبدئي",levels:"المراحل / المستويات",addLevel:"إضافة مستوى",levelName:"اسم المستوى",sequence:"الترتيب",components:"المكونات / المواد",addComponent:"إضافة مكون",subjectName:"اسم المادة / المكون",level:"المستوى",subjectType:"نوع المادة",progressMethod:"طريقة التقدم",unitStructure:"بنية الوحدة",units:"الوحدات / الدروس",addUnit:"إضافة وحدة",component:"المكون",parentUnit:"الوحدة الأم",unitName:"اسم الوحدة / الدرس",expectedPeriods:"الحصص المتوقعة",publish:"نشر المنهج",publishHelp:"يُحفظ الإصدار المنشور للمهام والمراجع التاريخية للتقييم.",published:"منشور",draft:"مسودة",assignments:"مهام التدريس",assign:"تعيين التدريس",session:"العام الدراسي",target:"الهدف",group:"المجموعة",student:"الطالب",teacher:"المعلم",startDate:"تاريخ البدء",endDate:"تاريخ الانتهاء",progress:"تقدم الطالب",recordProgress:"تسجيل التقدم",state:"الحالة",score:"الدرجة",maximum:"الحد الأقصى",percent:"النسبة",rating:"التقييم 1–5",notes:"ملاحظات",none:"لا يوجد",choose:"اختر",saving:"جارٍ الحفظ…",success:"تم الحفظ بنجاح.",error:"تعذر حفظ التغيير." }
};

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());

export function ProgramsSyllabusManager({ locale, data }: Props) {
  const router = useRouter();
  const text = copy[locale];
  const [selectedProgramId, setSelectedProgramId] = useState(data.programs[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
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

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/programs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || text.error);
      setMessage({ tone: "success", text: text.success });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : text.error });
    } finally {
      setBusy(false);
    }
  }

  function labelsFrom(form: FormData, prefix: string) {
    return { en: String(form.get(`${prefix}En`) ?? ""), ur: String(form.get(`${prefix}Ur`) ?? "") };
  }

  async function submitProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await mutate({ action:"create_program", key:String(form.get("key")??""), labels:labelsFrom(form,"name"), descriptions:{ en:String(form.get("description")??""), ur:"", ar:"" }, programType:String(form.get("programType")??"custom"), templateKey:String(form.get("templateKey")??"blank_custom") });
  }

  async function submitLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await mutate({ action:"add_level", programId:selectedProgramId, key:String(form.get("key")??""), labels:labelsFrom(form,"name"), sequence:Number(form.get("sequence")??programLevels.length) });
  }

  async function submitComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const levelRaw=String(form.get("levelId")??"");
    await mutate({ action:"add_component", programId:selectedProgramId, levelId:levelRaw?Number(levelRaw):null, subjectKey:String(form.get("key")??""), subjectLabels:labelsFrom(form,"name"), subjectType:String(form.get("subjectType")??"custom"), progressMethod:String(form.get("progressMethod")??"completion"), unitStructure:String(form.get("unitStructure")??"lesson") });
  }

  async function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const parent=String(form.get("parentUnitId")??""); const expected=String(form.get("expectedPeriods")??"");
    await mutate({ action:"add_unit", curriculumItemId:Number(form.get("curriculumItemId")), parentUnitId:parent?Number(parent):null, key:String(form.get("key")??""), labels:labelsFrom(form,"name"), sequence:Number(form.get("sequence")??0), expectedPeriods:expected?Number(expected):null });
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const targetId=Number(form.get("targetId")); const itemId=Number(form.get("curriculumItemId")); const item=data.items.find((entry)=>entry.id===itemId);
    await mutate({ action:"assign", sessionId:Number(form.get("sessionId")), curriculumItemId:itemId, groupId:assignmentTarget==="group"?targetId:null, studentPersonId:assignmentTarget==="student"?targetId:null, teacherPersonId:Number(form.get("teacherPersonId")), evaluationMethod:item?.progressMethod??"completion", startsOn:String(form.get("startsOn")??""), endsOn:String(form.get("endsOn")??"")||null });
  }

  async function submitProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedProgressAssignment || !progressItem) return; const form = new FormData(event.currentTarget); const progressValue: Record<string, unknown> = {};
    if (progressItem.progressMethod === "percentage") progressValue.percent = Number(form.get("percent"));
    if (progressItem.progressMethod === "rating") progressValue.rating = Number(form.get("rating"));
    if (progressItem.progressMethod === "score" || progressItem.progressMethod === "marks") { progressValue.score = Number(form.get("score")); progressValue.max = Number(form.get("maximum")); }
    await mutate({ action:"record_progress", assignmentId:selectedProgressAssignment.id, studentPersonId:Number(form.get("studentPersonId")), curriculumUnitId:Number(form.get("curriculumUnitId")), teacherPersonId:selectedProgressAssignment.teacherPersonId, state:String(form.get("state")??"in_progress"), progressValue, notes:String(form.get("notes")??"") });
  }

  const dateToday = new Date().toISOString().slice(0,10);

  return (
    <div className="flow-stack" data-page-section>
      {message ? <div className={message.tone === "success" ? "workspace-success" : "workspace-inline-state"} role={message.tone === "error" ? "alert" : "status"}><strong>{message.text}</strong></div> : null}

      <section className="workspace-task-section">
        <header className="workspace-section-heading"><h2>{text.program}</h2></header>
        <div className="workspace-filter-bar">
          <label className="workspace-field"><span>{text.program}</span><select value={selectedProgramId} onChange={(event)=>setSelectedProgramId(Number(event.target.value))}>{data.programs.length===0?<option value={0}>{text.none}</option>:null}{data.programs.map((program)=><option key={program.id} value={program.id}>{program.label} · {program.templateKey}</option>)}</select></label>
          {selectedProgram ? <div className="workspace-page-meta"><strong>{selectedProgram.label}</strong><span>{selectedProgram.nativeLabel}</span><small>{selectedProgram.description || selectedProgram.key}</small></div> : null}
        </div>
        <details>
          <summary className="action-button">{text.createProgram}</summary>
          <form className="workspace-filter-bar" onSubmit={submitProgram}>
            <label className="workspace-field"><span>{text.key}</span><input name="key" required pattern="[a-z][a-z0-9_]{1,63}" /></label>
            <label className="workspace-field"><span>{text.programName} (EN)</span><input name="nameEn" required maxLength={120}/></label>
            <label className="workspace-field"><span>{text.nativeName} (UR)</span><input name="nameUr" maxLength={120}/></label>
            
            <label className="workspace-field"><span>{text.description}</span><input name="description" required maxLength={1000}/></label>
            <label className="workspace-field"><span>{text.type}</span><select name="programType">{programTypes.map((value)=><option key={value} value={value}>{titleize(value)}</option>)}</select></label>
            <label className="workspace-field"><span>{text.template}</span><select name="templateKey">{programTemplateKeys.map((value)=><option key={value} value={value}>{titleize(value)}</option>)}</select></label>
            <button className="action-button action-button-primary" disabled={busy} type="submit">{busy?text.saving:text.createProgram}</button>
          </form>
        </details>
      </section>

      {selectedProgram ? <>
        <section className="workspace-task-section">
          <header className="workspace-section-heading"><h2>{text.levels}</h2></header>
          <div className="workspace-task-list">{programLevels.map((level)=><div className="workspace-task-row" key={level.id}><div><strong>{level.label}</strong><p>{level.key} · #{level.sequence}</p></div></div>)}</div>
          <form className="workspace-filter-bar" onSubmit={submitLevel}><label className="workspace-field"><span>{text.key}</span><input name="key" required/></label><label className="workspace-field"><span>{text.levelName} (EN)</span><input name="nameEn" required/></label><label className="workspace-field"><span>UR</span><input name="nameUr"/></label><label className="workspace-field"><span>{text.sequence}</span><input name="sequence" type="number" min={0} defaultValue={programLevels.length}/></label><button className="action-button" disabled={busy}>{busy?text.saving:text.addLevel}</button></form>
        </section>

        <section className="workspace-task-section">
          <header className="workspace-section-heading"><h2>{text.components}</h2><p>{draftVersion?`${text.draft} v${draftVersion.version}`:publishedVersion?`${text.published} v${publishedVersion.version}`:""}</p></header>
          <div className="workspace-task-list">{draftItems.map((item)=><div className="workspace-task-row" key={item.id}><div><strong>{item.subjectLabel}</strong><p>{titleize(item.progressMethod)} · {titleize(item.unitStructure)} · {data.units.filter((unit)=>unit.curriculumItemId===item.id).length} {text.units.toLowerCase()}</p></div></div>)}</div>
          <form className="workspace-filter-bar" onSubmit={submitComponent}><label className="workspace-field"><span>{text.key}</span><input name="key" required/></label><label className="workspace-field"><span>{text.subjectName} (EN)</span><input name="nameEn" required/></label><label className="workspace-field"><span>UR</span><input name="nameUr"/></label><label className="workspace-field"><span>{text.level}</span><select name="levelId"><option value="">{text.none}</option>{programLevels.map((level)=><option key={level.id} value={level.id}>{level.label}</option>)}</select></label><label className="workspace-field"><span>{text.subjectType}</span><select name="subjectType">{subjectTypes.map((value)=><option key={value} value={value}>{titleize(value)}</option>)}</select></label><label className="workspace-field"><span>{text.progressMethod}</span><select name="progressMethod">{progressMethods.map((value)=><option key={value} value={value}>{titleize(value)}</option>)}</select></label><label className="workspace-field"><span>{text.unitStructure}</span><select name="unitStructure">{unitStructures.map((value)=><option key={value} value={value}>{titleize(value)}</option>)}</select></label><button className="action-button" disabled={busy}>{busy?text.saving:text.addComponent}</button></form>
        </section>

        {draftItems.length ? <section className="workspace-task-section"><header className="workspace-section-heading"><h2>{text.units}</h2></header><form className="workspace-filter-bar" onSubmit={submitUnit}><label className="workspace-field"><span>{text.component}</span><select name="curriculumItemId" required>{draftItems.map((item)=><option key={item.id} value={item.id}>{item.subjectLabel}</option>)}</select></label><label className="workspace-field"><span>{text.parentUnit}</span><select name="parentUnitId"><option value="">{text.none}</option>{data.units.filter((unit)=>draftItems.some((item)=>item.id===unit.curriculumItemId)).map((unit)=><option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="workspace-field"><span>{text.key}</span><input name="key" required/></label><label className="workspace-field"><span>{text.unitName} (EN)</span><input name="nameEn" required/></label><label className="workspace-field"><span>UR</span><input name="nameUr"/></label><label className="workspace-field"><span>{text.sequence}</span><input name="sequence" type="number" min={0} defaultValue={0}/></label><label className="workspace-field"><span>{text.expectedPeriods}</span><input name="expectedPeriods" type="number" min={0} step="0.5"/></label><button className="action-button" disabled={busy}>{busy?text.saving:text.addUnit}</button></form><div className="workspace-task-list">{data.units.filter((unit)=>draftItems.some((item)=>item.id===unit.curriculumItemId)).map((unit)=><div className="workspace-task-row" key={unit.id}><div><strong>{unit.label}</strong><p>{unit.key} · #{unit.sequence}</p></div></div>)}</div></section> : null}

        {draftVersion ? <section className="workspace-task-section"><header className="workspace-section-heading"><h2>{text.publish}</h2><p>{text.publishHelp}</p></header><button className="action-button action-button-primary" type="button" disabled={busy} onClick={()=>mutate({action:"publish",programId:selectedProgramId})}>{busy?text.saving:`${text.publish} · v${draftVersion.version}`}</button></section> : null}

        {publishedVersion && publishedItems.length ? <section className="workspace-task-section"><header className="workspace-section-heading"><h2>{text.assignments}</h2><p>{text.published} v{publishedVersion.version}</p></header><form className="workspace-filter-bar" onSubmit={submitAssignment}><label className="workspace-field"><span>{text.component}</span><select name="curriculumItemId" value={assignmentItemId||publishedItems[0]?.id||0} onChange={(event)=>setAssignmentItemId(Number(event.target.value))}>{publishedItems.map((item)=><option key={item.id} value={item.id}>{item.subjectLabel} · {titleize(item.progressMethod)}</option>)}</select></label><label className="workspace-field"><span>{text.session}</span><select name="sessionId">{data.sessions.map((session)=><option key={session.id} value={session.id}>{session.label}</option>)}</select></label><label className="workspace-field"><span>{text.target}</span><select value={assignmentTarget} onChange={(event)=>setAssignmentTarget(event.target.value as "group"|"student")}><option value="group">{text.group}</option><option value="student">{text.student}</option></select></label><label className="workspace-field"><span>{assignmentTarget==="group"?text.group:text.student}</span><select name="targetId" required>{(assignmentTarget==="group"?programGroups:programStudents).map((target)=><option key={"id" in target?target.id:target.personId} value={"id" in target?target.id:target.personId}>{"label" in target?target.label:target.name}</option>)}</select></label><label className="workspace-field"><span>{text.teacher}</span><select name="teacherPersonId" required>{data.teachers.map((teacher)=><option key={teacher.personId} value={teacher.personId}>{teacher.name} · {teacher.employeeNumber}</option>)}</select></label><label className="workspace-field"><span>{text.startDate}</span><input name="startsOn" type="date" defaultValue={dateToday} required/></label><label className="workspace-field"><span>{text.endDate}</span><input name="endsOn" type="date"/></label><button className="action-button" disabled={busy || !selectedAssignmentItem}>{busy?text.saving:text.assign}</button></form><div className="workspace-task-list">{programAssignments.map((assignment)=>{const item=data.items.find((entry)=>entry.id===assignment.curriculumItemId);const teacher=data.teachers.find((entry)=>entry.personId===assignment.teacherPersonId);const group=data.groups.find((entry)=>entry.id===assignment.groupId);const student=data.students.find((entry)=>entry.personId===assignment.studentPersonId);return <div className="workspace-task-row" key={assignment.id}><div><strong>{item?.subjectLabel??text.component}</strong><p>{teacher?.name??text.teacher} · {group?.label??student?.name??text.target}</p></div></div>})}</div></section> : null}

        {programAssignments.length ? <section className="workspace-task-section"><header className="workspace-section-heading"><h2>{text.progress}</h2></header><form className="workspace-filter-bar" onSubmit={submitProgress}><label className="workspace-field"><span>{text.assignments}</span><select value={progressAssignmentId||programAssignments[0]?.id||0} onChange={(event)=>setProgressAssignmentId(Number(event.target.value))}>{programAssignments.map((assignment)=>{const item=data.items.find((entry)=>entry.id===assignment.curriculumItemId);return <option key={assignment.id} value={assignment.id}>{item?.subjectLabel??`#${assignment.id}`}</option>})}</select></label><label className="workspace-field"><span>{text.student}</span><select name="studentPersonId" required>{progressStudents.map((student)=><option key={student.personId} value={student.personId}>{student.name}</option>)}</select></label><label className="workspace-field"><span>{text.units}</span><select name="curriculumUnitId" required>{progressUnits.map((unit)=><option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="workspace-field"><span>{text.state}</span><select name="state"><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="passed">Passed</option><option value="repeat">Repeat</option><option value="needs_support">Needs support</option><option value="skipped">Skipped</option></select></label>{progressItem?.progressMethod==="percentage"?<label className="workspace-field"><span>{text.percent}</span><input name="percent" type="number" min={0} max={100} required/></label>:null}{progressItem?.progressMethod==="rating"?<label className="workspace-field"><span>{text.rating}</span><input name="rating" type="number" min={1} max={5} required/></label>:null}{progressItem && ["score","marks"].includes(progressItem.progressMethod)?<><label className="workspace-field"><span>{text.score}</span><input name="score" type="number" min={0} required/></label><label className="workspace-field"><span>{text.maximum}</span><input name="maximum" type="number" min={1} required/></label></>:null}<label className="workspace-field"><span>{text.notes}</span><input name="notes" maxLength={2000}/></label><button className="action-button" disabled={busy || !selectedProgressAssignment || !progressUnits.length || !progressStudents.length}>{busy?text.saving:text.recordProgress}</button></form></section> : null}
      </> : null}
    </div>
  );
}
