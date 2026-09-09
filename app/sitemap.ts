import type { MetadataRoute } from "next";

import { GUIDE_SOURCES } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const latestGuideUpdate = GUIDE_SOURCES.reduce(
    (latest, guide) => (guide.updatedAt > latest ? guide.updatedAt : latest),
    GUIDE_SOURCES[0].updatedAt,
  );

  return [
    {
      changeFrequency: "monthly",
      lastModified: new Date(latestGuideUpdate),
      priority: 1,
      url: siteUrl.toString(),
    },
    ...GUIDE_SOURCES.map((guide) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(guide.updatedAt),
      priority: 0.9,
      url: new URL(guide.route, siteUrl).toString(),
    })),
  ];
}
