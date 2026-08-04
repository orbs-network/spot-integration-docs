import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spot Integration Docs",
  description: "Step-by-step integration documentation for Spot Order Sink",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
