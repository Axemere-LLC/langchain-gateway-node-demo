import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAiGateway } from "../llm.js";
import { ReviewOutputSchema, type ReviewOutput } from "../types.js";

const SYSTEM = `You are an expert software engineer specializing in performance optimization.
Your job is to identify inefficiencies, scalability bottlenecks, and resource waste.

Focus on:
- Algorithmic complexity (O(n²) loops, redundant traversals)
- Unnecessary allocations or copies
- N+1 query patterns or missing batching
- Blocking I/O where async would help
- Missing caching for expensive repeated computations
- Memory leaks or unbounded growth
- Inefficient data structure choices
- Cold path code that executes on every hot-path call

Be specific about expected impact. Only report issues with meaningful performance consequence.`;

const HUMAN = `Review the following code for performance issues:

\`\`\`
{code}
\`\`\`

Respond with a JSON object matching exactly this structure (no markdown, no extra keys):
{{
  "findings": [
    {{
      "title": "short issue name",
      "description": "what the problem is and why it matters",
      "severity": "critical" | "high" | "medium" | "low",
      "line_hint": "line number or range, e.g. '12' or '12-15' (omit if unknown)",
      "suggestion": "concrete fix or improvement"
    }}
  ],
  "summary": "one-paragraph overview of this performance review"
}}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

const parser = new JsonOutputParser<ReviewOutput>();

export async function runPerformanceReview(
  llm: ChatAiGateway,
  code: string
): Promise<ReviewOutput> {
  const chain = prompt.pipe(llm).pipe(parser);
  const raw = await chain.invoke({ code });
  return ReviewOutputSchema.parse(raw);
}
