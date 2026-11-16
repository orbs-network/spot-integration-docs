export type IntegrationAgent = "codex" | "claude";

// Codex composer: https://learn.chatgpt.com/docs/reference/commands#deep-links
// Claude's own prompt buttons: https://academy.claude.com/tutorials/prompting-strategies-for-financial-analysis
/** Prefill the selected agent's composer without sending the prompt. */
export function createIntegrationAgentHref(
  agent: IntegrationAgent,
  prompt: string,
): string {
  const encodedPrompt = encodeURIComponent(prompt);
  return agent === "codex"
    ? `codex://new?prompt=${encodedPrompt}`
    : `https://claude.ai/new?q=${encodedPrompt}`;
}
