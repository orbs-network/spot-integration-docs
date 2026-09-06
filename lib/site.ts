export const SITE_NAME = "Spot Integration Docs";
export const SITE_DESCRIPTION =
  "Integration guides for Orbs Liquidity Hub and Advanced Orders.";
export const SITE_REPOSITORY = "https://github.com/orbs-network/spot-integration-docs";

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
