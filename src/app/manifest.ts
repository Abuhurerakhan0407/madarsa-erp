import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Jamia Islamia Uloomul Quraan",
    short_name: "Jamia Islamia",
    description: "Jamia Islamia Uloomul Quraan for Hifz, Arabic learning and residential hostel operations.",
    start_url: "/login?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#14734f",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    lang: "ur",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
