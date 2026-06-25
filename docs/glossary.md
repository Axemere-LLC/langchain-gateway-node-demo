# Glossary

Domain terms used across this codebase and its documentation.

## Table of Contents

- [Findings](#findings)
- [Gateway](#gateway)
- [LCEL](#lcel)
- [Metering](#metering)
- [Explicit Mode](#explicit-mode)
- [Project ID](#project-id)
- [Provider](#provider)
- [Proxy Mode](#proxy-mode)
- [Ranker](#ranker)
- [Record ID](#record-id)
- [Run ID](#run-id)
- [Severity](#severity)
- [Structured Output](#structured-output)
- [Workload ID](#workload-id)

---

### Findings

Individual issues identified by a reviewer agent in the code under analysis. Each finding has a `title`, `description`, `severity`, an optional `line_hint`, and a `suggestion` for remediation. Raw findings are produced by the SecurityReviewer, PerformanceReviewer, and StyleReviewer; the Ranker assigns a cross-dimension priority rank to each.

See: [docs/agents.md](agents.md)

---

### Gateway

The Axemere Gateway — a managed or self-hosted proxy that sits between your application and upstream LLM providers (OpenAI, Anthropic, Groq, Gemini, etc.). It handles credential management, routing, policy enforcement, and records every call with full metering. Your application presents a single gateway token regardless of which providers are in use.

See: [docs/gateway-integration.md](gateway-integration.md)

---

### LCEL

LangChain Expression Language. A composable, pipe-based syntax for building chains in LangChain.js. A chain is constructed by piping components together with `.pipe()`:

```typescript
const chain = prompt.pipe(llm).pipe(parser);
```

Each component receives the output of the previous one. LCEL chains are lazy; execution is deferred until `.invoke()` is called.

---

### Metering

Usage data returned by the Gateway alongside every LLM response. In this SDK the `Metering` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `tokens_in` | `number` | Prompt tokens consumed |
| `tokens_out` | `number` | Completion tokens generated |
| `cost_usd` | `string` | Estimated cost in USD for this call |

Metering is available per-call via `ChatAiGateway.lastMetering` and is aggregated across all agents in the `PipelineResult`.

See: [docs/gateway-integration.md](gateway-integration.md#metering)

---

### Explicit Mode

The integration pattern where the application calls `AiGatewayClient.execute()` directly (wrapped here inside `ChatAiGateway`). The application specifies `provider`, `model`, `workload_id`, and `labels` explicitly per call. Metering is returned in the response body and is immediately available in the chain result.

Contrast with [Proxy Mode](#proxy-mode).

See: [docs/gateway-integration.md](gateway-integration.md#integration-paths)

---

### Project ID

A unique identifier for a project registered in the Axemere console. Set via `AXEMERE_PROJECT_ID`. All gateway records are attributed to this project, enabling cost tracking and workload management at the project level.

---

### Provider

An upstream LLM service routed through the Gateway. Examples: `openai`, `groq`, `anthropic`, `gemini`, `deepseek`. The provider name is passed to `AiGatewayClient.execute()` and determines which upstream API the Gateway calls on your behalf.

See: [docs/gateway-integration.md](gateway-integration.md)

---

### Proxy Mode

An alternative integration pattern where a standard LangChain chat model (e.g., `ChatOpenAI`) is pointed at the Gateway's OpenAI-compatible proxy URL instead of the real OpenAI endpoint. No custom `ChatAiGateway` class is needed; the gateway intercepts the call. Metering data is available in response headers rather than in the chain result.

Contrast with [Explicit Mode](#explicit-mode).

See: [docs/gateway-integration.md](gateway-integration.md#integration-paths)

---

### Ranker

The fourth agent in the pipeline. It receives the raw findings from all three reviewer agents and assigns a cross-dimension priority `rank` to each (rank 1 = most critical overall). The Ranker evaluates findings across security, performance, and style dimensions together so that a critical security vulnerability outranks a minor style issue regardless of which agent surfaced it.

See: [docs/agents.md](agents.md#ranker)

---

### Record ID

A unique identifier assigned by the Gateway to each individual LLM call. Returned in the response as `record_id`. Can be used to look up the exact request, response, and metering for that call in the Axemere console or API. In this pipeline each of the five agents produces one record per run.

---

### Run ID

An 8-character identifier generated at the start of each pipeline execution (a prefix of a UUID v4). It is attached to every gateway record for that run as the `run_id` label, making the full set of five calls queryable together:

```
GET /v1/records?label.run_id=<run_id>
```

The run ID also appears in console log lines for easy correlation during debugging.

See: [docs/architecture.md](architecture.md#run-id-label-strategy)

---

### Severity

A categorical priority assigned to each finding by the reviewing agent. Valid values:

| Value | Meaning |
|-------|---------|
| `critical` | Immediate action required; high exploitability or data loss risk |
| `high` | Should be fixed before next release |
| `medium` | Should be addressed in normal development flow |
| `low` | Minor improvement; fix when convenient |

Severity is set by the individual reviewer agents. The [Ranker](#ranker) then assigns a cross-dimension `rank` that can reorder findings across severity levels.

---

### Structured Output

A technique for constraining an LLM to produce a specific JSON schema rather than free-form prose. In this project, structured output is implemented using `JsonOutputParser` (which extracts JSON from the model response text) followed by Zod schema validation. This approach is provider-agnostic because it relies on prompt instructions rather than provider-specific tool-calling APIs.

See: [docs/agents.md](agents.md#structured-output-approach)

---

### Workload ID

A string identifier that categorizes a gateway call by its logical role within a project. Workloads are registered in the Axemere console and enable filtering, cost attribution, and policy enforcement at the role level. For example, all calls made by the SecurityReviewer carry `workload_id: "code-review-security"`.

See: [docs/agents.md](agents.md#workload-ids)
