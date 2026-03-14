import fs from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import { captureThought } from "@/lib/engine/capture";
import { handleCommand } from "@/lib/engine/commands";
import { getStore, resetStoreForTests } from "@/lib/store";
import { resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-session-store.json";
const libraryPath = "./data/test-session-library";

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

describe("session commands", () => {
  it("tracks one current session across new, load, and clear", async () => {
    const first = await handleCommand({
      name: "new",
      authorId: "owner-dev",
      options: { topic: "First topic" }
    });
    const second = await handleCommand({
      name: "new",
      authorId: "owner-dev",
      options: { topic: "Second topic" }
    });

    expect(first.kind).toBe("message");
    expect(second.kind).toBe("message");

    const sessionsAfterCreate = await getStore().listSessions("owner-dev");
    const currentAfterCreate = sessionsAfterCreate.find((session) =>
      Boolean(session.metadata?.isCurrent)
    );
    expect(currentAfterCreate?.topic).toBe("Second topic");

    const original = sessionsAfterCreate.find((session) => session.topic === "First topic");
    expect(original).toBeTruthy();

    await handleCommand({
      name: "load",
      authorId: "owner-dev",
      options: { session_id: original!.id }
    });

    const capture = await captureThought({
      message: "Leadership needs cleaner ownership boundaries.",
      authorId: "owner-dev",
      channel: "claude_code"
    });
    expect(capture.capture?.sessionId).toBe(original!.id);

    const loadedSession = await getStore().getSession(original!.id);
    expect(loadedSession?.history.at(-1)?.text).toBe(
      "Leadership needs cleaner ownership boundaries."
    );

    await handleCommand({
      name: "clear",
      authorId: "owner-dev",
      options: {}
    });

    const sessionsAfterClear = await getStore().listSessions("owner-dev");
    expect(
      sessionsAfterClear.some(
        (session) => Boolean(session.metadata?.isCurrent) && session.status === "active"
      )
    ).toBe(false);

    const sessionSignals = await getStore().listSignals({ kinds: ["session_command"] });
    expect(sessionSignals.length).toBeGreaterThanOrEqual(4);
    const sessionRuns = await getStore().listRuns({ recipeId: "session-command" });
    expect(sessionRuns.length).toBeGreaterThanOrEqual(4);
  });
});
