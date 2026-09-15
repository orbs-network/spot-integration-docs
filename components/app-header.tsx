"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPartnerDocumentationHref } from "@/features/partner-documentation/query-state";
import type { PartnerDocumentationRequest } from "@/features/partner-documentation/partner-documentation";
import { ExternalLink, Github } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_REPOSITORY } from "@/lib/site";

export function AppHeader({ search, partnerRequest }: { search?: ReactNode; partnerRequest?: PartnerDocumentationRequest }) {
  const pathname = usePathname();
  const homeHref = createPartnerDocumentationHref("/", partnerRequest);
  const advancedOrders = pathname.startsWith("/advanced-orders");
  const playgroundUrl = advancedOrders
    ? "http://localhost:3000/?devMode=true&tab=twap"
    : "https://orbs-spot.vercel.app/";
  return (
    <header className={`app-header${search ? " app-header-with-search" : ""}`}>
      <Link
        aria-label="Orbs Spot"
        className="app-logo-link"
        href={homeHref}
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
        <a
          aria-label="Open integration docs on GitHub in a new tab"
          className="github-nav-link"
          href={SITE_REPOSITORY}
          rel="noopener noreferrer"
          target="_blank"
          title="View on GitHub"
        >
          <Github aria-hidden="true" size={18} />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
