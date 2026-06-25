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
//   - Security:    Anthropic claude-3-5-sonnet — strong at nuanced reasoning and attack surface analysis
//   - Performance: OpenAI gpt-4o — good at algorithmic analysis and complexity tradeoffs
//   - Style:       Gemini gemini-2.5-flash — fast and cost-effective for linting-style checks
//   - Ranker:      OpenAI gpt-4o-mini — lightweight cross-finding prioritization
//   - Synthesizer: Anthropic claude-3-5-haiku — concise narrative at low cost
// Alternatives:
//   A) Route all agents to a single provider — simpler ops, but no per-dimension optimization
//   B) Let the gateway policy engine decide routing — use provider: undefined + a routing policy
// Docs: https://axemere.ai/docs/routing
export const AGENT_CONFIGS = {
  security: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  performance: { provider: "openai", model: "gpt-4o" },
  style: { provider: "google", model: "gemini-2.5-flash" },
  ranker: { provider: "openai", model: "gpt-4o-mini" },
  synthesizer: { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
} as const;

export type AgentName = keyof typeof AGENT_CONFIGS;

export function createGatewayConfig(): AiGatewayConfig {
  return new AiGatewayConfig();
}

export function newRunId(): string {
  // Short ID that tags all gateway records from a single pipeline run.
  return crypto.randomUUID().slice(0, 8);
}
