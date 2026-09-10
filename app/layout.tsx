import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ProductBackground } from "@/components/product-background";

import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

import "./globals.css";

const montserrat = localFont({
  src: "../public/fonts/montserrat-latin.woff2",
  variable: "--font-orbs",
  weight: "400 800",
  display: "swap",
});

const THEME_INITIALIZER = `
(function () {
  try {
    var storedTheme = window.localStorage.getItem("orbs-docs-theme");
    var theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.content = theme === "light" ? "#f7f7f8" : "#09090b";
    });
  } catch (_) {}
})();`;

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
  colorScheme: "light dark",
  initialScale: 1,
  themeColor: "#09090b",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={montserrat.variable} data-scroll-behavior="smooth" data-theme="dark" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INITIALIZER }} />
      </head>
      <body>
        <ProductBackground />
        <a className="skip-link" href="#guide-content">
          Skip to main content
        </a>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
