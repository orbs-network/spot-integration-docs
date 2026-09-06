import type { MetadataRoute } from "next";

import { GUIDE_SOURCES } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return GUIDE_SOURCES.map((guide) => ({
    changeFrequency: "monthly",
    lastModified: new Date(guide.updatedAt),
    priority: guide.id === "liquidity-hub" ? 1 : 0.9,
    url: new URL(guide.route, siteUrl).toString(),
  }));
}
