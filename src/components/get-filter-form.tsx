"use client";

import { createContext, useContext, useTransition, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const FilterPendingContext = createContext(false);

export function GetFilterForm({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const query = new URLSearchParams();
    const formData = new FormData(event.currentTarget);
    formData.forEach((value, key) => {
      if (typeof value === "string" && value.length > 0) query.append(key, value);
    });

    const serialized = query.toString();
    startTransition(() => {
      router.push(serialized ? `${pathname}?${serialized}` : pathname);
    });
  }

  return (
    <FilterPendingContext.Provider value={pending}>
      <form className={className} method="get" onSubmit={submit} aria-busy={pending || undefined}>
        {children}
      </form>
    </FilterPendingContext.Provider>
  );
}

export function GetFilterSubmitButton({
  label,
  pendingLabel,
  className = "action-button"
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const pending = useContext(FilterPendingContext);

  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><span className="inline-spinner" aria-hidden="true" /><span>{pendingLabel}</span></> : label}
    </button>
  );
}
