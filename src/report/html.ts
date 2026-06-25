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
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:12px;background:${SEVERITY_BG[f.severity] ?? "#fff"}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:18px;font-weight:800;color:#9ca3af;min-width:28px">#${f.rank}</span>
      ${severityBadge(f.severity)}
      ${categoryBadge(f.category)}
      ${f.line_hint ? `<span style="font-size:12px;color:#6b7280">line ${f.line_hint}</span>` : ""}
    </div>
    <div style="font-weight:700;font-size:15px;margin-bottom:6px">${escHtml(f.title)}</div>
    <div style="color:#374151;margin-bottom:10px;line-height:1.5">${escHtml(f.description)}</div>
    <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:10px 14px;border-radius:0 6px 6px 0">
      <span style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase">Suggestion</span>
      <div style="margin-top:4px;color:#166534">${escHtml(f.suggestion)}</div>
    </div>
    ${f.rationale ? `<div style="margin-top:8px;font-size:12px;color:#6b7280;font-style:italic">Ranking rationale: ${escHtml(f.rationale)}</div>` : ""}
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

  const actionItems = result.synthesis.action_items
    .map(
      (a) =>
        `<li style="margin-bottom:6px">${severityBadge(a.priority)} <span style="margin-left:6px">${escHtml(a.action)}</span></li>`
    )
    .join("");

  const findingRows = result.ranked.ranked_findings.map(renderFinding).join("");
  const meteringRows = result.metering.map(renderMeteringRow).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report — Run ${result.run_id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f3f4f6; color: #111827; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin: 32px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; margin-bottom: 20px; }
    .stat { display: inline-block; margin-right: 32px; }
    .stat-value { font-size: 28px; font-weight: 800; }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f9fafb; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }
    .badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
<div class="container">

  <h1>Code Review Report</h1>
  <div style="color:#6b7280;margin-bottom:24px">
    Run <code>${result.run_id}</code> &nbsp;·&nbsp; ${now}
    &nbsp;·&nbsp; ${formatElapsed(result.elapsed_ms)} total
  </div>

  <!-- Dashboard -->
  <div class="card">
    <div style="margin-bottom:20px">
      <div class="stat">
        <div class="stat-value">${result.ranked.ranked_findings.length}</div>
        <div class="stat-label">Total findings</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#b91c1c">
          ${result.ranked.ranked_findings.filter((f) => f.severity === "critical").length}
        </div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#c2410c">
          ${result.ranked.ranked_findings.filter((f) => f.severity === "high").length}
        </div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#b45309">
          ${result.ranked.ranked_findings.filter((f) => f.severity === "medium").length}
        </div>
        <div class="stat-label">Medium</div>
      </div>
      <div class="stat">
        <div class="stat-value">${result.ranked.ranked_findings.filter((f) => f.severity === "low").length}</div>
        <div class="stat-label">Low</div>
      </div>
    </div>
    <div class="badge-row">
      <div class="stat">
        <div class="stat-value" style="font-size:20px">$${parseFloat(result.total_cost_usd).toFixed(4)}</div>
        <div class="stat-label">Total cost</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="font-size:20px">${(result.total_tokens_in + result.total_tokens_out).toLocaleString()}</div>
        <div class="stat-label">Total tokens</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="font-size:20px">${result.metering.length}</div>
        <div class="stat-label">Agent calls</div>
      </div>
    </div>
  </div>

  <!-- Executive Summary -->
  <h2>Executive Summary</h2>
  <div class="card">
    <p style="line-height:1.7;margin:0 0 16px">${escHtml(result.synthesis.executive_summary)}</p>
    <div style="background:#fef3c7;border-left:3px solid #d97706;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:16px">
      <strong>Risk assessment:</strong> ${escHtml(result.synthesis.risk_assessment)}
    </div>
  </div>

  <!-- Action Plan -->
  <h2>Action Plan</h2>
  <div class="card">
    <ul style="list-style:none;padding:0;margin:0">${actionItems}</ul>
  </div>

  <!-- Ranked Findings -->
  <h2>All Findings — Ranked by Priority</h2>
  <div style="color:#6b7280;font-size:13px;margin-bottom:12px">${escHtml(result.ranked.ranking_notes)}</div>
  ${findingRows}

  <!-- Per-dimension summaries -->
  <h2>Review Dimension Summaries</h2>
  <div class="card">
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("security")} Security</div>
      <div style="color:#374151;line-height:1.6">${escHtml(result.security.summary)}</div>
    </div>
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("performance")} Performance</div>
      <div style="color:#374151;line-height:1.6">${escHtml(result.performance.summary)}</div>
    </div>
    <div>
      <div style="font-weight:700;margin-bottom:4px">${categoryBadge("style")} Style</div>
      <div style="color:#374151;line-height:1.6">${escHtml(result.style.summary)}</div>
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
        <tr style="background:#f9fafb;font-weight:700">
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
  </footer>

</div>
</body>
</html>`;
}
