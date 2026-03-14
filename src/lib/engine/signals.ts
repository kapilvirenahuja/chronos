import { loadConfig } from "@/lib/config";
import { makeId } from "@/lib/ids";
import { askChronos } from "@/lib/engine/ask";
import { captureThought } from "@/lib/engine/capture";
import { runHeartbeat } from "@/lib/engine/heartbeat";
import {
  archiveCurrentSession,
  archiveSession,
  createSession,
  loadSession
} from "@/lib/engine/sessions";
import { applyWebAction } from "@/lib/engine/web-actions";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type {
  CaptureOutcome,
  Channel,
  ExecutionRun,
  HeartbeatOutcome,
  SignalEnvelope
} from "@/lib/types";

type CaptureSignalInput = {
  type: "capture";
  text: string;
  author: string;
  channel?: Extract<Channel, "claude_code" | "web" | "discord">;
  session_id?: string;
  topic?: string;
  timestamp?: string;
};

type AskSignalInput = {
  type: "ask";
  question: string;
  author: string;
  channel?: Extract<Channel, "claude_code" | "web" | "discord">;
  session_id?: string;
  topic?: string;
  timestamp?: string;
};

type WebActionSignalInput = {
  type: "web_action";
  capture_id: string;
  action_type:
    | "confidence_update"
    | "disagreement"
    | "question"
    | "approve"
    | "clarification_response";
  value?: string;
  author?: string;
  session_id?: string;
  page_id?: string;
  timestamp?: string;
};

type SessionCommandSignalInput = {
  type: "session_command";
  command: "new" | "load" | "clear" | "sessions";
  author: string;
  channel?: Extract<Channel, "claude_code" | "web" | "discord">;
  session_id?: string;
  topic?: string;
  timestamp?: string;
};

type HeartbeatSignalInput = {
  type: "heartbeat";
  author?: string;
  timestamp?: string;
};

export type SignalInput =
  | CaptureSignalInput
  | AskSignalInput
  | WebActionSignalInput
  | SessionCommandSignalInput
  | HeartbeatSignalInput;

export type SignalOutcome =
  | CaptureOutcome
  | {
      status: "ok";
      capture: Awaited<ReturnType<typeof applyWebAction>>;
    }
  | HeartbeatOutcome;

export interface QueuedSignalReceipt {
  accepted: true;
  runId: string;
  status: "queued";
}

type CaptureSignal = SignalEnvelope & {
  kind: "capture";
  channel: "claude_code" | "web" | "discord";
  payload: {
    text: string;
  };
};

type AskSignal = SignalEnvelope & {
  kind: "ask";
  channel: "claude_code" | "web" | "discord";
  payload: {
    question: string;
  };
};

type WebActionSignal = SignalEnvelope & {
  kind: "web_action";
  channel: "web_action";
  payload: {
    capture_id: string;
    action_type:
      | "confidence_update"
      | "disagreement"
      | "question"
      | "approve"
      | "clarification_response";
    value?: string;
    page_id?: string;
  };
};

type HeartbeatSignal = SignalEnvelope & {
  kind: "heartbeat";
  channel: "heartbeat";
  payload: {};
};

type SessionCommandSignal = SignalEnvelope & {
  kind: "session_command";
  channel: "claude_code" | "web" | "discord";
  payload: {
    command: "new" | "load" | "clear" | "sessions";
  };
};

function ownerFallback(): string {
  return loadConfig().trust.trust.owner_ids[0] ?? "system";
}

function signalId(kind: SignalEnvelope["kind"]): string {
  return makeId(`signal-${kind}`);
}

function userChannel(
  channel: SignalEnvelope["channel"]
): "discord" | "claude_code" | "web" {
  return channel === "discord" || channel === "web" ? channel : "claude_code";
}

function recipeIdForSignal(signal: SignalEnvelope): string {
  switch (signal.kind) {
    case "ask":
      return "consult-cto";
    case "capture":
      return "capture";
    case "heartbeat":
      return "heartbeat";
    case "web_action":
      return "capture-review";
    case "session_command":
      return "session-command";
  }
}

function executionPatternForSignal(
  signal: SignalEnvelope
): ExecutionRun["executionPattern"] {
  return signal.kind === "ask" || signal.kind === "heartbeat" ? "agentic" : "one_shot";
}

function assignedAgentForSignal(signal: SignalEnvelope): string | undefined {
  if (signal.kind === "ask") {
    return "phoenix:strategy-guardian";
  }

  if (signal.kind === "heartbeat") {
    return "phoenix:heartbeat";
  }

  return undefined;
}

function gateForCaptureOutcome(outcome: CaptureOutcome): ExecutionRun["gate"] {
  if (outcome.kind === "silent" || outcome.kind === "ignored") {
    return "none";
  }

  if (outcome.message?.includes("/review/clarifications/")) {
    return "clarification";
  }

  if (outcome.message?.includes("**Status**: blocked")) {
    return "blocked";
  }

  if (
    outcome.message?.includes("/review/briefs/") ||
    outcome.message?.includes("/review/captures/") ||
    outcome.message?.includes("/review/decisions/") ||
    outcome.message?.includes("/review/sessions/") ||
    outcome.message?.includes("Classification accuracy:")
  ) {
    return "synthesis";
  }

  return "none";
}

function statusForCaptureOutcome(outcome: CaptureOutcome): ExecutionRun["status"] {
  const gate = gateForCaptureOutcome(outcome);
  return gate === "clarification" ? "awaiting_user" : "completed";
}

function gateForHeartbeatOutcome(): ExecutionRun["gate"] {
  return "synthesis";
}

async function queueRun(signal: SignalEnvelope): Promise<ExecutionRun> {
  const run: ExecutionRun = {
    id: makeId("run"),
    signalId: signal.id,
    recipeId: recipeIdForSignal(signal),
    executionPattern: executionPatternForSignal(signal),
    status: "queued",
    gate: "none",
    assignedAgent: assignedAgentForSignal(signal),
    retryCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: {
      channel: signal.channel,
      signalKind: signal.kind
    }
  };

  await getStore().saveRun(run);
  return run;
}

async function markRunRunning(run: ExecutionRun): Promise<ExecutionRun> {
  const next: ExecutionRun = {
    ...run,
    status: "running",
    updatedAt: nowIso(),
    startedAt: run.startedAt ?? nowIso()
  };
  await getStore().saveRun(next);
  return next;
}

async function completeRun(
  run: ExecutionRun,
  input: {
    status: ExecutionRun["status"];
    gate: ExecutionRun["gate"];
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await getStore().saveRun({
    ...run,
    status: input.status,
    gate: input.gate,
    updatedAt: nowIso(),
    completedAt: input.status === "completed" ? nowIso() : undefined,
    metadata: {
      ...(run.metadata ?? {}),
      ...(input.metadata ?? {})
    }
  });
}

async function failRun(run: ExecutionRun, error: unknown): Promise<void> {
  await getStore().saveRun({
    ...run,
    status: "failed",
    gate: "error",
    updatedAt: nowIso(),
    completedAt: nowIso(),
    failureReason: error instanceof Error ? error.message : String(error)
  });
}

export async function processSignal(signal: CaptureSignal): Promise<CaptureOutcome>;
export async function processSignal(signal: AskSignal): Promise<CaptureOutcome>;
export async function processSignal(
  signal: WebActionSignal
): Promise<{
  status: "ok";
  capture: Awaited<ReturnType<typeof applyWebAction>>;
}>;
export async function processSignal(signal: HeartbeatSignal): Promise<HeartbeatOutcome>;
export async function processSignal(signal: SessionCommandSignal): Promise<CaptureOutcome>;
export async function processSignal(signal: SignalEnvelope): Promise<SignalOutcome>;
export async function processSignal(signal: SignalEnvelope): Promise<SignalOutcome> {
  const store = getStore();
  await store.saveSignal(signal);
  const run = await queueRun(signal);

  return processQueuedRun(run.id);
}

export async function enqueueSignal(signal: SignalEnvelope): Promise<ExecutionRun> {
  const store = getStore();
  await store.saveSignal(signal);
  return queueRun(signal);
}

export async function submitSignal(
  signal: SignalEnvelope,
  options?: {
    dispatch?: boolean;
  }
): Promise<SignalOutcome | QueuedSignalReceipt> {
  const dispatch =
    options?.dispatch ??
    (process.env.CHRONOS_SIGNAL_EXECUTION_MODE ?? "inline") !== "queued";

  if (dispatch) {
    return processSignal(signal);
  }

  const run = await enqueueSignal(signal);
  return {
    accepted: true,
    runId: run.id,
    status: "queued"
  };
}

export async function processQueuedRun(runId: string): Promise<SignalOutcome> {
  const store = getStore();
  const existingRun = await store.getRun(runId);
  if (!existingRun) {
    throw new Error(`Execution run ${runId} was not found.`);
  }

  const signal = await store.getSignal(existingRun.signalId);
  if (!signal) {
    throw new Error(`Signal ${existingRun.signalId} was not found for run ${runId}.`);
  }

  const run = await markRunRunning(existingRun);

  try {
    if (signal.kind === "capture") {
      const outcome = await captureThought({
        message: String(signal.payload.text ?? ""),
        authorId: signal.authorId,
        channel: userChannel(signal.channel),
        sessionId: signal.sessionId,
        topic: signal.topic,
        runId: run.id
      });
      await completeRun(run, {
        status: statusForCaptureOutcome(outcome),
        gate: gateForCaptureOutcome(outcome),
        metadata: {
          outcomeKind: outcome.kind,
          captureId: outcome.capture?.id
        }
      });
      return outcome;
    }

    if (signal.kind === "ask") {
      const outcome = await askChronos({
        question: String(signal.payload.question ?? ""),
        authorId: signal.authorId,
        channel: userChannel(signal.channel),
        sessionId: signal.sessionId,
        topic: signal.topic,
        runId: run.id
      });
      await completeRun(run, {
        status: statusForCaptureOutcome(outcome),
        gate: gateForCaptureOutcome(outcome),
        metadata: {
          outcomeKind: outcome.kind
        }
      });
      return outcome;
    }

    if (signal.kind === "web_action") {
      const updated = await applyWebAction({
        captureId: String(signal.payload.capture_id ?? ""),
        actionType: signal.payload.action_type as
          | "confidence_update"
          | "disagreement"
          | "question"
          | "approve"
          | "clarification_response",
        value:
          typeof signal.payload.value === "string" ? signal.payload.value : undefined,
        runId: run.id
      });

      await completeRun(run, {
        status: "completed",
        gate: "none",
        metadata: {
          captureId: updated?.id ?? null,
          actionType: signal.payload.action_type
        }
      });

      return {
        status: "ok",
        capture: updated
      };
    }

    if (signal.kind === "session_command") {
      const command = signal.payload.command;

      if (command === "new") {
        const session = await createSession({
          authorId: signal.authorId,
          channel: userChannel(signal.channel),
          topic: signal.topic ?? "Untitled session"
        });
        const outcome: CaptureOutcome = {
          kind: "message",
          message: `Active session: ${session.topic} (${session.id})`
        };
        await completeRun(run, {
          status: "completed",
          gate: "none",
          metadata: {
            command,
            sessionId: session.id
          }
        });
        return outcome;
      }

      if (command === "load") {
        const requestedId = signal.sessionId;
        if (!requestedId) {
          await completeRun(run, {
            status: "completed",
            gate: "none",
            metadata: { command, sessionId: null }
          });
          return {
            kind: "message",
            message: "Provide `session_id` to load a session."
          };
        }

        const session = await loadSession(signal.authorId, requestedId);
        const loadOutcome: CaptureOutcome = session
          ? {
              kind: "message",
              message: `Loaded ${session.topic} (${session.id}) as the active session.`
            }
          : {
              kind: "message",
              message: `Session ${requestedId} was not found.`
            };
        await completeRun(run, {
          status: "completed",
          gate: "none",
          metadata: {
            command,
            sessionId: session?.id ?? requestedId
          }
        });
        return loadOutcome;
      }

      if (command === "clear") {
        const archived = signal.sessionId
          ? await archiveSession(signal.sessionId)
          : await archiveCurrentSession(signal.authorId);
        const clearOutcome: CaptureOutcome = {
          kind: "message",
          message: archived
            ? `Archived ${archived.topic} (${archived.id})`
            : signal.sessionId
              ? `Session ${signal.sessionId} was not found.`
              : "No active session to archive."
        };
        await completeRun(run, {
          status: "completed",
          gate: "none",
          metadata: {
            command,
            sessionId: archived?.id ?? signal.sessionId ?? null
          }
        });
        return clearOutcome;
      }

      const sessions = await getStore().listSessions(signal.authorId);
      const lines = sessions
        .slice(0, 10)
        .map(
          (session) =>
            `- ${Boolean(session.metadata?.isCurrent) ? "[current] " : ""}${session.topic} | ${session.status} | ${session.id} | ${session.updatedAt}`
        );
      const sessionsOutcome: CaptureOutcome = {
        kind: "message",
        message: sessions.length === 0 ? "No sessions yet." : `Sessions\n${lines.join("\n")}`
      };
      await completeRun(run, {
        status: "completed",
        gate: "none",
        metadata: {
          command,
          count: sessions.length
        }
      });
      return sessionsOutcome;
    }

    const outcome = await runHeartbeat(undefined, {
      runId: run.id
    });
    await completeRun(run, {
      status: "completed",
      gate: gateForHeartbeatOutcome(),
      metadata: {
        processed: outcome.processed.length,
        promoted: outcome.promoted.length,
        pendingOwner: outcome.pendingOwner.length,
        ignored: outcome.ignored.length
      }
    });
    return outcome;
  } catch (error) {
    await failRun(run, error);
    throw error;
  }
}

export async function dispatchQueuedRuns(limit = 10): Promise<{
  runs: ExecutionRun[];
  outcomes: SignalOutcome[];
}> {
  const store = getStore();
  const queued = await store.listRuns({
    statuses: ["queued"],
    limit
  });
  const outcomes: SignalOutcome[] = [];

  for (const run of queued) {
    outcomes.push(await processQueuedRun(run.id));
  }

  return {
    runs: queued,
    outcomes
  };
}

export function normalizeCaptureSignal(input: CaptureSignalInput): CaptureSignal {
  return {
    id: signalId("capture"),
    kind: "capture",
    channel: input.channel ?? "claude_code",
    authorId: input.author,
    sessionId: input.session_id,
    topic: input.topic,
    createdAt: input.timestamp ?? nowIso(),
    payload: {
      text: input.text
    }
  };
}

export function normalizeAskSignal(input: AskSignalInput): AskSignal {
  return {
    id: signalId("ask"),
    kind: "ask",
    channel: input.channel ?? "claude_code",
    authorId: input.author,
    sessionId: input.session_id,
    topic: input.topic,
    createdAt: input.timestamp ?? nowIso(),
    payload: {
      question: input.question
    }
  };
}

export function normalizeWebActionSignal(
  input: Omit<WebActionSignalInput, "author" | "timestamp">
): WebActionSignal {
  return {
    id: signalId("web_action"),
    kind: "web_action",
    channel: "web_action",
    authorId: ownerFallback(),
    sessionId: input.session_id,
    createdAt: nowIso(),
    payload: {
      capture_id: input.capture_id,
      action_type: input.action_type,
      value: input.value,
      page_id: input.page_id
    }
  };
}

export function normalizeSessionCommandSignal(
  input: SessionCommandSignalInput
): SessionCommandSignal {
  return {
    id: signalId("session_command"),
    kind: "session_command",
    channel: input.channel ?? "discord",
    authorId: input.author,
    sessionId: input.session_id,
    topic: input.topic,
    createdAt: input.timestamp ?? nowIso(),
    payload: {
      command: input.command
    }
  };
}

export function normalizeHeartbeatSignal(): HeartbeatSignal {
  return {
    id: signalId("heartbeat"),
    kind: "heartbeat",
    channel: "heartbeat",
    authorId: "system",
    createdAt: nowIso(),
    payload: {}
  };
}
