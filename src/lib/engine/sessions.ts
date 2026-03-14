import { loadConfig } from "@/lib/config";
import { makeId } from "@/lib/ids";
import { getMemoryAdapter } from "@/lib/memory";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { Channel, SessionRecord } from "@/lib/types";

function isCurrentSession(session: SessionRecord): boolean {
  return Boolean(session.metadata?.isCurrent);
}

async function setCurrentSession(authorId: string, sessionId: string): Promise<void> {
  const store = getStore();
  const sessions = await store.listSessions(authorId);

  await Promise.all(
    sessions.map(async (session) => {
      const nextCurrent = session.id === sessionId;
      if (isCurrentSession(session) === nextCurrent) {
        return;
      }

      await store.saveSession({
        ...session,
        metadata: {
          ...(session.metadata ?? {}),
          isCurrent: nextCurrent
        }
      });
    })
  );
}

async function enforceActiveSessionLimit(authorId: string): Promise<void> {
  const store = getStore();
  const maxActive = loadConfig().session.session.max_active_sessions;
  const activeSessions = (await store.listSessions(authorId))
    .filter((session) => session.status === "active")
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));

  while (activeSessions.length >= maxActive) {
    const oldest = activeSessions.shift();
    if (!oldest) {
      break;
    }

    await store.saveSession({
      ...oldest,
      status: "archived",
      updatedAt: nowIso(),
      metadata: {
        ...(oldest.metadata ?? {}),
        isCurrent: false
      }
    });
  }
}

async function initializeSessionContext(topic: string): Promise<SessionRecord["context"]> {
  try {
    const adapter = getMemoryAdapter();
    const related = await adapter.search(topic, 5);
    return related.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      category: item.category,
      score: item.score
    }));
  } catch {
    return [];
  }
}

export async function ensureActiveSession(input: {
  authorId: string;
  channel: Channel;
  requestedSessionId?: string;
  requestedTopic?: string;
}): Promise<SessionRecord> {
  const store = getStore();
  const now = nowIso();

  if (input.requestedSessionId) {
    const existing = await store.getSession(input.requestedSessionId);
    if (existing) {
      const resumed = {
        ...existing,
        status: "active" as const,
        updatedAt: now,
        lastSignalAt: now,
        metadata: {
          ...(existing.metadata ?? {}),
          isCurrent: true
        }
      };
      await store.saveSession(resumed);
      await setCurrentSession(input.authorId, resumed.id);
      return resumed;
    }
  }

  const existingSessions = await store.listSessions(input.authorId);
  const active = existingSessions.find(
    (session) => session.status === "active" && isCurrentSession(session)
  );
  if (active) {
    const resumed = {
      ...active,
      updatedAt: now,
      lastSignalAt: now,
      metadata: {
        ...(active.metadata ?? {}),
        isCurrent: true
      }
    };
    await store.saveSession(resumed);
    await setCurrentSession(input.authorId, resumed.id);
    return resumed;
  }

  const created = await createSession({
    authorId: input.authorId,
    channel: input.channel,
    topic: input.requestedTopic ?? "Inbox"
  });

  return created;
}

export async function createSession(input: {
  authorId: string;
  channel: Channel;
  topic: string;
}): Promise<SessionRecord> {
  const store = getStore();
  const now = nowIso();
  await enforceActiveSessionLimit(input.authorId);

  const session: SessionRecord = {
    id: makeId("session"),
    topic: input.topic,
    status: "active",
    channel: input.channel,
    authorId: input.authorId,
    createdAt: now,
    updatedAt: now,
    lastSignalAt: now,
    context: await initializeSessionContext(input.topic),
    history: [],
    metadata: {
      origin: "user",
      isCurrent: true
    }
  };

  await store.saveSession(session);
  await setCurrentSession(input.authorId, session.id);
  return session;
}

export async function loadSession(
  authorId: string,
  sessionId: string
): Promise<SessionRecord | null> {
  const store = getStore();
  const session = await store.getSession(sessionId);
  if (!session) {
    return null;
  }

  const resumed = {
    ...session,
    status: "active" as const,
    updatedAt: nowIso(),
    lastSignalAt: nowIso(),
    metadata: {
      ...(session.metadata ?? {}),
      isCurrent: true
    }
  };

  await store.saveSession(resumed);
  await setCurrentSession(authorId, resumed.id);
  return resumed;
}

export async function archiveSession(
  sessionId: string
): Promise<SessionRecord | null> {
  const store = getStore();
  const session = await store.getSession(sessionId);
  if (!session) {
    return null;
  }

  const archived = {
    ...session,
    status: "archived" as const,
    updatedAt: nowIso(),
    metadata: {
      ...(session.metadata ?? {}),
      isCurrent: false
    }
  };
  await store.saveSession(archived);
  return archived;
}

export async function archiveCurrentSession(
  authorId: string
): Promise<SessionRecord | null> {
  const store = getStore();
  const sessions = await store.listSessions(authorId);
  const current =
    sessions.find((session) => session.status === "active" && isCurrentSession(session)) ??
    sessions.find((session) => session.status === "active");

  if (!current) {
    return null;
  }

  return archiveSession(current.id);
}

export async function appendSessionHistory(input: {
  sessionId: string;
  role: "user" | "system";
  text: string;
  source: Channel;
}): Promise<void> {
  const store = getStore();
  const session = await store.getSession(input.sessionId);
  if (!session) {
    return;
  }

  const nextHistory = [
    ...session.history,
    {
      at: nowIso(),
      role: input.role,
      text: input.text,
      source: input.source
    }
  ].slice(-40);

  await store.saveSession({
    ...session,
    history: nextHistory,
    updatedAt: nowIso(),
    lastSignalAt: nowIso()
  });
}

export async function mergeSessionContext(input: {
  sessionId: string;
  entries: SessionRecord["context"];
}): Promise<void> {
  const store = getStore();
  const session = await store.getSession(input.sessionId);
  if (!session || input.entries.length === 0) {
    return;
  }

  const seen = new Map(session.context.map((entry) => [entry.id, entry]));
  for (const entry of input.entries) {
    seen.set(entry.id, entry);
  }

  await store.saveSession({
    ...session,
    context: [...seen.values()].sort((left, right) => right.score - left.score).slice(0, 8),
    updatedAt: nowIso()
  });
}
