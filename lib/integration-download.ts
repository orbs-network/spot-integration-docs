import type { Guide } from "./guides";
import type { ReferenceExample } from "./reference-examples";
import { exampleReadme } from "./example-download";
import { personalizeDocumentationMarkdown, personalizeReferenceExample, type PartnerDocumentationContext } from "../features/partner-documentation/partner-documentation";

// Generated at build time from canonical source files, with local imports
// resolved and colliding bindings renamed through TypeScript's symbol table.
export async function buildIntegrationTypeScript(
  guide: Guide,
  sharedMarkdown: string,
  sourceUrl: string,
  config?: PartnerDocumentationContext,
): Promise<string> {
  const { default: sources } = await import("./generated-integration-sources.json");
  const source = sources[guide.id as keyof typeof sources];
  if (!source) throw new Error("No integration source for this guide");
  const example: ReferenceExample = {
    files: [{ name: "integration.ts", language: "typescript", code: source }],
    help: "", label: "", purpose: "", title: guide.title,
    includePartnerContextFile: false,
  };
  const code = config ? personalizeReferenceExample(guide.id, example, config).files[0].code : source;
  const notes = [
    `${guide.title} — integration source`,
    `Source: ${sourceUrl}`,
    "Canonical examples merged into one module. Supply the documented host imports and dependencies.",
    "Browser examples require an injected wallet and active-chain RPC configuration.",
    "Follow the guide for installation, input validation, and acceptance checks.",
    `Shared reference: /${guide.product}/shared`,
    // Preserve setup/reference instructions as comments, never executable alternatives.
    "Dependencies referenced by the code" + exampleReadme([{ name: "integration.ts", language: "typescript", code }], sourceUrl)
      .split("## Dependencies referenced by the code")[1]
      .replace("Some imports may refer to your host application or another example in the guide. Resolve any missing modules before running; this archive includes only this example panel.", "Supply the listed host adapters before compiling in your application."),
    [guide.intro, guide.introReference, ...guide.steps.map(step => `${step.title}\n\n${step.content}`), sharedMarkdown]
      .map(text => config ? personalizeDocumentationMarkdown(text, config) : text)
      .join("\n\n")
      .replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, ""),
  ].join("\n\n").split("\n").map(line => `// ${line}`).join("\n");
  return `${notes}\n\n${code}`;
}
