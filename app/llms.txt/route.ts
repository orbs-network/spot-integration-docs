import { GUIDE_SOURCES } from "@/lib/guides";
import { createTextResponse } from "@/lib/markdown-response";
import { getDocumentationSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export function GET(request?: Request): Response {
  const siteUrl = getDocumentationSiteUrl(request?.url);
  const instructions = GUIDE_SOURCES.filter((guide) => guide.id !== "swap-shared").map((guide) => {
    const url = new URL(`${guide.route}/llms.txt`, siteUrl).toString();
    const description = guide.id === "advanced-orders-shared"
      ? "Product setup and links to choose one React SDK, TypeScript SDK, or API Only integration."
      : "Implementation task, relevant guides, and complete reference example files.";
    return `- [${guide.label} — integration instructions](${url}): ${description}`;
  }).join("\n");
  const index = GUIDE_SOURCES.map((guide) => {
    const url = new URL(`${guide.route}.md`, siteUrl).toString();
    return `- [${guide.label}](${url}): ${guide.description}`;
  }).join("\n");

  return createTextResponse(
    [
      `# ${SITE_NAME}`,
      "",
      `> ${SITE_DESCRIPTION}`,
      "",
      "## Integration instructions",
      "",
      instructions,
      "",
      "## Documentation",
      "",
      index,
      `- [Full documentation](${new URL("/llms-full.txt", siteUrl)}): All canonical guides in one document; load only when the complete corpus is needed.`,
      "",
    ].join("\n"),
  );
}
