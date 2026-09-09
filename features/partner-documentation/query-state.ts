import { createSerializer, parseAsString } from "nuqs/server";

import {
  parsePartnerDocumentationQuery,
  type PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";

const PARTNER_QUERY_KEYS = new Set(["chainId", "partner"]);

export const partnerDocumentationSearchParams = {
  chainId: parseAsString,
  partner: parseAsString,
};

const serializePartnerDocumentation = createSerializer(
  partnerDocumentationSearchParams,
);

export function createPartnerDocumentationHref(
  route: string,
  request?: PartnerDocumentationRequest,
  stepId?: string,
): string {
  const href = request
    ? serializePartnerDocumentation(route, {
        chainId: String(request.chainId),
        partner: request.partner,
      })
    : route;
  return `${href}${stepId ? `#${stepId}` : ""}`;
}

/**
 * Browsers treat everything after `#` as a fragment, so shared links written as
 * `#step?partner=...` do not expose those values through URLSearchParams. Accept
 * that common ordering once, then replace it with the canonical `?query#step`
 * form used by nuqs and the rest of the app.
 */
export function normalizePartnerDocumentationLocation(
  href: string,
): string | null {
  const url = new URL(href);
  const fragment = url.hash.slice(1);
  const separatorIndex = fragment.indexOf("?");
  if (separatorIndex < 0) return null;

  const stepId = fragment.slice(0, separatorIndex);
  const fragmentQuery = new URLSearchParams(
    fragment.slice(separatorIndex + 1),
  );
  if (
    !fragmentQuery.has("partner") &&
    !fragmentQuery.has("chainId")
  ) {
    return null;
  }

  const partner =
    url.searchParams.get("partner") ?? fragmentQuery.get("partner");
  const chainId =
    url.searchParams.get("chainId") ?? fragmentQuery.get("chainId");
  const parsedQuery = parsePartnerDocumentationQuery(partner, chainId);

  for (const [key, value] of fragmentQuery) {
    if (!PARTNER_QUERY_KEYS.has(key) && !url.searchParams.has(key)) {
      url.searchParams.append(key, value);
    }
  }

  if (parsedQuery.kind === "valid") {
    url.searchParams.set("partner", parsedQuery.request.partner);
    url.searchParams.set("chainId", String(parsedQuery.request.chainId));
  } else {
    url.searchParams.delete("partner");
    url.searchParams.delete("chainId");
  }

  url.hash = stepId ? `#${stepId}` : "";
  return url.toString();
}
