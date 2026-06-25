import { z } from "zod";

// --- Finding schemas ---

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CategorySchema = z.enum(["security", "performance", "style"]);
export type Category = z.infer<typeof CategorySchema>;

export const FindingSchema = z.object({
  title: z.string().describe("Short name for the issue"),
  description: z.string().describe("What the problem is and why it matters"),
  severity: SeveritySchema.describe("How critical this issue is"),
  line_hint: z.string().optional().describe("Line number or range if identifiable, e.g. '12' or '12-15'"),
  suggestion: z.string().describe("Concrete fix or improvement"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewOutputSchema = z.object({
  findings: z.array(FindingSchema).describe("All issues found in this review pass"),
  summary: z.string().describe("One-paragraph overview of this review dimension"),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

export const RankedFindingSchema = FindingSchema.extend({
  rank: z.number().int().positive().describe("Priority rank across all findings (1 = most critical)"),
  category: CategorySchema.describe("Which review dimension surfaced this finding"),
  rationale: z.string().describe("Why this rank was assigned"),
});
export type RankedFinding = z.infer<typeof RankedFindingSchema>;

export const RankerOutputSchema = z.object({
  ranked_findings: z.array(RankedFindingSchema).describe("All findings sorted by priority rank"),
  ranking_notes: z.string().describe("Brief explanation of the ranking strategy applied"),
});
export type RankerOutput = z.infer<typeof RankerOutputSchema>;

export const SynthesisOutputSchema = z.object({
  executive_summary: z.string().describe("2-3 sentence overview for a tech lead"),
  action_items: z.array(
    z.object({
      priority: SeveritySchema,
      action: z.string(),
    })
  ).describe("Ordered action list derived from ranked findings"),
  risk_assessment: z.string().describe("Overall risk level and rationale"),
});
export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// --- Metering ---

export interface AgentMetering {
  agent: string;
  provider: string;
  model: string;
  record_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  latency_ms: number;
}

// --- Pipeline result ---

export interface PipelineResult {
  run_id: string;
  code_input: string;
  security: ReviewOutput;
  performance: ReviewOutput;
  style: ReviewOutput;
  ranked: RankerOutput;
  synthesis: SynthesisOutput;
  metering: AgentMetering[];
  total_cost_usd: string;
  total_tokens_in: number;
  total_tokens_out: number;
  elapsed_ms: number;
}
