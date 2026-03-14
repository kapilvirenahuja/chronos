import fs from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import {
  dispatchQueuedRuns,
  enqueueSignal,
  normalizeAskSignal,
  normalizeCaptureSignal,
  normalizeHeartbeatSignal,
  processQueuedRun,
  processSignal,
  submitSignal
} from "@/lib/engine/signals";
import { getStore, resetStoreForTests } from "@/lib/store";
import { resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-signal-store.json";
const libraryPath = "./data/test-signal-library";

beforeEach(async () => {
  process.env.CHRONOS_STORE = "file";
  process.env.CHRONOS_OWNER_IDS = "owner-dev";
  process.env.CHRONOS_FILE_STORE_PATH = storePath;
  process.env.CHRONOS_LTM_PATH = libraryPath;
  delete process.env.ANTHROPIC_API_KEY;
  resetConfigForTests();
  resetStoreForTests();
  await fs.rm(resolveFromRoot(storePath), { force: true });
  await fs.rm(resolveFromRoot(libraryPath), { force: true, recursive: true });
});

describe("signal normalization", () => {
  it("normalizes capture and ask inputs into a canonical envelope", () => {
    const capture = normalizeCaptureSignal({
      type: "capture",
      text: "A durable strategic thought.",
      author: "owner-dev",
      channel: "discord"
    });
    const ask = normalizeAskSignal({
      type: "ask",
      question: "Help me with my system",
      author: "owner-dev",
      channel: "discord"
    });

    expect(capture.kind).toBe("capture");
    expect(capture.authorId).toBe("owner-dev");
    expect(capture.payload.text).toBe("A durable strategic thought.");
    expect(ask.kind).toBe("ask");
    expect(ask.payload.question).toBe("Help me with my system");
  });

  it("routes ask signals through the shared signal processor", async () => {
    const signal = normalizeAskSignal({
      type: "ask",
      question: "Help me with my system",
      author: "owner-dev",
      channel: "discord"
    });

    const outcome = await processSignal(signal);

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toContain("/review/clarifications/");

    const storedSignal = await getStore().getSignal(signal.id);
    expect(storedSignal?.kind).toBe("ask");
    expect(storedSignal?.payload.question).toBe("Help me with my system");

    const runs = await getStore().listRuns({ signalId: signal.id });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.recipeId).toBe("consult-cto");
    expect(runs[0]?.executionPattern).toBe("agentic");
    expect(runs[0]?.status).toBe("awaiting_user");
    expect(runs[0]?.gate).toBe("clarification");
  });

  it("persists one-shot capture runs with completion state", async () => {
    const outcome = await processSignal(
      normalizeCaptureSignal({
        type: "capture",
        text: "A durable strategic thought about AI leverage.",
        author: "owner-dev",
        channel: "discord"
      })
    );

    expect(outcome.kind).toBe("silent");

    const signals = await getStore().listSignals({ kinds: ["capture"] });
    expect(signals).toHaveLength(1);

    const runs = await getStore().listRuns({ recipeId: "capture" });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.executionPattern).toBe("one_shot");
    expect(runs[0]?.status).toBe("completed");
    expect(runs[0]?.gate).toBe("none");
    const toolCalls = await getStore().listToolCalls({ runId: runs[0]?.id });
    expect(toolCalls.some((record) => record.toolName === "capture_classification")).toBe(
      true
    );
    expect(toolCalls.some((record) => record.toolName === "write_decision_log")).toBe(true);
  });

  it("supports queue then dispatch flow for ask signals", async () => {
    const signal = normalizeAskSignal({
      type: "ask",
      question: "Help me with my system",
      author: "owner-dev",
      channel: "discord"
    });

    const run = await enqueueSignal(signal);
    expect(run.status).toBe("queued");

    const queued = await getStore().getRun(run.id);
    expect(queued?.status).toBe("queued");

    const dispatch = await dispatchQueuedRuns(10);
    expect(dispatch.runs.map((item) => item.id)).toContain(run.id);

    const completed = await getStore().getRun(run.id);
    expect(completed?.status).toBe("awaiting_user");
    expect(completed?.gate).toBe("clarification");
  });

  it("can stop at enqueue when queue mode is selected", async () => {
    const receipt = await submitSignal(
      normalizeAskSignal({
        type: "ask",
        question: "Help me with my system",
        author: "owner-dev",
        channel: "discord"
      }),
      {
        dispatch: false
      }
    );

    expect("accepted" in receipt && receipt.accepted).toBe(true);
    if (!("runId" in receipt)) {
      throw new Error("Expected a queued receipt.");
    }

    const queued = await getStore().getRun(receipt.runId);
    expect(queued?.status).toBe("queued");
    expect(queued?.recipeId).toBe("consult-cto");
  });

  it("can process a specific queued run by id", async () => {
    const run = await enqueueSignal(
      normalizeCaptureSignal({
        type: "capture",
        text: "A durable strategic thought about AI leverage.",
        author: "owner-dev",
        channel: "discord"
      })
    );

    const outcome = await processQueuedRun(run.id);
    expect("kind" in outcome && outcome.kind === "silent").toBe(true);

    const persisted = await getStore().getRun(run.id);
    expect(persisted?.status).toBe("completed");
    expect(persisted?.gate).toBe("none");
  });

  it("records tool calls for heartbeat runs", async () => {
    await processSignal(
      normalizeCaptureSignal({
        type: "capture",
        text: "AI agents need intent alignment before they get more agency or autonomy.",
        author: "owner-dev",
        channel: "discord"
      })
    );

    const outcome = await processSignal(normalizeHeartbeatSignal());
    expect("processed" in outcome).toBe(true);

    const runs = await getStore().listRuns({ recipeId: "heartbeat" });
    expect(runs).toHaveLength(1);
    const toolCalls = await getStore().listToolCalls({ runId: runs[0]?.id });
    expect(toolCalls.some((record) => record.toolName === "search_memory")).toBe(true);
    expect(toolCalls.some((record) => record.toolName === "heartbeat_classification")).toBe(
      true
    );
    expect(toolCalls.some((record) => record.toolName === "evaluate_content_quality")).toBe(
      true
    );
    expect(toolCalls.some((record) => record.toolName === "write_decision_log")).toBe(true);
  });
});
