"use client";

import { ExternalLink } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { CodeBlock } from "@/components/code-viewer";
import {
  createPartnerDocumentationHref,
} from "@/features/partner-documentation/query-state";
import type {
  PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";

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

function renderInline(
  text: string,
  highlightQuery?: string,
  partnerRequest?: PartnerDocumentationRequest,
): ReactNode[] {
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
      const href =
        !external && link[2].startsWith("/") && partnerRequest
          ? createPartnerDocumentationHref(link[2], partnerRequest)
          : link[2];
      parts.push(
        <a
          key={`${token}-${match.index}`}
          className="markdown-link"
          href={href}
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

export function MarkdownContent({
  highlightQuery,
  markdown,
  partnerRequest,
}: {
  highlightQuery?: string;
  markdown: string;
  partnerRequest?: PartnerDocumentationRequest;
}) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level >= 4 ? "h3" : "h2";
          return (
            <Heading key={index}>
              {renderInline(block.text, highlightQuery, partnerRequest)}
            </Heading>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={index}>
              {renderInline(block.text, highlightQuery, partnerRequest)}
            </p>
          );
        }

        if (block.type === "list" || block.type === "orderedList") {
          const List = block.type === "list" ? "ul" : "ol";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(item, highlightQuery, partnerRequest)}
                </li>
              ))}
            </List>
          );
        }

        if (block.type === "code") {
          return <CodeBlock code={block.code} key={index} language={block.language} />;
        }

        const [header, ...rows] = block.rows;
        const isRecoveryTable = header[0] === "Failure" || header[0] === "Error";
        return (
          <div
            className={isRecoveryTable ? "table-wrap table-wrap-recovery" : "table-wrap"}
            key={index}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col">
                      {renderInline(cell, highlightQuery, partnerRequest)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td data-label={header[cellIndex]} key={cellIndex}>
                        {renderInline(cell, highlightQuery, partnerRequest)}
                      </td>
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
