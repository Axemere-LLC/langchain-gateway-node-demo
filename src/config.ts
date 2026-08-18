import { AiGatewayConfig } from "@axemere/gateway";

// [AXEMERE] Workload vs project attribution
// One workload_id identifies "the code-review pipeline" as a call site — it comes
// from AXEMERE_WORKLOAD_ID (a first-class AiGatewayConfig field, already read from
// env by the SDK) and is shared by every agent. Cost/usage attribution instead
// varies per agent role via a distinct project_id per role: projects are both the
// billing/attribution boundary and the credential-scoping boundary on the managed
// gateway, so each reviewer's calls can be billed and credentialed independently.
// Each PROJECT_ID_* falls back to the single AXEMERE_PROJECT_ID if its role-specific
// var is unset, so the demo still runs out-of-the-box with just one project configured.
// Alternatives:
//   A) One workload per role (this demo's previous design) — filterable by role in
//      the console, but conflates "who is calling" with "what should this cost
//      against," and requires N workload registrations instead of one.
//   B) One project for the whole demo — simplest, but all five agents' spend
//      collapses into a single line item with no per-role cost breakdown.
// Docs: https://axemere.ai/docs/guides/configuration/workloads
export function projectIdFor(role: AgentName, config: AiGatewayConfig): string {
  const envVar = `PROJECT_ID_${role.toUpperCase()}`;
  return process.env[envVar] || config.project_id;
}

// [AXEMERE] Provider + model assignment per agent
// Different review dimensions benefit from different model strengths:
//   - Security:    OpenAI gpt-4o — strong reasoning for vulnerability analysis
//   - Performance: OpenAI gpt-4o-mini — cost-effective for pattern recognition
//   - Style:       Groq llama-3.3-70b-versatile — fast, third provider for diversity
//   - Ranker:      OpenAI gpt-4o-mini — lightweight cross-finding prioritization
//   - Synthesizer: Groq llama-3.3-70b-versatile — concise narrative at low cost
//
// Intended production mapping (requires managed gateway or self-hosted with all providers):
//   - Security:    anthropic / claude-3-5-sonnet-20241022
//   - Style:       gemini / gemini-2.5-flash
//   - Synthesizer: anthropic / claude-3-5-haiku-20241022
// Note: The TypeScript SDK sends OpenAI-format messages to all providers.
//   Gemini requires message format translation not yet in the TypeScript SDK v0.1.8
//   (the Python SDK handles this in ChatAiGateway). Use OpenAI-compatible providers
//   (openai, groq, deepseek, together, etc.) until the TypeScript SDK adds format translation.
//
// Alternatives:
//   A) Route all agents to a single provider — simpler ops, but no per-dimension optimization
//   B) Let the gateway policy engine decide routing — use provider: undefined + a routing policy
// Docs: https://axemere.ai/docs/routing
//
// [AXEMERE] max_tokens per agent
// The SDK default of 256 is intentionally conservative and works for short completions.
// Code review agents produce structured JSON with multiple findings, each containing a
// description and a suggestion — easily 800–1500 tokens per agent. Set max_tokens
// explicitly here so the output is never silently truncated mid-JSON.
//   - Reviewer agents (security, performance, style): up to ~10 findings × ~150 tokens
//     each, plus a summary paragraph → 2048 is a safe ceiling.
//   - Ranker: must emit ALL findings from all three reviewers, sorted and annotated
//     → needs the highest budget since input volume is unpredictable.
//   - Synthesizer: one narrative paragraph + a short action-item list → 1024 is enough.
// Tune these down if you are cost-optimizing and your codebase produces fewer findings.
export const AGENT_CONFIGS = {
  security:    { provider: "openai", model: "gpt-4o",                  maxTokens: 2048 },
  performance: { provider: "openai", model: "gpt-4o-mini",             maxTokens: 2048 },
  style:       { provider: "groq",   model: "llama-3.3-70b-versatile", maxTokens: 2048 },
  ranker:      { provider: "openai", model: "gpt-4o-mini",             maxTokens: 4096 },
  synthesizer: { provider: "groq",   model: "llama-3.3-70b-versatile", maxTokens: 1024 },
} as const;

export type AgentName = keyof typeof AGENT_CONFIGS;

export function createGatewayConfig(): AiGatewayConfig {
  return new AiGatewayConfig();
}

// [AXEMERE] run_id format
// Local-time YYYYMMDDHHMMSS instead of a random UUID: sortable lexicographically
// (equals chronological order), human-readable in the console's label filter, and
// doubles as the output directory name. Sub-second collisions aren't a concern for
// this demo's usage pattern (one run at a time, manually triggered).
export function newRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}
