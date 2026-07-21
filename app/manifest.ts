import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Draft My Hair",
    short_name: "Draft My Hair",
    description: "See Your Next Hairstyle Before You Cut It.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f0",
    theme_color: "#181816",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
