"use client";

import Image from "next/image";
import Link from "next/link";
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
  type MouseEvent,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { InteractiveReference } from "@/components/interactive-reference";
import { HighlightedText, MarkdownContent } from "@/components/markdown-content";
import type { Guide, GuideId, GuideStep } from "@/lib/guides";

const LOCATION_EVENT = "spot-docs-location-change";

const RESOURCES: Record<
  GuideId,
  { primaryHref: string; primaryLabel: string; sourceHref: string }
> = {
  "liquidity-hub": {
    primaryHref: "https://orbs-spot.vercel.app",
    primaryLabel: "Open Live Liquidity Hub UI",
    sourceHref:
      "https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx",
  },
  "advanced-orders-direct": {
    primaryHref: "https://github.com/orbs-network/spot-integration-docs",
    primaryLabel: "Open Direct API Reference",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui",
  },
  "advanced-orders-react": {
    primaryHref:
      "https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx",
    primaryLabel: "Open React Integration",
    sourceHref:
      "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react",
  },
};

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
  return window.location.hash.slice(1);
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

function getSearchText(step: GuideStep, supplementalContent = ""): string {
  return `${step.title} ${supplementalContent} ${step.content}`
    .replace(/```[\w-]*\n?/g, " ")
    .replace(/[`#|*_[\]()]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchExcerpt(
  step: GuideStep,
  query: string,
  supplementalContent = "",
): string {
  const text = getSearchText(step, supplementalContent);
  const matchIndex = text.toLowerCase().indexOf(query);
  if (matchIndex < 0) return text.slice(0, 120);
  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(text.length, matchIndex + query.length + 74);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function GuideNavigation({ activeGuide, guides }: { activeGuide: Guide; guides: Guide[] }) {
  const liquidityHubGuide = guides.find((guide) => guide.id === "liquidity-hub");
  const advancedOrdersGuide = guides.find(
    (guide) => guide.id === "advanced-orders-direct",
  );
  const options = [
    liquidityHubGuide
      ? {
          active: activeGuide.id === "liquidity-hub",
          description: "Best-price routing for swaps",
          guide: liquidityHubGuide,
          label: "Liquidity Hub",
        }
      : undefined,
    advancedOrdersGuide
      ? {
          active: activeGuide.id !== "liquidity-hub",
          description: "Direct API or React SDK",
          guide: advancedOrdersGuide,
          label: "Advanced Orders",
        }
      : undefined,
  ].filter((option) => option !== undefined);

  return (
    <nav aria-label="Integration guides" className="guide-list">
      {options.map((option) => {
        return (
          <Link
            aria-current={option.active ? "location" : undefined}
            className={`guide-link${option.active ? " guide-link-active" : ""}`}
            href={option.guide.route}
            key={option.label}
          >
            <span className="guide-link-marker" />
            <span className="guide-link-copy">
              <span className="guide-link-label">{option.label}</span>
              <span className="guide-link-description">{option.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdvancedOrdersVariantNavigation({
  activeGuide,
  guides,
}: {
  activeGuide: Guide;
  guides: Guide[];
}) {
  const variants = guides.filter((guide) => guide.id !== "liquidity-hub");

  return (
    <nav
      aria-label="Advanced Orders integration type"
      className="variant-list"
    >
      {variants.map((guide) => {
        const active = guide.id === activeGuide.id;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`variant-link${active ? " variant-link-active" : ""}`}
            href={guide.route}
            key={guide.id}
          >
            {guide.id === "advanced-orders-react" ? "React SDK" : "Direct API"}
          </Link>
        );
      })}
    </nav>
  );
}

function StepNavigation({
  activeStepIndex,
  guide,
  onStepClick,
  stepRefs,
}: {
  activeStepIndex: number;
  guide: Guide;
  onStepClick: (event: MouseEvent<HTMLAnchorElement>, step: GuideStep) => void;
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
            href={`${guide.route}#${step.id}`}
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
  previousStep,
}: {
  guide: Guide;
  nextStep?: GuideStep;
  onStepClick: (event: MouseEvent<HTMLAnchorElement>, step: GuideStep) => void;
  previousStep?: GuideStep;
}) {
  return (
    <footer className="step-footer">
      {previousStep ? (
        <a
          className="step-footer-link"
          href={`${guide.route}#${previousStep.id}`}
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
          href={`${guide.route}#${nextStep.id}`}
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

export function DocsShell({
  activeGuideId,
  guides,
}: {
  activeGuideId: GuideId;
  guides: Guide[];
}) {
  const activeGuide = guides.find((guide) => guide.id === activeGuideId) ?? guides[0];
  const hash = useSyncExternalStore(
    subscribeToLocation,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const activeStepIndex = getStepIndex(activeGuide, hash);
  const activeStep = activeGuide.steps[activeStepIndex] ?? activeGuide.steps[0];
  const previousStep = activeGuide.steps[activeStepIndex - 1];
  const nextStep = activeGuide.steps[activeStepIndex + 1];
  const contentRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const mobileStepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [search, setSearch] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const introduction = `${activeGuide.intro}\n\n${activeGuide.introReference}`.trim();
  const searchResults = deferredSearch
    ? activeGuide.steps.filter((step, index) =>
        getSearchText(step, index === 0 ? introduction : "")
          .toLowerCase()
          .includes(deferredSearch),
      )
    : [];
  const resources = RESOURCES[activeGuide.id];

  const openStep = (step: GuideStep, query = "") => {
    setHighlightQuery(query);
    setSearch("");
    window.history.pushState(null, "", `${activeGuide.route}#${step.id}`);
    window.dispatchEvent(new Event(LOCATION_EVENT));
    document.getElementById("mobile-guide-menu")?.removeAttribute("open");
    window.requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
      if (!query) {
        contentRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      }
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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) openStep(searchResults[0], deferredSearch);
  };

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
      <header className="app-header">
        <a
          aria-label="Orbs Spot"
          className="app-logo-link"
          href="https://orbs-spot.vercel.app"
        >
          <Image
            alt="Orbs Swap"
            height="40"
            priority
            src="/orbs-logo.svg"
            width="160"
          />
        </a>
      </header>
      <main className="docs-shell">
        <div className="docs-page">
          <div className="docs-layout">
        <aside className="sidebar">
          <details className="mobile-menu" id="mobile-guide-menu">
            <summary>
              <span>
                <small>
                  {activeGuide.id === "liquidity-hub"
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
              <GuideNavigation activeGuide={activeGuide} guides={guides} />
              {activeGuide.id !== "liquidity-hub" ? (
                <AdvancedOrdersVariantNavigation
                  activeGuide={activeGuide}
                  guides={guides}
                />
              ) : null}
              <div className="sidebar-rule" />
              <StepNavigation
                activeStepIndex={activeStepIndex}
                guide={activeGuide}
                onStepClick={navigateToStep}
                stepRefs={mobileStepRefs}
              />
            </div>
          </details>

          <div className="desktop-sidebar">
            <div className="brand-lockup">
              <span aria-hidden="true" className="brand-mark"><BookOpen size={17} /></span>
              <span>
                <small>Orbs Spot Docs</small>
                <strong>Integration Guides</strong>
              </span>
            </div>
            <GuideNavigation activeGuide={activeGuide} guides={guides} />
            {activeGuide.id !== "liquidity-hub" ? (
              <div className="variant-section">
                <p>Integration Type</p>
                <AdvancedOrdersVariantNavigation
                  activeGuide={activeGuide}
                  guides={guides}
                />
              </div>
            ) : null}
            <div className="sidebar-rule" />
            <div className="step-list-heading">
              <span>{activeGuide.label}</span>
              <span>{activeStepIndex + 1}/{activeGuide.steps.length}</span>
            </div>
            <StepNavigation
              activeStepIndex={activeStepIndex}
              guide={activeGuide}
              onStepClick={navigateToStep}
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
              <h1 id="guide-step-title">
                <HighlightedText query={highlightQuery} text={activeStep.title} />
              </h1>
              <form className="guide-search" onSubmit={submitSearch} role="search">
                <label>
                  <span className="sr-only">Search this integration guide</span>
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
                      if (event.key === "Escape") setSearch("");
                    }}
                    placeholder="Search this guide…"
                    type="search"
                    value={search}
                  />
                </label>
                {deferredSearch ? (
                  <div className="search-results" id="guide-search-results">
                    <p aria-live="polite">
                      {searchResults.length} {searchResults.length === 1 ? "section" : "sections"} found
                    </p>
                    {searchResults.length ? (
                      <ul>
                        {searchResults.map((step) => {
                          const index = activeGuide.steps.findIndex((item) => item.id === step.id);
                          return (
                            <li key={step.id}>
                              <a
                                href={`${activeGuide.route}#${step.id}`}
                                onClick={(event) => {
                                  if (isModifiedClick(event)) return;
                                  event.preventDefault();
                                  openStep(step, deferredSearch);
                                }}
                              >
                                <span>{index + 1}</span>
                                <span>
                                  <strong><HighlightedText query={deferredSearch} text={step.title} /></strong>
                                  <small>
                                    <HighlightedText
                                      query={deferredSearch}
                                      text={getSearchExcerpt(
                                        step,
                                        deferredSearch,
                                        index === 0 ? introduction : "",
                                      )}
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
            <p className="guide-name">{activeGuide.title}</p>
            <div className="metadata-row">
              <span>Tested: {activeGuide.metadata}</span>
              <span>Updated Sep 1, 2026</span>
              <span>Sample addresses are illustrative</span>
            </div>
          </header>

          {activeStepIndex === 0 && introduction ? (
            <section aria-label={`${activeGuide.label} introduction`} className="guide-introduction">
              <p className="eyebrow">Before You Start</p>
              <MarkdownContent highlightQuery={highlightQuery} markdown={introduction} />
            </section>
          ) : null}

          <div aria-hidden="true" className="progress-track">
            <span style={{ transform: `scaleX(${(activeStepIndex + 1) / activeGuide.steps.length})` }} />
          </div>

          <article className="guide-article" id={activeStep.id}>
            <InteractiveReference
              guideId={activeGuide.id}
              stepId={activeStep.id}
            />
            <MarkdownContent
              codeBlocksFirst
              highlightQuery={highlightQuery}
              markdown={activeStep.content}
            />
          </article>

          <StepFooter
            guide={activeGuide}
            nextStep={nextStep}
            onStepClick={navigateToStep}
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
              <a href={resources.primaryHref} rel="noreferrer" target="_blank">
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
