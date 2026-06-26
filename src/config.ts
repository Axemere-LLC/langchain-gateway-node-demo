import { AiGatewayConfig } from "@axemere/gateway";

// [AXEMERE] Workload IDs
// Each logical role in the pipeline gets its own workload_id so gateway records
// are filterable by role (e.g. "show me all security-reviewer calls this week").
// Workloads are registered in the Axemere console under your project.
export const WORKLOAD_SECURITY = "code-review-security";
export const WORKLOAD_PERFORMANCE = "code-review-performance";
export const WORKLOAD_STYLE = "code-review-style";
export const WORKLOAD_RANKER = "code-review-ranker";
export const WORKLOAD_SYNTHESIZER = "code-review-synthesizer";

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

export function newRunId(): string {
  // Short ID that tags all gateway records from a single pipeline run.
  return crypto.randomUUID().slice(0, 8);
}
