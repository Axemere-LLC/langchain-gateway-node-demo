import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAiGateway } from "../llm.js";
import { ReviewOutputSchema, type ReviewOutput } from "../types.js";

const SYSTEM = `You are an expert security engineer performing a code security review.
Your job is to identify vulnerabilities, unsafe patterns, and security risks.

Focus on:
- Injection vulnerabilities (SQL, command, XSS, SSTI)
- Authentication and authorization flaws
- Insecure deserialization or data handling
- Secrets or credentials in code
- Unsafe use of cryptography
- Input validation gaps at trust boundaries
- Denial-of-service risks
- Dependency or supply-chain concerns

Be precise. Only report genuine issues — avoid false positives.
For each finding, provide a concrete, actionable suggestion.`;

const HUMAN = `Review the following code for security vulnerabilities:

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
  "summary": "one-paragraph overview of this security review"
}}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

// [AXEMERE] Structured output via JsonOutputParser + Zod
// We use JsonOutputParser (text → JSON) then Zod validation rather than
// withStructuredOutput() because withStructuredOutput() requires bindTools(),
// which is provider-specific. This approach works with any text-generating
// model routed through the gateway — the format instructions in the human
// message tell the model exactly what JSON to produce.
// Docs: https://axemere.ai/docs/sdk/typescript
const parser = new JsonOutputParser<ReviewOutput>();

export async function runSecurityReview(
  llm: ChatAiGateway,
  code: string
): Promise<ReviewOutput> {
  const chain = prompt.pipe(llm).pipe(parser);
  const raw = await chain.invoke({ code });
  return ReviewOutputSchema.parse(raw);
}
