import fs from "node:fs";
import path from "node:path";
import {
  ReadmeSteps,
  type ReadmeGuide,
  type ReadmeStep,
} from "@/components/readme-steps";

type GuideSource = {
  id: string;
  label: string;
  description: string;
};

const guideSources: GuideSource[] = [
  {
    id: "liquidity-hub",
    label: "Liquidity Hub",
    description: "Best-price routing for swaps",
  },
  {
    id: "advanced-orders",
    label: "Advanced Orders",
    description: "TWAP, limit, and trigger orders",
  },
];

function readGuideMarkdown(): Record<string, string> {
  return {
    "liquidity-hub": fs.readFileSync(
      path.join(process.cwd(), "LIQUIDITY_HUB.md"),
      "utf8",
    ),
    "advanced-orders": fs.readFileSync(
      path.join(process.cwd(), "README.md"),
      "utf8",
    ),
  };
}

function splitGuide(markdown: string): { title: string; steps: ReadmeStep[] } {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const titleMatch = normalized.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] || "Spot Integration Docs";
  const withoutTitle = normalized.replace(/^#\s+.+\n?/, "").trim();
  const sections = withoutTitle.split(/\n(?=##\s+)/g);
  const intro = sections[0]?.startsWith("## ") ? "" : sections.shift() || "";
  const steps = sections
    .map((section) => {
      const [heading = "", ...content] = section.split("\n");
      return {
        title: heading.replace(/^##\s+/, "").trim(),
        content: content.join("\n").trim(),
      };
    })
    .filter((step) => step.title && step.content);

  if (intro) {
    steps.unshift({ title: "Overview", content: intro });
  }

  return { title, steps };
}

function createGuides(): ReadmeGuide[] {
  const markdownByGuideId = readGuideMarkdown();

  return guideSources.map((source): ReadmeGuide => {
    const guide = splitGuide(markdownByGuideId[source.id] ?? "");

    return {
      id: source.id,
      label: source.label,
      description: source.description,
      title: guide.title,
      steps: guide.steps,
    };
  });
}

export default function HomePage() {
  const guides = createGuides();

  return (
    <ReadmeSteps
      guides={guides}
      defaultGuideId="liquidity-hub"
      legacyGuideId="advanced-orders"
    />
  );
}
