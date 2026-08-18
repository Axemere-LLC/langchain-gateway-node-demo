import { AiGatewayConfig } from "@axemere/gateway";
import { ChatAiGateway } from "./llm.js";
import { runSecurityReview } from "./agents/security.js";
import { runPerformanceReview } from "./agents/performance.js";
import { runStyleReview } from "./agents/style.js";
import { runRanker } from "./agents/ranker.js";
import { runSynthesizer } from "./agents/synthesizer.js";
import { AGENT_CONFIGS, projectIdFor, workloadIdFor, newRunId } from "./config.js";
import type { AgentMetering, PipelineResult } from "./types.js";

function buildLLM(
  config: AiGatewayConfig,
  agentName: keyof typeof AGENT_CONFIGS,
  runId: string
): ChatAiGateway {
  const { provider, model, maxTokens } = AGENT_CONFIGS[agentName];
  return new ChatAiGateway({
    config,
    provider,
    model,
    // [AXEMERE] Single generic workload, per-role project — see config.ts.
    workloadId: workloadIdFor(config),
    projectId: projectIdFor(agentName, config),
    maxTokens,
    // [AXEMERE] Run-level label
    // Every gateway record from this pipeline run shares the same run_id label,
    // making the full run queryable in the Axemere console or API:
    //   GET /v1/records?label.run_id=<run_id>
    labels: { run_id: runId, agent: agentName },
  });
}

function captureMetering(
  llm: ChatAiGateway,
  agent: string,
  startMs: number
): AgentMetering {
  return {
    agent,
    provider: llm.lastProvider ?? "unknown",
    model: llm.lastModel ?? "unknown",
    record_id: llm.lastRecordId ?? "",
    tokens_in: llm.lastMetering?.tokens_in ?? 0,
    tokens_out: llm.lastMetering?.tokens_out ?? 0,
    cost_usd: llm.lastMetering?.cost_usd ?? "0",
    latency_ms: Date.now() - startMs,
  };
}

export async function runPipeline(
  code: string,
  config: AiGatewayConfig
): Promise<PipelineResult> {
  const runId = newRunId();
  const pipelineStart = Date.now();

  const securityLLM = buildLLM(config, "security", runId);
  const performanceLLM = buildLLM(config, "performance", runId);
  const styleLLM = buildLLM(config, "style", runId);
  const rankerLLM = buildLLM(config, "ranker", runId);
  const synthesizerLLM = buildLLM(config, "synthesizer", runId);

  // [AXEMERE] Parallel review phase
  // Three specialist reviewers run concurrently via Promise.all — each routes
  // to a different provider through the gateway. Total latency = slowest reviewer,
  // not sum. Each call is independently metered with its own record_id.
  // Alternatives:
  //   A) Sequential — simpler error handling, 3x slower
  //   B) LangChain RunnableParallel — equivalent, slightly less transparent metering capture
  console.log(`[${runId}] Starting parallel review (security | performance | style)...`);
  const reviewStart = Date.now();
  const [security, performance, style] = await Promise.all([
    runSecurityReview(securityLLM, code),
    runPerformanceReview(performanceLLM, code),
    runStyleReview(styleLLM, code),
  ]);
  const reviewMs = Date.now() - reviewStart;

  const securityMetering = captureMetering(securityLLM, "security", reviewStart);
  const performanceMetering = captureMetering(performanceLLM, "performance", reviewStart);
  const styleMetering = captureMetering(styleLLM, "style", reviewStart);

  const findingCount =
    security.findings.length + performance.findings.length + style.findings.length;
  console.log(
    `[${runId}] Review complete in ${reviewMs}ms — ${findingCount} findings across 3 dimensions`
  );

  // Ranker: cross-dimension prioritization
  console.log(`[${runId}] Ranking ${findingCount} findings...`);
  const rankerStart = Date.now();
  const ranked = await runRanker(rankerLLM, security, performance, style);
  const rankerMetering = captureMetering(rankerLLM, "ranker", rankerStart);
  console.log(`[${runId}] Ranked in ${Date.now() - rankerStart}ms`);

  // Synthesizer: narrative summary + action plan
  console.log(`[${runId}] Synthesizing report...`);
  const synthStart = Date.now();
  const synthesis = await runSynthesizer(synthesizerLLM, ranked);
  const synthMetering = captureMetering(synthesizerLLM, "synthesizer", synthStart);
  console.log(`[${runId}] Synthesis complete in ${Date.now() - synthStart}ms`);

  const metering = [
    securityMetering,
    performanceMetering,
    styleMetering,
    rankerMetering,
    synthMetering,
  ];

  const totalCostUsd = metering
    .reduce((sum, m) => sum + parseFloat(m.cost_usd || "0"), 0)
    .toFixed(6);

  return {
    run_id: runId,
    code_input: code,
    security,
    performance,
    style,
    ranked,
    synthesis,
    metering,
    total_cost_usd: totalCostUsd,
    total_tokens_in: metering.reduce((s, m) => s + m.tokens_in, 0),
    total_tokens_out: metering.reduce((s, m) => s + m.tokens_out, 0),
    elapsed_ms: Date.now() - pipelineStart,
  };
}
