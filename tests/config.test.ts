import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AiGatewayConfig } from "@axemere/gateway";
import { AGENT_CONFIGS, projectIdFor, workloadIdFor, newRunId } from "../src/config.js";

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

describe("projectIdFor", () => {
  const ROLE_ENV_VARS = [
    "PROJECT_ID_SECURITY",
    "PROJECT_ID_PERFORMANCE",
    "PROJECT_ID_STYLE",
    "PROJECT_ID_RANKER",
    "PROJECT_ID_SYNTHESIZER",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [...ROLE_ENV_VARS, "AXEMERE_PROJECT_ID"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("falls back to config.project_id when no role-specific var is set", () => {
    process.env["AXEMERE_PROJECT_ID"] = "prj_fallback";
    const config = new AiGatewayConfig();
    expect(projectIdFor("security", config)).toBe("prj_fallback");
  });

  it("uses the role-specific PROJECT_ID_* var when set", () => {
    process.env["AXEMERE_PROJECT_ID"] = "prj_fallback";
    process.env["PROJECT_ID_SECURITY"] = "prj_code_review_security";
    const config = new AiGatewayConfig();
    expect(projectIdFor("security", config)).toBe("prj_code_review_security");
    expect(projectIdFor("performance", config)).toBe("prj_fallback");
  });
});

describe("workloadIdFor", () => {
  let savedWorkloadId: string | undefined;

  beforeEach(() => {
    savedWorkloadId = process.env["AXEMERE_WORKLOAD_ID"];
    delete process.env["AXEMERE_WORKLOAD_ID"];
  });

  afterEach(() => {
    if (savedWorkloadId === undefined) delete process.env["AXEMERE_WORKLOAD_ID"];
    else process.env["AXEMERE_WORKLOAD_ID"] = savedWorkloadId;
  });

  it("falls back to the WORKLOAD default when AXEMERE_WORKLOAD_ID is unset", () => {
    const config = new AiGatewayConfig();
    expect(workloadIdFor(config)).toBe("wl_code_review_demo");
  });

  it("honors an explicit AXEMERE_WORKLOAD_ID from the environment", () => {
    process.env["AXEMERE_WORKLOAD_ID"] = "wl_custom";
    const config = new AiGatewayConfig();
    expect(workloadIdFor(config)).toBe("wl_custom");
  });
});

describe("newRunId", () => {
  it("returns a 14-character numeric timestamp string", () => {
    const id = newRunId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^\d{14}$/);
  });
});
