import type { MetadataRoute } from "next"

export const dynamic = "force-static"
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GymTrack",
    short_name: "GymTrack",
    description: "Treinos e evolução, mesmo sem internet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "pt-BR",
    background_color: "#0b1714",
    theme_color: "#0b1714",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
