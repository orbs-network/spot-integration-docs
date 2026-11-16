import { renderAgentGuideMarkdown } from "@/lib/agent-markdown";
import { GUIDE_SOURCES } from "@/lib/guides";
import { createTextResponse } from "@/lib/markdown-response";
import { getDocumentationSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export function GET(request?: Request): Response {
  const siteUrl = getDocumentationSiteUrl(request?.url);
  const documents = GUIDE_SOURCES.map((guide) =>
    renderAgentGuideMarkdown(guide.id, siteUrl),
  ).join("\n\n---\n\n");

  return createTextResponse([
    `# ${SITE_NAME} — full documentation`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `For the compact index and integration-specific instructions, use [llms.txt](${new URL("/llms.txt", siteUrl)}).`,
    "",
    documents,
    "",
  ].join("\n"));
}
