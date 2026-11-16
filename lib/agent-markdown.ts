import { GUIDE_SOURCES, loadGuideMarkdown, type GuideId } from "@/lib/guides";

function absoluteLink(href: string, sourceUrl: URL): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return href;
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return href;
  }
}

/** Format standalone references without changing any fenced example code. */
export function formatAgentMarkdown(
  markdown: string,
  sourceUrl: URL,
  headingOffset = 0,
): string {
  let fence: { character: string; length: number } | undefined;

  return markdown.split("\n").map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.character
        && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) {
        fence = undefined;
      }
      return line;
    }
    if (marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return line;
    }

    return line
      .replace(/^( {0,3})(#{1,6})([ \t]+)/, (_match, indent: string, hashes: string, space: string) =>
        `${indent}${"#".repeat(Math.min(6, Math.max(1, hashes.length + headingOffset)))}${space}`)
      .replace(/(\]\()(<[^>\n]+>|[^\s)]+)(?=[ \t]*(?:\)|["']))/g,
        (_match, opening: string, destination: string) => {
          const angled = destination.startsWith("<") && destination.endsWith(">");
          const href = angled ? destination.slice(1, -1) : destination;
          const absolute = absoluteLink(href, sourceUrl);
          return `${opening}${angled ? `<${absolute}>` : absolute}`;
        })
      .replace(/^( {0,3}\[[^\]]+\]:[ \t]*)(<[^>\n]+>|\S+)/,
        (_match, opening: string, destination: string) => {
          const angled = destination.startsWith("<") && destination.endsWith(">");
          const href = angled ? destination.slice(1, -1) : destination;
          const absolute = absoluteLink(href, sourceUrl);
          return `${opening}${angled ? `<${absolute}>` : absolute}`;
        });
  }).join("\n");
}

/** Include one canonical title, nested beneath the containing document's title. */
export function renderAgentGuideMarkdown(
  guideId: GuideId,
  siteUrl: string | URL,
  headingOffset = 1,
): string {
  const source = GUIDE_SOURCES.find((guide) => guide.id === guideId);
  if (!source) throw new Error(`Unknown integration guide: ${guideId}`);
  const sourceUrl = new URL(`${source.route}.md`, siteUrl);
  const markdown = formatAgentMarkdown(loadGuideMarkdown(guideId), sourceUrl, headingOffset);
  return markdown.replace(/^(#{1,6}[^\n]+)\n/, `$1\n\nSource: ${sourceUrl}\n`);
}
