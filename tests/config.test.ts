import { describe, it, expect, beforeEach } from "vitest";
import { AGENT_CONFIGS, WORKLOAD_SECURITY, WORKLOAD_PERFORMANCE, WORKLOAD_STYLE, WORKLOAD_RANKER, WORKLOAD_SYNTHESIZER, newRunId } from "../src/config.js";

describe("AGENT_CONFIGS", () => {
  it("has an entry for every agent role", () => {
    const roles = ["security", "performance", "style", "ranker", "synthesizer"] as const;
    for (const role of roles) {
      expect(AGENT_CONFIGS[role]).toBeDefined();
      expect(AGENT_CONFIGS[role].provider).toBeTruthy();
      expect(AGENT_CONFIGS[role].model).toBeTruthy();
    }
  });

  it("uses different providers for review agents", () => {
    const providers = new Set([
      AGENT_CONFIGS.security.provider,
      AGENT_CONFIGS.performance.provider,
      AGENT_CONFIGS.style.provider,
    ]);
    // At least two distinct providers among the three reviewers
    expect(providers.size).toBeGreaterThanOrEqual(2);
  });
});

describe("workload IDs", () => {
  it("are all non-empty strings", () => {
    for (const wl of [WORKLOAD_SECURITY, WORKLOAD_PERFORMANCE, WORKLOAD_STYLE, WORKLOAD_RANKER, WORKLOAD_SYNTHESIZER]) {
      expect(typeof wl).toBe("string");
      expect(wl.length).toBeGreaterThan(0);
    }
  });

  it("are all distinct", () => {
    const ids = [WORKLOAD_SECURITY, WORKLOAD_PERFORMANCE, WORKLOAD_STYLE, WORKLOAD_RANKER, WORKLOAD_SYNTHESIZER];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("newRunId", () => {
  it("returns an 8-character string", () => {
    const id = newRunId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(8);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newRunId()));
    expect(ids.size).toBe(100);
  });
});
