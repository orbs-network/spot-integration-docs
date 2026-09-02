"use client";

import {
  Check,
  Clipboard,
  Code2,
  ExternalLink,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Highlight, themes, type Language } from "prism-react-renderer";
import {
  Children,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useContainedWheelScroll } from "@/lib/use-contained-wheel-scroll";

type MarkdownBlock =
  | { code: string; language: string; type: "code" }
  | { level: number; text: string; type: "heading" }
  | { items: string[]; type: "list" }
  | { items: string[]; type: "orderedList" }
  | { rows: string[][]; type: "table" }
  | { text: string; type: "paragraph" };

const TOKEN_PATTERN = /(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;
const CODE_PATTERN = /^`([^`]+)`$/;
const LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  js: "javascript",
  sh: "bash",
  shell: "bash",
  text: "plain",
  ts: "typescript",
};

function parseTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(row: string): boolean {
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

    const codeStart = line.match(/^```([\w-]+)?\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({
        code: codeLines.join("\n"),
        language: codeStart[1] ?? "text",
        type: "code",
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        level: heading[1].length,
        text: heading[2],
        type: "heading",
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
      blocks.push({ rows, type: "table" });
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "list" });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "orderedList" });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,4}\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*-\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("|")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ text: paragraph.join(" "), type: "paragraph" });
  }

  return blocks;
}

export function HighlightedText({ query, text }: { query?: string; text: string }) {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) return text;

  const normalizedText = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark key={`${matchIndex}-${normalizedQuery}`} data-search-highlight="true">
        {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>,
    );
    cursor = matchIndex + normalizedQuery.length;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function renderInline(text: string, highlightQuery?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) {
      parts.push(
        <HighlightedText
          key={`plain-${cursor}`}
          query={highlightQuery}
          text={text.slice(cursor, match.index)}
        />,
      );
    }

    const token = match[0];
    const link = token.match(LINK_PATTERN);
    const code = token.match(CODE_PATTERN);

    if (link) {
      const external = /^https?:\/\//.test(link[2]);
      parts.push(
        <a
          key={`${token}-${match.index}`}
          className="markdown-link"
          href={link[2]}
          rel={external ? "noreferrer" : undefined}
          target={external ? "_blank" : undefined}
        >
          <HighlightedText query={highlightQuery} text={link[1]} />
          {external ? <ExternalLink aria-hidden="true" size={12} /> : null}
        </a>,
      );
    } else if (code) {
      parts.push(
        <code key={`${token}-${match.index}`} className="inline-code" translate="no">
          <HighlightedText query={highlightQuery} text={code[1]} />
        </code>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    parts.push(
      <HighlightedText
        key={`plain-${cursor}`}
        query={highlightQuery}
        text={text.slice(cursor)}
      />,
    );
  }
  return parts;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useContainedWheelScroll<HTMLPreElement>();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syntaxLanguage = LANGUAGE_ALIASES[language] ?? language;

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await containerRef.current.requestFullscreen();
  };

  return (
    <div className="code-block" ref={containerRef}>
      <div className="code-toolbar">
        <span className="code-language">
          <Code2 aria-hidden="true" size={15} />
          {language}
        </span>
        <span className="code-actions">
          <button aria-label="Copy code" className="code-action" onClick={copyCode} type="button">
            {copyStatus === "copied" ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
            {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Retry" : "Copy"}
          </button>
          <button
            aria-label={isFullscreen ? "Exit full screen" : "Open code in full screen"}
            className="code-action"
            onClick={() => void toggleFullscreen()}
            type="button"
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" size={14} /> : <Maximize2 aria-hidden="true" size={14} />}
            <span className="desktop-only">{isFullscreen ? "Exit" : "Full Screen"}</span>
          </button>
        </span>
      </div>
      <Highlight code={code} language={syntaxLanguage} theme={themes.oneDark}>
        {({ className, getLineProps, getTokenProps, style, tokens }) => (
          <pre
            className={className}
            ref={codeScrollRef}
            style={{ ...style, background: "transparent" }}
            tabIndex={0}
          >
            <code translate="no">
              {Children.toArray(
                tokens.map((line, lineIndex) => {
                  const lineProps = getLineProps({ line });
                  return (
                    <span
                      className={lineProps.className}
                      key={`line-${lineIndex}`}
                      style={lineProps.style}
                    >
                      <span aria-hidden="true" className="line-number">{lineIndex + 1}</span>
                      <span className="code-line">
                        {Children.toArray(
                          line.map((token, tokenIndex) => {
                            const tokenProps = getTokenProps({ token });
                            return (
                              <span
                                className={tokenProps.className}
                                key={`token-${lineIndex}-${tokenIndex}`}
                                style={tokenProps.style}
                              >
                                {token.content}
                              </span>
                            );
                          }),
                        )}
                      </span>
                    </span>
                  );
                }),
              )}
            </code>
          </pre>
        )}
      </Highlight>
      <span aria-live="polite" className="sr-only">
        {copyStatus === "copied" ? "Code copied" : copyStatus === "failed" ? "Code could not be copied" : ""}
      </span>
    </div>
  );
}

export function MarkdownContent({
  codeBlocksFirst = false,
  highlightQuery,
  markdown,
}: {
  codeBlocksFirst?: boolean;
  highlightQuery?: string;
  markdown: string;
}) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  const firstCodeIndex = blocks.findIndex((block) => block.type === "code");
  const orderedBlocks =
    codeBlocksFirst && firstCodeIndex > 0
      ? [
          blocks[firstCodeIndex],
          ...blocks.slice(0, firstCodeIndex),
          ...blocks.slice(firstCodeIndex + 1),
        ]
      : blocks;

  return (
    <div className="markdown-content">
      {orderedBlocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level >= 4 ? "h4" : "h3";
          return <Heading key={index}>{renderInline(block.text, highlightQuery)}</Heading>;
        }

        if (block.type === "paragraph") {
          return <p key={index}>{renderInline(block.text, highlightQuery)}</p>;
        }

        if (block.type === "list" || block.type === "orderedList") {
          const List = block.type === "list" ? "ul" : "ol";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, highlightQuery)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "code") {
          return <CodeBlock code={block.code} key={index} language={block.language} />;
        }

        const [header, ...rows] = block.rows;
        return (
          <div className="table-wrap" key={index} tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col">{renderInline(cell, highlightQuery)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderInline(cell, highlightQuery)}</td>
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
