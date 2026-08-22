import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FundsFlow — Money Tracking That Doesn't Feel Like Homework",
    short_name: "FundsFlow",
    description:
      "Track earnings, spending, bills, budgets and savings goals by just saying what happened. Chat-first, and built to be enjoyable to use.",
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
