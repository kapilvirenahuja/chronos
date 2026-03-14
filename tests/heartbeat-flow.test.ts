import fs from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import { captureThought } from "@/lib/engine/capture";
import { runHeartbeat } from "@/lib/engine/heartbeat";
import { applyWebAction } from "@/lib/engine/web-actions";
import { getStore, resetStoreForTests } from "@/lib/store";
import { resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-heartbeat-store.json";
const libraryPath = "./data/test-heartbeat-library";

beforeEach(async () => {
  process.env.CHRONOS_STORE = "file";
  process.env.CHRONOS_OWNER_IDS = "owner-dev";
  process.env.CHRONOS_FILE_STORE_PATH = storePath;
  process.env.CHRONOS_LTM_PATH = libraryPath;
  delete process.env.DISCORD_NOTIFICATION_CHANNEL_ID;
  delete process.env.DISCORD_BOT_TOKEN;
  resetConfigForTests();
  resetStoreForTests();
  await fs.rm(resolveFromRoot(storePath), { force: true });
  await fs.rm(resolveFromRoot(libraryPath), { force: true, recursive: true });
});

describe("runHeartbeat", () => {
  it("promotes a strong signal into the local library", async () => {
    await captureThought({
      message: "AI agents need intent alignment before they get more agency or autonomy.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    const outcome = await runHeartbeat();
    expect(outcome.promoted).toHaveLength(1);

    const captures = await getStore().listCaptures();
    expect(captures[0]?.status).toBe("processed");
    expect(captures[0]?.libraryId).toMatch(/test-heartbeat-library/);
  });

  it("keeps time-sensitive captures pending owner review", async () => {
    await captureThought({
      message: "The weather today reminded me of Tokyo.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    const outcome = await runHeartbeat();
    expect(outcome.pendingOwner).toHaveLength(1);

    const captures = await getStore().listCaptures();
    expect(captures[0]?.status).toBe("pending_owner");
  });

  it("rejects low-confidence captures below the ask threshold", async () => {
    const outcome = await captureThought({
      message: "Architecture needs simpler tradeoffs for platform teams.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    await applyWebAction({
      captureId: outcome.capture!.id,
      actionType: "confidence_update",
      value: "0.20"
    });

    const heartbeat = await runHeartbeat();
    expect(heartbeat.ignored).toHaveLength(1);

    const updated = await getStore().getCapture(outcome.capture!.id);
    expect(updated?.status).toBe("processed");
    expect(updated?.rejectedReason).toContain("fell below the LTM review threshold");
  });

  it("keeps mid-confidence captures pending owner review", async () => {
    const outcome = await captureThought({
      message: "Architecture needs simpler tradeoffs for platform teams.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    await applyWebAction({
      captureId: outcome.capture!.id,
      actionType: "confidence_update",
      value: "0.70"
    });

    const heartbeat = await runHeartbeat();
    expect(heartbeat.pendingOwner).toHaveLength(1);

    const updated = await getStore().getCapture(outcome.capture!.id);
    expect(updated?.status).toBe("pending_owner");
  });

  it("reprocesses reviewed captures on the next heartbeat run", async () => {
    const outcome = await captureThought({
      message: "Architecture needs simpler tradeoffs.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    await runHeartbeat();

    await applyWebAction({
      captureId: outcome.capture!.id,
      actionType: "confidence_update",
      value: "0.70"
    });
    await applyWebAction({
      captureId: outcome.capture!.id,
      actionType: "approve"
    });

    const secondPass = await runHeartbeat();
    expect(secondPass.promoted).toHaveLength(1);

    const updated = await getStore().getCapture(outcome.capture!.id);
    expect(updated?.status).toBe("processed");
    expect(updated?.libraryId).toBeTruthy();
  });

  it("ignores operational smoke-test captures instead of leaving them pending", async () => {
    await captureThought({
      message: "Preview smoke test from Codex after Anthropic switch.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    const outcome = await runHeartbeat();
    expect(outcome.ignored).toHaveLength(1);

    const captures = await getStore().listCaptures();
    expect(captures[0]?.status).toBe("processed");
    expect(captures[0]?.rejectedReason).toContain("Operational or smoke-test content");
  });
});
