import fs from "node:fs";
import path from "node:path";
import { ReadmeSteps, type ReadmeStep } from "@/components/readme-steps";

function readReadme() {
  return fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");
}

function splitReadme(markdown: string): { title: string; steps: ReadmeStep[] } {
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

export default function HomePage() {
  const guide = splitReadme(readReadme());

  return <ReadmeSteps title={guide.title} steps={guide.steps} />;
}
