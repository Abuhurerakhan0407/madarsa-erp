import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ilmgaah",
    short_name: "Ilmgaah",
    description: "Ilmgaah for madrasa administrators, teachers, parents, and staff.",
    start_url: "/login?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6ef",
    theme_color: "#0a7154",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    lang: "en",
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
