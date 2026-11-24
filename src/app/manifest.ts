import type { MetadataRoute } from "next";

/** Lets students install the web app on their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Readback",
    short_name: "Readback",
    description: "Aviation radio communication training for PPL and ATPL students.",
    start_url: "/treino",
    display: "standalone",
    background_color: "#0d1419",
    theme_color: "#0d1419",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
