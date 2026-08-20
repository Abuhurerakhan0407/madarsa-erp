"use client";

import { useId, useRef } from "react";

type QuickActionDialogProps = {
  buttonLabel: string;
  cancelLabel: string;
  description: string;
  nameLabel: string;
  submitLabel: string;
  title: string;
};

export function QuickActionDialog({
  buttonLabel,
  cancelLabel,
  description,
  nameLabel,
  submitLabel,
  title
}: QuickActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        className="action-button action-button-primary"
        onClick={() => dialogRef.current?.showModal()}
      >
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="app-dialog"
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            dialogRef.current.close();
          }
        }}
      >
        <form method="dialog" className="dialog-panel">
          <header>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </header>

          <label className="field-label">
            <span>{nameLabel}</span>
            <input className="text-field" name="studentName" autoComplete="name" required />
          </label>

          <footer className="dialog-actions">
            <button className="action-button" value="cancel">
              {cancelLabel}
            </button>
            <button className="action-button action-button-primary" value="submit">
              {submitLabel}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
