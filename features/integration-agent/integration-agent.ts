import type { Guide, GuideId } from "@/lib/guides";

interface IntegrationPromptDefinition {
  goal: string;
  references: readonly string[];
  implementation: string;
  skill?: "spot-swap-integration" | "spot-advanced-orders-integration" | "spot-advanced-orders-react-integration" | "choose";
}

export interface IntegrationAgentPromptParams {
  guide: Pick<Guide, "id" | "title">;
  /** Documentation origin for the active local or public site. */
  siteUrl: string | URL;
  /** Already validated documentation context; protocol addresses stay in config. */
  partnerConfig?: {
    partner: string;
    requestedPartner?: string;
    chainId?: number;
  };
}

const PROMPTS = {
  "swap-shared": {
    goal: "Add Orbs Spot token swaps to my existing application.",
    references: ["/swap/shared", "/swap"],
    skill: "spot-swap-integration",
    implementation:
      "Use the TypeScript client flow for any framework; React apps may import the same public client APIs from spot-react without a swap provider. Keep the host's quote competition, resolved auto/custom slippage, wallet, forms, and progress UI. Quote exactly one input amount or output target, then capture the resolved fixed input spend. Implement protected-minimum review, confirmed wrapping/approval, prepareSwap, inline signing, submitSwap, and host-owned getOrder polling. The reviewed quote percentage becomes integer basis points in signed witness.slippage; preserve minimumAmountOut unchanged. Acceptance stays pending until OrderStatus.Completed.",
  },
  swap: {
    goal: "Integrate Orbs Spot swaps using the TypeScript SDK in my existing application.",
    references: ["/swap/shared", "/swap"],
    skill: "spot-swap-integration",
    implementation:
      "Keep the existing router and wallet flow. Use client.getQuote with exactly one inAmount or outAmount, capture its resolved request.inAmount, and preserve minimumAmountOut unchanged; dexMinAmountOut is a local input-only comparison threshold. Reuse the host's resolved auto/custom slippage. Use standalone getTokenUsd for missing USD prices and synchronous getSwapSlippage with host-computed amountUsd when adding automatic policy. Keep effective slippage consistent between display, quote, and final review; the reviewed quote percentage becomes integer basis points in signed witness.slippage. Confirm wrapping and sufficient allowance for client.spenderAddress, then prepareSwap, sign its exact signingRequest, and submitSwap. Retain the signed attempt and accepted order; poll getOrder until OrderStatus.Completed. Reconcile uncertain acceptance before another submission or fallback.",
  },
  "advanced-orders-shared": {
    goal: "Add Orbs Spot advanced orders to my existing application.",
    references: [
      "/advanced-orders/shared",
      "/advanced-orders/react",
      "/advanced-orders/typescript",
      "/advanced-orders/direct",
    ],
    skill: "choose",
    implementation:
      "Choose the integration from the existing stack: AdvancedOrdersProvider and focused hooks for React, or the framework-neutral TypeScript SDK otherwise. Use API Only when the project requires no Orbs SDK. Read the chosen guide in full before coding. Establish which of TWAP, limit, stop-loss, and take-profit are required from the project; ask if unresolved. Implement the native form, review, execution feedback, history/fills, and cancellation using that one path. Order creation is acceptance, not a completed fill.",
  },
  "advanced-orders-sdk": {
    goal: "Integrate Orbs Spot advanced orders using the framework-neutral TypeScript SDK in my existing application.",
    references: ["/advanced-orders/shared", "/advanced-orders/typescript"],
    skill: "spot-advanced-orders-integration",
    implementation:
      "Use OrderType and calculateOrder with current host amounts, quotes, USD prices, balances, and a positive per-trade minTradeSizeUsd. Gate submission on form.canSubmit. Capture one reviewed attempt; confirm wrapping and sufficient allowance before prepareOrder, sign its exact payload inline, then submitOrder. Add client.getOrders history, fills, and confirmed cancellation via getCancelOrderRequest. Preserve uncertain signed attempts for reconciliation; creation means acceptance, not completed execution.",
  },
  "advanced-orders-react": {
    goal: "Integrate Orbs Spot advanced orders using the React SDK in my existing application.",
    references: ["/advanced-orders/shared", "/advanced-orders/react"],
    skill: "spot-advanced-orders-react-integration",
    implementation:
      "Use AdvancedOrdersProvider with OrderType and the host's current tokens, market data, balances, USD prices, and positive per-trade minTradeSizeUsd. Implement the six walletInteractions methods with confirmed receipts and live allowance checks. Build the host-native form and review/progress UI with focused hooks; add unified errorFallback, useOrders history/fills, and useCancelOrder. Preserve provider execution across modal closure and expose checkOrderStatus recovery. Acceptance is creation success; later fills belong in history.",
  },
  "advanced-orders-direct": {
    goal: "Integrate Orbs Spot advanced orders through the direct API without an Orbs SDK in my existing application.",
    references: ["/advanced-orders/shared", "/advanced-orders/direct"],
    implementation:
      "Follow only the API Only path; reuse the host's wallet library and do not add an Orbs SDK. Implement validated partner/chain configuration, strategy calculations, raw amount and schedule validation, confirmed wrapping/allowance, exact EIP-712 order construction and signing, and one submission. Use the submission partner ID as exchange for history; add fills and confirmed on-chain cancellation. Retain the signed intent and reconcile uncertain acceptance before any replacement. Build the form, review, and feedback using existing UI patterns.",
  },
  "perps-api": {
    goal: "Integrate Perpetual Hub using the Perps Direct API in my existing application.",
    references: ["/perps/api"],
    implementation:
      "Use the assigned partner/chain lane and verify its configuration, markets, and trading rules from the API. Implement server-side account signing and sessions, collateral deposit/withdrawal flows, order controls, positions/history, and live updates with reconnect and reconciliation. Preserve exact decimal order prices and sign their 1e18 values; keep quantity, collateral, and legacy price scales distinct. Retain each order's requestId for controlled retry/replay, reconcile unknown outcomes before new intents, and deduplicate WebSocket fillId against REST trade id. Keep account signing secrets on the server. Distinguish order admission, execution, account credit, and wallet payout. The sample lane is illustrative; resolve the actual lane from project configuration or ask me. Follow this API guide without adding a Spot SDK or Spot partner configuration.",
  },
} as const satisfies Record<GuideId, IntegrationPromptDefinition>;

function documentationUrl(path: string, siteUrl: string | URL): string {
  const url = new URL(`${path}.md`, siteUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The documentation site must use an HTTP or HTTPS URL");
  }
  return url.toString();
}

export function getIntegrationAgentReferencePaths(
  guideId: GuideId,
  referencesMode: "linked" | "embedded" = "linked",
): readonly string[] {
  if (guideId === "advanced-orders-shared" && referencesMode === "embedded") {
    return ["/advanced-orders/shared"];
  }
  return PROMPTS[guideId].references;
}

/** A shareable document URL; only the selected integration context is included. */
export function buildIntegrationInstructionsUrl({
  guide,
  siteUrl,
  partnerConfig,
}: {
  guide: Pick<Guide, "id" | "route">;
  siteUrl: string | URL;
  partnerConfig?: IntegrationAgentPromptParams["partnerConfig"];
}): string {
  const url = new URL(`${guide.route}/llms.txt`, siteUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The documentation site must use an HTTP or HTTPS URL");
  }
  if (guide.id !== "perps-api" && partnerConfig) {
    url.searchParams.set("partner", partnerConfig.requestedPartner ?? partnerConfig.partner);
    if (partnerConfig.chainId !== undefined) {
      url.searchParams.set("chainId", String(partnerConfig.chainId));
    }
  }
  return url.toString();
}

function sdkInstructions(skill: IntegrationPromptDefinition["skill"]): string | undefined {
  if (!skill) return undefined;
  if (skill === "choose") {
    return "Choose the method first. For React, read node_modules/@orbs-network/spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md; for TypeScript, read node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md. Load only the selected skill and relevant references, and verify its manifest.json.sdkVersion matches the installed package version. Preserve a compatible installation and use public root exports. If the installed release lacks the bundle, use that named skill from a matching spot-ui repository release or checkout, checking its API against the installed version. For API Only, use the HTTP guide without installing an Orbs package.";
  }
  const sdk = skill === "spot-advanced-orders-react-integration" ? "spot-react" : "spot-ui";
  return `Inspect the installed @orbs-network/${sdk} version and read node_modules/@orbs-network/${sdk}/dist/integration-skills/${skill}/SKILL.md. Verify its manifest.json.sdkVersion matches the installed package version, then load the relevant referenced files. Preserve a compatible installation; if missing, use this project's package manager. If the release lacks the bundle, use https://github.com/orbs-network/spot-ui/tree/master/skills/${skill} from a matching release or checkout and check its API against the installed version; repository master may differ. Use public package root exports.`;
}

/** Ready-to-edit task text for the selected integration, independent of launch target. */
export function buildIntegrationAgentPrompt({
  guide,
  siteUrl,
  partnerConfig,
}: IntegrationAgentPromptParams, referencesMode: "linked" | "embedded" = "linked"): string {
  const definition: IntegrationPromptDefinition = PROMPTS[guide.id];
  const references = referencesMode === "embedded"
    ? guide.id === "advanced-orders-shared"
      ? "The shared overview is included below. Read it, then choose exactly one of the scoped handoff links under ‘Choose an integration method’. Fetch only that method's handoff for its complete implementation guide and code examples. Source URLs are citations; do not fetch material already included in this document again."
      : "The complete Markdown references and code examples are included below. Read that material before coding. Source URLs are citations; do not fetch those guides again."
    : [
      guide.id === "advanced-orders-shared"
        ? "Read the shared overview first, then choose one implementation guide from these alternatives. Read only the chosen method before coding:"
        : "Read the complete Markdown references first:",
      ...definition.references.map(path => `- ${documentationUrl(path, siteUrl)}`),
    ].join("\n");
  const context = guide.id === "perps-api"
    ? undefined
    : partnerConfig
      ? `Selected Spot context: partner ${JSON.stringify(partnerConfig.requestedPartner ?? partnerConfig.partner)}${partnerConfig.chainId === undefined ? "" : `, chainId ${partnerConfig.chainId}`}. Use this scope, fetch its trusted protocol configuration, and confirm support; the selection does not prove activation.`
      : "Resolve the Spot partner and supported chains from project configuration. Ask only for values that cannot be established; sample partner, chain, wallet, and token values in the guide are examples.";
  return [
    definition.goal,
    references,
    "Inspect the repository, framework, package manager, wallet/network layer, token and market-data sources, state, and existing UI before editing. Reuse those patterns and components. Ask concise questions only for requirements or configuration that remain unresolved.",
    sdkInstructions(definition.skill),
    context,
    definition.implementation,
    guide.id === "swap" || guide.id === "swap-shared"
      ? "If the app already imports these client APIs from spot-react, keep that package. The swap skill is bundled with its spot-ui dependency, so resolve that dependency's node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md and matching manifest.json.sdkVersion without adding a separate core dependency."
      : undefined,
    guide.id === "swap" || guide.id === "swap-shared"
      ? "If an existing @orbs-network/liquidity-hub-sdk swap path is present, also read node_modules/@orbs-network/spot-ui/dist/integration-skills/liquidity-hub-to-spot-swap-migration/SKILL.md and verify its manifest.json.sdkVersion against the resolved core package. React hosts use the same core dependency. If that bundle is absent, use https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-to-spot-swap-migration checked against the installed release. Migrate allowances, signing, submission, and settlement together. Preserve staged wallet actions, resolved DEX slippage, and recovery for pending legacy attempts using their original protocol identity."
      : undefined,
    "Implement the integration, run the relevant local checks and mocked failure/recovery cases, then summarize the changes and any remaining setup. Leave deployment and live signatures, transactions, and trades for me.",
  ].filter((section): section is string => section !== undefined).join("\n\n");
}
