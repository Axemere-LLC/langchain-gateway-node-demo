import type { PipelineResult, RankedFinding, AgentMetering } from "../types.js";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#b91c1c",
  high: "#c2410c",
  medium: "#b45309",
  low: "#4b5563",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "#fef2f2",
  high: "#fff7ed",
  medium: "#fffbeb",
  low: "#f9fafb",
};

function severityBadge(severity: string): string {
  const color = SEVERITY_COLOR[severity] ?? "#4b5563";
  const bg = SEVERITY_BG[severity] ?? "#f9fafb";
  return `<span style="background:${bg};color:${color};border:1px solid ${color};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;text-transform:uppercase">${severity}</span>`;
}

function categoryBadge(category: string): string {
  const colors: Record<string, string> = {
    security: "#7c3aed",
    performance: "#0369a1",
    style: "#065f46",
  };
  const c = colors[category] ?? "#4b5563";
  return `<span style="background:${c}18;color:${c};border:1px solid ${c}40;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;text-transform:uppercase">${category}</span>`;
}

function renderFinding(f: RankedFinding): string {
  return `
  <div style="border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin-bottom:12px;background:var(--surface)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:18px;font-weight:800;color:var(--text-muted);min-width:28px">#${f.rank}</span>
      ${severityBadge(f.severity)}
      ${categoryBadge(f.category)}
      ${f.line_hint ? `<span style="font-size:12px;color:var(--text-muted)">line ${f.line_hint}</span>` : ""}
    </div>
    <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:var(--text)">${escHtml(f.title)}</div>
    <div style="color:var(--text-muted);margin-bottom:10px;line-height:1.5">${escHtml(f.description)}</div>
    <div style="background:rgba(52,211,153,0.08);border-left:3px solid #34d399;padding:10px 14px;border-radius:0 6px 6px 0">
      <span style="font-size:11px;font-weight:700;color:#34d399;text-transform:uppercase">Suggestion</span>
      <div style="margin-top:4px;color:var(--text-muted)">${escHtml(f.suggestion)}</div>
    </div>
    ${f.rationale ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted);font-style:italic">Ranking rationale: ${escHtml(f.rationale)}</div>` : ""}
  </div>`;
}

function renderMeteringRow(m: AgentMetering): string {
  return `
  <tr>
    <td style="padding:10px 14px;font-weight:600">${m.agent}</td>
    <td style="padding:10px 14px;color:#6b7280">${m.provider}</td>
    <td style="padding:10px 14px;color:#6b7280;font-family:monospace;font-size:12px">${m.model}</td>
    <td style="padding:10px 14px;text-align:right">${m.tokens_in.toLocaleString()}</td>
    <td style="padding:10px 14px;text-align:right">${m.tokens_out.toLocaleString()}</td>
    <td style="padding:10px 14px;text-align:right;font-family:monospace">$${parseFloat(m.cost_usd).toFixed(5)}</td>
    <td style="padding:10px 14px;text-align:right">${m.latency_ms.toLocaleString()}ms</td>
    <td style="padding:10px 14px;font-family:monospace;font-size:10px;color:#9ca3af">${m.record_id}</td>
  </tr>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderReport(result: PipelineResult): string {
  const now = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const actionRows = result.synthesis.action_items
    .map(
      (a) =>
        `<tr><td>${severityBadge(a.priority)}</td><td style="color:var(--text);line-height:1.5">${escHtml(a.action)}</td></tr>`
    )
    .join("");

  const findingRows = result.ranked.ranked_findings.map(renderFinding).join("");
  const meteringRows = result.metering.map(renderMeteringRow).join("");

  const criticalCount = result.ranked.ranked_findings.filter((f) => f.severity === "critical").length;
  const highCount     = result.ranked.ranked_findings.filter((f) => f.severity === "high").length;
  const mediumCount   = result.ranked.ranked_findings.filter((f) => f.severity === "medium").length;
  const lowCount      = result.ranked.ranked_findings.filter((f) => f.severity === "low").length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report — Run ${result.run_id}</title>
  <style>
    :root {
      --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a; --border: #2e3350;
      --text: #e2e8f0; --text-muted: #8892a4;
      --accent: #6c8ef7; --green: #34d399;
      --crit: #f87171; --high: #fb923c; --med: #fbbf24; --low: #94a3b8;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: var(--bg); color: var(--text); }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin: 32px 0 12px; border-bottom: 2px solid var(--border); padding-bottom: 8px; color: var(--text); }
    .card { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); padding: 24px; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .meta-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: 4px; }
    .meta-value { font-size: 1.15rem; font-weight: 700; color: var(--text); }
    .meta-value.accent { color: var(--accent); font-family: monospace; font-size: .95rem; }
    .meta-value.green  { color: var(--green); }
    .meta-value.crit   { color: var(--crit); }
    .meta-value.high   { color: var(--high); }
    .meta-value.med    { color: var(--med); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: var(--surface2); padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); border-bottom: 2px solid var(--border); }
    td { color: var(--text); }
    tr:not(:last-child) td { border-bottom: 1px solid var(--border); }
    .action-table { width: 100%; border-collapse: collapse; }
    .action-table td { padding: 10px 12px; vertical-align: middle; border-bottom: 1px solid var(--border); }
    .action-table td:first-child { white-space: nowrap; width: 90px; }
    footer { text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); }
    footer a { color: var(--text-muted); }
  </style>
</head>
<body>
<div class="container">

  <h1>Code Review Report</h1>
  <div style="color:var(--text-muted);margin-bottom:24px">
    <a href="https://console.axemere.ai/records?label_key=run_id&label_value=${result.run_id}" target="_blank" rel="noopener" style="color:var(--accent)"><code>${result.run_id}</code></a>
    &nbsp;·&nbsp; ${now} &nbsp;·&nbsp; ${formatElapsed(result.elapsed_ms)} total
  </div>

  <!-- Dashboard -->
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-label">Total Findings</div>
      <div class="meta-value">${result.ranked.ranked_findings.length}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Critical</div>
      <div class="meta-value crit">${criticalCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">High</div>
      <div class="meta-value high">${highCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Medium</div>
      <div class="meta-value med">${mediumCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Low</div>
      <div class="meta-value" style="color:var(--low)">${lowCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Tokens In</div>
      <div class="meta-value">${result.total_tokens_in.toLocaleString()}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Tokens Out</div>
      <div class="meta-value">${result.total_tokens_out.toLocaleString()}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Agent Calls</div>
      <div class="meta-value">${result.metering.length}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Total Cost</div>
      <div class="meta-value green">$${parseFloat(result.total_cost_usd).toFixed(4)}</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <h2>Executive Summary</h2>
  <div class="card">
    <p style="line-height:1.7;margin:0 0 16px;color:var(--text)">${escHtml(result.synthesis.executive_summary)}</p>
    <div style="background:rgba(251,191,36,0.1);border-left:3px solid #fbbf24;padding:12px 16px;border-radius:0 6px 6px 0">
      <strong style="color:#fbbf24">Risk assessment:</strong> <span style="color:var(--text)">${escHtml(result.synthesis.risk_assessment)}</span>
    </div>
  </div>

  <!-- Action Plan -->
  <h2>Action Plan</h2>
  <div class="card" style="padding:0;overflow:auto">
    <table class="action-table">
      <thead><tr>
        <th>Severity</th>
        <th>Action</th>
      </tr></thead>
      <tbody>${actionRows}</tbody>
    </table>
  </div>

  <!-- Ranked Findings -->
  <h2>All Findings — Ranked by Priority</h2>
  <div style="color:var(--text-muted);font-size:13px;margin-bottom:12px">${escHtml(result.ranked.ranking_notes)}</div>
  ${findingRows}

  <!-- Per-dimension summaries -->
  <h2>Review Dimension Summaries</h2>
  <div class="card">
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("security")} Security</div>
      <div style="color:var(--text-muted);line-height:1.6">${escHtml(result.security.summary)}</div>
    </div>
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("performance")} Performance</div>
      <div style="color:var(--text-muted);line-height:1.6">${escHtml(result.performance.summary)}</div>
    </div>
    <div>
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("style")} Style</div>
      <div style="color:var(--text-muted);line-height:1.6">${escHtml(result.style.summary)}</div>
    </div>
  </div>

  <!-- Metering -->
  <h2>Gateway Metering — By Agent</h2>
  <div class="card" style="padding:0;overflow:auto">
    <table>
      <thead>
        <tr>
          <th>Agent</th>
          <th>Provider</th>
          <th>Model</th>
          <th style="text-align:right">Tokens in</th>
          <th style="text-align:right">Tokens out</th>
          <th style="text-align:right">Cost</th>
          <th style="text-align:right">Latency</th>
          <th>Record ID</th>
        </tr>
      </thead>
      <tbody>
        ${meteringRows}
        <tr style="background:var(--surface2);font-weight:700">
          <td colspan="3" style="padding:10px 14px">Total</td>
          <td style="padding:10px 14px;text-align:right">${result.total_tokens_in.toLocaleString()}</td>
          <td style="padding:10px 14px;text-align:right">${result.total_tokens_out.toLocaleString()}</td>
          <td style="padding:10px 14px;text-align:right;font-family:monospace">$${parseFloat(result.total_cost_usd).toFixed(5)}</td>
          <td style="padding:10px 14px;text-align:right">${formatElapsed(result.elapsed_ms)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <footer>
    Generated by <a href="https://github.com/Axemere-LLC/langchain-gateway-node-demo" style="color:#6b7280">langchain-gateway-node-demo</a>
    &nbsp;·&nbsp; Powered by <a href="https://axemere.ai" style="color:#6b7280">Axemere Gateway</a>
    &nbsp;·&nbsp; <a href="https://console.axemere.ai/records?label_key=run_id&label_value=${result.run_id}" target="_blank" rel="noopener" style="color:#6b7280">View run in Console</a>
  </footer>

</div>
</body>
</html>`;
}
