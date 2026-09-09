"use client";

import {
  CircleHelp,
  Code2,
} from "lucide-react";
import { useMemo } from "react";

import {
  RequestResponseCodeViewer,
  TabbedCodeViewer,
} from "@/components/code-viewer";

import {
  REFERENCE_EXAMPLES,
  type ReferenceExample,
} from "@/lib/reference-examples";
import type { GuideId } from "@/lib/guides";
import {
  personalizeReferenceExample,
  type PartnerDocumentationConfig,
} from "@/features/partner-documentation/partner-documentation";

function getReferenceExample(
  guideId: GuideId,
  stepId: string,
): ReferenceExample | undefined {
  const key = `${guideId}:${stepId}` as keyof typeof REFERENCE_EXAMPLES;
  const example: ReferenceExample | undefined = REFERENCE_EXAMPLES[key];
  if (!example || example.format !== "request-response") {
    return example;
  }

  return {
    ...example,
    files: example.files
      .filter((file) => file.kind)
      .map((file) => ({
        ...file,
        name: file.kind === "request" ? "Request" : "Response",
      })),
  };
}

export function InteractiveReference({
  guideId,
  partnerConfig,
  stepId,
}: {
  guideId: GuideId;
  partnerConfig?: PartnerDocumentationConfig;
  stepId: string;
}) {
  const referenceKey = `${guideId}:${stepId}`;
  const example = getReferenceExample(guideId, stepId);
  const displayedExample = useMemo(
    () =>
      example && partnerConfig
        ? personalizeReferenceExample(guideId, example, partnerConfig)
        : example,
    [example, guideId, partnerConfig],
  );

  if (!displayedExample) return null;

  const idPrefix = `reference-${referenceKey.replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="interactive-step">
      <p className="interactive-purpose">
        <strong>What this step accomplishes:</strong> {displayedExample.purpose}
      </p>
      <section
        aria-label={`${displayedExample.title}: ${displayedExample.label}`}
        className="interactive-reference"
      >
        <div className="interactive-reference-label">
          <Code2 aria-hidden="true" size={16} />
          <span>{displayedExample.label}</span>
          <span className="interactive-reference-help">
            <button
              aria-describedby={`${idPrefix}-help`}
              aria-label={`About ${displayedExample.label}`}
              type="button"
            >
              <CircleHelp aria-hidden="true" size={14} />
            </button>
            <span
              className="interactive-reference-tooltip"
              id={`${idPrefix}-help`}
              role="tooltip"
            >
              {displayedExample.help}
            </span>
          </span>
          {partnerConfig ? (
            <span
              className="partner-example-label"
              title={`${partnerConfig.partner} · Chain ${partnerConfig.chainId}`}
              translate="no"
            >
              {partnerConfig.partner} · Chain {partnerConfig.chainId}
            </span>
          ) : null}
        </div>
        <div className="interactive-reference-frame">
          {displayedExample.format === "request-response" &&
          displayedExample.files[0] &&
          displayedExample.files[1] ? (
            <RequestResponseCodeViewer
              idPrefix={idPrefix}
              key={`${referenceKey}:${partnerConfig?.requestedPartner ?? "sample"}:${partnerConfig?.chainId ?? "default"}`}
              request={displayedExample.files[0]}
              response={displayedExample.files[1]}
            />
          ) : (
            <TabbedCodeViewer
              files={displayedExample.files}
              idPrefix={idPrefix}
              key={`${referenceKey}:${partnerConfig?.requestedPartner ?? "sample"}:${partnerConfig?.chainId ?? "default"}`}
            />
          )}
        </div>
      </section>
    </div>
  );
}
