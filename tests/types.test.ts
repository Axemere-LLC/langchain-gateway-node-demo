import { describe, it, expect } from "vitest";
import {
  FindingSchema,
  ReviewOutputSchema,
  RankerOutputSchema,
  SynthesisOutputSchema,
} from "../src/types.js";

describe("FindingSchema", () => {
  it("accepts a valid finding", () => {
    const result = FindingSchema.safeParse({
      title: "SQL Injection",
      description: "Unsanitized input in query",
      severity: "critical",
      line_hint: "42",
      suggestion: "Use parameterized queries",
    });
    expect(result.success).toBe(true);
  });

  it("accepts finding without optional line_hint", () => {
    const result = FindingSchema.safeParse({
      title: "Unused variable",
      description: "x is declared but never used",
      severity: "low",
      suggestion: "Remove the declaration",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = FindingSchema.safeParse({
      title: "Issue",
      description: "desc",
      severity: "blocker",
      suggestion: "fix it",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = FindingSchema.safeParse({ title: "Issue" });
    expect(result.success).toBe(false);
  });
});

describe("ReviewOutputSchema", () => {
  it("accepts valid review output", () => {
    const result = ReviewOutputSchema.safeParse({
      findings: [
        {
          title: "XSS",
          description: "Unescaped output",
          severity: "high",
          suggestion: "Escape HTML",
        },
      ],
      summary: "One XSS vulnerability found.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty findings", () => {
    const result = ReviewOutputSchema.safeParse({
      findings: [],
      summary: "No issues found.",
    });
    expect(result.success).toBe(true);
  });
});

describe("RankerOutputSchema", () => {
  it("accepts valid ranked output", () => {
    const result = RankerOutputSchema.safeParse({
      ranked_findings: [
        {
          title: "SQL Injection",
          description: "Unsafe query",
          severity: "critical",
          suggestion: "Use parameterized queries",
          rank: 1,
          category: "security",
          rationale: "Direct exploit path",
        },
        {
          title: "Unused variable",
          description: "x not used",
          severity: "low",
          suggestion: "Remove it",
          rank: 2,
          category: "style",
          rationale: "Low impact",
        },
      ],
      ranking_notes: "Security issues ranked above style",
    });
    expect(result.success).toBe(true);
  });
});

describe("SynthesisOutputSchema", () => {
  it("accepts valid synthesis output", () => {
    const result = SynthesisOutputSchema.safeParse({
      executive_summary: "Two critical issues found.",
      action_items: [
        { priority: "critical", action: "Fix SQL injection on line 42" },
        { priority: "low", action: "Remove unused variable" },
      ],
      risk_assessment: "High risk due to SQL injection",
    });
    expect(result.success).toBe(true);
  });
});
