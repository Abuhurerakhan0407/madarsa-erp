import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("Android/PWA install manifest", () => {
  it("keeps the Jamia Islamia client install contract stable", () => {
    const value = manifest();
    expect(value).toMatchObject({
      id: "/",
      name: "Jamia Islamia Uloomul Quraan",
      short_name: "Jamia Islamia",
      start_url: "/login?source=app",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#14734f",
      orientation: "portrait-primary"
    });
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "/icons/maskable-512.png", sizes: "512x512", purpose: "maskable" })
    ]));
  });
});
