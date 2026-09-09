import fs from "node:fs";
import path from "node:path";

export type GuideId =
  | "liquidity-hub"
  | "liquidity-hub-direct"
  | "advanced-orders-direct"
  | "advanced-orders-sdk"
  | "advanced-orders-react";

export type GuideProductId = "liquidity-hub" | "advanced-orders";

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
  product: GuideProductId;
  route: string;
  steps: GuideStep[];
  title: string;
  updatedAt: string;
  variantLabel: string;
}

export type GuideSummary = Pick<
  Guide,
  | "description"
  | "id"
  | "label"
  | "product"
  | "route"
  | "title"
  | "variantLabel"
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
  product: GuideProductId;
  route: string;
  segments: readonly string[];
  stepOrder: readonly string[];
  updatedAt: string;
  variantLabel: string;
}

export const GUIDE_SOURCES = [
  {
    description: "Best-price routing for swaps",
    fileName: "liquidity-hub.md",
    hashAliases: {
      "end-to-end-flow": "submit-swap",
      "execute-swap": "submit-swap",
      "execute-and-confirm": "submit-swap",
      "execute-the-full-flow": "submit-swap",
      "fallback-and-errors": "errors-and-recovery",
      "request-quotes": "fetch-quote",
      "react-wagmi-full-flow": "submit-swap",
      "refresh-and-sign": "submit-swap",
      "wrap-and-approve": "submit-swap",
      overview: "install-and-initialize",
    },
    id: "liquidity-hub",
    introSections: ["Concepts", "Integration Resources"],
    label: "Liquidity Hub · TypeScript SDK",
    product: "liquidity-hub",
    route: "/liquidity-hub",
    segments: ["liquidity-hub"],
    stepOrder: [],
    updatedAt: "2026-09-08",
    variantLabel: "TypeScript SDK",
  },
  {
    description: "Direct Liquidity Hub HTTP integration",
    fileName: "liquidity-hub-direct.md",
    hashAliases: {
      endpoint: "quickstart",
      "api-endpoint": "quickstart",
      "choose-the-api-endpoint": "quickstart",
      "fetch-a-liquidity-hub-quote": "fetch-quote",
      quote: "fetch-quote",
      compare: "fetch-quote",
      "compare-with-a-dex-router": "fetch-quote",
      "optional-compare-with-a-dex-router": "fetch-quote",
      sign: "submit-swap",
      submit: "submit-swap",
      status: "submit-swap",
      confirmation: "submit-swap",
      "submit-and-poll-the-swap": "submit-swap",
      "submit-poll-and-confirm-the-swap": "submit-swap",
      "prepare-funds-and-sign": "submit-swap",
      "confirm-the-transaction": "submit-swap",
      overview: "quickstart",
    },
    id: "liquidity-hub-direct",
    introSections: ["Concepts", "Integration Resources"],
    label: "Liquidity Hub · Direct API",
    product: "liquidity-hub",
    route: "/liquidity-hub/direct",
    segments: ["liquidity-hub", "direct"],
    stepOrder: [],
    updatedAt: "2026-09-08",
    variantLabel: "Direct API",
  },
  {
    description: "Package-free HTTP + EIP-712 integration",
    fileName: "advanced-orders-direct.md",
    hashAliases: {
      allowance: "create-order",
      "cancel-order": "cancel-order-sink-orders",
      "core-setup": "create-order",
      "end-to-end": "create-order",
      "fetch-orders": "fetch-order-sink-orders",
      "build-the-order": "create-order",
      "generated-order-fields": "create-order",
      "fetch-partner-config": "create-order",
      overview: "quickstart",
      prerequisites: "quickstart",
      "output-limit-and-trigger-rules": "create-order",
      "protocol-reference": "create-order",
      sign: "create-order",
      submit: "create-order",
      "witness-fields": "create-order",
    },
    id: "advanced-orders-direct",
    introSections: ["Concepts", "Integration Resources"],
    label: "Advanced Orders · API Only",
    product: "advanced-orders",
    route: "/advanced-orders/direct",
    segments: ["advanced-orders", "direct"],
    stepOrder: [
      "quickstart",
      "strategy-recipes",
      "create-order",
      "fetch-order-sink-orders",
      "cancel-order-sink-orders",
      "operational-checklist",
    ],
    updatedAt: "2026-09-08",
    variantLabel: "API Only",
  },
  {
    description: "Framework-neutral TypeScript SDK integration",
    fileName: "advanced-orders-sdk.md",
    hashAliases: {
      calculate: "calculate-the-order-form",
      client: "initialize-the-client",
      create: "prepare-and-submit-an-order",
      history: "fetch-and-cancel-orders",
      install: "install-the-typescript-sdk",
      orders: "fetch-and-cancel-orders",
      "choose-the-right-integration": "quickstart",
      overview: "quickstart",
      submit: "prepare-and-submit-an-order",
    },
    id: "advanced-orders-sdk",
    introSections: ["Concepts", "Integration Resources"],
    label: "Advanced Orders · TypeScript SDK",
    product: "advanced-orders",
    route: "/advanced-orders/typescript",
    segments: ["advanced-orders", "typescript"],
    stepOrder: [],
    updatedAt: "2026-09-08",
    variantLabel: "TypeScript SDK",
  },
  {
    description: "Provider + hooks for React",
    fileName: "advanced-orders-react.md",
    hashAliases: {
      callbacks: "submit-and-track-execution",
      history: "order-history-and-cancellation",
      install: "install-the-react-sdk",
      "install-the-react-package": "install-the-react-sdk",
      "install-the-react-packages": "install-the-react-sdk",
      "integration-model": "configure-spotprovider",
      "lifecycle-and-reset": "submit-and-track-execution",
      "order-history": "order-history-and-cancellation",
      "order-history-details-fills-and-cancellation": "order-history-and-cancellation",
      overview: "quickstart",
      prerequisites: "quickstart",
      "package-guardrails-and-escape-hatches": "order-history-and-cancellation",
      "advanced-orders-provider": "configure-spotprovider",
      "connect-spotprovider": "configure-spotprovider",
      "adapt-wallet-interactions": "implement-wallet-interactions",
      provider: "configure-spotprovider",
      submit: "submit-and-track-execution",
      "submit-and-show-progress": "submit-and-track-execution",
      "submit-modal-and-lifecycle": "submit-and-track-execution",
      "build-the-form-with-usespot": "build-with-focused-hooks",
      wallet: "implement-wallet-interactions",
    },
    id: "advanced-orders-react",
    introSections: ["Integration Resources"],
    label: "Advanced Orders · React SDK",
    product: "advanced-orders",
    route: "/advanced-orders/react",
    segments: ["advanced-orders", "react"],
    stepOrder: [],
    updatedAt: "2026-09-08",
    variantLabel: "React SDK",
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
      product: source.product,
      route: source.route,
      steps: parsed.steps,
      title: parsed.title,
      updatedAt: source.updatedAt,
      variantLabel: source.variantLabel,
    };
  });
}

export function createGuideSummaries(guides: readonly Guide[]): GuideSummary[] {
  return guides.map(({ description, id, label, product, route, title, variantLabel }) => ({
    description,
    id,
    label,
    product,
    route,
    title,
    variantLabel,
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
