import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getChronosRuntimeStage,
  loadConfig,
  resetConfigForTests
} from "@/lib/config";

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalRuntimeMode = process.env.CHRONOS_RUNTIME_MODE;
const originalAnthropicModel = process.env.ANTHROPIC_MODEL;
const originalAnthropicEvalModel = process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT;

beforeEach(() => {
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT;
  delete process.env.CHRONOS_RUNTIME_MODE;
  delete process.env.VERCEL_ENV;
  env.NODE_ENV = "test";
  resetConfigForTests();
});

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;

  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnv;
  }

  if (originalRuntimeMode === undefined) {
    delete process.env.CHRONOS_RUNTIME_MODE;
  } else {
    process.env.CHRONOS_RUNTIME_MODE = originalRuntimeMode;
  }

  if (originalAnthropicModel === undefined) {
    delete process.env.ANTHROPIC_MODEL;
  } else {
    process.env.ANTHROPIC_MODEL = originalAnthropicModel;
  }

  if (originalAnthropicEvalModel === undefined) {
    delete process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT;
  } else {
    process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT = originalAnthropicEvalModel;
  }

  resetConfigForTests();
});

describe("anthropic model selection", () => {
  it("defaults to haiku in non-production runtimes", () => {
    const config = loadConfig();

    expect(getChronosRuntimeStage()).toBe("development");
    expect(config.engine.engine.model).toBe("claude-3-haiku-20240307");
    expect(config.engine.engine.model_for_eval_agent).toBe("claude-3-haiku-20240307");
  });

  it("uses pinned production defaults in production", () => {
    process.env.VERCEL_ENV = "production";
    env.NODE_ENV = "production";
    resetConfigForTests();

    const config = loadConfig();

    expect(getChronosRuntimeStage()).toBe("production");
    expect(config.engine.engine.model).toBe("claude-sonnet-4-6");
    expect(config.engine.engine.model_for_eval_agent).toBe("claude-haiku-4-5-20251001");
  });

  it("treats vercel preview as development for model defaults", () => {
    process.env.VERCEL_ENV = "preview";
    env.NODE_ENV = "production";
    resetConfigForTests();

    const config = loadConfig();

    expect(getChronosRuntimeStage()).toBe("development");
    expect(config.engine.engine.model).toBe("claude-3-haiku-20240307");
    expect(config.engine.engine.model_for_eval_agent).toBe("claude-3-haiku-20240307");
  });

  it("honors explicit model overrides", () => {
    process.env.CHRONOS_RUNTIME_MODE = "development";
    process.env.ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";
    process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT = "claude-3-5-haiku-latest";
    resetConfigForTests();

    const config = loadConfig();

    expect(config.engine.engine.model).toBe("claude-3-5-haiku-20241022");
    expect(config.engine.engine.model_for_eval_agent).toBe("claude-3-5-haiku-latest");
  });
});
