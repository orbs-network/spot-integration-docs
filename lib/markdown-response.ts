import type { GuideId } from "@/lib/guides";
import { loadGuideMarkdown } from "@/lib/guides";

const MARKDOWN_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "text/markdown; charset=utf-8",
} as const;

const TEXT_HEADERS = {
  ...MARKDOWN_HEADERS,
  "Content-Type": "text/plain; charset=utf-8",
} as const;

export function createGuideMarkdownResponse(guideId: GuideId): Response {
  return new Response(loadGuideMarkdown(guideId), {
    headers: MARKDOWN_HEADERS,
  });
}

export function createMarkdownResponse(markdown: string): Response {
  return new Response(markdown, {
    headers: MARKDOWN_HEADERS,
  });
}

export function createTextResponse(text: string): Response {
  return new Response(text, {
    headers: TEXT_HEADERS,
  });
}
