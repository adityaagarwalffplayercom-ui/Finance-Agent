import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Actic Finance — AI Finance Workspace",
    short_name: "Actic Finance",
    description:
      "Actic Finance is an AI-powered finance workspace for smarter business decisions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090d14",
    theme_color: "#0b111b",
    orientation: "portrait",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/aureli-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}