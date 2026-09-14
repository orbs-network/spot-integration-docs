import type { Guide } from "./guides";
import { REFERENCE_EXAMPLES, type ReferenceExample } from "./reference-examples";
import { downloadFilename, exampleReadme, type DownloadFile } from "./example-download";
import { personalizeDocumentationMarkdown, personalizeReferenceExample, type PartnerDocumentationConfig } from "../features/partner-documentation/partner-documentation";

function fencedCode(file: DownloadFile): string {
  const longestFence = Math.max(2, ...[...file.code.matchAll(/`+/g)].map(match => match[0].length));
  const fence = "`".repeat(longestFence + 1);
  return `### File: ${downloadFilename(file)}\n\n${fence}${file.language}\n${file.code}\n${fence}`;
}

export function buildIntegrationDocument(guide: Guide, sharedMarkdown: string, sourceUrl: string, config?: PartnerDocumentationConfig): string {
  const personalize = (text: string) => config ? personalizeDocumentationMarkdown(text, config) : text;
  const allFiles: DownloadFile[] = [];
  const sections = guide.steps.map(step => {
    const original = REFERENCE_EXAMPLES[`${guide.id}:${step.id}` as keyof typeof REFERENCE_EXAMPLES] as ReferenceExample | undefined;
    const example = original && config ? personalizeReferenceExample(guide.id, original, config) : original;
    const files = example?.files.filter(file => example.format !== "request-response" || file.kind) ?? [];
    allFiles.push(...files);
    const content = personalize(step.content);
    for (const match of content.matchAll(/^```([\w-]+)?(?:\s+title="([^"]+)")?\s*\n([\s\S]*?)^```\s*$/gm)) {
      allFiles.push({name: match[2] ?? step.id, language: match[1] ?? "text", code: match[3]});
    }
    const examples = files.map(file => [fencedCode(file), file.curl ? fencedCode({name: `${downloadFilename(file)}.curl.sh`, language: "bash", code: file.curl}) : ""].filter(Boolean).join("\n\n")).join("\n\n");
    return `## ${step.title}\n\n${examples ? `${examples}\n\n` : ""}${content}`;
  });
  const dependencyNotes = exampleReadme(allFiles, sourceUrl).split("## Dependencies referenced by the code")[1]
    .replace("Some imports may refer to your host application or another example in the guide. Resolve any missing modules before running; this archive includes only this example panel.", "Resolve host-specific imports and connect examples from the sections above before running.");
  const configuration = {
    partner: config?.requestedPartner ?? "unknown", chainId: config?.chainId ?? null,
    rpcUrl: "REPLACE_WITH_ACTIVE_CHAIN_RPC", account: "FROM_CONNECTED_WALLET",
    inputToken: {address: "REPLACE", decimals: null}, outputToken: {address: "REPLACE", decimals: null},
    wrappedNativeToken: {address: "REPLACE", decimals: null},
  };
  return [
    `# ${guide.title} — complete integration\n\nSource: ${sourceUrl}`,
    "All instructions and code examples are included in this single document, with the page's applied partner configuration. Code blocks retain their original filenames where provided. This is an integration reference; supply your application's wallet, market data, state, and callbacks before running the examples.",
    "## Setup\n\nFollow the guide below in order. Use the dependency list and configuration template at the end, and consult Shared Reference for chains, units, fees, and wallet actions. Examples may build on earlier snippets or show alternative implementations; do not concatenate their code blocks into one executable module.",
    personalize(guide.intro), personalize(guide.introReference), ...sections,
    "---\n\n# Shared Reference", personalize(sharedMarkdown).replace(/^# .+\n/, ""),
    "# Configuration Template\n\nReplace these placeholders with host configuration and wire them into the examples. Fetch current protocol configuration as directed above; this template does not configure the application automatically.",
    fencedCode({name: "config.example.json", language: "json", code: JSON.stringify(configuration, null, 2)}),
    `# Dependencies and Host Imports\n\nFollow the installation instructions above and use compatible versions from your existing application.\n\n## Dependencies referenced by the code${dependencyNotes}`,
  ].filter(Boolean).join("\n\n") + "\n";
}
