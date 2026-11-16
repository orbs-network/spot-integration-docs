export const ORBS_SUPPORT_URL = "https://t.me/dTWAPSupportGroup";
export const SITE_NAME = "Orbs Integration Docs";
export const SITE_DESCRIPTION =
  "Integration guides for Spot quotes, swaps, advanced orders, and the Perps API.";
export const SITE_REPOSITORY = "https://github.com/orbs-network/spot-integration-docs";
export const SPOT_INTEGRATION_SKILLS = {
  swap: [
    { title: "Swap integration skill", href: "https://github.com/orbs-network/spot-ui/tree/master/skills/spot-swap-integration" },
  ],
  "advanced-orders": [
    { title: "TypeScript integration skill", href: "https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-integration" },
    { title: "React integration skill", href: "https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-react-integration" },
  ],
} as const;

const DEFAULT_SITE_URL = "https://spot-integration-docs.vercel.app";

export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    DEFAULT_SITE_URL;
  const url = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    return new URL(url);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

/** Keep local documentation on the running server; public links use the canonical site. */
export function getDocumentationSiteUrl(currentUrl?: string | URL): URL {
  if (currentUrl !== undefined) {
    try {
      const url = new URL(currentUrl);
      const local = url.hostname === "localhost"
        || url.hostname.endsWith(".localhost")
        || url.hostname === "127.0.0.1"
        || url.hostname === "[::1]"
        || url.hostname === "0.0.0.0";
      if (local && (url.protocol === "http:" || url.protocol === "https:")) {
        return new URL(url.origin);
      }
    } catch {
      // Invalid locations fall back to the configured public documentation site.
    }
  }
  return new URL(getSiteUrl().origin);
}
