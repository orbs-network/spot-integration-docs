"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Github,
  Search,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  Suspense,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AppHeader } from "@/components/app-header";
import { HighlightedText, MarkdownContent } from "@/components/markdown-content";
import { PageActions } from "@/components/page-actions";
import {
  usePartnerDocumentation,
  type PartnerDocumentationState,
} from "@/features/partner-documentation/use-partner-documentation";
import {
  createPartnerDocumentationHref,
} from "@/features/partner-documentation/query-state";
import {
  personalizeDocumentationMarkdown,
  type PartnerDocumentationConfig,
  type PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";
import type {
  Guide,
  GuideId,
  GuideSearchEntry,
  GuideStep,
  GuideSummary,
} from "@/lib/guides";
import { hasReferenceExample } from "@/lib/reference-keys";

const InteractiveReference = dynamic(() =>
  import("@/components/interactive-reference").then(
    (module) => module.InteractiveReference,
  ),
  {
    loading: () => (
      <p aria-live="polite" className="reference-loading">
        Loading code example…
      </p>
    ),
  },
);

const LOCATION_EVENT = "spot-docs-location-change";

const RESOURCES: Record<
  GuideId,
  { primaryHref: string; primaryLabel: string; sourceHref: string }
> = {
  "liquidity-hub": {
    primaryHref: "https://orbs-spot.vercel.app/?devMode=true",
    primaryLabel: "Open Interactive Example",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/liquidity-hub-ui",
  },
  "liquidity-hub-direct": {
    primaryHref: "https://orbs-spot.vercel.app/?devMode=true",
    primaryLabel: "Open Interactive Example",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/liquidity-hub-ui/src/lib",
  },
  "advanced-orders-direct": {
    primaryHref: "https://orbs-spot.vercel.app/?devMode=true",
    primaryLabel: "Open Interactive Example",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui",
  },
  "advanced-orders-sdk": {
    primaryHref: "https://orbs-spot.vercel.app/?devMode=true&tab=twap",
    primaryLabel: "Open Interactive Example",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui",
  },
  "advanced-orders-react": {
    primaryHref: "https://orbs-spot.vercel.app/?devMode=true&tab=twap",
    primaryLabel: "Open Interactive Example",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react",
  },
};

function createInteractiveExampleHref(
  href: string,
  request?: PartnerDocumentationRequest,
): string {
  if (!request) return href;

  const url = new URL(href);
  url.searchParams.set("partner", request.partner);
  url.searchParams.set("chainId", String(request.chainId));
  return url.toString();
}

function subscribeToLocation(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(LOCATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(LOCATION_EVENT, onStoreChange);
  };
}

function getHashSnapshot(): string {
  return window.location.hash.slice(1).split("?", 1)[0] ?? "";
}

function getServerHashSnapshot(): string {
  return "";
}

function getStepIndex(guide: Guide, hash: string): number {
  if (!hash) return 0;
  const decodedHash = decodeURIComponent(hash);
  const requestedId = guide.hashAliases[decodedHash] ?? decodedHash;
  const index = guide.steps.findIndex((step) => step.id === requestedId);
  return index < 0 ? 0 : index;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function getSearchExcerpt(
  text: string,
  query: string,
): string {
  const matchIndex = text.toLowerCase().indexOf(query);
  if (matchIndex < 0) return text.slice(0, 120);
  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(text.length, matchIndex + query.length + 74);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function GuideNavigation({
  activeGuide,
  guides,
  partnerRequest,
}: {
  activeGuide: Guide;
  guides: GuideSummary[];
  partnerRequest?: PartnerDocumentationRequest;
}) {
  const products = [
    {
      description: "Best-price swap routing",
      id: "liquidity-hub" as const,
      label: "Liquidity Hub",
    },
    {
      description: "Scheduled and conditional orders",
      id: "advanced-orders" as const,
      label: "Advanced Orders",
    },
  ];

  return (
    <nav aria-label="Integration guides" className="guide-tree">
      {products.map((product) => {
        const activeProduct = activeGuide.product === product.id;
        const variants = guides.filter((guide) => guide.product === product.id);

        return (
          <div
            aria-label={`${product.label} integration methods`}
            className={`guide-product${activeProduct ? " guide-product-active" : ""}`}
            key={product.id}
            role="group"
          >
            <div className="guide-product-heading">
              <strong>{product.label}</strong>
              <span>{product.description}</span>
            </div>
            <div className="variant-list">
              {variants.map((guide) => {
                const active = guide.id === activeGuide.id;
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`variant-link${active ? " variant-link-active" : ""}`}
                    href={createPartnerDocumentationHref(
                      guide.route,
                      partnerRequest,
                    )}
                    key={guide.id}
                  >
                    <span aria-hidden="true" className="variant-link-marker" />
                    <span>{guide.variantLabel}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function StepNavigation({
  activeStepIndex,
  guide,
  onStepClick,
  partnerRequest,
  stepRefs,
}: {
  activeStepIndex: number;
  guide: Guide;
  onStepClick: (event: MouseEvent<HTMLAnchorElement>, step: GuideStep) => void;
  partnerRequest?: PartnerDocumentationRequest;
  stepRefs: React.RefObject<(HTMLAnchorElement | null)[]>;
}) {
  return (
    <nav aria-label={`${guide.label} guide steps`} className="step-list">
      {guide.steps.map((step, index) => {
        const active = index === activeStepIndex;
        return (
          <a
            aria-current={active ? "step" : undefined}
            className={`step-link${active ? " step-link-active" : ""}`}
            href={createPartnerDocumentationHref(
              guide.route,
              partnerRequest,
              step.id,
            )}
            key={step.id}
            onClick={(event) => onStepClick(event, step)}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
          >
            <span className="step-number">{index + 1}</span>
            <span className="step-label">{step.title}</span>
          </a>
        );
      })}
    </nav>
  );
}

function StepFooter({
  guide,
  nextStep,
  onStepClick,
  partnerRequest,
  previousStep,
}: {
  guide: Guide;
  nextStep?: GuideStep;
  onStepClick: (event: MouseEvent<HTMLAnchorElement>, step: GuideStep) => void;
  partnerRequest?: PartnerDocumentationRequest;
  previousStep?: GuideStep;
}) {
  return (
    <footer className="step-footer">
      {previousStep ? (
        <a
          className="step-footer-link"
          href={createPartnerDocumentationHref(
            guide.route,
            partnerRequest,
            previousStep.id,
          )}
          onClick={(event) => onStepClick(event, previousStep)}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          <span>
            <small>Previous</small>
            <strong>{previousStep.title}</strong>
          </span>
        </a>
      ) : (
        <span />
      )}
      {nextStep ? (
        <a
          className="step-footer-link step-footer-link-next"
          href={createPartnerDocumentationHref(
            guide.route,
            partnerRequest,
            nextStep.id,
          )}
          onClick={(event) => onStepClick(event, nextStep)}
        >
          <span>
            <small>Next</small>
            <strong>{nextStep.title}</strong>
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </a>
      ) : null}
    </footer>
  );
}

interface DocsShellProps {
  activeGuide: Guide;
  guides: GuideSummary[];
  searchIndex: GuideSearchEntry[];
}

const EMPTY_PARTNER_DOCUMENTATION: PartnerDocumentationState = {
  kind: "none",
};

function PartnerAwareDocsShell(props: DocsShellProps) {
  const partnerDocumentation = usePartnerDocumentation();
  return (
    <DocsShellContent
      {...props}
      partnerDocumentation={partnerDocumentation}
    />
  );
}

export function DocsShell(props: DocsShellProps) {
  return (
    <Suspense
      fallback={
        <DocsShellContent
          {...props}
          partnerDocumentation={EMPTY_PARTNER_DOCUMENTATION}
        />
      }
    >
      <PartnerAwareDocsShell {...props} />
    </Suspense>
  );
}

function DocsShellContent({
  activeGuide,
  guides,
  partnerDocumentation,
  searchIndex,
}: DocsShellProps & {
  partnerDocumentation: PartnerDocumentationState;
}) {
  const router = useRouter();
  const hash = useSyncExternalStore(
    subscribeToLocation,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const partnerRequest =
    partnerDocumentation.kind === "none"
      ? undefined
      : partnerDocumentation.request;
  const partnerConfig: PartnerDocumentationConfig | undefined =
    partnerDocumentation.kind === "ready"
      ? partnerDocumentation.config
      : undefined;
  const partnerName = partnerConfig?.partner;
  const activeStepIndex = getStepIndex(activeGuide, hash);
  const activeStep = activeGuide.steps[activeStepIndex] ?? activeGuide.steps[0];
  const previousStep = activeGuide.steps[activeStepIndex - 1];
  const nextStep = activeGuide.steps[activeStepIndex + 1];
  const contentRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const mobileStepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [search, setSearch] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const rawIntroduction = `${activeGuide.intro}\n\n${activeGuide.introReference}`.trim();
  const introduction = partnerConfig
    ? personalizeDocumentationMarkdown(rawIntroduction, partnerConfig)
    : rawIntroduction;
  const activeStepContent = partnerConfig
    ? personalizeDocumentationMarkdown(activeStep.content, partnerConfig)
    : activeStep.content;
  const matchingSearchResults = deferredSearch
    ? searchIndex
        .filter((entry) => entry.searchText.toLowerCase().includes(deferredSearch))
    : [];
  const searchResults = matchingSearchResults.slice(0, 10);
  const resources = RESOURCES[activeGuide.id];
  const interactiveExampleHref = createInteractiveExampleHref(
    resources.primaryHref,
    partnerDocumentation.kind === "ready"
      ? partnerDocumentation.request
      : undefined,
  );
  const hasInteractiveReference = hasReferenceExample(
    activeGuide.id,
    activeStep.id,
  );

  const openStep = (step: GuideStep, query = "") => {
    setHighlightQuery(query);
    setSearch("");
    window.history.pushState(
      null,
      "",
      createPartnerDocumentationHref(
        activeGuide.route,
        partnerRequest,
        step.id,
      ),
    );
    window.dispatchEvent(new Event(LOCATION_EVENT));
    document.getElementById("mobile-guide-menu")?.removeAttribute("open");
    window.requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
    });
  };

  const navigateToStep = (
    event: MouseEvent<HTMLAnchorElement>,
    step: GuideStep,
  ) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    openStep(step);
  };

  const openSearchResult = (result: GuideSearchEntry) => {
    if (result.guideId !== activeGuide.id) {
      setHighlightQuery("");
      setSearch("");
      router.push(
        createPartnerDocumentationHref(
          result.route,
          partnerRequest,
          result.stepId,
        ),
      );
      return;
    }

    const step = activeGuide.steps.find((candidate) => candidate.id === result.stepId);
    if (step) openStep(step, deferredSearch);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) openSearchResult(searchResults[0]);
  };

  const navigateSearchResults = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearch("");
      searchInputRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + direction + searchResults.length) % searchResults.length;
    searchResultRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const searchInput = searchInputRef.current;
        if (!searchInput) return;

        searchInput.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
        searchInput.focus({ preventScroll: true });
        searchInput.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ behavior: "auto", left: 0, top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeGuide.id, activeStep.id]);

  useEffect(() => {
    const activeLink = stepRefs.current[activeStepIndex];
    const mobileActiveLink = mobileStepRefs.current[activeStepIndex];
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    activeLink?.scrollIntoView({ behavior, block: "nearest" });
    mobileActiveLink?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }, [activeStepIndex]);

  useEffect(() => {
    if (!highlightQuery) return;
    const frame = window.requestAnimationFrame(() => {
      contentRef.current
        ?.querySelector<HTMLElement>('[data-search-highlight="true"]')
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStep.id, highlightQuery]);

  return (
    <>
      <AppHeader />
      <main className="docs-shell">
        <div className="docs-page">
          <div className="docs-layout">
        <aside className="sidebar">
          <details className="mobile-menu" id="mobile-guide-menu">
            <summary>
              <span>
                <small>
                  {activeGuide.product === "liquidity-hub"
                    ? "Liquidity Hub"
                    : "Advanced Orders"}
                </small>
                <strong>{activeStepIndex + 1}. {activeStep.title}</strong>
              </span>
              <span className="mobile-menu-label">
                Guide menu
                <ChevronDown aria-hidden="true" size={16} />
              </span>
            </summary>
            <div className="mobile-menu-content">
              <GuideNavigation
                activeGuide={activeGuide}
                guides={guides}
                partnerRequest={partnerRequest}
              />
              <div className="sidebar-rule" />
              <StepNavigation
                activeStepIndex={activeStepIndex}
                guide={activeGuide}
                onStepClick={navigateToStep}
                partnerRequest={partnerRequest}
                stepRefs={mobileStepRefs}
              />
            </div>
          </details>

          <div className="desktop-sidebar">
            <div className="brand-lockup">
              <span aria-hidden="true" className="brand-mark"><BookOpen size={17} /></span>
              <span>
                <small>Orbs Spot Docs</small>
                <strong>
                  {partnerName ? (
                    <>
                      <span className="sidebar-partner-name" translate="no">
                        {partnerName}
                      </span>{" "}
                    </>
                  ) : null}
                  Integration Guides
                </strong>
              </span>
            </div>
            <GuideNavigation
              activeGuide={activeGuide}
              guides={guides}
              partnerRequest={partnerRequest}
            />
            <div className="sidebar-rule" />
            <div className="step-list-heading">
              <span>{activeGuide.variantLabel} guide</span>
              <span>Step {activeStepIndex + 1} of {activeGuide.steps.length}</span>
            </div>
            <StepNavigation
              activeStepIndex={activeStepIndex}
              guide={activeGuide}
              onStepClick={navigateToStep}
              partnerRequest={partnerRequest}
              stepRefs={stepRefs}
            />
          </div>
        </aside>

        <section
          aria-labelledby="guide-step-title"
          className="guide-content"
          id="guide-content"
          ref={contentRef}
          tabIndex={-1}
        >
          <header className="guide-header">
            <p className="eyebrow">
              {activeGuide.label} · Step {activeStepIndex + 1} of {activeGuide.steps.length}
            </p>
            <div className="guide-title-row">
              <div className="guide-heading-row">
                <h1 id="guide-step-title">
                  <HighlightedText query={highlightQuery} text={activeStep.title} />
                </h1>
                <PageActions
                  markdownPath={`${activeGuide.route}.md`}
                  pagePath={activeGuide.route}
                />
              </div>
              <form className="guide-search" onSubmit={submitSearch} role="search">
                <label>
                  <span className="sr-only">Search all integration documentation</span>
                  <Search aria-hidden="true" size={16} />
                  <input
                    aria-controls="guide-search-results"
                    autoComplete="off"
                    name="guide-search"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setHighlightQuery("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearch("");
                        return;
                      }
                      if (event.key === "ArrowDown" && searchResults.length) {
                        event.preventDefault();
                        searchResultRefs.current[0]?.focus();
                      }
                    }}
                    placeholder="Search all docs…"
                    ref={searchInputRef}
                    type="search"
                    value={search}
                  />
                  <kbd aria-hidden="true">⌘K</kbd>
                </label>
                {deferredSearch ? (
                  <div className="search-results" id="guide-search-results">
                    <p aria-live="polite">
                      {matchingSearchResults.length} {matchingSearchResults.length === 1 ? "section" : "sections"} found across all guides
                      {matchingSearchResults.length > searchResults.length
                        ? ` · showing first ${searchResults.length}`
                        : ""}
                    </p>
                    {searchResults.length ? (
                      <ul>
                        {searchResults.map((result, resultIndex) => {
                          return (
                            <li key={`${result.guideId}-${result.stepId}`}>
                              <a
                                aria-label={`${result.title}, ${result.guideLabel}`}
                                href={createPartnerDocumentationHref(
                                  result.route,
                                  partnerRequest,
                                  result.stepId,
                                )}
                                onClick={(event) => {
                                  if (isModifiedClick(event)) return;
                                  event.preventDefault();
                                  openSearchResult(result);
                                }}
                                onKeyDown={(event) => navigateSearchResults(event, resultIndex)}
                                ref={(element) => {
                                  searchResultRefs.current[resultIndex] = element;
                                }}
                              >
                                <span>{result.stepIndex + 1}</span>
                                <span>
                                  <strong><HighlightedText query={deferredSearch} text={result.title} /></strong>
                                  <em>{result.guideLabel}</em>
                                  <small>
                                    <HighlightedText
                                      query={deferredSearch}
                                      text={getSearchExcerpt(result.searchText, deferredSearch)}
                                    />
                                  </small>
                                </span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="search-empty">Try a field, endpoint, or lifecycle stage.</span>
                    )}
                  </div>
                ) : null}
              </form>
            </div>
          </header>

          {activeStepIndex === 0 && introduction ? (
            <section aria-label={`${activeGuide.label} introduction`} className="guide-introduction">
              <MarkdownContent
                highlightQuery={highlightQuery}
                markdown={introduction}
                partnerRequest={partnerRequest}
              />
            </section>
          ) : null}

          <div aria-hidden="true" className="progress-track">
            <span style={{ transform: `scaleX(${(activeStepIndex + 1) / activeGuide.steps.length})` }} />
          </div>

          <article className="guide-article" id={activeStep.id}>
            {hasInteractiveReference ? (
              <InteractiveReference
                guideId={activeGuide.id}
                partnerConfig={partnerConfig}
                stepId={activeStep.id}
              />
            ) : null}
            <MarkdownContent
              highlightQuery={highlightQuery}
              markdown={activeStepContent}
              partnerRequest={partnerRequest}
            />
          </article>

          <StepFooter
            guide={activeGuide}
            nextStep={nextStep}
            onStepClick={navigateToStep}
            partnerRequest={partnerRequest}
            previousStep={previousStep}
          />

          <aside className="implementation-callout">
            <span>
              <strong>Ready to Implement?</strong>
              <small>Use the reference implementation, then contact Orbs if partner configuration is missing.</small>
            </span>
            <span className="resource-links">
              <a href={resources.sourceHref} rel="noreferrer" target="_blank">
                <Github aria-hidden="true" size={15} />
                View Source
              </a>
              <a href={interactiveExampleHref} rel="noreferrer" target="_blank">
                {resources.primaryLabel}
                <ArrowRight aria-hidden="true" size={15} />
              </a>
            </span>
          </aside>
        </section>
          </div>
        </div>
      </main>
    </>
  );
}
