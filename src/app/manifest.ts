import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Freeze Fund | Kid Money Tracker",
    short_name: "Freeze Fund",
    description: "A fun, chunky money tracker for kids — track earnings, spending, and savings goals.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7e8",
    theme_color: "#2a2d7c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
