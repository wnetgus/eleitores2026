import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELEITORES2026",
    short_name: "ELEITORES",
    description: "Plataforma de gestão política e territorial",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#6366f1",
    orientation: "portrait",
    categories: ["productivity", "politics"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Cadastro Rápido",
        short_name: "Cadastrar",
        description: "Cadastrar eleitor em campo",
        url: "/cadastro-rapido",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
