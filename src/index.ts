#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createGatewayConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { renderReport } from "./report/html.js";

function printHelp(): void {
  console.log(`
langchain-gateway-node-demo — multi-agent code review pipeline

Usage:
  node dist/index.js <file>          Review a source file
  node dist/index.js --stdin         Read code from stdin
  node dist/index.js --help          Show this help

Options:
  --out <path>   Write HTML report to a file (default: output/<run_id>/report.html)
  --json         Also write raw JSON result alongside the HTML report

Environment variables (see .env.example):
  AXEMERE_GATEWAY_TOKEN   Required — your Axemere gateway token
  AXEMERE_PROJECT_ID      Required — project for workload attribution
  AXEMERE_GATEWAY_URL     Optional — defaults to https://us.gw.axemere.ai

Example:
  TOPIC=src/app.ts make run
  node dist/index.js src/app.ts --out output/review.html
`);
}

async function readCode(args: string[]): Promise<{ code: string; label: string }> {
  const stdinFlag = args.includes("--stdin");
  if (stdinFlag) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return { code: Buffer.concat(chunks).toString("utf8"), label: "stdin" };
  }
  const filePath = args.find((a) => !a.startsWith("--"));
  if (!filePath) {
    printHelp();
    process.exit(1);
  }
  const code = fs.readFileSync(filePath, "utf8");
  return { code, label: path.basename(filePath) };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printHelp();
    return;
  }

  const outFlag = args.indexOf("--out");
  const explicitOutPath = outFlag !== -1 ? args[outFlag + 1] : undefined;
  const writeJson = args.includes("--json");

  const { code, label } = await readCode(args);
  console.log(`Reviewing: ${label} (${code.length} chars)`);

  const config = createGatewayConfig();
  const result = await runPipeline(code, config);

  // [AXEMERE] Per-run output directory
  // Defaults to output/<run_id>/report.html so successive runs don't overwrite
  // each other and the directory name matches the run_id gateway label — the
  // same value used to filter all of a run's records in the console.
  const outPath = explicitOutPath ?? `output/${result.run_id}/report.html`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const html = renderReport(result);
  fs.writeFileSync(outPath, html, "utf8");
  console.log(`\nReport written to: ${outPath}`);

  if (writeJson) {
    const jsonPath = outPath.replace(/\.html$/, ".json");
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
    console.log(`JSON written to:   ${jsonPath}`);
  }

  console.log(`\nSummary:`);
  console.log(`  Run ID:   ${result.run_id}`);
  console.log(`  Findings: ${result.ranked.ranked_findings.length} (${result.ranked.ranked_findings.filter((f) => f.severity === "critical").length} critical, ${result.ranked.ranked_findings.filter((f) => f.severity === "high").length} high)`);
  console.log(`  Cost:     $${parseFloat(result.total_cost_usd).toFixed(5)}`);
  console.log(`  Tokens:   ${(result.total_tokens_in + result.total_tokens_out).toLocaleString()} total`);
  console.log(`  Elapsed:  ${(result.elapsed_ms / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
