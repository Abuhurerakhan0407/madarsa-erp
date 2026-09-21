import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("Android/PWA install manifest", () => {
  it("keeps the Ilmgaah install contract stable", () => {
    const value = manifest();
    expect(value).toMatchObject({
      id: "/",
      name: "Ilmgaah",
      short_name: "Ilmgaah",
      start_url: "/login?source=app",
      scope: "/",
      display: "standalone",
      background_color: "#f8f6ef",
      theme_color: "#0a7154",
      orientation: "portrait-primary"
    });
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "/icons/maskable-512.png", sizes: "512x512", purpose: "maskable" })
    ]));
  });
});
