import { loadConfig } from "@/lib/config";
import { executeTool } from "@/lib/agents/tools";
import { makeId } from "@/lib/ids";
import { classifyWithAnthropic } from "@/lib/intelligence/anthropic";
import { quickClassify } from "@/lib/intelligence/classifier";
import { appendSessionHistory, ensureActiveSession } from "@/lib/engine/sessions";
import { isOwner, unknownUserMessage } from "@/lib/engine/trust";
import { getStore } from "@/lib/store";
import { loadSystemLayer } from "@/lib/system";
import { nowIso } from "@/lib/utils";

import type { CaptureLogEntry, CaptureOutcome, Channel, DecisionLogEntry } from "@/lib/types";

async function saveSessionMetadata(input: {
  sessionId: string;
  metadataPatch: Record<string, unknown>;
}): Promise<void> {
  const store = getStore();
  const session = await store.getSession(input.sessionId);
  if (!session) {
    return;
  }

  await store.saveSession({
    ...session,
    updatedAt: nowIso(),
    metadata: {
      ...(session.metadata ?? {}),
      ...input.metadataPatch
    }
  });
}

async function saveDecision(
  decision: DecisionLogEntry,
  trace?: {
    runId?: string;
  }
): Promise<void> {
  if (!trace?.runId) {
    await getStore().saveDecision(decision);
    return;
  }

  await executeTool({
    runId: trace.runId,
    toolName: "write_decision_log",
    inputSummary: decision.action,
    metadata: {
      action: decision.action,
      captureId: decision.captureId ?? null,
      sessionId: decision.sessionId ?? null
    },
    execute: () => getStore().saveDecision(decision),
    summarize: () => decision.action
  });
}

export async function captureThought(input: {
  message: string;
  authorId: string;
  channel: Channel;
  sessionId?: string;
  topic?: string;
  runId?: string;
}): Promise<CaptureOutcome> {
  loadSystemLayer();
  loadConfig();

  if (!isOwner(input.authorId)) {
    return {
      kind: "message",
      message: unknownUserMessage()
    };
  }

  const message = input.message.trim();
  if (!message) {
    return { kind: "ignored" };
  }

  const store = getStore();
  const session = await ensureActiveSession({
    authorId: input.authorId,
    channel: input.channel,
    requestedSessionId: input.sessionId,
    requestedTopic: input.topic
  });
  const now = nowIso();
  const pendingCaptureId =
    typeof session.metadata?.pendingCaptureClarificationId === "string"
      ? session.metadata.pendingCaptureClarificationId
      : null;

  if (pendingCaptureId) {
    const pendingCapture = await store.getCapture(pendingCaptureId);
    if (pendingCapture?.clarification?.question && !pendingCapture.clarification.response) {
      const combined = `${pendingCapture.message}\n\nClarification: ${message}`;
      const updatedClassification =
        input.runId == null
          ? (await classifyWithAnthropic(combined)) ?? quickClassify(combined)
          : await executeTool({
              runId: input.runId,
              toolName: "capture_classification",
              inputSummary: combined,
              metadata: {
                followUp: true,
                channel: input.channel
              },
              execute: async () =>
                (await classifyWithAnthropic(combined)) ?? quickClassify(combined),
              summarize: (result) =>
                `${result.category ?? "unclassified"}:${result.confidence ?? "null"}`
            });
      const updatedCapture: CaptureLogEntry = {
        ...pendingCapture,
        updatedAt: now,
        status: "unprocessed",
        quickClassification: updatedClassification,
        clarification: {
          ...pendingCapture.clarification,
          response: message,
          respondedAt: now
        }
      };

      await store.saveCapture(updatedCapture);
      await appendSessionHistory({
        sessionId: session.id,
        role: "user",
        text: message,
        source: input.channel
      });
      await saveSessionMetadata({
        sessionId: session.id,
        metadataPatch: {
          pendingCaptureClarificationId: null,
          pendingCaptureQuestion: null
        }
      });

      const followUpDecision: DecisionLogEntry = {
        id: makeId("decision"),
        action: "classification",
        input: combined,
        captureId: updatedCapture.id,
        sessionId: updatedCapture.sessionId,
        confidence: updatedClassification.confidence,
        thresholdUsed: updatedClassification.ambiguous ? "ask" : "manual",
        autoApproved: !updatedClassification.ambiguous,
        userResponse: message,
        evalAgentModel: process.env.ANTHROPIC_API_KEY
          ? loadConfig().engine.engine.model_for_eval_agent
          : "heuristic",
        decision: {
          category: updatedClassification.category,
          confidence: updatedClassification.confidence,
          ambiguous: updatedClassification.ambiguous,
          clarificationResolved: !updatedClassification.ambiguous
        },
        metadata: {
          source: input.channel,
          reasoning: updatedClassification.reasoning
        },
        createdAt: now
      };
      await saveDecision(followUpDecision, {
        runId: input.runId
      });

      if (
        updatedClassification.ambiguous &&
        updatedClassification.clarificationQuestion
      ) {
        updatedCapture.clarification = {
          ...updatedCapture.clarification,
          question: updatedClassification.clarificationQuestion,
          askedAt: now
        };
        await store.saveCapture(updatedCapture);
        await saveSessionMetadata({
          sessionId: session.id,
          metadataPatch: {
            pendingCaptureClarificationId: updatedCapture.id,
            pendingCaptureQuestion: updatedClassification.clarificationQuestion
          }
        });
        await appendSessionHistory({
          sessionId: session.id,
          role: "system",
          text: updatedClassification.clarificationQuestion,
          source: "system"
        });
        return {
          kind: "message",
          message: updatedClassification.clarificationQuestion,
          capture: updatedCapture
        };
      }

      return {
        kind: "silent",
        capture: updatedCapture
      };
    }
  }

  const classification =
    input.runId == null
      ? (await classifyWithAnthropic(message)) ?? quickClassify(message)
      : await executeTool({
          runId: input.runId,
          toolName: "capture_classification",
          inputSummary: message,
          metadata: {
            followUp: false,
            channel: input.channel
          },
          execute: async () =>
            (await classifyWithAnthropic(message)) ?? quickClassify(message),
          summarize: (result) =>
            `${result.category ?? "unclassified"}:${result.confidence ?? "null"}`
        });
  const capture: CaptureLogEntry = {
    id: makeId("capture"),
    message,
    sessionId: session.id,
    authorId: input.authorId,
    source: input.channel,
    status: "unprocessed",
    createdAt: now,
    updatedAt: now,
    quickClassification: classification,
    reviewNotes: {}
  };

  if (classification.ambiguous && classification.clarificationQuestion) {
    capture.clarification = {
      question: classification.clarificationQuestion,
      askedAt: now
    };
  }

  await store.saveCapture(capture);
  await appendSessionHistory({
    sessionId: session.id,
    role: "user",
    text: message,
    source: input.channel
  });

  const decision: DecisionLogEntry = {
    id: makeId("decision"),
    action: "classification",
    input: message,
    captureId: capture.id,
    sessionId: capture.sessionId,
    confidence: classification.confidence,
    thresholdUsed: classification.ambiguous ? "ask" : "auto",
    autoApproved: !classification.ambiguous,
    evalAgentModel: process.env.ANTHROPIC_API_KEY
      ? loadConfig().engine.engine.model_for_eval_agent
      : "heuristic",
    decision: {
      category: classification.category,
      confidence: classification.confidence,
      ambiguous: classification.ambiguous
    },
    metadata: {
      source: input.channel,
      reasoning: classification.reasoning
    },
    createdAt: now
  };

  await saveDecision(decision, {
    runId: input.runId
  });

  if (classification.ambiguous && classification.clarificationQuestion) {
    await saveSessionMetadata({
      sessionId: session.id,
      metadataPatch: {
        pendingCaptureClarificationId: capture.id,
        pendingCaptureQuestion: classification.clarificationQuestion
      }
    });
    await appendSessionHistory({
      sessionId: session.id,
      role: "system",
      text: classification.clarificationQuestion,
      source: "system"
    });
    return {
      kind: "message",
      message: classification.clarificationQuestion,
      capture
    };
  }

  return {
    kind: "silent",
    capture
  };
}
