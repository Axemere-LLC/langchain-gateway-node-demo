# Agents

Reference for each of the five agents in the code review pipeline: purpose, provider, model, project ID, prompt strategy, and output schema.

Related: [architecture.md](architecture.md) | [gateway-integration.md](gateway-integration.md) | [glossary.md](glossary.md)

## Table of Contents

- [Workload and Project IDs](#workload-and-project-ids)
- [Structured Output Approach](#structured-output-approach)
- [Shared Schemas](#shared-schemas)
- [SecurityReviewer](#securityreviewer)
- [PerformanceReviewer](#performancereviewer)
- [StyleReviewer](#stylereviewer)
- [Ranker](#ranker)
- [Synthesizer](#synthesizer)

## Workload and Project IDs

All five agents share one [Workload ID](glossary.md#workload-id) (`AXEMERE_WORKLOAD_ID`) — it identifies "the code-review pipeline" as a single call site. Attribution granularity instead comes from a distinct [Project ID](glossary.md#project-id) per agent role, so each agent's cost is broken out separately in the console and can be pointed at different provider credentials:

| Agent | Project ID env var |
|-------|---------------------|
| SecurityReviewer | `PROJECT_ID_SECURITY` |
| PerformanceReviewer | `PROJECT_ID_PERFORMANCE` |
| StyleReviewer | `PROJECT_ID_STYLE` |
| Ranker | `PROJECT_ID_RANKER` |
| Synthesizer | `PROJECT_ID_SYNTHESIZER` |

Each falls back to `AXEMERE_PROJECT_ID` when unset. See `projectIdFor()` in `src/config.ts` and the `[AXEMERE] Workload vs project attribution` comment there for the rationale.

## Structured Output Approach

All five agents use the same pattern for [structured output](glossary.md#structured-output):

```
ChatPromptTemplate → ChatAiGateway → JsonOutputParser → Zod.parse()
```

The human prompt includes an explicit JSON schema in plain text, instructing the model to respond with a JSON object matching that structure and nothing else (no markdown fences, no extra keys).

`JsonOutputParser` extracts the JSON from the raw model response text. The result is then passed through `Zod.parse()` for strict runtime validation.

This approach is preferred over LangChain's `withStructuredOutput()` because `withStructuredOutput()` requires `bindTools()`, which is provider-specific. The `JsonOutputParser` + Zod approach works with any text-generating model routed through the [Gateway](glossary.md#gateway) without provider-specific adaptation.

```typescript
// Pattern used by every agent (example: SecurityReviewer)
const parser = new JsonOutputParser<ReviewOutput>();
const chain = prompt.pipe(llm).pipe(parser);
const raw = await chain.invoke({ code });
return ReviewOutputSchema.parse(raw); // Zod runtime validation
```

## Shared Schemas

The following Zod schemas from `src/types.ts` are shared across multiple agents.

### Severity

```typescript
export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
```

See [Severity](glossary.md#severity) in the glossary.

### Finding

Used by all three reviewer agents:

```typescript
export const FindingSchema = z.object({
  title:       z.string().describe("Short name for the issue"),
  description: z.string().describe("What the problem is and why it matters"),
  severity:    SeveritySchema.describe("How critical this issue is"),
  line_hint:   z.string().optional()
                 .describe("Line number or range if identifiable, e.g. '12' or '12-15'"),
  suggestion:  z.string().describe("Concrete fix or improvement"),
});
```

### ReviewOutput

Returned by each of the three reviewer agents:

```typescript
export const ReviewOutputSchema = z.object({
  findings: z.array(FindingSchema)
              .describe("All issues found in this review pass"),
  summary:  z.string()
              .describe("One-paragraph overview of this review dimension"),
});
```

## SecurityReviewer

**Purpose:** Identify vulnerabilities, unsafe patterns, and security risks in the code under review.

**Provider:** `openai`
**Model:** `gpt-4o`
**Project ID env var:** `PROJECT_ID_SECURITY`
**Source:** `src/agents/security.ts`

**Intended production mapping:** `anthropic` / `claude-3-5-sonnet-20241022`

### Focus Areas

The system prompt directs the agent to examine:

- Injection vulnerabilities (SQL, command, XSS, SSTI)
- Authentication and authorization flaws
- Insecure deserialization or data handling
- Secrets or credentials embedded in code
- Unsafe use of cryptography
- Input validation gaps at trust boundaries
- Denial-of-service risks
- Dependency or supply-chain concerns

### Output Schema

`ReviewOutputSchema` — see [Shared Schemas](#shared-schemas) above.

## PerformanceReviewer

**Purpose:** Identify inefficiencies, bottlenecks, and patterns that degrade runtime performance or resource consumption.

**Provider:** `openai`
**Model:** `gpt-4o-mini`
**Project ID env var:** `PROJECT_ID_PERFORMANCE`
**Source:** `src/agents/performance.ts`

### Output Schema

`ReviewOutputSchema` — see [Shared Schemas](#shared-schemas) above.

## StyleReviewer

**Purpose:** Identify readability problems, naming inconsistencies, structural anti-patterns, and deviations from established conventions.

**Provider:** `groq`
**Model:** `llama-3.3-70b-versatile`
**Project ID env var:** `PROJECT_ID_STYLE`
**Source:** `src/agents/style.ts`

**Intended production mapping:** `gemini` / `gemini-2.5-flash`

Note: Gemini requires a different message format (`contents` / `generationConfig`) than the OpenAI-compatible format sent by the TypeScript SDK v0.1.6. Use an OpenAI-compatible provider (openai, groq, deepseek, etc.) until a future SDK version adds format translation. See [gateway-integration.md — Known Limitations](gateway-integration.md#known-limitations).

### Output Schema

`ReviewOutputSchema` — see [Shared Schemas](#shared-schemas) above.

## Ranker

**Purpose:** Cross-dimension prioritization. Takes all [findings](glossary.md#findings) from the three reviewer agents and assigns a global priority rank to each (rank 1 = most critical overall). A critical security vulnerability should outrank a low-severity style issue regardless of which agent surfaced it.

**Provider:** `openai`
**Model:** `gpt-4o-mini`
**Project ID env var:** `PROJECT_ID_RANKER`
**Source:** `src/agents/ranker.ts`

### Output Schema

```typescript
export const RankedFindingSchema = FindingSchema.extend({
  rank:      z.number().int().positive()
               .describe("Priority rank across all findings (1 = most critical)"),
  category:  CategorySchema
               .describe("Which review dimension surfaced this finding"),
  rationale: z.string()
               .describe("Why this rank was assigned"),
});

export const RankerOutputSchema = z.object({
  ranked_findings: z.array(RankedFindingSchema)
                     .describe("All findings sorted by priority rank"),
  ranking_notes:   z.string()
                     .describe("Brief explanation of the ranking strategy applied"),
});
```

Where `CategorySchema` is:

```typescript
export const CategorySchema = z.enum(["security", "performance", "style"]);
```

## Synthesizer

**Purpose:** Produce an executive-level summary and action plan from the ranked findings. The output is written for a tech lead audience and focuses on overall risk and prioritized next steps.

**Provider:** `groq`
**Model:** `llama-3.3-70b-versatile`
**Project ID env var:** `PROJECT_ID_SYNTHESIZER`
**Source:** `src/agents/synthesizer.ts`

**Intended production mapping:** `anthropic` / `claude-3-5-haiku-20241022`

### Output Schema

```typescript
export const SynthesisOutputSchema = z.object({
  executive_summary: z.string()
                       .describe("2-3 sentence overview for a tech lead"),
  action_items:      z.array(
                       z.object({
                         priority: SeveritySchema,
                         action:   z.string(),
                       })
                     ).describe("Ordered action list derived from ranked findings"),
  risk_assessment:   z.string()
                       .describe("Overall risk level and rationale"),
});
```
