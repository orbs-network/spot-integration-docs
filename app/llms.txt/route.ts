import { GUIDE_SOURCES, loadGuideMarkdown } from "@/lib/guides";
import { createTextResponse } from "@/lib/markdown-response";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

export function GET(): Response {
  const siteUrl = getSiteUrl();
  const index = GUIDE_SOURCES.map((guide) => {
    const url = new URL(`${guide.route}.md`, siteUrl).toString();
    return `- [${guide.label}](${url}): ${guide.description}`;
  }).join("\n");
  const documents = GUIDE_SOURCES.map((guide) => {
    const url = new URL(`${guide.route}.md`, siteUrl).toString();
    return [
      `# ${guide.label}`,
      "",
      `Source: ${url}`,
      "",
      loadGuideMarkdown(guide.id),
    ].join("\n");
  }).join("\n\n---\n\n");

  return createTextResponse(
    [
      `# ${SITE_NAME}`,
      "",
      `> ${SITE_DESCRIPTION}`,
      "",
      "## Documentation",
      "",
      index,
      "",
      "## Full documentation",
      "",
      documents,
      "",
    ].join("\n"),
  );
}
