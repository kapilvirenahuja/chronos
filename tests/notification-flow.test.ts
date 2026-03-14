import fs from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import {
  dispatchQueuedNotifications,
  queueHeartbeatNotification
} from "@/lib/engine/notifications";
import { getStore, resetStoreForTests } from "@/lib/store";
import { nowIso, resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-notification-store.json";

beforeEach(async () => {
  process.env.CHRONOS_STORE = "file";
  process.env.CHRONOS_OWNER_IDS = "owner-dev";
  process.env.CHRONOS_FILE_STORE_PATH = storePath;
  process.env.DISCORD_NOTIFICATION_CHANNEL_ID = "123456789012345678";
  process.env.DISCORD_BOT_TOKEN = "token";
  resetConfigForTests();
  resetStoreForTests();
  vi.restoreAllMocks();
  await fs.rm(resolveFromRoot(storePath), { force: true });
});

describe("notification flow", () => {
  it("queues a heartbeat review notification with the configured word cap", async () => {
    const record = await queueHeartbeatNotification({
      processed: [],
      promoted: [],
      ignored: [],
      pendingOwner: [
        {
          id: "capture-1",
          message:
            "This is a deliberately long capture that should still turn into a capped notification message for the owner review flow.",
          sessionId: "session-1",
          authorId: "owner-dev",
          source: "discord",
          status: "pending_owner",
          createdAt: nowIso(),
          updatedAt: nowIso()
        }
      ]
    });

    expect(record).not.toBeNull();
    expect(record?.status).toBe("queued");
    expect(record?.content.split(/\s+/).length).toBeLessThanOrEqual(55);

    const notifications = await getStore().listNotifications({
      statuses: ["queued"]
    });
    expect(notifications).toHaveLength(1);
  });

  it("dispatches due notifications through Discord", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true
    });
    vi.stubGlobal("fetch", fetchMock);

    await getStore().saveNotification({
      id: "notification-1",
      kind: "heartbeat_review",
      channel: "discord",
      status: "queued",
      content: "Chronos heartbeat needs review.",
      deliverAt: "2000-01-01T00:00:00.000Z",
      createdAt: nowIso()
    });

    const result = await dispatchQueuedNotifications({
      now: new Date("2026-03-13T04:00:00.000Z"),
      ignoreConversation: true
    });
    expect(result.sent).toBe(1);

    const notifications = await getStore().listNotifications();
    expect(notifications[0]?.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
