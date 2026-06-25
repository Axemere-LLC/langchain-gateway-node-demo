import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAiGateway } from "../llm.js";
import { SynthesisOutputSchema, type SynthesisOutput, type RankerOutput } from "../types.js";

const SYSTEM = `You are a senior engineering lead writing a concise code review summary for a tech lead.
Your output will be the top section of a code review report.

Be direct. The reader is technical and time-constrained. Use plain language.
Focus on what to do, in what order, and why it matters.`;

const HUMAN = `Synthesize the following prioritized code review findings into an executive summary and action plan.

## Ranked findings (rank 1 = most critical)
{ranked_findings}

## Ranking notes from the ranker
{ranking_notes}

Respond with a JSON object matching exactly this structure (no markdown, no extra keys):
{{
  "executive_summary": "2-3 sentence overview for a tech lead",
  "action_items": [
    {{
      "priority": "critical" | "high" | "medium" | "low",
      "action": "concrete action to take"
    }}
  ],
  "risk_assessment": "overall risk level and rationale"
}}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

const parser = new JsonOutputParser<SynthesisOutput>();

function formatRankedFindings(output: RankerOutput): string {
  return output.ranked_findings
    .map(
      (f) =>
        `#${f.rank} [${f.severity.toUpperCase()}] [${f.category}] ${f.title}\n   ${f.description}\n   Fix: ${f.suggestion}${f.line_hint ? ` (line ${f.line_hint})` : ""}\n   Rationale: ${f.rationale}`
    )
    .join("\n\n");
}

export async function runSynthesizer(
  llm: ChatAiGateway,
  ranked: RankerOutput
): Promise<SynthesisOutput> {
  const chain = prompt.pipe(llm).pipe(parser);
  const raw = await chain.invoke({
    ranked_findings: formatRankedFindings(ranked),
    ranking_notes: ranked.ranking_notes,
  });
  return SynthesisOutputSchema.parse(raw);
}
