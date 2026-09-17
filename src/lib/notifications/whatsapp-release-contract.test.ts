import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/[locale]/communications/whatsapp/page.tsx"), "utf8");
const nav = readFileSync(resolve(process.cwd(), "src/lib/navigation/client-v3-navigation.ts"), "utf8");

describe("WhatsApp client release gate", () => {
  it("keeps unfinished WhatsApp UI hidden from authenticated clients", () => {
    expect(page).toContain("notFound()");
    expect(page).not.toContain("WhatsappAutomationCenter");
    expect(page).not.toContain("getWhatsappCenter");
  });

  it("does not expose WhatsApp in client navigation", () => {
    expect(nav).not.toContain("communications/whatsapp");
  });
});
