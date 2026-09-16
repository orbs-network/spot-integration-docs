import fs from "node:fs";
import path from "node:path";

export type GuideId =
  | "liquidity-hub-shared"
  | "advanced-orders-shared"
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
    description: "Start here: product basics, prerequisites, and method selection",
    fileName: "liquidity-hub-shared.md",
    hashAliases: {
      "choose-an-integration": "integration-options",
      "integration-resources": "integration-options",
      "concepts": "how-it-works",
      "integration-lifecycle": "how-it-works",
      "input-tokens": "how-it-works",
      "fees": "fees-and-configuration",
      "partner-configuration": "fees-and-configuration",
    },
    id: "liquidity-hub-shared",
    introSections: [],
    label: "Swap · Overview & Setup",
    product: "liquidity-hub",
    route: "/liquidity-hub/shared",
    segments: ["liquidity-hub", "shared"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "Overview & Setup",
  },
  {
    description: "Start here: product basics, prerequisites, and method selection",
    fileName: "advanced-orders-shared.md",
    hashAliases: {
      "choose-an-integration": "integration-options",
      "integration-resources": "integration-options",
      "concepts": "how-it-works",
      "integration-lifecycle": "how-it-works",
      "input-tokens": "how-it-works",
      "fees": "fees-and-configuration",
      "partner-configuration": "fees-and-configuration",
    },
    id: "advanced-orders-shared",
    introSections: [],
    label: "Advanced Orders · Overview & Setup",
    product: "advanced-orders",
    route: "/advanced-orders/shared",
    segments: ["advanced-orders", "shared"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "Overview & Setup",
  },

  {
    description: "Quotes and swap execution in any JavaScript or TypeScript app",
    fileName: "liquidity-hub.md",
    hashAliases: {
      "end-to-end-flow": "submit-swap",
      "execute-swap": "submit-swap",
      "execute-and-confirm": "submit-swap",
      "execute-the-full-flow": "submit-swap",
      "fallback-and-errors": "errors-and-recovery",
      "request-quotes": "fetch-quote",
      "react-wagmi-full-flow": "submit-swap",
      overview: "install-and-initialize",
      "compare-routes": "fetch-quote",
      "wrap-and-approve": "submit-swap",
      "refresh-and-sign": "submit-swap",
      "submit-and-poll": "submit-swap",
      "confirm-the-receipt": "submit-swap",
      "end-to-end-acceptance-run": "operational-checklist",
    },
    id: "liquidity-hub",
    introSections: [],
    label: "Swap · TypeScript SDK",
    product: "liquidity-hub",
    route: "/liquidity-hub",
    segments: ["liquidity-hub"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "TypeScript SDK",
  },
  {
    description: "Implement quote, signing, submission, and polling yourself",
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
      "compare-routes": "fetch-quote",
      "wrap-and-approve": "submit-swap",
      "refresh-and-sign": "submit-swap",
      "submit-and-poll": "submit-swap",
      "confirm-the-receipt": "submit-swap",
      "end-to-end-acceptance-run": "operational-checklist",
    },
    id: "liquidity-hub-direct",
    introSections: [],
    label: "Swap · Direct API",
    product: "liquidity-hub",
    route: "/liquidity-hub/direct",
    segments: ["liquidity-hub", "direct"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "Direct API",
  },
  {
    description: "Connect your app to a provider and focused React hooks",
    fileName: "advanced-orders-react.md",
    hashAliases: {
      callbacks: "show-execution-progress",
      history: "order-history-and-cancellation",
      install: "quickstart",
      "install-the-react-package": "quickstart",
      "install-the-react-packages": "quickstart",
      "integration-model": "configure-spotprovider",
      "lifecycle-and-reset": "show-execution-progress",
      "order-history": "order-history-and-cancellation",
      "order-history-details-fills-and-cancellation": "order-history-and-cancellation",
      overview: "quickstart",
      prerequisites: "quickstart",
      "package-guardrails-and-escape-hatches": "order-history-and-cancellation",
      "advanced-orders-provider": "configure-spotprovider",
      "connect-spotprovider": "configure-spotprovider",
      "connect-your-app-data": "configure-spotprovider",
      "adapt-wallet-interactions": "implement-wallet-interactions",
      provider: "configure-spotprovider",
      submit: "submit-and-track-execution",
      "submit-and-show-progress": "submit-and-track-execution",
      "submit-modal-and-lifecycle": "submit-and-track-execution",
      "build-the-form-with-usespot": "build-with-focused-hooks",
      wallet: "implement-wallet-interactions",
      "install-the-react-sdk": "quickstart",
      "check-provider-inputs": "configure-spotprovider",
      "add-schedule-and-trigger-controls": "build-with-focused-hooks",
      "assemble-the-order-form": "build-with-focused-hooks",
      "build-the-review-screen": "submit-and-track-execution",
      "handle-completion-and-retry": "show-execution-progress",
      "show-order-details-and-cancel": "order-history-and-cancellation",
      "end-to-end-acceptance-run": "integration-checklist",
    },
    id: "advanced-orders-react",
    introSections: [],
    label: "Advanced Orders · React SDK",
    product: "advanced-orders",
    route: "/advanced-orders/react",
    segments: ["advanced-orders", "react"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "React SDK",
  },
  {
    description: "Calculate and submit orders without React",
    fileName: "advanced-orders-sdk.md",
    hashAliases: {
      calculate: "calculate-the-order-form",
      cancel: "fetch-and-cancel-orders",
      client: "quickstart",
      create: "prepare-and-submit-an-order",
      "fetch-orders": "fetch-and-cancel-orders",
      history: "fetch-and-cancel-orders",
      install: "quickstart",
      orders: "fetch-and-cancel-orders",
      "choose-the-right-integration": "quickstart",
      overview: "quickstart",
      submit: "prepare-and-submit-an-order",
      "install-the-typescript-sdk": "quickstart",
      "initialize-the-client": "quickstart",
      "validate-form-inputs": "calculate-the-order-form",
      "cancel-order": "fetch-and-cancel-orders",
      "end-to-end-acceptance-run": "operational-checklist",
    },
    id: "advanced-orders-sdk",
    introSections: [],
    label: "Advanced Orders · TypeScript SDK",
    product: "advanced-orders",
    route: "/advanced-orders/typescript",
    segments: ["advanced-orders", "typescript"],
    stepOrder: [],
    updatedAt: "2026-09-16",
    variantLabel: "TypeScript SDK",
  },
  {
    description: "Build, sign, and submit orders without an Orbs SDK",
    fileName: "advanced-orders-direct.md",
    hashAliases: {
      allowance: "create-order",
      "cancel-order": "cancel-order-sink-orders",
      "core-setup": "create-order",
      "end-to-end": "create-order",
      "fetch-orders": "fetch-order-sink-orders",
      "build-the-order": "create-order",
      "generated-order-fields": "create-order",
      "fetch-partner-config": "fetch-config",
      overview: "quickstart",
      prerequisites: "quickstart",
      "output-limit-and-trigger-rules": "create-order",
      "protocol-reference": "create-order",
      sign: "create-order",
      submit: "create-order",
      "witness-fields": "create-order",
      "build-the-form-input": "strategy-recipes",
      "check-signing-and-submission-results": "create-order",
      "end-to-end-acceptance-run": "operational-checklist",
    },
    id: "advanced-orders-direct",
    introSections: [],
    label: "Advanced Orders · API Only",
    product: "advanced-orders",
    route: "/advanced-orders/direct",
    segments: ["advanced-orders", "direct"],
    stepOrder: [
      "quickstart",
      "fetch-config",
      "strategy-recipes",
      "create-order",
      "fetch-order-sink-orders",
      "cancel-order-sink-orders",
      "operational-checklist",
    ],
    updatedAt: "2026-09-16",
    variantLabel: "API Only",
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
