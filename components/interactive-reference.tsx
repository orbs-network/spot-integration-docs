"use client";

import {
  Braces,
  Check,
  CircleHelp,
  Clipboard,
  Code2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { Children, useEffect, useRef, useState } from "react";

import {
  REFERENCE_EXAMPLES,
  type ReferenceExample,
  type ReferenceFile,
} from "@/lib/reference-examples";
import type { GuideId } from "@/lib/guides";
import { useContainedWheelScroll } from "@/lib/use-contained-wheel-scroll";

function getReferenceExample(
  guideId: GuideId,
  stepId: string,
): ReferenceExample | undefined {
  const key = `${guideId}:${stepId}` as keyof typeof REFERENCE_EXAMPLES;
  return REFERENCE_EXAMPLES[key];
}

function ReferenceCodeViewer({
  files,
  idPrefix,
}: {
  files: readonly ReferenceFile[];
  idPrefix: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useContainedWheelScroll<HTMLPreElement>();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [fullscreenStatus, setFullscreenStatus] = useState<
    "idle" | "active" | "failed"
  >("idle");
  const activeFile = files[activeFileIndex] ?? files[0];

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreenStatus(
        document.fullscreenElement === containerRef.current ? "active" : "idle",
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  if (!activeFile) return null;

  const selectFile = (index: number) => {
    setActiveFileIndex(index);
    codeScrollRef.current?.scrollTo({ left: 0, top: 0 });
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
        <div
          aria-label="Reference files"
          className="reference-file-tabs"
          role="tablist"
        >
          {files.map((file, index) => {
            const tabId = `${idPrefix}-file-${index}`;

            return (
              <button
                aria-controls={panelId}
                aria-selected={index === activeFileIndex}
                className={
                  index === activeFileIndex
                    ? "reference-file-tab active"
                    : "reference-file-tab"
                }
                id={tabId}
                key={file.name}
                onClick={() => selectFile(index)}
                role="tab"
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
            onClick={copyCode}
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
      <Highlight
        code={activeFile.code}
        language={activeFile.language}
        theme={themes.oneDark}
      >
        {({ className, getLineProps, getTokenProps, style, tokens }) => (
          <pre
            aria-labelledby={`${idPrefix}-file-${activeFileIndex}`}
            className={className}
            id={panelId}
            ref={codeScrollRef}
            role="tabpanel"
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
                      key={`reference-line-${lineIndex}`}
                      style={lineProps.style}
                    >
                      <span aria-hidden="true" className="line-number">
                        {lineIndex + 1}
                      </span>
                      <span className="code-line">
                        {Children.toArray(
                          line.map((token, tokenIndex) => {
                            const tokenProps = getTokenProps({ token });
                            return (
                              <span
                                className={tokenProps.className}
                                key={`reference-token-${lineIndex}-${tokenIndex}`}
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
        {copyStatus === "copied"
          ? "Reference code copied"
          : copyStatus === "failed"
            ? "Reference code could not be copied. Try again."
            : ""}
      </span>
    </div>
  );
}

export function InteractiveReference({
  guideId,
  stepId,
}: {
  guideId: GuideId;
  stepId: string;
}) {
  const referenceKey = `${guideId}:${stepId}`;
  const example = getReferenceExample(guideId, stepId);

  if (!example) return null;

  const idPrefix = `reference-${referenceKey.replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="interactive-step">
      <p className="interactive-purpose">
        <strong>What this step accomplishes:</strong> {example.purpose}
      </p>
      <section
        aria-label={example.label}
        className="interactive-reference"
      >
        <div className="interactive-reference-label">
          <Code2 aria-hidden="true" size={16} />
          <span>{example.label}</span>
        </div>
        <div className="interactive-reference-frame">
          <header className="interactive-reference-header">
            <span aria-hidden="true" className="interactive-reference-icon">
              <Braces size={16} />
            </span>
            <h3>{example.title}</h3>
            <span
              aria-label={example.help}
              className="interactive-reference-help"
              role="img"
              title={example.help}
            >
              <CircleHelp aria-hidden="true" size={16} />
            </span>
          </header>
          <ReferenceCodeViewer
            files={example.files}
            idPrefix={idPrefix}
            key={referenceKey}
          />
        </div>
      </section>
    </div>
  );
}
