import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAiGateway } from "../llm.js";
import { ReviewOutputSchema, type ReviewOutput } from "../types.js";

const SYSTEM = `You are a senior software engineer reviewing code for style, maintainability, and correctness.
Your job is to identify issues that make code harder to understand, test, or extend.

Focus on:
- Naming clarity (variables, functions, types)
- Function length and single-responsibility violations
- Code duplication that should be abstracted
- Missing or misleading comments on non-obvious logic
- Error handling gaps (swallowed exceptions, missing edge cases)
- TypeScript-specific: missing types, use of \`any\`, weak type assertions
- Inconsistency with surrounding code patterns
- Dead code or unreachable branches

Severity guide for style issues:
- critical/high: correctness bugs masquerading as style (swallowed errors, wrong logic)
- medium: maintainability issues that will cause problems as the code grows
- low: purely cosmetic or preference-level feedback`;

const HUMAN = `Review the following code for style and maintainability issues:

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
  "summary": "one-paragraph overview of this style review"
}}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

const parser = new JsonOutputParser<ReviewOutput>();

export async function runStyleReview(
  llm: ChatAiGateway,
  code: string
): Promise<ReviewOutput> {
  const chain = prompt.pipe(llm).pipe(parser);
  const raw = await chain.invoke({ code });
  return ReviewOutputSchema.parse(raw);
}
