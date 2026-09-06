"use client";

import {
  Braces,
  CircleHelp,
  Code2,
} from "lucide-react";

import { TabbedCodeViewer } from "@/components/code-viewer";

import {
  REFERENCE_EXAMPLES,
  type ReferenceExample,
} from "@/lib/reference-examples";
import type { GuideId } from "@/lib/guides";

function getReferenceExample(
  guideId: GuideId,
  stepId: string,
): ReferenceExample | undefined {
  const key = `${guideId}:${stepId}` as keyof typeof REFERENCE_EXAMPLES;
  return REFERENCE_EXAMPLES[key];
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
            <h2>{example.title}</h2>
            <span
              aria-label={example.help}
              className="interactive-reference-help"
              role="img"
              title={example.help}
            >
              <CircleHelp aria-hidden="true" size={16} />
            </span>
          </header>
          <TabbedCodeViewer
            files={example.files}
            idPrefix={idPrefix}
            key={referenceKey}
          />
        </div>
      </section>
    </div>
  );
}
