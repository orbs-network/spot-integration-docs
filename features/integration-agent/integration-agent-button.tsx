"use client";

import { Check, ChevronDown, Clipboard, ExternalLink, Link, MessageSquare, Sparkles, SquareTerminal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { createIntegrationAgentHref } from "./agent-links";
import styles from "./integration-agent.module.css";

export function IntegrationAgentButton({
  guideLabel,
  instructionsUrl,
  prompt,
}: {
  guideLabel: string;
  instructionsUrl: string;
  prompt: string;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied-prompt" | "copied-link" | "failed-prompt" | "failed-link">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();
  const promptId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!copyStatus.startsWith("copied-")) return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const copy = async (kind: "prompt" | "link") => {
    try {
      await navigator.clipboard.writeText(kind === "prompt" ? prompt : instructionsUrl);
      setCopyStatus(`copied-${kind}`);
    } catch {
      setCopyStatus(`failed-${kind}`);
    }
  };

  return (
    <div
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
      ref={rootRef}
    >
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => {
          setCopyStatus("idle");
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          setOpen(true);
          window.requestAnimationFrame(() => firstLinkRef.current?.focus());
        }}
        ref={triggerRef}
        type="button"
      >
        <Sparkles aria-hidden="true" size={15} />
        <span>Integrate with AI</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} size={13} />
      </button>
      {open ? (
        <div aria-label="Integration prompt" className={styles.panel} id={panelId} role="region">
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Start this integration</p>
              <p className={styles.guide}>{guideLabel}</p>
            </div>
            <button
              aria-label="Close integration prompt"
              className={styles.close}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <div className={styles.choices}>
            <a className={styles.choice} href={createIntegrationAgentHref("codex", prompt)} ref={firstLinkRef}>
              <SquareTerminal aria-hidden="true" size={20} />
              <span>
                <strong>Open in Codex</strong>
                <small>Desktop app · choose your project</small>
              </span>
              <ExternalLink aria-hidden="true" size={14} />
            </a>
            <a className={styles.choice} href={createIntegrationAgentHref("claude", prompt)} rel="noopener noreferrer" target="_blank">
              <MessageSquare aria-hidden="true" size={20} />
              <span>
                <strong>Open in Claude</strong>
                <small>Browser · ready-made prompt</small>
              </span>
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          </div>
          <p className={styles.hint}>Opens with your integration prompt. Review it, then send.</p>
          <div className={styles.instructions}>
            <p>Send one link to any coding agent for instructions and implementation references.</p>
            <div className={styles.shareActions}>
              <button className={styles.copyLink} onClick={() => void copy("link")} type="button">
                {copyStatus === "copied-link" ? <Check aria-hidden="true" size={14} /> : <Link aria-hidden="true" size={14} />}
                {copyStatus === "copied-link" ? "Link copied" : "Copy instructions link"}
              </button>
              <a href={instructionsUrl} rel="noopener noreferrer" target="_blank">
                View llms.txt
                <ExternalLink aria-hidden="true" size={12} />
              </a>
            </div>
          </div>
          <div className={styles.footer}>
            <details className={styles.preview}>
              <summary>Preview prompt</summary>
              <label className="sr-only" htmlFor={promptId}>Integration prompt for {guideLabel}</label>
              <textarea id={promptId} readOnly spellCheck={false} value={prompt} />
            </details>
            <button className={styles.copy} onClick={() => void copy("prompt")} type="button">
              {copyStatus === "copied-prompt" ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
              {copyStatus === "copied-prompt" ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <p aria-live="polite" className={copyStatus.startsWith("failed-") ? styles.error : "sr-only"}>
            {copyStatus === "failed-link"
              ? "Couldn’t copy. Use View llms.txt to open the instructions and copy the URL."
              : copyStatus === "failed-prompt"
              ? "Couldn’t copy. Open Preview prompt to select and copy the text."
              : copyStatus === "copied-prompt" ? "Integration prompt copied"
              : copyStatus === "copied-link" ? "Integration instructions link copied" : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
