"use client";

import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  ExternalLink,
  FileText,
  SquareTerminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyStatus =
  | "copied-codex"
  | "copied-page"
  | "copying-page"
  | "failed"
  | "idle";

function getPagePrompt(pagePath: string): string {
  const url = new URL(pagePath, window.location.origin);
  url.search = window.location.search;
  url.hash = window.location.hash;
  return `Read this documentation page and use it as context for my questions: ${url}`;
}

async function fetchMarkdownBlob(markdownPath: string): Promise<Blob> {
  const response = await fetch(markdownPath);
  if (!response.ok) throw new Error("Markdown request failed");
  return new Blob([await response.text()], { type: "text/plain" });
}

export function PageActions({
  markdownPath,
  pagePath,
}: {
  markdownPath: string;
  pagePath: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle" || status === "copying-page") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const copyPage = async () => {
    setStatus("copying-page");

    try {
      const markdownBlob = fetchMarkdownBlob(markdownPath);

      if (
        typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard.write === "function"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": markdownBlob }),
        ]);
      } else {
        await navigator.clipboard.writeText(await (await markdownBlob).text());
      }

      setStatus("copied-page");
    } catch {
      setStatus("failed");
    }
  };

  const copyForCodex = async () => {
    try {
      await navigator.clipboard.writeText(getPagePrompt(pagePath));
      setStatus("copied-codex");
      setMenuOpen(false);
    } catch {
      setStatus("failed");
    }
  };

  const openInChatGPT = () => {
    const query = new URLSearchParams({
      hints: "search",
      prompt: getPagePrompt(pagePath),
    });
    window.open(`https://chatgpt.com/?${query}`, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  };

  const copied = status === "copied-page";
  const copying = status === "copying-page";

  return (
    <div className="page-actions">
      <button
        aria-label={
          copied
            ? "Documentation page copied"
            : copying
              ? "Copying documentation page"
              : "Copy documentation page as Markdown"
        }
        className="page-action-primary"
        disabled={copying}
        onClick={() => void copyPage()}
        type="button"
      >
        {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
        <span>{copied ? "Copied" : copying ? "Copying…" : "Copy page"}</span>
      </button>
      <div
        className="page-action-menu"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          setMenuOpen(false);
          menuTriggerRef.current?.focus();
        }}
        ref={menuRef}
      >
        <button
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label={menuOpen ? "Close page actions" : "Open page actions"}
          className="page-action-menu-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          ref={menuTriggerRef}
          type="button"
        >
          <ChevronDown aria-hidden="true" size={15} />
        </button>
        {menuOpen ? (
          <div className="page-action-popover">
            <a href={markdownPath} rel="noreferrer" target="_blank">
              <FileText aria-hidden="true" size={17} />
              <span>
                <strong>View as Markdown</strong>
                <small>Open the AI-friendly source</small>
              </span>
              <ExternalLink aria-hidden="true" size={13} />
            </a>
            <button onClick={openInChatGPT} type="button">
              <Bot aria-hidden="true" size={17} />
              <span>
                <strong>Ask in ChatGPT</strong>
                <small>Open this page as context</small>
              </span>
              <ExternalLink aria-hidden="true" size={13} />
            </button>
            <button onClick={() => void copyForCodex()} type="button">
              {status === "copied-codex" ? (
                <Check aria-hidden="true" size={17} />
              ) : (
                <SquareTerminal aria-hidden="true" size={17} />
              )}
              <span>
                <strong>{status === "copied-codex" ? "Copied for Codex" : "Copy for Codex"}</strong>
                <small>Paste a context-ready task prompt</small>
              </span>
            </button>
          </div>
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {status === "copied-page"
          ? "Documentation page copied as Markdown"
          : status === "copied-codex"
            ? "Codex prompt copied"
            : status === "failed"
              ? "Copy failed. Open View as Markdown and copy the source manually."
              : status === "copying-page"
                ? "Copying documentation page"
              : ""}
      </span>
    </div>
  );
}
