import fs from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import { captureThought } from "@/lib/engine/capture";
import { getStore, resetStoreForTests } from "@/lib/store";
import { resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-capture-store.json";
const libraryPath = "./data/test-capture-library";

beforeEach(async () => {
  process.env.CHRONOS_STORE = "file";
  process.env.CHRONOS_OWNER_IDS = "owner-dev";
  process.env.CHRONOS_FILE_STORE_PATH = storePath;
  process.env.CHRONOS_LTM_PATH = libraryPath;
  resetConfigForTests();
  resetStoreForTests();
  await fs.rm(resolveFromRoot(storePath), { force: true });
  await fs.rm(resolveFromRoot(libraryPath), { force: true, recursive: true });
});

describe("captureThought", () => {
  it("stores a clear thought silently", async () => {
    const outcome = await captureThought({
      message: "AI agents need intent alignment before they get more agency.",
      authorId: "owner-dev",
      channel: "claude_code"
    });

    expect(outcome.kind).toBe("silent");

    const captures = await getStore().listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.message).toContain("intent alignment");
    expect(captures[0]?.status).toBe("unprocessed");
    expect(captures[0]?.quickClassification?.category).toBe("ai-intelligence");
  });

  it("asks for clarification when the capture is too ambiguous", async () => {
    const outcome = await captureThought({
      message: "That thing we discussed",
      authorId: "owner-dev",
      channel: "discord"
    });

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toMatch(/specific idea|missing subject/i);

    const captures = await getStore().listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.clarification?.question).toBeTruthy();
  });

  it("applies the next reply to the pending ambiguous capture", async () => {
    const first = await captureThought({
      message: "That thing we discussed",
      authorId: "owner-dev",
      channel: "discord"
    });
    expect(first.kind).toBe("message");

    const second = await captureThought({
      message: "It was the AI agent workflow for finance analysts on Vercel.",
      authorId: "owner-dev",
      channel: "discord"
    });

    expect(second.capture?.id).toBe(first.capture?.id);
    const captures = await getStore().listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.clarification?.response).toContain("finance analysts");
  });
});
