import {
  buildIntegrationAgentPrompt,
  buildIntegrationInstructionsUrl,
  getIntegrationAgentReferencePaths,
  type IntegrationAgentPromptParams,
} from "@/features/integration-agent/integration-agent";
import { parsePartnerDocumentationQuery } from "@/features/partner-documentation/partner-documentation";
import {
  getGuideIdFromSegments,
  GUIDE_SOURCES,
} from "@/lib/guides";
import { formatAgentMarkdown, renderAgentGuideMarkdown } from "@/lib/agent-markdown";
import { createTextResponse } from "@/lib/markdown-response";
import { REFERENCE_EXAMPLES, type ReferenceExample } from "@/lib/reference-examples";
import { getDocumentationSiteUrl } from "@/lib/site";

function referenceExamples(guideId: IntegrationAgentPromptParams["guide"]["id"]): string {
  const examples: Readonly<Record<string, ReferenceExample>> = REFERENCE_EXAMPLES;
  return Object.entries(examples)
    .filter(([key]) => key.startsWith(`${guideId}:`))
    .map(([, example]) => [
      `#### ${example.title} — reference files`,
      "",
      example.purpose,
      "",
      example.help,
      "",
      ...example.files.flatMap((file) => [
        `##### ${file.name}`,
        "",
        `\`\`\`${file.language}`,
        file.code,
        "```",
        "",
        ...(file.curl ? ["```bash", file.curl, "```", ""] : []),
      ]),
    ].join("\n"))
    .join("\n\n");
}

/** Overview handoffs select a method; specific handoffs include its complete references. */
export function buildIntegrationInstructions(params: IntegrationAgentPromptParams): string {
  const source = GUIDE_SOURCES.find((guide) => guide.id === params.guide.id);
  if (!source) throw new Error("Unknown integration guide");

  const choosingMethod = source.id === "advanced-orders-shared";
  const methodLinks = choosingMethod
    ? GUIDE_SOURCES
      .filter((guide) => guide.product === "advanced-orders" && guide.id !== source.id)
      .map((guide) => `- [${guide.label}](${buildIntegrationInstructionsUrl({
        guide,
        siteUrl: params.siteUrl,
        partnerConfig: params.partnerConfig,
      })}): ${guide.description}`)
      .join("\n")
    : undefined;
  const documents = getIntegrationAgentReferencePaths(source.id, "embedded").map((route) => {
    const reference = GUIDE_SOURCES.find((guide) => guide.route === route);
    if (!reference) throw new Error(`Unknown integration reference: ${route}`);
    const sourceUrl = new URL(`${route}.md`, params.siteUrl);
    const examples = referenceExamples(reference.id);
    return [
      renderAgentGuideMarkdown(reference.id, params.siteUrl, 2),
      ...(examples ? ["", formatAgentMarkdown(examples, sourceUrl)] : []),
    ].join("\n");
  });

  return [
    `# ${source.label} — agent integration instructions`,
    "",
    choosingMethod
      ? "> Use this shared overview to choose one Advanced Orders integration method for the user's existing application. Follow only the selected method's handoff for its implementation guide and examples."
      : "> Use this document to implement the selected Orbs integration in the user's existing application. The implementation task and complete reference material are included below.",
    "",
    `Documentation: ${new URL(source.route, params.siteUrl)}`,
    "",
    "## Implementation task",
    "",
    buildIntegrationAgentPrompt(params, "embedded"),
    ...(methodLinks ? [
      "",
      "## Choose an integration method",
      "",
      "Read the shared overview below, then fetch only the handoff that matches the chosen method. Each handoff includes the shared prerequisites, that method's complete guide, and its code examples. These links preserve the selected partner and chain scope.",
      "",
      methodLinks,
    ] : []),
    "",
    "## Reference conventions",
    "",
    source.product === "perps"
      ? "Use the following canonical guide and its complete code examples. Resolve the Perpetual Hub partner/chain lane and account credentials from the project and trusted API configuration. Keep the lane's routing header, endpoints, collateral configuration, and signing domain together. Example accounts, identifiers, and amounts must be adapted to the application."
      : choosingMethod
        ? "Use the shared overview below for product behavior and prerequisites. Implementation details and code examples are in the chosen method's handoff. Resolve the actual partner and chains from the project and trusted configuration; selected URL context describes the requested scope and does not validate protocol configuration."
      : "Use the following canonical guides and reference files together. Code examples retain their sample configuration; resolve the actual partner, chains, accounts, token addresses, and credentials from the project and trusted configuration before adapting them. Selected URL context describes the requested integration scope and does not validate protocol configuration. Match the configuration's partner and signing chain IDs before enabling submission.",
    "",
    choosingMethod ? "## Shared overview" : "## Complete integration reference",
    "",
    documents.join("\n\n---\n\n"),
    "",
  ].join("\n");
}

export function createIntegrationInstructionsResponse(
  guideSegments: readonly string[],
  request: Request,
): Response {
  const guideId = getGuideIdFromSegments(guideSegments);
  const source = GUIDE_SOURCES.find((guide) => guide.id === guideId);
  if (!source) {
    return new Response("Integration guide not found.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const context = source.product === "perps"
    ? { kind: "none" } as const
    : parsePartnerDocumentationQuery(url.searchParams.get("partner"), url.searchParams.get("chainId"));
  if (context.kind === "invalid") {
    return new Response("Invalid integration context. Supply a valid partner and optional positive chainId.\n", {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return createTextResponse(buildIntegrationInstructions({
    guide: { id: source.id, title: source.label },
    siteUrl: getDocumentationSiteUrl(request.url),
    partnerConfig: context.kind === "valid" || context.kind === "partner-only"
      ? context.request
      : undefined,
  }));
}
