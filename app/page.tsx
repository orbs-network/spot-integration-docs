import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { CategoryAccordion } from "@/components/category-accordion";
import {
  parsePartnerDocumentationQuery,
  type PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";
import { createPartnerDocumentationHref } from "@/features/partner-documentation/query-state";
import { GUIDE_SOURCES, type GuideProductId } from "@/lib/guides";
import { ADVANCED_ORDERS_SKILL_URL, SITE_DESCRIPTION } from "@/lib/site";

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
      "Swap tokens now using an Orbs quote. Add it to your swap form or compare it with your existing DEX route.",
    id: "liquidity-hub",
    kicker: "Swap Routing",
    title: "Swap",
  },
  {
    description:
      "Let users split trades over time (TWAP), set a limit price, or trade when a stop-loss or take-profit price is reached.",
    id: "advanced-orders",
    kicker: "Scheduled Orders",
    title: "Advanced Orders",
  },
];

const GUIDE_BADGES: Partial<Record<(typeof GUIDE_SOURCES)[number]["id"], string>> = {
  "advanced-orders-react": "For React",
  "advanced-orders-sdk": "Any Framework",
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
    parsedPartnerQuery.kind === "valid" || parsedPartnerQuery.kind === "partner-only"
      ? parsedPartnerQuery.request
      : undefined;
  const guideHref = (route: string) =>
    createPartnerDocumentationHref(route, partnerRequest);

  return (
    <>
      <AppHeader partnerRequest={partnerRequest} />
      <main className="docs-home" id="guide-content" tabIndex={-1}>
        <div className="docs-home-shell">
          <header className="docs-home-hero">
            <p className="eyebrow">Orbs Spot Docs{partnerRequest ? ` for ${partnerRequest.partner.charAt(0).toUpperCase() + partnerRequest.partner.slice(1)}` : ""}</p>
            <h1>Choose Your Integration Guide</h1>
            <p>
              Choose what your users need below, then pick one SDK or API guide.
              Follow it from setup to a working trade, with the requirements
              explained along the way.
            </p>
          </header>

          <nav aria-label="Product categories" className="home-category-badges">
            <span className="home-category-badge home-category-badge-upcoming" data-product="perps">
              Perps
              <span className="coming-soon-badge">Coming soon</span>
            </span>
            <a aria-current="location" className="home-category-badge home-category-badge-active" href="#spot-guides">
              <span aria-hidden="true" className="home-category-dot" />
              Spot
            </a>
          </nav>
          <section aria-labelledby="spot-heading" className="docs-home-category home-category-panel" id="spot-guides">
            <h2 className="sr-only" id="spot-heading">Spot</h2>
            <div className="docs-home-products">
              {PRODUCTS.map((product) => {
                const guides = GUIDE_SOURCES.filter(
                  (guide) => guide.product === product.id,
                );

                return (
                  <article className="docs-home-product" data-product={product.id} key={product.id}>
                    <header>
                      <p>{product.kicker}</p>
                      <h3>{product.title}</h3>
                      <span>{product.description}</span>
                    </header>
                    <nav
                      aria-label={`${product.title} integration guides`}
                      className="docs-home-guide-list"
                    >
                      {guides.map((guide) => (
                        <Link
                          className={`docs-home-guide-link${guide.id.endsWith("-shared") ? " docs-home-guide-link-reference" : ""}`}
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
                      {product.id === "advanced-orders" ? (
                        <a
                          className="docs-home-guide-link"
                          href={ADVANCED_ORDERS_SKILL_URL}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>
                            <strong>MCP Skill</strong>
                            <small>Implementation resources for coding agents</small>
                          </span>
                          <ExternalLink aria-hidden="true" size={17} />
                        </a>
                      ) : null}
                    </nav>
                  </article>
                );
              })}
            </div>
            <CategoryAccordion
              className="home-private-orders"
              defaultOpen={false}
              headingLevel={3}
              title="Private and Sealed Orders"
            >
              <p className="category-contact-copy">
                Contact the Orbs team for access and integration guidance for
                Private and Sealed Orders.
              </p>
            </CategoryAccordion>
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
