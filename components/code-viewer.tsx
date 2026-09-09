"use client";

import {
  Check,
  Clipboard,
  Code2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";
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

const CODE_THEME = {
  plain: {
    backgroundColor: "transparent",
    color: "var(--syntax-text)",
  },
  styles: [
    {
      style: { color: "var(--syntax-comment)" },
      types: ["comment", "prolog", "cdata"],
    },
    {
      style: { color: "var(--syntax-text)" },
      types: ["doctype", "punctuation", "entity"],
    },
    {
      style: { color: "var(--syntax-number)" },
      types: [
        "attr-name",
        "class-name",
        "maybe-class-name",
        "boolean",
        "constant",
        "number",
        "atrule",
      ],
    },
    {
      style: { color: "var(--syntax-keyword)" },
      types: ["keyword"],
    },
    {
      style: { color: "var(--syntax-property)" },
      types: ["property", "tag", "symbol", "deleted", "important"],
    },
    {
      style: { color: "var(--syntax-string)" },
      types: [
        "selector",
        "string",
        "char",
        "builtin",
        "inserted",
        "regex",
        "attr-value",
      ],
    },
    {
      style: { color: "var(--syntax-function)" },
      types: ["variable", "operator", "function"],
    },
    {
      style: { color: "var(--syntax-url)" },
      types: ["url"],
    },
    {
      style: { textDecorationLine: "line-through" },
      types: ["deleted"],
    },
    {
      style: { textDecorationLine: "underline" },
      types: ["inserted"],
    },
    {
      style: { fontStyle: "italic" },
      types: ["italic"],
    },
    {
      style: { fontWeight: "bold" },
      types: ["important", "bold"],
    },
  ],
} satisfies PrismTheme;

type CopyStatus = "copied" | "failed" | "idle";
type FullscreenStatus = "active" | "failed" | "idle";

function useCopyStatus() {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  return [copyStatus, setCopyStatus] as const;
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
    <Highlight code={code} language={syntaxLanguage} theme={CODE_THEME}>
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
  const [copyStatus, setCopyStatus] = useCopyStatus();
  const [fullscreenStatus, setFullscreenStatus] =
    useState<FullscreenStatus>("idle");

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

function useCodeViewerControls(files: readonly ReferenceFile[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useCopyStatus();
  const [fullscreenStatus, setFullscreenStatus] =
    useState<FullscreenStatus>("idle");
  const activeFile = files[activeFileIndex] ?? files[0];

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreenStatus(
        document.fullscreenElement === containerRef.current ? "active" : "idle",
      );
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const selectFile = (index: number, focus = false) => {
    setActiveFileIndex(index);
    setCopyStatus("idle");
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
    if (!activeFile) return;
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

  return {
    activeFile,
    activeFileIndex,
    containerRef,
    copyCode,
    copyStatus,
    fullscreenStatus,
    navigateTabs,
    preRef,
    selectFile,
    tabRefs,
    toggleFullscreen,
  };
}

export function TabbedCodeViewer({
  files,
  idPrefix,
}: {
  files: readonly ReferenceFile[];
  idPrefix: string;
}) {
  const {
    activeFile,
    activeFileIndex,
    containerRef,
    copyCode,
    copyStatus,
    fullscreenStatus,
    navigateTabs,
    preRef,
    selectFile,
    tabRefs,
    toggleFullscreen,
  } = useCodeViewerControls(files);

  if (!activeFile) return null;

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

export function RequestResponseCodeViewer({
  idPrefix,
  request,
  response,
}: {
  idPrefix: string;
  request: ReferenceFile;
  response: ReferenceFile;
}) {
  const files = [request, response] as const;
  const {
    activeFile,
    activeFileIndex,
    containerRef,
    copyCode,
    copyStatus: codeCopyStatus,
    fullscreenStatus,
    navigateTabs,
    preRef,
    selectFile,
    tabRefs,
    toggleFullscreen,
  } = useCodeViewerControls(files);
  const [curlCopyStatus, setCurlCopyStatus] = useCopyStatus();

  if (!activeFile) return null;

  const copyCurl = async () => {
    if (!request.curl) return;
    try {
      await navigator.clipboard.writeText(request.curl);
      setCurlCopyStatus("copied");
    } catch {
      setCurlCopyStatus("failed");
    }
  };

  const panelId = `${idPrefix}-panel`;

  return (
    <div className="request-response-viewer" ref={containerRef}>
      <div className="request-response-toolbar">
        <div className="request-response-toolbar-left">
          <div
            aria-label="API request and response"
            className="request-response-tabs"
            role="tablist"
          >
            {files.map((file, index) => {
              const active = activeFileIndex === index;
              const tabId = `${idPrefix}-file-${index}`;
              return (
                <button
                  aria-controls={panelId}
                  aria-selected={active}
                  className={active ? "active" : undefined}
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
                  {file.name}
                </button>
              );
            })}
          </div>
          <span className="request-method" translate="no">
            {request.method ?? "GET"}
          </span>
        </div>
        <div className="request-response-actions">
          {request.curl ? (
            <button
              aria-label={
                curlCopyStatus === "copied"
                  ? "cURL command copied"
                  : curlCopyStatus === "failed"
                    ? "Copy cURL command failed, retry"
                    : "Copy request as cURL"
              }
              onClick={() => void copyCurl()}
              type="button"
            >
              {curlCopyStatus === "copied" ? (
                <Check aria-hidden="true" size={14} />
              ) : (
                <Clipboard aria-hidden="true" size={14} />
              )}
              {curlCopyStatus === "copied"
                ? "Copied"
                : curlCopyStatus === "failed"
                  ? "Retry cURL"
                  : "Copy as cURL"}
            </button>
          ) : null}
          <button
            aria-label={
              codeCopyStatus === "copied"
                ? `${activeFile.name} copied`
                : codeCopyStatus === "failed"
                  ? `Copy ${activeFile.name.toLowerCase()} failed, retry`
                  : `Copy ${activeFile.name.toLowerCase()}`
            }
            onClick={() => void copyCode()}
            type="button"
          >
            {codeCopyStatus === "copied" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <Clipboard aria-hidden="true" size={14} />
            )}
            {codeCopyStatus === "copied"
              ? "Copied"
              : codeCopyStatus === "failed"
                ? "Retry"
                : "Copy"}
          </button>
          {fullscreenStatus === "failed" ? (
            <span className="reference-code-error" role="status">
              Full screen unavailable
            </span>
          ) : null}
          <button
            aria-label={
              fullscreenStatus === "active"
                ? "Exit full screen"
                : "Open request and response in full screen"
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
        {curlCopyStatus === "copied"
          ? "cURL command copied"
          : curlCopyStatus === "failed"
            ? "cURL command could not be copied. Try again."
            : codeCopyStatus === "copied"
              ? `${activeFile.name} copied`
              : codeCopyStatus === "failed"
                ? `${activeFile.name} could not be copied. Try again.`
                : ""}
      </span>
    </div>
  );
}
