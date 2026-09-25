"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

type Option = { key: string; label: string; href: string };

export function DocumentTypeSelect({
  label,
  selected,
  options,
  pendingLabel
}: {
  label: string;
  selected: string;
  options: Option[];
  pendingLabel: string;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    lock.current = false;
  }, [selected]);

  function change(next: string) {
    if (lock.current || next === selected) return;
    const option = options.find((item) => item.key === next);
    if (!option) return;
    lock.current = true;
    startTransition(() => {
      router.push(option.href);
    });
  }

  return (
    <section className="panel document-type-control" aria-busy={pending || undefined}>
      <label className="field-label">
        <span>{label}</span>
        <select
          className="text-field"
          value={selected}
          disabled={pending}
          onChange={(event) => change(event.target.value)}
        >

          {options.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>
      {pending ? (
        <div className="document-type-progress" role="status">
          <span className="inline-spinner" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </div>
      ) : null}
    </section>
  );
}
