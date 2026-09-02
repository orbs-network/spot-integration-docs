import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsShell } from "@/components/docs-shell";
import {
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
    title: `${source.label} — Spot Integration Docs`,
    description: source.description,
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { guide: segments } = await params;
  const guideId = getGuideIdFromSegments(segments);
  if (!guideId) notFound();

  return <DocsShell activeGuideId={guideId} guides={loadGuides()} />;
}
