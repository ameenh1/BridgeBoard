import type { Metadata, Viewport } from "next";
import { Francois_One } from "next/font/google";
import "./globals.css";

/**
 * Self-hosted through next/font rather than the CSS @import the frontend used:
 * no render-blocking request to a third party, no layout shift, and nothing
 * about a child's session leaves the device to fetch a typeface.
 */
const display = Francois_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "BridgeBoard",
  description: "Conversation in. Choice out.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b9dfd9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
