import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BionicsSCAN",
    short_name: "BionicsSCAN",
    description: "FRC inventory management for belts, gears, and sprockets.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8f6",
    theme_color: "#0f4d3a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
