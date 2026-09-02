import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Spot Integration Docs",
  title: "Spot Integration Docs",
  description:
    "Integration guides for Orbs Liquidity Hub and Advanced Orders.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  initialScale: 1,
  themeColor: "#09090b",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <a className="skip-link" href="#guide-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
