"use client";

import {
  Check,
  Clipboard,
  Code2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Highlight, themes, type Language } from "prism-react-renderer";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import type { ReferenceFile } from "@/lib/reference-examples";

const LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  js: "javascript",
  sh: "bash",
  shell: "bash",
  text: "plain",
  ts: "typescript",
};

type CopyStatus = "copied" | "failed" | "idle";
type FullscreenStatus = "active" | "failed" | "idle";

function useResetCopyStatus(copyStatus: CopyStatus, reset: () => void): void {
  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(reset, 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus, reset]);
}

function SyntaxHighlightedCode({
  code,
  labelledBy,
  language,
  panelId,
  preRef,
  role,
}: {
  code: string;
  labelledBy?: string;
  language: string;
  panelId?: string;
  preRef: RefObject<HTMLPreElement | null>;
  role?: "tabpanel";
}) {
  const syntaxLanguage = LANGUAGE_ALIASES[language] ?? language;

  return (
    <Highlight code={code} language={syntaxLanguage} theme={themes.oneDark}>
      {({ className, getLineProps, getTokenProps, style, tokens }) => (
        <pre
          aria-labelledby={labelledBy}
          className={className}
          id={panelId}
          ref={preRef}
          role={role}
          style={{ ...style, background: "transparent" }}
          tabIndex={0}
        >
          <code translate="no">
            {tokens.map((line, lineIndex) => {
              const lineProps = getLineProps({ line });
              return (
                <span
                  className={lineProps.className}
                  key={`line-${lineIndex}`}
                  style={lineProps.style}
                >
                  <span aria-hidden="true" className="line-number">
                    {lineIndex + 1}
                  </span>
                  <span className="code-line">
                    {line.map((token, tokenIndex) => {
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
                    })}
                  </span>
                </span>
              );
            })}
          </code>
        </pre>
      )}
    </Highlight>
  );
}

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [fullscreenStatus, setFullscreenStatus] =
    useState<FullscreenStatus>("idle");

  useResetCopyStatus(copyStatus, () => setCopyStatus("idle"));

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreenStatus(
        document.fullscreenElement === containerRef.current ? "active" : "idle",
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await containerRef.current?.requestFullscreen();
    } catch {
      setFullscreenStatus("failed");
    }
  };

  return (
    <div className="code-block" ref={containerRef}>
      <div className="code-toolbar">
        <span className="code-language">
          <Code2 aria-hidden="true" size={15} />
          {language}
        </span>
        <span className="code-actions">
          {fullscreenStatus === "failed" ? (
            <span className="code-error" role="status">
              Full screen unavailable
            </span>
          ) : null}
          <button
            aria-label={
              copyStatus === "copied"
                ? "Code copied"
                : copyStatus === "failed"
                  ? "Copy failed, retry"
                  : "Copy code"
            }
            className="code-action"
            onClick={() => void copyCode()}
            type="button"
          >
            {copyStatus === "copied" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <Clipboard aria-hidden="true" size={14} />
            )}
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Retry"
                : "Copy"}
          </button>
          <button
            aria-label={
              fullscreenStatus === "active"
                ? "Exit full screen"
                : "Open code in full screen"
            }
            aria-pressed={fullscreenStatus === "active"}
            className="code-action"
            onClick={() => void toggleFullscreen()}
            type="button"
          >
            {fullscreenStatus === "active" ? (
              <Minimize2 aria-hidden="true" size={14} />
            ) : (
              <Maximize2 aria-hidden="true" size={14} />
            )}
            <span className="desktop-only">
              {fullscreenStatus === "active" ? "Exit" : "Full screen"}
            </span>
          </button>
        </span>
      </div>
      <SyntaxHighlightedCode code={code} language={language} preRef={preRef} />
      <span aria-live="polite" className="sr-only">
        {copyStatus === "copied"
          ? "Code copied"
          : copyStatus === "failed"
            ? "Code could not be copied. Try again."
            : ""}
      </span>
    </div>
  );
}

export function TabbedCodeViewer({
  files,
  idPrefix,
}: {
  files: readonly ReferenceFile[];
  idPrefix: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [fullscreenStatus, setFullscreenStatus] =
    useState<FullscreenStatus>("idle");
  const activeFile = files[activeFileIndex] ?? files[0];

  useResetCopyStatus(copyStatus, () => setCopyStatus("idle"));

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreenStatus(
        document.fullscreenElement === containerRef.current ? "active" : "idle",
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (!activeFile) return null;

  const selectFile = (index: number, focus = false) => {
    setActiveFileIndex(index);
    preRef.current?.scrollTo({ left: 0, top: 0 });
    if (focus) window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
  };

  const navigateTabs = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % files.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + files.length) % files.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = files.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectFile(nextIndex, true);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await containerRef.current?.requestFullscreen();
    } catch {
      setFullscreenStatus("failed");
    }
  };

  const panelId = `${idPrefix}-panel`;

  return (
    <div className="reference-code-viewer" ref={containerRef}>
      <div className="reference-code-toolbar">
        <div aria-label="Reference files" className="reference-file-tabs" role="tablist">
          {files.map((file, index) => {
            const tabId = `${idPrefix}-file-${index}`;
            const active = index === activeFileIndex;

            return (
              <button
                aria-controls={panelId}
                aria-selected={active}
                className={active ? "reference-file-tab active" : "reference-file-tab"}
                id={tabId}
                key={file.name}
                onClick={() => selectFile(index)}
                onKeyDown={(event) => navigateTabs(event, index)}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                role="tab"
                tabIndex={active ? 0 : -1}
                type="button"
              >
                <Code2 aria-hidden="true" size={14} />
                {file.name}
              </button>
            );
          })}
        </div>
        <div className="reference-code-actions">
          {fullscreenStatus === "failed" ? (
            <span className="reference-code-error" role="status">
              Full screen unavailable
            </span>
          ) : null}
          <button
            aria-label={
              copyStatus === "copied"
                ? "Code copied"
                : copyStatus === "failed"
                  ? "Copy failed, retry"
                  : "Copy code"
            }
            onClick={() => void copyCode()}
            type="button"
          >
            {copyStatus === "copied" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <Clipboard aria-hidden="true" size={14} />
            )}
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Retry"
                : "Copy"}
          </button>
          <button
            aria-label={
              fullscreenStatus === "active"
                ? "Exit full screen"
                : "Open reference code in full screen"
            }
            aria-pressed={fullscreenStatus === "active"}
            onClick={() => void toggleFullscreen()}
            type="button"
          >
            {fullscreenStatus === "active" ? (
              <Minimize2 aria-hidden="true" size={14} />
            ) : (
              <Maximize2 aria-hidden="true" size={14} />
            )}
            <span className="reference-fullscreen-label">
              {fullscreenStatus === "active" ? "Exit" : "Full screen"}
            </span>
          </button>
        </div>
      </div>
      <SyntaxHighlightedCode
        code={activeFile.code}
        labelledBy={`${idPrefix}-file-${activeFileIndex}`}
        language={activeFile.language}
        panelId={panelId}
        preRef={preRef}
        role="tabpanel"
      />
      <span aria-live="polite" className="sr-only">
        {copyStatus === "copied"
          ? "Reference code copied"
          : copyStatus === "failed"
            ? "Reference code could not be copied. Try again."
            : ""}
      </span>
    </div>
  );
}
