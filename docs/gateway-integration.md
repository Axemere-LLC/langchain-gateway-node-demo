# Gateway Integration

How this project integrates with the Axemere Gateway: the two available patterns, how the custom `ChatAiGateway` class works, metering, environment variables, known limitations, and a comparison to the Python SDK approach.

Related: [architecture.md](architecture.md) | [glossary.md](glossary.md)

## Table of Contents

- [What the Gateway Does](#what-the-gateway-does)
- [Integration Paths](#integration-paths)
  - [Explicit Mode — ChatAiGateway](#explicit-mode--chataigateway)
  - [Proxy Mode — ChatOpenAI](#proxy-mode--chatopenai)
  - [Comparison](#comparison)
- [How AiGatewayClient.execute() Works](#how-aigatewayclientexecute-works)
- [Console Deep-Link Pattern](#console-deep-link-pattern)
- [Metering](#metering)
- [Environment Variables](#environment-variables)
- [Known Limitations](#known-limitations)
- [Comparison to the Python SDK](#comparison-to-the-python-sdk)

## What the Gateway Does

The Axemere [Gateway](glossary.md#gateway) is a managed or self-hosted proxy that sits between your application and upstream LLM [providers](glossary.md#provider) (OpenAI, Groq, Anthropic, Gemini, etc.). Responsibilities:

- **Credential management** — your application presents a single gateway token; provider API keys are stored in the gateway, not in your environment.
- **Routing** — the application specifies `provider` and `model`; the gateway resolves the upstream request.
- **Policy enforcement** — rate limiting, model allow-lists, cost caps, and routing policies can be applied per workload.
- **Observability** — every call is recorded with full request/response content, token counts, cost, latency, labels, and a unique [Record ID](glossary.md#record-id).

## Integration Paths

The TypeScript SDK (`@axemere/gateway` v0.1.8) supports two integration patterns.

### Explicit Mode — ChatAiGateway

The application wraps `AiGatewayClient.execute()` inside a custom LangChain `BaseChatModel` subclass called `ChatAiGateway` (defined in `src/llm.ts`). Each call specifies `provider`, `model`, `workload_id`, `project_id`, and `labels` explicitly. The gateway returns both the completion content and full [metering](glossary.md#metering) in the response body.

This is the pattern used in this project. It is preferred here because metering is a first-class demo concern and must be available inline in the chain result.

```typescript
export class ChatAiGateway extends BaseChatModel {
  async _generate(messages, _options, _runManager): Promise<ChatResult> {
    const response = await this.client.execute({
      messages: gatewayMessages,
      provider: this.provider,
      model:    this.model_,
      workload_id: this.workloadId,
      project_id:  this.projectId,
      labels:   this.labels,
      max_tokens: this.maxTokens,
    });

    // Metering captured as side-channel fields for use by pipeline.ts
    this.lastMetering  = response.metering;
    this.lastRecordId  = response.record_id;
    this.lastProvider  = response.provider;
    this.lastModel     = response.model;

    return { generations: [{ message: new AIMessage(response.content), ... }] };
  }
}
```

### Proxy Mode — ChatOpenAI

Alternatively, point any standard LangChain chat model at the gateway's OpenAI-compatible proxy URL:

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AiGatewayConfig } from "@axemere/gateway";

const cfg = new AiGatewayConfig();
const llm = new ChatOpenAI({
  openAIApiKey: process.env.AXEMERE_GATEWAY_TOKEN,
  configuration: { baseURL: cfg.proxyUrl("openai") },
  model: "gpt-4o",
});
```

No custom class is needed. The gateway intercepts the request, records it, and forwards it to the upstream provider. Metering is available in response headers rather than in the chain result, so capturing it requires either a LangChain callback or post-hoc API queries.

### Comparison

| Concern | Explicit Mode (ChatAiGateway) | Proxy Mode (ChatOpenAI) |
|---------|-------------------------------|-------------------------|
| Custom code | `ChatAiGateway` wrapper (~80 lines) | None |
| Metering in chain | Yes — `response.metering` | No — headers only |
| Workload ID per call | Yes — set per instance | Requires custom header |
| Labels per call | Yes — set per instance | Requires custom header |
| Multi-provider | Any provider the gateway supports | Provider-specific class per provider |
| Provider format translation | In the SDK | Not needed (always OpenAI format) |

## How AiGatewayClient.execute() Works

`AiGatewayClient` is instantiated from `AiGatewayConfig`, which reads credentials from environment variables. The `execute()` method sends a single HTTP request to the gateway:

**Request fields:**

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `Message[]` | OpenAI-format message array (`role` + `content`) |
| `provider` | `string` | Target provider (e.g., `"openai"`, `"groq"`) |
| `model` | `string` | Model identifier within that provider |
| `workload_id` | `string` | [Workload ID](glossary.md#workload-id) for this call — one shared value for the whole pipeline |
| `project_id` | `string` | [Project ID](glossary.md#project-id) for this call — varies per agent role; see `projectIdFor()` in `src/config.ts` |
| `labels` | `Record<string, string>` | Arbitrary key-value labels attached to the gateway record |
| `max_tokens` | `number` | Maximum completion tokens (optional — defaults to `256` if omitted) |

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | The model's completion text |
| `record_id` | `string` | Unique [Record ID](glossary.md#record-id) for this gateway call |
| `metering` | `Metering` | Token counts and cost — see [Metering](#metering) below |
| `provider` | `string` | Actual provider used (may differ if the gateway applied routing policy) |
| `model` | `string` | Actual model used |

## Console Deep-Link Pattern

Every gateway record is tagged with the labels passed to `execute()`. The Axemere console Records page accepts `label_key` and `label_value` query parameters to pre-filter the view:

```
https://console.axemere.ai/records?label_key=run_id&label_value=20260818145233
```

This demo uses `run_id` as the label key, but the pattern works for any label you define — `environment`, `customer_id`, `feature_flag`, etc. The HTML report links the run ID in its header directly to this URL, so readers can jump from the report to the full gateway trace in one click.

See the [example report](https://axemere-llc.github.io/langchain-gateway-node-demo/examples/sample-vulnerable/report.html) for a live demonstration.

## Metering

The `Metering` object returned by every `execute()` call:

| Field | Type | Description |
|-------|------|-------------|
| `tokens_in` | `number` | Prompt token count |
| `tokens_out` | `number` | Completion token count |
| `cost_usd` | `string` | Estimated cost in USD as a decimal string |

In `pipeline.ts`, metering is read from `ChatAiGateway` instance fields after each call and stored in an `AgentMetering` record:

```typescript
function captureMetering(llm: ChatAiGateway, agent: string, startMs: number): AgentMetering {
  return {
    agent,
    provider:   llm.lastProvider ?? "unknown",
    model:      llm.lastModel    ?? "unknown",
    record_id:  llm.lastRecordId ?? "",
    tokens_in:  llm.lastMetering?.tokens_in  ?? 0,
    tokens_out: llm.lastMetering?.tokens_out ?? 0,
    cost_usd:   llm.lastMetering?.cost_usd   ?? "0",
    latency_ms: Date.now() - startMs,
  };
}
```

The pipeline aggregates all five `AgentMetering` records into `total_cost_usd`, `total_tokens_in`, and `total_tokens_out` in `PipelineResult`.

See [docs/architecture.md — Metering](architecture.md#metering) for how per-run aggregation works.

## Environment Variables

Copy `.env.example` to `.env` and fill in values before running the pipeline.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AXEMERE_GATEWAY_TOKEN` | Yes | — | Your gateway token from [console.axemere.ai](https://console.axemere.ai) |
| `AXEMERE_PROJECT_ID` | Yes | — | Fallback [project ID](glossary.md#project-id) used by any agent role without its own `PROJECT_ID_*` override |
| `AXEMERE_WORKLOAD_ID` | No | — | [Workload ID](glossary.md#workload-id) shared by every agent in the pipeline |
| `PROJECT_ID_SECURITY` | No | `AXEMERE_PROJECT_ID` | Project for the SecurityReviewer |
| `PROJECT_ID_PERFORMANCE` | No | `AXEMERE_PROJECT_ID` | Project for the PerformanceReviewer |
| `PROJECT_ID_STYLE` | No | `AXEMERE_PROJECT_ID` | Project for the StyleReviewer |
| `PROJECT_ID_RANKER` | No | `AXEMERE_PROJECT_ID` | Project for the Ranker |
| `PROJECT_ID_SYNTHESIZER` | No | `AXEMERE_PROJECT_ID` | Project for the Synthesizer |
| `AXEMERE_GATEWAY_URL` | No | `http://localhost:7080` | Gateway base URL. Omit for local Docker gateway; set to `https://us.gw.axemere.ai` for the managed cloud gateway. |
| `AXEMERE_PROVIDER` | No | — | Optional default provider override |
| `AXEMERE_MODEL` | No | — | Optional default model override |

Example `.env`:

```bash
AXEMERE_GATEWAY_TOKEN=your-gateway-token-here
AXEMERE_PROJECT_ID=your-project-id-here
AXEMERE_GATEWAY_URL=https://us.gw.axemere.ai
```

For a self-hosted or local Docker gateway:

```bash
AXEMERE_GATEWAY_URL=http://localhost:7080
```

## Known Limitations

### Gemini requires a different message format

The TypeScript SDK v0.1.6 sends OpenAI-format `messages` arrays to all providers. Gemini's API uses a different format (`contents` / `generationConfig`). Until the TypeScript SDK adds format translation, use OpenAI-compatible providers: `openai`, `groq`, `deepseek`, `together`, etc.

The intended production mapping for the StyleReviewer (`gemini` / `gemini-2.5-flash`) and others requires either the Python SDK (which handles format translation in `ChatAiGateway`) or a future TypeScript SDK version.

## Comparison to the Python SDK

| Behavior | TypeScript SDK v0.1.8 | Python SDK |
|----------|----------------------|------------|
| Default gateway URL | `localhost:7080` | `localhost:7080` |
| Gemini message format translation | Not supported | Supported in `ChatAiGateway` |
| `max_tokens` default | `256` (SDK default as of v0.1.8) | `256` (SDK default) |
| Metering location | Response body (`response.metering`) | Response body (same) |
| LangChain integration | Custom `BaseChatModel` subclass | Custom `BaseChatModel` subclass |
| Structured output strategy | `JsonOutputParser` + Zod | `JsonOutputParser` + Pydantic |

The architectural approach is identical between the two SDKs: a custom `ChatAiGateway` class wraps `AiGatewayClient.execute()` and returns metering alongside content. The primary differences are format translation support and the default gateway URL behavior.
