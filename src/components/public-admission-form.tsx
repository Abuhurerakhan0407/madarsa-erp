"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  PublicAdmissionLocale,
  PublicAdmissionSection
} from "@/lib/admissions/public-intake-model";

type LocalizedLabels = Record<string, string>;

type IntakeOption = {
  key: string;
  labels: LocalizedLabels;
};

type GroupOption = IntakeOption & {
  sessionKey: string;
  programKey: string;
};

type PublicAdmissionFormProps = {
  tenantName: string;
  branchName: string;
  tenantSlug: string;
  locale: PublicAdmissionLocale;
  formLabels: LocalizedLabels;
  sessions: Array<IntakeOption & { startsOn: string; endsOn: string; isDefault: boolean }>;
  programs: Array<IntakeOption & { programType: string }>;
  groups: GroupOption[];
  sections: PublicAdmissionSection[];
  requirePhoto: boolean;
};

type SubmitResult = {
  trackingId: string;
  trackingToken: string;
};

type PhotoUploadResult = {
  photoToken?: string;
  expiresAt?: string;
  error?: string;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const ui = {
  en: {
    admissions: "Admissions",
    branch: "Branch",
    session: "Academic session",
    program: "Program",
    required: "Required",
    consent: "I confirm the information is accurate and consent to its use for this admission application.",
    submit: "Submit application",
    submitting: "Submitting securely…",
    successTitle: "Application submitted",
    successBody: "Keep this private tracking information. It will be required for applicant tracking and future updates.",
    reference: "Tracking reference",
    secret: "Private tracking key",
    trackApplication: "Track this application",
    newApplication: "Submit another application",
    error: "We could not submit the application. Check the highlighted information and try again.",
    language: "Language",
    photoTitle: "Student photo",
    photoHelp: "A clear front-facing photo is required and will become the student's private canonical profile photo.",
    takePhoto: "Take Photo",
    uploadPhoto: "Upload Photo",
    retake: "Retake",
    replace: "Replace",
    remove: "Remove",
    photoRequired: "Select or take a student photo before submitting.",
    photoInvalid: "Use a JPEG, PNG, or WebP photo up to 5 MB.",
    photoUploading: "Uploading student photo…",
    groupUnavailable: "No class/group is available for this session and program.",
    select: "Select"
  },
  ur: {
    admissions: "داخلہ",
    branch: "شاخ",
    session: "تعلیمی سال",
    program: "پروگرام",
    required: "ضروری",
    consent: "میں تصدیق کرتا/کرتی ہوں کہ معلومات درست ہیں اور داخلہ درخواست کے لیے ان کے استعمال کی اجازت دیتا/دیتی ہوں۔",
    submit: "درخواست جمع کریں",
    submitting: "محفوظ طریقے سے جمع ہو رہی ہے…",
    successTitle: "درخواست جمع ہو گئی",
    successBody: "یہ نجی ٹریکنگ معلومات محفوظ رکھیں۔ درخواست کی پیش رفت اور آئندہ اپ ڈیٹس کے لیے اس کی ضرورت ہوگی۔",
    reference: "ٹریکنگ حوالہ",
    secret: "نجی ٹریکنگ کلید",
    trackApplication: "اس درخواست کی پیش رفت دیکھیں",
    newApplication: "ایک اور درخواست جمع کریں",
    error: "درخواست جمع نہیں ہو سکی۔ معلومات چیک کریں اور دوبارہ کوشش کریں۔",
    language: "زبان",
    photoTitle: "طالب علم کی تصویر",
    photoHelp: "واضح سامنے سے لی گئی تصویر ضروری ہے اور یہی طالب علم کی محفوظ مرکزی پروفائل تصویر ہوگی۔",
    takePhoto: "تصویر لیں",
    uploadPhoto: "تصویر اپ لوڈ کریں",
    retake: "دوبارہ لیں",
    replace: "تبدیل کریں",
    remove: "ہٹائیں",
    photoRequired: "درخواست جمع کرنے سے پہلے طالب علم کی تصویر لیں یا منتخب کریں۔",
    photoInvalid: "JPEG، PNG یا WebP تصویر استعمال کریں، زیادہ سے زیادہ 5 MB۔",
    photoUploading: "طالب علم کی تصویر اپ لوڈ ہو رہی ہے…",
    groupUnavailable: "اس تعلیمی سال اور پروگرام کے لیے کوئی کلاس / گروپ دستیاب نہیں۔",
    select: "منتخب کریں"
  }
} as const;

const genderOptions = {
  en: [["male", "Male"], ["female", "Female"], ["other", "Other"], ["undisclosed", "Prefer not to say"]],
  ur: [["male", "مرد"], ["female", "خاتون"], ["other", "دیگر"], ["undisclosed", "بتانا نہیں چاہتے"]]
} as const;

const relationshipOptions = {
  en: [["father", "Father"], ["mother", "Mother"], ["guardian", "Guardian"], ["other", "Other"]],
  ur: [["father", "والد"], ["mother", "والدہ"], ["guardian", "سرپرست"], ["other", "دیگر"]]
} as const;

function label(labels: LocalizedLabels, locale: PublicAdmissionLocale): string {
  return labels[locale] || labels.en || Object.values(labels)[0] || "";
}

function inputType(type: string): string {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  if (type === "date") return "date";
  return "text";
}

export function PublicAdmissionForm({
  tenantName,
  branchName,
  tenantSlug,
  locale,
  formLabels,
  sessions,
  programs,
  groups,
  sections,
  requirePhoto
}: PublicAdmissionFormProps) {
  const text = ui[locale];
  const defaultSession = sessions.find((session) => session.isDefault)?.key ?? sessions[0]?.key ?? "";
  const defaultProgram = programs[0]?.key ?? "";
  const defaultGroup = groups.find(
    (group) => group.sessionKey === defaultSession && group.programKey === defaultProgram
  )?.key ?? "";
  const [sessionKey, setSessionKey] = useState(defaultSession);
  const [programKey, setProgramKey] = useState(defaultProgram);
  const [groupKey, setGroupKey] = useState(defaultGroup);
  const [busy, setBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoToken, setPhotoToken] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const matchingGroups = useMemo(
    () => groups.filter((group) => group.sessionKey === sessionKey && group.programKey === programKey),
    [groups, programKey, sessionKey]
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFirstGroup(nextSessionKey: string, nextProgramKey: string) {
    setGroupKey(
      groups.find((group) => group.sessionKey === nextSessionKey && group.programKey === nextProgramKey)?.key ?? ""
    );
  }

  function changeSession(nextSessionKey: string) {
    setSessionKey(nextSessionKey);
    chooseFirstGroup(nextSessionKey, programKey);
  }

  function changeProgram(nextProgramKey: string) {
    setProgramKey(nextProgramKey);
    chooseFirstGroup(sessionKey, nextProgramKey);
  }

  function selectPhoto(file: File | undefined) {
    if (!file) return;
    if (!allowedPhotoTypes.has(file.type) || file.size < 1 || file.size > MAX_PHOTO_BYTES) {
      setError(text.photoInvalid);
      return;
    }
    setError(null);
    setPhotoToken(null);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoToken(null);
    setPreviewUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function stagePhoto(): Promise<string | null> {
    if (photoToken) return photoToken;
    if (!photoFile) return null;

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.set("photo", photoFile);
      const response = await fetch(`/api/public/admissions/${encodeURIComponent(tenantSlug)}/photo`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as PhotoUploadResult;
      if (!response.ok || !payload.photoToken) {
        setError(payload.error || text.error);
        return null;
      }
      setPhotoToken(payload.photoToken);
      return payload.photoToken;
    } catch {
      setError(text.error);
      return null;
    } finally {
      setPhotoUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const answers = Object.fromEntries(
      sections.flatMap((section) =>
        section.fields.map((field) => [field.key, String(data.get(field.key) ?? "")])
      )
    );

    try {
      let stagedPhotoToken = photoToken;
      if (requirePhoto) {
        if (!photoFile && !photoToken) {
          setError(text.photoRequired);
          return;
        }
        stagedPhotoToken = await stagePhoto();
        if (!stagedPhotoToken) return;
      }

      const response = await fetch(`/api/public/admissions/${encodeURIComponent(tenantSlug)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          programKey,
          preferredLocale: locale,
          consent: data.get("consent") === "on",
          answers,
          photoToken: stagedPhotoToken
        })
      });

      const payload = (await response.json()) as {
        trackingId?: string;
        trackingToken?: string;
        error?: string;
        details?: string[];
      };

      if (!response.ok || !payload.trackingId || !payload.trackingToken) {
        if (response.status === 409) setPhotoToken(null);
        setError(payload.details?.[0] || payload.error || text.error);
        return;
      }

      setResult({ trackingId: payload.trackingId, trackingToken: payload.trackingToken });
      form.reset();
      clearPhoto();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  function resetForAnotherApplication() {
    setResult(null);
    setError(null);
    setSessionKey(defaultSession);
    setProgramKey(defaultProgram);
    setGroupKey(defaultGroup);
    clearPhoto();
  }

  if (result) {
    return (
      <main className="public-intake-shell" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
        <section className="public-intake-card public-intake-success" aria-live="polite">
          <div className="public-intake-brand">I</div>
          <p className="public-intake-kicker">{tenantName} · {text.admissions}</p>
          <h1>{text.successTitle}</h1>
          <p>{text.successBody}</p>
          <dl className="tracking-details">
            <div>
              <dt>{text.reference}</dt>
              <dd><code>{result.trackingId}</code></dd>
            </div>
            <div>
              <dt>{text.secret}</dt>
              <dd><code>{result.trackingToken}</code></dd>
            </div>
          </dl>
          <p>
            <a href={`/track?lang=${locale}&ref=${encodeURIComponent(result.trackingId)}`}>
              {text.trackApplication}
            </a>
          </p>
          <button className="public-submit secondary" type="button" onClick={resetForAnotherApplication}>
            {text.newApplication}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="public-intake-shell" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
      <section className="public-intake-card">
        <header className="public-intake-header">
          <div>
            <div className="public-intake-brand">I</div>
            <p className="public-intake-kicker">{tenantName}</p>
            <h1>{label(formLabels, locale)}</h1>
            <p>{text.branch}: {branchName}</p>
          </div>
          <div className="public-language-switcher" aria-label={text.language}>
            <a aria-current={locale === "en" ? "page" : undefined} href="?lang=en">EN</a>
            <a aria-current={locale === "ur" ? "page" : undefined} href="?lang=ur">اردو</a>
          </div>
        </header>

        <form className="public-intake-form" onSubmit={submit}>
          <div className="public-intake-grid">
            <label>
              <span>{text.session}</span>
              <select name="sessionKey" value={sessionKey} onChange={(event) => changeSession(event.target.value)} required>
                {sessions.map((session) => (
                  <option key={session.key} value={session.key}>
                    {label(session.labels, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{text.program}</span>
              <select name="programKey" value={programKey} onChange={(event) => changeProgram(event.target.value)} required>
                {programs.map((program) => (
                  <option key={program.key} value={program.key}>
                    {label(program.labels, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sections.map((section) => (
            <Fragment key={section.key}>
              <fieldset className="public-intake-section">
                <legend>{label(section.labels, locale)}</legend>
                <div className="public-intake-grid">
                  {section.fields.map((field) => (
                    <label key={field.key} className={field.type === "long_text" ? "full-width" : undefined}>
                      <span>
                        {label(field.labels, locale)}
                        {field.required ? <small> · {text.required}</small> : null}
                      </span>
                      {field.key === "gender" ? (
                        <select name={field.key} required={field.required} defaultValue="">
                          <option value="" disabled>{text.select}</option>
                          {genderOptions[locale].map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                        </select>
                      ) : field.key === "guardian_relationship" ? (
                        <select name={field.key} required={field.required} defaultValue="">
                          <option value="" disabled>{text.select}</option>
                          {relationshipOptions[locale].map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                        </select>
                      ) : field.key === "group_key" ? (
                        <select name={field.key} required={field.required} value={groupKey} onChange={(event) => setGroupKey(event.target.value)}>
                          {matchingGroups.length === 0 ? <option value="">{text.groupUnavailable}</option> : null}
                          {matchingGroups.map((group) => <option key={group.key} value={group.key}>{label(group.labels, locale)}</option>)}
                        </select>
                      ) : field.type === "long_text" ? (
                        <textarea name={field.key} required={field.required} maxLength={2000} rows={4} />
                      ) : (
                        <input
                          name={field.key}
                          type={inputType(field.type)}
                          required={field.required}
                          maxLength={field.type === "email" ? 320 : field.type === "phone" ? 40 : undefined}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>

              {section.key === "student" && requirePhoto ? (
                <fieldset className="public-intake-section">
                  <legend>{text.photoTitle} · {text.required}</legend>
                  <p>{text.photoHelp}</p>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    hidden
                    onChange={(event) => selectPhoto(event.target.files?.[0])}
                  />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => selectPhoto(event.target.files?.[0])}
                  />
                  {previewUrl ? (
                    <div className="flow-stack">
                      <Image
                        src={previewUrl}
                        alt={text.photoTitle}
                        width={180}
                        height={220}
                        unoptimized
                        style={{ width: 180, height: 220, objectFit: "cover", borderRadius: 16 }}
                      />
                      <div className="quick-actions">
                        <button className="action-button" type="button" onClick={() => cameraInputRef.current?.click()}>{text.retake}</button>
                        <button className="action-button" type="button" onClick={() => uploadInputRef.current?.click()}>{text.replace}</button>
                        <button className="action-button" type="button" onClick={clearPhoto}>{text.remove}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="quick-actions">
                      <button className="action-button action-button-primary" type="button" onClick={() => cameraInputRef.current?.click()}>{text.takePhoto}</button>
                      <button className="action-button" type="button" onClick={() => uploadInputRef.current?.click()}>{text.uploadPhoto}</button>
                    </div>
                  )}
                  {photoUploading ? <p role="status">{text.photoUploading}</p> : null}
                </fieldset>
              ) : null}
            </Fragment>
          ))}

          <label className="public-consent">
            <input name="consent" type="checkbox" required />
            <span>{text.consent}</span>
          </label>

          {error ? <p className="public-intake-error" role="alert">{error}</p> : null}

          <button className="public-submit" type="submit" disabled={busy || photoUploading || matchingGroups.length === 0}>
            {busy ? text.submitting : text.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
