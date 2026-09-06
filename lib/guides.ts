import fs from "node:fs";
import path from "node:path";

export type GuideId =
  | "liquidity-hub"
  | "advanced-orders-direct"
  | "advanced-orders-react";

export interface GuideStep {
  content: string;
  id: string;
  title: string;
}

export interface Guide {
  description: string;
  hashAliases: Record<string, string>;
  id: GuideId;
  intro: string;
  introReference: string;
  label: string;
  metadata: string;
  route: string;
  steps: GuideStep[];
  title: string;
  updatedAt: string;
}

export type GuideSummary = Pick<
  Guide,
  "description" | "id" | "label" | "route" | "title"
>;

export interface GuideSearchEntry {
  guideId: GuideId;
  guideLabel: string;
  route: string;
  searchText: string;
  stepId: string;
  stepIndex: number;
  title: string;
}

interface GuideSource {
  description: string;
  fileName: string;
  hashAliases: Record<string, string>;
  id: GuideId;
  introSections: readonly string[];
  label: string;
  metadata: string;
  route: string;
  segments: readonly string[];
  stepOrder: readonly string[];
  updatedAt: string;
}

export const GUIDE_SOURCES = [
  {
    description: "Best-price routing for swaps",
    fileName: "liquidity-hub.md",
    hashAliases: {
      "end-to-end-flow": "execute-the-full-flow",
      "execute-swap": "execute-the-full-flow",
      "execute-and-confirm": "execute-the-full-flow",
      "fallback-and-errors": "errors-and-recovery",
      "fetch-quote": "request-quotes",
      "refresh-and-sign": "execute-the-full-flow",
      "wrap-and-approve": "execute-the-full-flow",
      overview: "install-and-initialize",
    },
    id: "liquidity-hub",
    introSections: ["Concepts", "Integration Resources"],
    label: "Liquidity Hub",
    metadata: "SDK 1.0.97",
    route: "/liquidity-hub",
    segments: ["liquidity-hub"],
    stepOrder: [],
    updatedAt: "2026-09-01",
  },
  {
    description: "Direct HTTP + EIP-712 integration",
    fileName: "advanced-orders-direct.md",
    hashAliases: {
      allowance: "create-order",
      "cancel-order": "cancel-order-sink-orders",
      "core-setup": "fetch-partner-config",
      "end-to-end": "create-order",
      "fetch-orders": "fetch-order-sink-orders",
      "build-the-order": "create-order",
      "generated-order-fields": "create-order",
      overview: "fetch-partner-config",
      "output-limit-and-trigger-rules": "create-order",
      "protocol-reference": "fetch-partner-config",
      sign: "create-order",
      submit: "create-order",
      "witness-fields": "create-order",
    },
    id: "advanced-orders-direct",
    introSections: ["Concepts", "Integration Resources"],
    label: "Advanced Orders · Direct API",
    metadata: "Order Sink v2",
    route: "/advanced-orders/direct",
    segments: ["advanced-orders", "direct"],
    stepOrder: [
      "fetch-partner-config",
      "strategy-recipes",
      "create-order",
      "fetch-order-sink-orders",
      "cancel-order-sink-orders",
      "operational-checklist",
    ],
    updatedAt: "2026-09-01",
  },
  {
    description: "Provider + hooks for React",
    fileName: "advanced-orders-react.md",
    hashAliases: {
      callbacks: "submit-modal-and-lifecycle",
      history: "order-history",
      install: "install-the-react-sdk",
      "install-the-react-package": "install-the-react-sdk",
      "install-the-react-packages": "install-the-react-sdk",
      "integration-model": "advanced-orders-provider",
      "lifecycle-and-reset": "submit-modal-and-lifecycle",
      "order-history-and-cancellation": "order-history",
      "order-history-details-fills-and-cancellation": "order-history",
      overview: "prerequisites",
      "package-guardrails-and-escape-hatches": "order-history",
      "connect-spotprovider": "advanced-orders-provider",
      "adapt-wallet-interactions": "advanced-orders-provider",
      provider: "advanced-orders-provider",
      submit: "submit-modal-and-lifecycle",
      "submit-and-show-progress": "submit-modal-and-lifecycle",
      wallet: "advanced-orders-provider",
    },
    id: "advanced-orders-react",
    introSections: ["Integration Resources"],
    label: "Advanced Orders · React SDK",
    metadata: "spot-react 1.1.45",
    route: "/advanced-orders/react",
    segments: ["advanced-orders", "react"],
    stepOrder: [],
    updatedAt: "2026-09-01",
  },
] as const satisfies readonly GuideSource[];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitGuide(
  markdown: string,
  introSectionTitles: readonly string[],
  stepOrder: readonly string[],
): Pick<Guide, "intro" | "introReference" | "steps" | "title"> {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const titleMatch = normalized.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] ?? "Spot Integration Docs";
  const withoutTitle = normalized.replace(/^#\s+.+\n?/, "").trim();
  const sections = withoutTitle.split(/\n(?=##\s+)/g);
  const intro = sections[0]?.startsWith("## ") ? "" : (sections.shift() ?? "");
  const introSectionIds = new Set(introSectionTitles.map(slugify));
  const introReference: string[] = [];
  const steps: GuideStep[] = [];

  for (const section of sections) {
    const [heading = "", ...content] = section.split("\n");
    const stepTitle = heading.replace(/^##\s+/, "").trim();
    const stepContent = content.join("\n").trim();
    if (!stepTitle || !stepContent) continue;

    const id = slugify(stepTitle);
    if (introSectionIds.has(id)) {
      const nestedContent = stepContent.replace(/^(#{3,4})(\s+)/gm, "#$1$2");
      introReference.push(`### ${stepTitle}\n\n${nestedContent}`);
      continue;
    }

    steps.push({ content: stepContent, id, title: stepTitle });
  }

  if (stepOrder.length > 0) {
    const orderById = new Map(stepOrder.map((id, index) => [id, index]));
    steps.sort(
      (left, right) =>
        (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return {
    intro,
    introReference: introReference.join("\n\n"),
    steps,
    title,
  };
}

export function loadGuides(): Guide[] {
  const contentDirectory = path.join(process.cwd(), "content");

  return GUIDE_SOURCES.map((source): Guide => {
    const markdown = fs.readFileSync(
      path.join(contentDirectory, source.fileName),
      "utf8",
    );
    const parsed = splitGuide(
      markdown,
      source.introSections,
      source.stepOrder,
    );

    return {
      description: source.description,
      hashAliases: source.hashAliases,
      id: source.id,
      intro: parsed.intro,
      introReference: parsed.introReference,
      label: source.label,
      metadata: source.metadata,
      route: source.route,
      steps: parsed.steps,
      title: parsed.title,
      updatedAt: source.updatedAt,
    };
  });
}

export function createGuideSummaries(guides: readonly Guide[]): GuideSummary[] {
  return guides.map(({ description, id, label, route, title }) => ({
    description,
    id,
    label,
    route,
    title,
  }));
}

function normalizeSearchText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`#|*_[\]()]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createGuideSearchIndex(
  guides: readonly Guide[],
): GuideSearchEntry[] {
  return guides.flatMap((guide) => {
    const introduction = `${guide.intro}\n\n${guide.introReference}`.trim();

    return guide.steps.map((step, stepIndex) => ({
      guideId: guide.id,
      guideLabel: guide.label,
      route: guide.route,
      searchText: normalizeSearchText(
        `${step.title}\n${stepIndex === 0 ? introduction : ""}\n${step.content}`,
      ),
      stepId: step.id,
      stepIndex,
      title: step.title,
    }));
  });
}

export function loadGuideMarkdown(guideId: GuideId): string {
  const source = GUIDE_SOURCES.find((candidate) => candidate.id === guideId);
  if (!source) return "";

  return fs.readFileSync(
    path.join(process.cwd(), "content", source.fileName),
    "utf8",
  );
}

export function getGuideIdFromSegments(segments: readonly string[]): GuideId | undefined {
  return GUIDE_SOURCES.find(
    (source) => source.segments.join("/") === segments.join("/"),
  )?.id;
}
