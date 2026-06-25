import { ChatPromptTemplate } from "@langchain/core/prompts";
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

Produce:
1. A 2-3 sentence executive summary for a tech lead
2. An ordered list of concrete action items (most critical first)
3. An overall risk assessment`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

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
  const structured = llm.withStructuredOutput(SynthesisOutputSchema);
  const chain = prompt.pipe(structured);
  return chain.invoke({
    ranked_findings: formatRankedFindings(ranked),
    ranking_notes: ranked.ranking_notes,
  }) as Promise<SynthesisOutput>;
}
