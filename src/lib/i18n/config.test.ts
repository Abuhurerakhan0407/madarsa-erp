import { describe, expect, it } from "vitest";
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
  it("supports only the approved release locales", () => {
    expect(locales).toEqual(["en", "ur"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("ar")).toBe(false);
    expect(isLocale("fr")).toBe(false);
  });

  it("maps release writing directions correctly", () => {
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("ur")).toBe("rtl");
  });

  it("keeps English and Urdu translation keys aligned", () => {
    expect(messageKeys(ur).sort()).toEqual(messageKeys(en).sort());
  });
});
