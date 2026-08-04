"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export type ReadmeStep = {
  title: string;
  content: string;
};

type Props = {
  title: string;
  steps: ReadmeStep[];
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
          <ExternalLink size={13} />
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
                    <th key={cellIndex}>{renderInline(cell)}</th>
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

export function ReadmeSteps({ title, steps }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const goToStep = (nextIndex: number) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, nextIndex)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="guide-shell">
      <div className="guide-layout">
        <aside className="guide-sidebar">
          <p className="guide-kicker">Spot Docs</p>
          <h1 className="guide-title">{title}</h1>
          <nav className="step-list" aria-label="Guide steps">
            {steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`step-tab ${index === stepIndex ? "step-tab-active" : ""}`}
                onClick={() => goToStep(index)}
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-label">{item.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="guide-main">
          <div className="guide-topbar">
            <div>
              <p className="step-count">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <h2 className="step-heading">{step.title}</h2>
            </div>
            <div className="nav-buttons">
              <button
                type="button"
                className="nav-button nav-button-icon"
                disabled={isFirst}
                aria-label="Previous step"
                onClick={() => goToStep(stepIndex - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="nav-button nav-button-icon"
                disabled={isLast}
                aria-label="Next step"
                onClick={() => goToStep(stepIndex + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <article className="markdown-card">
            <MarkdownContent markdown={step.content} />
          </article>

          <div className="guide-footer">
            <button
              type="button"
              className="nav-button"
              disabled={isFirst}
              onClick={() => goToStep(stepIndex - 1)}
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              type="button"
              className="nav-button"
              disabled={isLast}
              onClick={() => goToStep(stepIndex + 1)}
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
