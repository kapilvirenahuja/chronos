import { executeTool } from "@/lib/agents/tools";
import { makeId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { CaptureLogEntry, DecisionLogEntry } from "@/lib/types";

export async function applyWebAction(input: {
  captureId: string;
  actionType:
    | "confidence_update"
    | "disagreement"
    | "question"
    | "approve"
    | "clarification_response";
  value?: string;
  runId?: string;
}): Promise<CaptureLogEntry | null> {
  const store = getStore();
  const existing = await store.getCapture(input.captureId);
  if (!existing) {
    return null;
  }

  const reviewNotes = {
    ...(existing.reviewNotes ?? {})
  };

  if (input.actionType === "confidence_update") {
    const parsed = Number(input.value);
    if (!Number.isNaN(parsed)) {
      reviewNotes.adjustedConfidence = Number(parsed.toFixed(2));
      if (existing.quickClassification) {
        existing.quickClassification = {
          ...existing.quickClassification,
          confidence: reviewNotes.adjustedConfidence
        };
      }
    }
  } else if (input.actionType === "disagreement") {
    reviewNotes.disagreement = input.value?.trim();
  } else if (input.actionType === "question") {
    reviewNotes.question = input.value?.trim();
  } else if (input.actionType === "approve") {
    reviewNotes.approved = true;
  } else if (existing.clarification) {
    existing.clarification = {
      ...existing.clarification,
      response: input.value?.trim(),
      respondedAt: nowIso()
    };
  }

  reviewNotes.lastActionAt = nowIso();

  const updated: CaptureLogEntry = {
    ...existing,
    status: "unprocessed",
    updatedAt: nowIso(),
    reviewNotes
  };

  if (input.runId) {
    await executeTool({
      runId: input.runId,
      toolName: "record_review_action",
      inputSummary: input.actionType,
      metadata: {
        captureId: updated.id,
        actionType: input.actionType
      },
      execute: () => store.saveCapture(updated),
      summarize: () => updated.id
    });
  } else {
    await store.saveCapture(updated);
  }

  const decision: DecisionLogEntry = {
    id: makeId("decision"),
    action: `web_${input.actionType}`,
    input: existing.message,
    captureId: updated.id,
    sessionId: updated.sessionId,
    confidence: updated.quickClassification?.confidence ?? null,
    thresholdUsed: "manual",
    autoApproved: false,
    userResponse: input.value?.trim() ?? null,
    evalAgentModel: "owner",
    decision: {
      actionType: input.actionType,
      value: input.value ?? null
    },
    createdAt: nowIso()
  };

  if (input.runId) {
    await executeTool({
      runId: input.runId,
      toolName: "write_decision_log",
      inputSummary: decision.action,
      metadata: {
        captureId: updated.id,
        sessionId: updated.sessionId,
        actionType: input.actionType
      },
      execute: () => store.saveDecision(decision),
      summarize: () => decision.action
    });
  } else {
    await store.saveDecision(decision);
  }
  return updated;
}
