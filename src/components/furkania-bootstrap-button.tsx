"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ConfigurationLocale } from "@/lib/configuration/model";

type Props = { locale: ConfigurationLocale };

type BootstrapResponse = {
  error?: string;
  changed?: boolean;
  created?: {
    program: boolean;
    levels: string[];
    components: string[];
  };
  skipped?: {
    program: boolean;
    levels: string[];
    components: string[];
  };
};

const copy = {
  en: {
    idle: "Set up Deeniyat 1–5",
    running: "Setting up…",
    done: "Deeniyat structure ready",
    unchanged: "Already configured",
    failed: "Setup failed"
  },
  ur: {
    idle: "دینیات 1–5 سیٹ اپ کریں",
    running: "سیٹ اپ ہو رہا ہے…",
    done: "دینیات کا ڈھانچہ تیار ہے",
    unchanged: "پہلے سے سیٹ اپ ہے",
    failed: "سیٹ اپ ناکام ہوا"
  },
  ar: {
    idle: "إعداد الدينيات 1–5",
    running: "جارٍ الإعداد…",
    done: "هيكل الدينيات جاهز",
    unchanged: "مُعدّ مسبقًا",
    failed: "فشل الإعداد"
  }
} as const;

export function FurkaniaBootstrapButton({ locale }: Props) {
  const router = useRouter();
  const text = copy[locale];
  const [state, setState] = useState<"idle" | "running" | "done" | "unchanged" | "failed">("idle");
  const [detail, setDetail] = useState("");

  async function bootstrap() {
    if (state === "running") return;
    setState("running");
    setDetail("");

    try {
      const response = await fetch("/api/client/furkania/bootstrap", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      const result = (await response.json()) as BootstrapResponse;

      if (!response.ok) {
        setState("failed");
        setDetail(result.error || text.failed);
        return;
      }

      if (result.changed) {
        const levelCount = result.created?.levels.length ?? 0;
        const componentCount = result.created?.components.length ?? 0;
        setState("done");
        setDetail(`${levelCount} courses · ${componentCount} curriculum components`);
      } else {
        setState("unchanged");
      }
      router.refresh();
    } catch {
      setState("failed");
      setDetail(text.failed);
    }
  }

  const label = state === "running"
    ? text.running
    : state === "done"
      ? text.done
      : state === "unchanged"
        ? text.unchanged
        : state === "failed"
          ? text.failed
          : text.idle;

  return (
    <div>
      <button
        className="action-button action-button-primary"
        disabled={state === "running"}
        onClick={bootstrap}
        type="button"
      >
        {label}
      </button>
      {detail ? <p role={state === "failed" ? "alert" : "status"}>{detail}</p> : null}
    </div>
  );
}
