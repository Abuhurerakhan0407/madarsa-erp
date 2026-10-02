"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import type { Locale } from "@/lib/i18n/config";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type UiLocale = "en" | "ur";

const copy = {
  en: {
    title: "Student photo",
    help: "Required. Take a clear front-facing photo or upload JPEG, PNG or WebP up to 5 MB. This becomes the private profile and ID-card photo.",
    take: "Take Photo",
    upload: "Upload Photo",
    retake: "Retake",
    replace: "Replace",
    remove: "Remove",
    invalid: "Use a JPEG, PNG, or WebP photo up to 5 MB."
  },
  ur: {
    title: "طالب علم کی تصویر",
    help: "ضروری۔ سامنے سے واضح تصویر لیں یا 5 MB تک JPEG، PNG یا WebP اپ لوڈ کریں۔ یہی محفوظ پروفائل اور ID کارڈ تصویر ہوگی۔",
    take: "تصویر لیں",
    upload: "تصویر اپ لوڈ کریں",
    retake: "دوبارہ لیں",
    replace: "تبدیل کریں",
    remove: "ہٹائیں",
    invalid: "5 MB تک JPEG، PNG یا WebP تصویر استعمال کریں۔"
  }
} as const;

type Props = {
  locale: Locale;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
};

export function StudentPhotoPicker({ locale, file, disabled = false, onChange, onError }: Props) {
  const language: UiLocale = locale === "ur" ? "ur" : "en";
  const text = copy[language];
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectPhoto(next: File | undefined) {
    if (!next) return;
    if (!allowedPhotoTypes.has(next.type) || next.size < 1 || next.size > MAX_PHOTO_BYTES) {
      onError(text.invalid);
      return;
    }
    onError(null);
    onChange(next);
  }

  function clearPhoto() {
    onError(null);
    onChange(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  return (
    <fieldset className="public-intake-section" aria-label={text.title}>
      <legend>{text.title}</legend>
      <p>{text.help}</p>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        hidden
        disabled={disabled}
        onChange={(event) => selectPhoto(event.target.files?.[0])}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        disabled={disabled}
        onChange={(event) => selectPhoto(event.target.files?.[0])}
      />
      {previewUrl ? (
        <div className="flow-stack">
          <Image
            src={previewUrl}
            alt={text.title}
            width={180}
            height={220}
            unoptimized
            style={{ width: 180, height: 220, objectFit: "cover", borderRadius: 16 }}
          />
          <div className="quick-actions">
            <button className="action-button" type="button" disabled={disabled} onClick={() => cameraInputRef.current?.click()}>{text.retake}</button>
            <button className="action-button" type="button" disabled={disabled} onClick={() => uploadInputRef.current?.click()}>{text.replace}</button>
            <button className="action-button" type="button" disabled={disabled} onClick={clearPhoto}>{text.remove}</button>
          </div>
        </div>
      ) : (
        <div className="quick-actions">
          <button className="action-button action-button-primary" type="button" disabled={disabled} onClick={() => cameraInputRef.current?.click()}>{text.take}</button>
          <button className="action-button" type="button" disabled={disabled} onClick={() => uploadInputRef.current?.click()}>{text.upload}</button>
        </div>
      )}
    </fieldset>
  );
}
