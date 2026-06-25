import { ChatPromptTemplate } from "@langchain/core/prompts";
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

Return your findings in the required structured format.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM],
  ["human", HUMAN],
]);

export async function runSecurityReview(
  llm: ChatAiGateway,
  code: string
): Promise<ReviewOutput> {
  // [AXEMERE] withStructuredOutput + Zod
  // LangChain uses the Zod schema to instruct the model to return JSON
  // matching the schema, then validates and parses it. The underlying
  // gateway call still flows through ChatAiGateway._generate() so metering
  // is captured on llm.lastMetering after this call returns.
  const structured = llm.withStructuredOutput(ReviewOutputSchema);
  const chain = prompt.pipe(structured);
  return chain.invoke({ code }) as Promise<ReviewOutput>;
}
