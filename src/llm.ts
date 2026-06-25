import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import type { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AiGatewayClient, AiGatewayConfig, type Metering, type Message as GatewayMessage } from "@axemere/gateway";

// [AXEMERE] Custom LangChain chat model
// Wraps AiGatewayClient.execute() as a LangChain BaseChatModel so we can use
// LCEL chains, structured output (withStructuredOutput + Zod), and prompt templates
// while keeping full metering data from every gateway call.
//
// Alternatives:
//   A) Proxy mode: point ChatOpenAI at cfg.proxyUrl("openai") — zero custom code,
//      but metering lives in response headers, not in the chain result
//   B) LangChain callbacks: capture metering in handleLLMEnd — works but requires
//      a stateful callback instance threaded through every chain
// We chose direct wrapping because metering is a first-class demo concern.
// Docs: https://axemere.ai/docs/sdk/typescript

export interface ChatAiGatewayParams extends BaseChatModelParams {
  config: AiGatewayConfig;
  provider: string;
  model: string;
  workloadId: string;
  labels?: Record<string, string>;
  maxTokens?: number;
}

export class ChatAiGateway extends BaseChatModel {
  private client: AiGatewayClient;
  private provider: string;
  private model_: string;
  private workloadId: string;
  private labels: Record<string, string>;
  private maxTokens: number;

  // Side-channel metering: populated after each _generate() call.
  // Safe because each agent owns its own ChatAiGateway instance (no concurrent sharing).
  lastMetering: Metering | null = null;
  lastRecordId: string | null = null;
  lastProvider: string | null = null;
  lastModel: string | null = null;

  constructor(params: ChatAiGatewayParams) {
    super(params);
    this.client = new AiGatewayClient(params.config);
    this.provider = params.provider;
    this.model_ = params.model;
    this.workloadId = params.workloadId;
    this.labels = params.labels ?? {};
    this.maxTokens = params.maxTokens ?? 4096;
  }

  _llmType(): string {
    return "axemere-gateway";
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const gatewayMessages: GatewayMessage[] = messages.map((m) => ({
      role: roleFor(m),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const response = await this.client.execute({
      messages: gatewayMessages,
      provider: this.provider,
      model: this.model_,
      workload_id: this.workloadId,
      labels: this.labels,
      max_tokens: this.maxTokens,
    });

    this.lastMetering = response.metering;
    this.lastRecordId = response.record_id;
    this.lastProvider = response.provider;
    this.lastModel = response.model;

    const generation: ChatGeneration = {
      message: new AIMessage(response.content),
      text: response.content,
      generationInfo: {
        record_id: response.record_id,
        metering: response.metering,
        provider: response.provider,
        model: response.model,
      },
    };

    return {
      generations: [generation],
      llmOutput: {
        record_id: response.record_id,
        metering: response.metering,
      },
    };
  }
}

function roleFor(message: BaseMessage): GatewayMessage["role"] {
  const type = message._getType();
  if (type === "human") return "user";
  if (type === "ai") return "assistant";
  if (type === "system") return "system";
  return "user";
}
