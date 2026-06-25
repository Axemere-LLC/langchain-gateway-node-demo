import { describe, it, expect } from "vitest";
import { renderReport } from "../src/report/html.js";
import type { PipelineResult } from "../src/types.js";

const FIXTURE: PipelineResult = {
  run_id: "abc123",
  code_input: "const x = 1;",
  security: {
    findings: [
      {
        title: "Hardcoded secret",
        description: "Password in source",
        severity: "critical",
        suggestion: "Use env vars",
      },
    ],
    summary: "One critical security issue found.",
  },
  performance: {
    findings: [
      {
        title: "N+1 query",
        description: "Query inside loop",
        severity: "high",
        suggestion: "Batch queries",
      },
    ],
    summary: "One high-severity performance issue.",
  },
  style: {
    findings: [],
    summary: "No style issues found.",
  },
  ranked: {
    ranked_findings: [
      {
        title: "Hardcoded secret",
        description: "Password in source",
        severity: "critical",
        suggestion: "Use env vars",
        rank: 1,
        category: "security",
        rationale: "Direct security risk",
      },
      {
        title: "N+1 query",
        description: "Query inside loop",
        severity: "high",
        suggestion: "Batch queries",
        rank: 2,
        category: "performance",
        rationale: "Performance degradation",
      },
    ],
    ranking_notes: "Security over performance",
  },
  synthesis: {
    executive_summary: "Two issues require immediate attention.",
    action_items: [
      { priority: "critical", action: "Remove hardcoded password" },
      { priority: "high", action: "Fix N+1 query pattern" },
    ],
    risk_assessment: "High risk",
  },
  metering: [
    {
      agent: "security",
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      record_id: "rec_001",
      tokens_in: 500,
      tokens_out: 200,
      cost_usd: "0.002100",
      latency_ms: 1200,
    },
    {
      agent: "performance",
      provider: "openai",
      model: "gpt-4o",
      record_id: "rec_002",
      tokens_in: 450,
      tokens_out: 180,
      cost_usd: "0.001800",
      latency_ms: 900,
    },
  ],
  total_cost_usd: "0.003900",
  total_tokens_in: 950,
  total_tokens_out: 380,
  elapsed_ms: 3500,
};

describe("renderReport", () => {
  it("returns valid HTML", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("includes run ID", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("abc123");
  });

  it("includes all finding titles", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("Hardcoded secret");
    expect(html).toContain("N+1 query");
  });

  it("includes metering providers", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("anthropic");
    expect(html).toContain("openai");
  });

  it("includes cost total", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("0.00390");
  });

  it("escapes HTML in finding descriptions", () => {
    const xssFixture = { ...FIXTURE };
    xssFixture.ranked = {
      ...FIXTURE.ranked,
      ranked_findings: [
        {
          ...FIXTURE.ranked.ranked_findings[0],
          description: "<script>alert('xss')</script>",
        },
        ...FIXTURE.ranked.ranked_findings.slice(1),
      ],
    };
    const html = renderReport(xssFixture);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows severity badges for all severity levels", () => {
    const html = renderReport(FIXTURE);
    expect(html).toContain("critical");
    expect(html).toContain("high");
  });
});
