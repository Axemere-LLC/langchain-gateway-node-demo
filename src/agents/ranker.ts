import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAiGateway } from "../llm.js";
import {
  RankerOutputSchema,
  type RankerOutput,
  type ReviewOutput,
} from "../types.js";

const SYSTEM = `You are a senior engineering lead prioritizing code review findings across security, performance, and style dimensions.

Your job is to assign a unified priority rank to every finding from all three review passes.
Rank 1 is the most critical issue that must be fixed first.

Ranking principles:
1. Security vulnerabilities with direct exploit paths always rank above performance or style issues
2. Performance issues that cause production outages or data loss rank above cosmetic style concerns
3. Within each severity tier, rank by blast radius — how many users or systems are affected?
4. When severity is equal, prefer actionable findings over vague ones
5. Never skip or merge findings — every input finding must appear in the output with a rank

Produce a flat ranked list across all categories. Include all findings from all three reviews.`;

const HUMAN = `Rank and prioritize these findings from a multi-pass code review.

## Security findings
{security_findings}

## Performance findings
{performance_findings}

## Style findings
{style_findings}

Assign a unique rank to every finding (1 = highest priority). Return the complete ranked list.

Respond with a JSON object matching exactly this structure (no markdown, no extra keys):
{{
  "ranked_findings": [
    {{
      "title": "finding title",
      "description": "what the problem is",
      "severity": "critical" | "high" | "medium" | "low",
      "line_hint": "line number if known (omit if not)",
      "suggestion": "concrete fix",
      "rank": 1,
      "category": "security" | "performance" | "style",
      "rationale": "why this rank was assigned"
    }}
  ],
  "ranking_notes": "brief explanation of the ranking strategy applied"
}}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

const parser = new JsonOutputParser<RankerOutput>();

function formatFindings(review: ReviewOutput): string {
  if (review.findings.length === 0) return "No findings.";
  return review.findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   ${f.description}\n   Suggestion: ${f.suggestion}${f.line_hint ? `\n   Line: ${f.line_hint}` : ""}`
    )
    .join("\n\n");
}

export async function runRanker(
  llm: ChatAiGateway,
  security: ReviewOutput,
  performance: ReviewOutput,
  style: ReviewOutput
): Promise<RankerOutput> {
  const chain = prompt.pipe(llm).pipe(parser);
  const raw = await chain.invoke({
    security_findings: formatFindings(security),
    performance_findings: formatFindings(performance),
    style_findings: formatFindings(style),
  });
  return RankerOutputSchema.parse(raw);
}
