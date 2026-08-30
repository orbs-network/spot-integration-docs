"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export type ReadmeStep = {
  title: string;
  content: string;
};

export type ReadmeGuide = {
  id: string;
  label: string;
  description: string;
  title: string;
  steps: ReadmeStep[];
};

type Props = {
  guides: ReadmeGuide[];
  defaultGuideId: string;
  legacyGuideId: string;
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "table"; rows: string[][] };

const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const linkPattern = /^\[([^\]]+)\]\(([^)]+)\)$/;
const codePattern = /^`([^`]+)`$/;
const guideLocationEvent = "readme-guide-location-change";

function clampStepIndex(index: number, stepCount: number) {
  return Math.max(0, Math.min(stepCount - 1, index));
}

function readStepIndexFromUrl(stepCount: number) {
  const step = new URLSearchParams(window.location.search).get("step");
  if (!step) return undefined;

  const stepNumber = Number.parseInt(step, 10);
  if (Number.isNaN(stepNumber)) return undefined;

  return clampStepIndex(stepNumber - 1, stepCount);
}

function readGuideIdFromUrl(
  guides: ReadmeGuide[],
  defaultGuideId: string,
  legacyGuideId: string,
) {
  const params = new URLSearchParams(window.location.search);
  const requestedGuideId = params.get("section");

  if (requestedGuideId && guides.some((guide) => guide.id === requestedGuideId)) {
    return requestedGuideId;
  }

  if (!requestedGuideId && params.has("step")) {
    const legacyGuide = guides.find((guide) => guide.id === legacyGuideId);
    if (legacyGuide) return legacyGuide.id;
  }

  return guides.find((guide) => guide.id === defaultGuideId)?.id ?? guides[0].id;
}

function buildGuideHref(guideId: string, stepIndex: number) {
  const params = new URLSearchParams({
    section: guideId,
    step: String(stepIndex + 1),
  });

  return `/?${params.toString()}`;
}

function writeGuideLocation(guideId: string, stepIndex: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", guideId);
  url.searchParams.set("step", String(stepIndex + 1));
  window.history.pushState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  window.dispatchEvent(new Event(guideLocationEvent));
}

function subscribeToGuideLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(guideLocationEvent, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(guideLocationEvent, onStoreChange);
  };
}

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    const token = match[0];
    const link = token.match(linkPattern);
    const code = token.match(codePattern);

    if (link) {
      parts.push(
        <a
          key={`${token}-${match.index}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="markdown-link"
        >
          {link[1]}
          <ExternalLink
            aria-hidden="true"
            className="markdown-link-icon"
            size={13}
          />
        </a>,
      );
    } else if (code) {
      parts.push(
        <code key={`${token}-${match.index}`} className="inline-code">
          {code[1]}
        </code>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function parseTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(row: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(row);
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```(\w+)?\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({
        type: "code",
        language: codeStart[1] || "text",
        code: codeLines.join("\n"),
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const rows = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "orderedList", items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,4}\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*[-\d]/.test(lines[index]) &&
      !lines[index].trim().startsWith("|")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h3 key={index}>{renderInline(block.text)}</h3>;
        }

        if (block.type === "paragraph") {
          return <p key={index}>{renderInline(block.text)}</p>;
        }

        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "orderedList") {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <div key={index} className="code-block">
              <div className="code-language">{block.language}</div>
              <pre>
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        const [header, ...rows] = block.rows;
        return (
          <div key={index} className="table-wrap">
            <table>
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function ReadmeSteps({
  guides,
  defaultGuideId,
  legacyGuideId,
}: Props) {
  const guideId = useSyncExternalStore(
    subscribeToGuideLocation,
    () => readGuideIdFromUrl(guides, defaultGuideId, legacyGuideId),
    () => defaultGuideId,
  );
  const guide = guides.find((item) => item.id === guideId) ?? guides[0];
  const stepIndex = useSyncExternalStore(
    subscribeToGuideLocation,
    () => readStepIndexFromUrl(guide.steps.length) ?? 0,
    () => 0,
  );
  const stepTabsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const step = guide.steps[stepIndex] ?? guide.steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === guide.steps.length - 1;

  useEffect(() => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";

    stepTabsRef.current[stepIndex]?.scrollIntoView({
      behavior,
      block: "nearest",
      inline: "center",
    });
  }, [guide.id, stepIndex]);

  const navigateTo = (
    event: React.MouseEvent<HTMLAnchorElement>,
    nextGuide: ReadmeGuide,
    nextIndex: number,
  ) => {
    if (isModifiedClick(event)) return;

    event.preventDefault();
    const nextStepIndex = clampStepIndex(nextIndex, nextGuide.steps.length);
    writeGuideLocation(nextGuide.id, nextStepIndex);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, behavior });
  };

  return (
    <main className="guide-shell">
      <a className="skip-link" href="#guide-content">
        Skip to guide content
      </a>
      <div className="guide-layout">
        <aside className="guide-sidebar">
          <p className="guide-kicker">Orbs Spot Docs</p>
          <h1 className="site-title">Integration Guides</h1>
          <nav className="guide-section-list" aria-label="Integration guides">
            {guides.map((item) => (
              <a
                key={item.id}
                href={buildGuideHref(item.id, 0)}
                className={`guide-section-link ${item.id === guide.id ? "guide-section-link-active" : ""}`}
                aria-current={item.id === guide.id ? "page" : undefined}
                onClick={(event) => navigateTo(event, item, 0)}
              >
                <span className="guide-section-name">{item.label}</span>
                <span className="guide-section-description">
                  {item.description}
                </span>
              </a>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <p className="current-guide-label">Current Guide</p>
          <h2 className="guide-title">{guide.title}</h2>
          <nav className="step-list" aria-label={`${guide.label} guide steps`}>
            {guide.steps.map((item, index) => (
              <a
                key={item.title}
                href={buildGuideHref(guide.id, index)}
                className={`step-tab ${index === stepIndex ? "step-tab-active" : ""}`}
                aria-current={index === stepIndex ? "step" : undefined}
                ref={(element) => {
                  stepTabsRef.current[index] = element;
                }}
                onClick={(event) => navigateTo(event, guide, index)}
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-label">{item.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <section
          aria-labelledby="step-heading"
          className="guide-main"
          id="guide-content"
          tabIndex={-1}
        >
          <div className="guide-topbar">
            <div>
              <p className="step-count">
                {guide.label} · Step {stepIndex + 1} of {guide.steps.length}
              </p>
              <h2 className="step-heading" id="step-heading">
                {step.title}
              </h2>
            </div>
            <div className="nav-buttons">
              {isFirst ? (
                <span
                  aria-hidden="true"
                  className="nav-button nav-button-icon nav-button-disabled"
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </span>
              ) : (
                <a
                  aria-label="Previous step"
                  className="nav-button nav-button-icon"
                  href={buildGuideHref(guide.id, stepIndex - 1)}
                  onClick={(event) => navigateTo(event, guide, stepIndex - 1)}
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </a>
              )}
              {isLast ? (
                <span
                  aria-hidden="true"
                  className="nav-button nav-button-icon nav-button-disabled"
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </span>
              ) : (
                <a
                  aria-label="Next step"
                  className="nav-button nav-button-icon"
                  href={buildGuideHref(guide.id, stepIndex + 1)}
                  onClick={(event) => navigateTo(event, guide, stepIndex + 1)}
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </a>
              )}
            </div>
          </div>

          <div aria-hidden="true" className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${((stepIndex + 1) / guide.steps.length) * 100}%`,
              }}
            />
          </div>

          <article className="markdown-card">
            <MarkdownContent markdown={step.content} />
          </article>

          <div className="guide-footer">
            {isFirst ? (
              <span
                aria-disabled="true"
                className="nav-button nav-button-disabled"
              >
                <ChevronLeft aria-hidden="true" size={18} />
                Previous
              </span>
            ) : (
              <a
                className="nav-button"
                href={buildGuideHref(guide.id, stepIndex - 1)}
                onClick={(event) => navigateTo(event, guide, stepIndex - 1)}
              >
                <ChevronLeft aria-hidden="true" size={18} />
                Previous
              </a>
            )}
            {isLast ? (
              <span
                aria-disabled="true"
                className="nav-button nav-button-disabled"
              >
                Next
                <ChevronRight aria-hidden="true" size={18} />
              </span>
            ) : (
              <a
                className="nav-button"
                href={buildGuideHref(guide.id, stepIndex + 1)}
                onClick={(event) => navigateTo(event, guide, stepIndex + 1)}
              >
                Next
                <ChevronRight aria-hidden="true" size={18} />
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
