import { describe, expect, it } from "vitest";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import ur from "../../../messages/ur.json";
import { getDirection, isLocale, locales } from "./config";

function messageKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return typeof nestedValue === "object" && nestedValue !== null
      ? messageKeys(nestedValue, path)
      : [path];
  });
}

describe("locale configuration", () => {
  it("exposes only the approved application locales", () => {
    expect(locales).toEqual(["en", "ur"]);
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("ar")).toBe(false);
    expect(isLocale("fr")).toBe(false);
  });

  it("keeps writing direction support for legacy localized data", () => {
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("ur")).toBe("rtl");
    expect(getDirection("ar")).toBe("rtl");
  });

  it("keeps dormant translation keys aligned", () => {
    const englishKeys = messageKeys(en).sort();

    expect(messageKeys(ur).sort()).toEqual(englishKeys);
    expect(messageKeys(ar).sort()).toEqual(englishKeys);
  });
});
