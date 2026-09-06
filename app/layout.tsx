import type { Metadata, Viewport } from "next";

import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  authors: [{ name: "Orbs" }],
  category: "technology",
  creator: "Orbs",
  description: SITE_DESCRIPTION,
  keywords: [
    "Orbs",
    "Liquidity Hub",
    "Advanced Orders",
    "DEX integration",
    "DeFi",
  ],
  metadataBase: getSiteUrl(),
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: "website",
  },
  publisher: "Orbs",
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
    title: SITE_NAME,
  },
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
