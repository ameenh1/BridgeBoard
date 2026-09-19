import type { MetadataRoute } from "next";

/**
 * Installable as an app, which matters more here than it usually does: a
 * communication device is something someone carries, and a home-screen icon
 * that opens full-screen with no browser chrome is both faster to reach in a
 * hurry and harder to navigate away from by accident.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BridgeBoard",
    short_name: "BridgeBoard",
    description: "Conversation in. Choice out.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#b9dfd9",
    theme_color: "#b9dfd9",
    categories: ["education", "medical", "utilities"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/brand/kids.webp", sizes: "900x720", type: "image/webp" },
    ],
  };
}
