import type { MetadataRoute } from "next";

/**
 * Web Application Manifest configuration for PWA installation and browser theme styling.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VELUR — a Ukrainian cosmetics brand",
    short_name: "VELUR",
    description:
      "Body and face care, gift sets. A daily ritual of self-love.",
    lang: "uk",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}

