"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { QuranDailyAction, QuranDailyTarget } from "@/lib/quran/daily-register-model";
import type { QuranDailyRegister as Register, QuranDailyRow, QuranDailyTargetView } from "@/lib/quran/daily-register";
import { quranCopy, quranWorkLabel } from "@/lib/quran/copy";

type Props = { locale: SupportedLocale; data: Register };
type TargetDraft = {
  workCategory: string;
  mode: "juz" | "ayah" | "page";
  juz: string;
  startSurah: string;
  startAyah: string;
  endSurah: string;
  endAyah: string;
  pageStart: string;
  pageEnd: string;
};

const extraCopy = {
  en: {
    group: "Halaqah / Group", date: "Lesson date", chooseGroup: "Choose a Halaqah or group", roster: "Daily roster",
    recorded: "Recorded", support: "Needs support", month: "Month entries", monthAverage: "Month average",
    quality: "Quality", mistakes: "Mistakes", nextTarget: "Next target", actions: "Quick actions", pass: "Pass", repeat: "Repeat",
    needsSupport: "Needs support", absent: "Absent", noLesson: "No lesson", details: "Details", hideDetails: "Hide details",
    useLast: "Last target", noTarget: "Set a target before recording", todayStatus: "Today", saveError: "Unable to update this student.",
    saved: "Saved", target: "Target", teacherNote: "Teacher note", revisionDate: "Revision due", optional: "Optional",
    setNext: "Set next target", parentSummary: "Parent summary", progressWall: "30-Juz progress",
    scoreHint: "0–100", targetHelp: "The previous target is reused by default for fast entry.", noGroup: "Choose a group and date to load the class roster.",
    history: "History", student: "Student", revisionQueue: "Revision queue"
  },
  ur: {
    group: "حلقہ / گروپ", date: "سبق کی تاریخ", chooseGroup: "حلقہ یا گروپ منتخب کریں", roster: "روزانہ رجسٹر",
    recorded: "درج شدہ", support: "توجہ درکار", month: "ماہانہ اندراجات", monthAverage: "ماہانہ اوسط",
    quality: "معیار", mistakes: "غلطیاں", nextTarget: "اگلا ہدف", actions: "فوری عمل", pass: "پاس", repeat: "اعادہ",
    needsSupport: "مدد درکار", absent: "غیر حاضر", noLesson: "سبق نہیں", details: "تفصیل", hideDetails: "تفصیل بند کریں",
    useLast: "پچھلا ہدف", noTarget: "ریکارڈ کرنے سے پہلے ہدف مقرر کریں", todayStatus: "آج", saveError: "طالب علم کا ریکارڈ محفوظ نہیں ہو سکا۔",
    saved: "محفوظ", target: "ہدف", teacherNote: "استاد کا نوٹ", revisionDate: "نظر ثانی کی تاریخ", optional: "اختیاری",
    setNext: "اگلا ہدف مقرر کریں", parentSummary: "والدین کے لیے خلاصہ", progressWall: "30 پارہ پیش رفت",
    scoreHint: "0–100", targetHelp: "تیز اندراج کے لیے پچھلا ہدف خودکار طور پر دوبارہ استعمال ہوتا ہے۔", noGroup: "کلاس رجسٹر کے لیے گروپ اور تاریخ منتخب کریں۔",
    history: "تاریخ", student: "طالب علم", revisionQueue: "نظر ثانی قطار"
  }
} as const;

type ExtraCopy = (typeof extraCopy)[SupportedLocale];

function draftFromTarget(target: QuranDailyTargetView | null): TargetDraft {
  return {
    workCategory: target?.workCategory ?? "sabaq",
    mode: target?.mode ?? "juz",
    juz: target?.juzNumber ? String(target.juzNumber) : "",
    startSurah: target?.startSurahNumber ? String(target.startSurahNumber) : "",
    startAyah: target?.startAyahNumber ? String(target.startAyahNumber) : "",
    endSurah: target?.endSurahNumber ? String(target.endSurahNumber) : "",
    endAyah: target?.endAyahNumber ? String(target.endAyahNumber) : "",
    pageStart: target?.pageStart ? String(target.pageStart) : "",
    pageEnd: target?.pageEnd ? String(target.pageEnd) : ""
  };
}

function targetPayload(draft: TargetDraft, includeWork = false): QuranDailyTarget | undefined {
  const numeric = (value: string) => value.trim() ? Number(value) : undefined;
  const work = includeWork ? { work_category: draft.workCategory as QuranDailyTarget["work_category"] } : {};
  if (draft.mode === "juz") {
    const juz = numeric(draft.juz);
    return juz ? { mode: "juz", juz_number: juz, ...work } : undefined;
  }
  if (draft.mode === "ayah") {
    const startSurah = numeric(draft.startSurah); const startAyah = numeric(draft.startAyah);
    const endSurah = numeric(draft.endSurah); const endAyah = numeric(draft.endAyah);
    return startSurah && startAyah && endSurah && endAyah
      ? { mode: "ayah", start_surah_number: startSurah, start_ayah_number: startAyah, end_surah_number: endSurah, end_ayah_number: endAyah, ...work }
      : undefined;
  }
  const pageStart = numeric(draft.pageStart); const pageEnd = numeric(draft.pageEnd);
  return pageStart && pageEnd ? { mode: "page", page_start: pageStart, page_end: pageEnd, ...work } : undefined;
}

function targetViewPayload(target: QuranDailyTargetView | null): QuranDailyTarget | undefined {
  if (!target) return undefined;
  if (target.mode === "juz" && target.juzNumber) return { mode: "juz", juz_number: target.juzNumber };
  if (target.mode === "ayah" && target.startSurahNumber && target.startAyahNumber && target.endSurahNumber && target.endAyahNumber) {
    return { mode: "ayah", start_surah_number: target.startSurahNumber, start_ayah_number: target.startAyahNumber, end_surah_number: target.endSurahNumber, end_ayah_number: target.endAyahNumber };
  }
  if (target.mode === "page" && target.pageStart && target.pageEnd) return { mode: "page", page_start: target.pageStart, page_end: target.pageEnd };
  return undefined;
}

function statusLabel(status: string | null, text: ExtraCopy) {
  if (status === "passed") return text.pass;
  if (status === "repeat") return text.repeat;
  if (status === "partial") return text.needsSupport;
  if (status === "absent") return text.absent;
  if (status === "no_lesson") return text.noLesson;
  return null;
}

function TargetFields({ draft, setDraft, locale, includeWork = false }: { draft: TargetDraft; setDraft: (next: TargetDraft) => void; locale: SupportedLocale; includeWork?: boolean }) {
  const t = quranCopy[locale];
  return <div className="quran-daily-target-fields">
    {includeWork ? <label className="field-label">{t.latest}<select className="text-field" value={draft.workCategory} onChange={(event)=>setDraft({...draft,workCategory:event.target.value})}>{["sabaq","sabqi","manzil","nazra","qaida","tajweed"].map((key)=><option value={key} key={key}>{quranWorkLabel(key,t)}</option>)}</select></label> : null}
    <label className="field-label">{t.target}<select className="text-field" value={draft.mode} onChange={(event)=>setDraft({...draft,mode:event.target.value as TargetDraft["mode"]})}><option value="juz">{t.juz}</option><option value="ayah">{t.ayah}</option><option value="page">{t.page}</option></select></label>
    {draft.mode === "juz" ? <label className="field-label">{t.juz}<input className="text-field" type="number" min="1" max="30" value={draft.juz} onChange={(event)=>setDraft({...draft,juz:event.target.value})}/></label> : null}
    {draft.mode === "ayah" ? <>
      <label className="field-label">{t.from} · {t.surah}<input className="text-field" type="number" min="1" max="114" value={draft.startSurah} onChange={(event)=>setDraft({...draft,startSurah:event.target.value})}/></label>
      <label className="field-label">{t.from} · {t.ayahNo}<input className="text-field" type="number" min="1" value={draft.startAyah} onChange={(event)=>setDraft({...draft,startAyah:event.target.value})}/></label>
      <label className="field-label">{t.to} · {t.surah}<input className="text-field" type="number" min="1" max="114" value={draft.endSurah} onChange={(event)=>setDraft({...draft,endSurah:event.target.value})}/></label>
      <label className="field-label">{t.to} · {t.ayahNo}<input className="text-field" type="number" min="1" value={draft.endAyah} onChange={(event)=>setDraft({...draft,endAyah:event.target.value})}/></label>
    </> : null}
    {draft.mode === "page" ? <>
      <label className="field-label">{t.from} · {t.pageNo}<input className="text-field" type="number" min="1" max="604" value={draft.pageStart} onChange={(event)=>setDraft({...draft,pageStart:event.target.value})}/></label>
      <label className="field-label">{t.to} · {t.pageNo}<input className="text-field" type="number" min="1" max="604" value={draft.pageEnd} onChange={(event)=>setDraft({...draft,pageEnd:event.target.value})}/></label>
    </> : null}
  </div>;
}

function QuranDailyStudentRow({ locale, row, groupId, sessionDate, canRecord }: { locale: SupportedLocale; row: QuranDailyRow; groupId: number; sessionDate: string; canRecord: boolean }) {
  const t = quranCopy[locale]; const x = extraCopy[locale]; const router = useRouter();
  const baseTarget = row.nextTarget ?? row.repeatTarget;
  const [expanded,setExpanded] = useState(!baseTarget);
  const [targetDraft,setTargetDraft] = useState<TargetDraft>(()=>draftFromTarget(baseTarget));
  const [nextTargetDraft,setNextTargetDraft] = useState<TargetDraft>(()=>draftFromTarget(null));
  const [useNextTarget,setUseNextTarget] = useState(false);
  const [quality,setQuality] = useState(row.qualityScore === null ? "" : String(row.qualityScore));
  const [tajweed,setTajweed] = useState(""); const [fluency,setFluency] = useState(""); const [mistakes,setMistakes] = useState(String(row.mistakeCount || 0));
  const [teacherNote,setTeacherNote] = useState(""); const [revisionDate,setRevisionDate] = useState(row.revisionDueOn ?? "");
  const [busy,setBusy] = useState(false); const [error,setError] = useState<string|null>(null); const [saved,setSaved] = useState(false);
  const currentTarget = targetPayload(targetDraft) ?? targetViewPayload(baseTarget);
  const parentSummary = `${row.memorizedJuz}/30 · ${x.quality}: ${row.qualityScore ?? "—"} · ${t.revision}: ${row.revisionDue}`;

  async function submit(action: QuranDailyAction, detailed = false) {
    if (action !== "absent" && action !== "no_lesson" && !currentTarget) { setExpanded(true); setError(x.noTarget); return; }
    setBusy(true); setError(null); setSaved(false);
    const requestKey = globalThis.crypto?.randomUUID?.() ?? `quran-${row.personId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const body: Record<string, unknown> = {
      requestKey, groupId, sessionDate, personId: row.personId,
      workCategory: targetDraft.workCategory || baseTarget?.workCategory || "sabaq", action,
      mistakeCount: detailed ? Number(mistakes || 0) : 0
    };
    if (currentTarget) body.target = currentTarget;
    if (detailed) {
      if (quality) body.qualityScore = Number(quality);
      if (tajweed) body.tajweedScore = Number(tajweed);
      if (fluency) body.fluencyScore = Number(fluency);
      if (teacherNote.trim()) body.teacherNote = teacherNote.trim();
      if (revisionDate) body.revisionDueOn = revisionDate;
      if (useNextTarget) {
        const nextTarget = targetPayload(nextTargetDraft,true);
        if (!nextTarget) { setError(x.noTarget); setBusy(false); return; }
        body.nextTarget = nextTarget;
      }
    }
    try {
      const response = await fetch("/api/quran/daily", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      const payload = await response.json().catch(()=>({})) as { error?: string };
      if (!response.ok) { setError(payload.error ?? x.saveError); return; }
      setSaved(true); router.refresh();
    } catch { setError(x.saveError); } finally { setBusy(false); }
  }

  return <article className="quran-daily-row">
    <div className="quran-daily-student">
      <strong>{row.name}</strong>{row.nameNative ? <span dir="auto">{row.nameNative}</span> : null}<small>{row.studentNumber}</small>
      <div className="quran-daily-links"><Link href={`/${locale}/quran/${row.personId}`} className="quiet-link">{x.history}</Link><Link href={`/${locale}/students/${row.personId}`} className="quiet-link">{x.student}</Link></div>
    </div>
    <div className="quran-daily-cell"><span>{t.sabaq}</span><strong>{row.sabaq ?? "—"}</strong></div>
    <div className="quran-daily-cell"><span>{t.sabqi}</span><strong>{row.sabqi ?? "—"}</strong></div>
    <div className="quran-daily-cell"><span>{t.manzil}</span><strong>{row.manzil ?? "—"}</strong></div>
    <div className="quran-daily-cell"><span>{x.quality}</span><strong>{row.qualityScore ?? "—"}</strong></div>
    <div className="quran-daily-cell"><span>{x.mistakes}</span><strong>{row.mistakeCount}</strong></div>
    <div className="quran-daily-cell quran-daily-target"><span>{x.nextTarget}</span><strong>{row.nextTarget?.label ?? (row.repeatTarget ? `${x.useLast}: ${row.repeatTarget.label}` : "—")}</strong>{row.revisionDue>0?<small>{t.revisionFlag}: {row.revisionDue}</small>:null}</div>
    <div className="quran-daily-actions">
      {row.dayStatus ? <span className="quran-daily-status">{x.todayStatus}: {statusLabel(row.dayStatus,x)}</span> : null}
      {canRecord ? <div className="quran-quick-buttons">
        <button type="button" disabled={busy} onClick={()=>submit("pass")}>{x.pass}</button>
        <button type="button" disabled={busy} onClick={()=>submit("repeat")}>{x.repeat}</button>
        <button type="button" disabled={busy} onClick={()=>submit("needs_support")}>{x.needsSupport}</button>
        <button type="button" disabled={busy} onClick={()=>submit("absent")}>{x.absent}</button>
        <button type="button" disabled={busy} onClick={()=>submit("no_lesson")}>{x.noLesson}</button>
      </div> : null}
      <button className="quiet-link quran-details-toggle" type="button" onClick={()=>setExpanded((value)=>!value)}>{expanded?x.hideDetails:x.details}</button>
    </div>
    {expanded ? <div className="quran-daily-detail">
      <div className="quran-detail-heading"><div><strong>{x.target}</strong><span>{x.targetHelp}</span></div>{row.repeatTarget?<button type="button" className="action-button" onClick={()=>setTargetDraft(draftFromTarget(row.repeatTarget))}>{x.useLast}: {row.repeatTarget.label}</button>:null}</div>
      <TargetFields draft={targetDraft} setDraft={setTargetDraft} locale={locale} includeWork />
      <div className="quran-score-fields">
        <label className="field-label">{x.quality}<input className="text-field" type="number" min="0" max="100" placeholder={x.scoreHint} value={quality} onChange={(event)=>setQuality(event.target.value)}/></label>
        <label className="field-label">{t.tajweedScore}<input className="text-field" type="number" min="0" max="100" placeholder={x.scoreHint} value={tajweed} onChange={(event)=>setTajweed(event.target.value)}/></label>
        <label className="field-label">{t.fluency}<input className="text-field" type="number" min="0" max="100" placeholder={x.scoreHint} value={fluency} onChange={(event)=>setFluency(event.target.value)}/></label>
        <label className="field-label">{x.mistakes}<input className="text-field" type="number" min="0" max="99" value={mistakes} onChange={(event)=>setMistakes(event.target.value)}/></label>
        <label className="field-label">{x.revisionDate} · {x.optional}<input className="text-field" type="date" min={sessionDate} value={revisionDate} onChange={(event)=>setRevisionDate(event.target.value)}/></label>
      </div>
      <label className="field-label">{x.teacherNote} · {x.optional}<textarea className="text-field" rows={2} maxLength={1000} value={teacherNote} onChange={(event)=>setTeacherNote(event.target.value)}/></label>
      <label className="quran-next-toggle"><input type="checkbox" checked={useNextTarget} onChange={(event)=>setUseNextTarget(event.target.checked)}/><span>{x.setNext}</span></label>
      {useNextTarget ? <TargetFields draft={nextTargetDraft} setDraft={setNextTargetDraft} locale={locale} includeWork /> : null}
      <div className="quran-progress-summary"><div><span>{x.progressWall}</span><div className="quran-juz-wall" aria-label={`${row.memorizedJuz} of 30 Juz passed`}>{Array.from({length:30},(_,index)=><i key={index} data-complete={index<row.memorizedJuz?"true":"false"}>{index+1}</i>)}</div></div><div><span>{x.parentSummary}</span><strong>{parentSummary}</strong></div></div>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}{saved ? <p className="form-message form-success" role="status">{x.saved}</p> : null}
      {canRecord ? <div className="quran-detailed-actions"><button className="action-button action-button-primary" type="button" disabled={busy} onClick={()=>submit("pass",true)}>{x.pass}</button><button className="action-button" type="button" disabled={busy} onClick={()=>submit("repeat",true)}>{x.repeat}</button><button className="action-button" type="button" disabled={busy} onClick={()=>submit("needs_support",true)}>{x.needsSupport}</button></div> : null}
    </div> : null}
  </article>;
}

function minimumRegisterDate(localDate: string) {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 90);
  return date.toISOString().slice(0,10);
}

export function QuranDailyRegister({ locale, data }: Props) {
  const router = useRouter(); const t = quranCopy[locale]; const x = extraCopy[locale];
  const selectedGroup = useMemo(()=>data.groups.find((group)=>group.id===data.selectedGroupId)??null,[data.groups,data.selectedGroupId]);
  const minimumDate = minimumRegisterDate(data.localDate);
  function navigate(groupId: number | null, date: string) {
    const query = new URLSearchParams(); if(groupId) query.set("group",String(groupId)); if(date) query.set("date",date);
    router.push(`/${locale}/quran?${query.toString()}`);
  }
  return <div className="quran-daily-register">
    <section className="quran-daily-toolbar" data-page-section>
      <label className="field-label">{x.group}<select className="text-field" value={data.selectedGroupId??""} onChange={(event)=>navigate(event.target.value?Number(event.target.value):null,data.selectedDate)}><option value="">{x.chooseGroup}</option>{data.groups.map((group)=><option key={group.id} value={group.id}>{group.label} · {group.students}</option>)}</select></label>
      <label className="field-label">{x.date}<input className="text-field" type="date" min={minimumDate} max={data.localDate} value={data.selectedDate} onChange={(event)=>navigate(data.selectedGroupId,event.target.value)}/></label>
      <Link className="action-button" href={`/${locale}/quran/revision`}>{x.revisionQueue}</Link>
    </section>
    {selectedGroup ? <>
      <section className="quran-daily-metrics" data-page-section>
        <div><span>{t.students}</span><strong>{data.summary.students}</strong></div><div><span>{x.recorded}</span><strong>{data.summary.recorded}</strong></div><div><span>{x.support}</span><strong>{data.summary.needsSupport}</strong></div><div><span>{t.revision}</span><strong>{data.summary.revisionDue}</strong></div><div><span>{x.month}</span><strong>{data.summary.monthlyAttempts}</strong></div><div><span>{x.monthAverage}</span><strong>{data.summary.monthlyAverage??"—"}</strong></div>
      </section>
      <section className="quran-daily-roster" data-page-section>
        <header><div><p className="state-kicker">{x.roster}</p><h2>{selectedGroup.label}</h2></div><time dateTime={data.selectedDate}>{data.selectedDate}</time></header>
        <div className="quran-daily-head" aria-hidden="true"><span>{x.student}</span><span>{t.sabaq}</span><span>{t.sabqi}</span><span>{t.manzil}</span><span>{x.quality}</span><span>{x.mistakes}</span><span>{x.nextTarget}</span><span>{x.actions}</span></div>
        {data.rows.length ? data.rows.map((row)=><QuranDailyStudentRow key={row.personId} locale={locale} row={row} groupId={selectedGroup.id} sessionDate={data.selectedDate} canRecord={data.canRecord}/>) : <div className="workspace-inline-state"><strong>{t.noStudents}</strong></div>}
      </section>
    </> : <section className="workspace-inline-state" data-page-section><strong>{x.noGroup}</strong><span>{x.targetHelp}</span></section>}
  </div>;
}
