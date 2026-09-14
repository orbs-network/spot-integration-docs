"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader({ search }: { search?: ReactNode }) {
  const pathname = usePathname();
  const advancedOrders = pathname.startsWith("/advanced-orders");
  const playgroundUrl = advancedOrders
    ? "http://localhost:3000/?devMode=true&tab=twap"
    : "https://orbs-spot.vercel.app/";
  return (
    <header className={`app-header${search ? " app-header-with-search" : ""}`}>
      <Link
        aria-label="Orbs Spot"
        className="app-logo-link"
        href="/"
      >
        <Image
          alt="Orbs Swap"
          height="40"
          priority
          src="/orbs-logo.svg"
          width="160"
        />
      </Link>
      {search}
      <div className="app-header-actions">
        <a
          className="playground-link"
          href={playgroundUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${advancedOrders ? "Advanced Orders" : "Swap"} playground in a new tab`}
        >
          Playground
          <ExternalLink aria-hidden="true" size={14} />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
