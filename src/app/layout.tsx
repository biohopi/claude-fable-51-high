import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import "./globals.css";
import "./lobby.css";

export const metadata: Metadata = {
  title: "Erangel Strike Enhanced | Blue vs Red",
  description:
    "Erangel Strike Enhanced: a playable Three.js tactical shooter with a PUBG-Mobile-style Warehouse team deathmatch, Erangel battle royale, and online rooms for friends over LAN or the internet.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#151c13", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
