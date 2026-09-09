import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import {
  parsePartnerDocumentationQuery,
  type PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";
import { createPartnerDocumentationHref } from "@/features/partner-documentation/query-state";
import { GUIDE_SOURCES, type GuideProductId } from "@/lib/guides";
import { SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description: SITE_DESCRIPTION,
  title: "Integration Guides",
};

const PRODUCTS: readonly {
  description: string;
  id: GuideProductId;
  kicker: string;
  title: string;
}[] = [
  {
    description:
      "Add solver-backed liquidity to an existing swap flow and compare executable output with the host DEX route.",
    id: "liquidity-hub",
    kicker: "Swap Routing",
    title: "Liquidity Hub",
  },
  {
    description:
      "Add TWAP, limit, and conditional orders with an API-only, framework-neutral TypeScript, or React integration.",
    id: "advanced-orders",
    kicker: "Scheduled Orders",
    title: "Advanced Orders",
  },
];

const GUIDE_BADGES: Partial<Record<(typeof GUIDE_SOURCES)[number]["id"], string>> = {
  "advanced-orders-react": "Easiest",
  "advanced-orders-sdk": "Most Flexible",
  "liquidity-hub": "Recommended",
};

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const params = await searchParams;
  const parsedPartnerQuery = parsePartnerDocumentationQuery(
    getSearchParam(params.partner),
    getSearchParam(params.chainId),
  );
  const partnerRequest: PartnerDocumentationRequest | undefined =
    parsedPartnerQuery.kind === "valid" ? parsedPartnerQuery.request : undefined;
  const guideHref = (route: string) =>
    createPartnerDocumentationHref(route, partnerRequest);

  return (
    <>
      <AppHeader />
      <main className="docs-home" id="guide-content" tabIndex={-1}>
        <div className="docs-home-shell">
          <header className="docs-home-hero">
            <p className="eyebrow">Orbs Spot Docs</p>
            <h1>Choose Your Integration Guide</h1>
            <p>
              Production-focused references for adding Orbs protocols to an
              existing DEX. Start with the product, then choose how much of the
              integration lifecycle your application should own.
            </p>
          </header>

          <section aria-label="Orbs Spot products" className="docs-home-products">
            {PRODUCTS.map((product) => {
              const guides = GUIDE_SOURCES.filter(
                (guide) => guide.product === product.id,
              );

              return (
                <article className="docs-home-product" key={product.id}>
                  <header>
                    <p>{product.kicker}</p>
                    <h2>{product.title}</h2>
                    <span>{product.description}</span>
                  </header>
                  <nav
                    aria-label={`${product.title} integration guides`}
                    className="docs-home-guide-list"
                  >
                    {guides.map((guide) => (
                      <Link
                        className="docs-home-guide-link"
                        href={guideHref(guide.route)}
                        key={guide.id}
                      >
                        <span>
                          <strong>{guide.variantLabel}</strong>
                          <small>{guide.description}</small>
                        </span>
                        {GUIDE_BADGES[guide.id] ? (
                          <em>{GUIDE_BADGES[guide.id]}</em>
                        ) : null}
                        <ArrowRight aria-hidden="true" size={17} />
                      </Link>
                    ))}
                  </nav>
                </article>
              );
            })}
          </section>

          <footer className="docs-home-footer">
            <span>
              Want to see the integrations running before choosing a guide?
            </span>
            <a
              href="https://orbs-spot.vercel.app/?devMode=true"
              rel="noreferrer"
              target="_blank"
            >
              Open Interactive Example
              <ExternalLink aria-hidden="true" size={15} />
            </a>
          </footer>
        </div>
      </main>
    </>
  );
}
