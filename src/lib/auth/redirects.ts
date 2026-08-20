const fallbackPath = "/en";

export function safeAuthRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallbackPath;
  }

  try {
    const url = new URL(value, "https://madarsa-erp.invalid");

    return url.origin === "https://madarsa-erp.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallbackPath;
  } catch {
    return fallbackPath;
  }
}
