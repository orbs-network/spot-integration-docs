import { createGuideMarkdownResponse } from "@/lib/markdown-response";

export const dynamic = "force-static";

export function GET(): Response {
  return createGuideMarkdownResponse("advanced-orders-direct");
}
