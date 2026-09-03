"use client";

import { useTranslations } from "next-intl";
import { WorkspaceState } from "@/components/workspace-ui";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("State");

  return (
    <WorkspaceState
      code="!"
      eyebrow={t("errorKicker")}
      title={t("errorTitle")}
      body={t("errorBody")}
      tone="danger"
      role="alert"
      action={<button className="action-button action-button-primary" onClick={reset} type="button">{t("tryAgain")}</button>}
    />
  );
}
