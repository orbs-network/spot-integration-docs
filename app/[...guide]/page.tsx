import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsShell } from "@/components/docs-shell";
import {
  createGuideSearchIndex,
  createGuideSummaries,
  getGuideIdFromSegments,
  GUIDE_SOURCES,
  loadGuides,
} from "@/lib/guides";

interface GuidePageProps {
  params: Promise<{ guide: string[] }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SOURCES.map((source) => ({ guide: [...source.segments] }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { guide: segments } = await params;
  const guideId = getGuideIdFromSegments(segments);
  const source = GUIDE_SOURCES.find((candidate) => candidate.id === guideId);

  if (!source) return {};

  return {
    alternates: {
      canonical: source.route,
      types: {
        "text/markdown": `${source.route}.md`,
      },
    },
    description: source.description,
    openGraph: {
      description: source.description,
      images: [
        {
          alt: "Orbs Spot Integration Guides",
          height: 630,
          url: "/opengraph-image",
          width: 1200,
        },
      ],
      title: source.label,
      type: "article",
      url: source.route,
    },
    title: source.label,
    twitter: {
      card: "summary_large_image",
      description: source.description,
      images: ["/opengraph-image"],
      title: source.label,
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { guide: segments } = await params;
  const guideId = getGuideIdFromSegments(segments);
  if (!guideId) notFound();

  const guides = loadGuides();
  const activeGuide = guides.find((guide) => guide.id === guideId);
  if (!activeGuide) notFound();

  return (
    <DocsShell
      activeGuide={activeGuide}
      guides={createGuideSummaries(guides)}
      searchIndex={createGuideSearchIndex(guides)}
    />
  );
}
