import { loadConfig } from "@/lib/config";
import { executeTool } from "@/lib/agents/tools";
import { makeId } from "@/lib/ids";
import { queueHeartbeatNotification } from "@/lib/engine/notifications";
import {
  classifyWithAnthropic,
  scoreClassificationConfidence
} from "@/lib/intelligence/anthropic";
import { evaluateContentQuality, quickClassify } from "@/lib/intelligence/classifier";
import { getMemoryAdapter } from "@/lib/memory";
import { getStore } from "@/lib/store";
import { loadSystemLayer } from "@/lib/system";
import { nowIso } from "@/lib/utils";

import type { CaptureLogEntry, DecisionLogEntry, HeartbeatOutcome } from "@/lib/types";

async function deepenClassification(
  capture: CaptureLogEntry,
  relatedCount: number
) {
  const baseline =
    (await classifyWithAnthropic(capture.message, { includeHeartbeat: true })) ??
    capture.quickClassification ??
    quickClassify(capture.message);
  if (!baseline.category || baseline.confidence == null) {
    return baseline;
  }

  const boost = capture.message.length > 48 ? 0.08 : 0.03;
  const contextualBoost = relatedCount > 0 ? 0.04 : 0;
  const evaluatedConfidence =
    (await scoreClassificationConfidence({
      message: capture.message,
      category: baseline.category,
      relatedCount
    })) ??
    Number(
      Math.min(0.96, baseline.confidence + boost + contextualBoost).toFixed(2)
    );

  const confidence =
    capture.reviewNotes?.adjustedConfidence ?? evaluatedConfidence;

  return {
    ...baseline,
    confidence,
    reasoning:
      capture.reviewNotes?.adjustedConfidence != null
        ? `${baseline.reasoning} Owner adjusted the confidence before heartbeat review.`
        : `${baseline.reasoning} Heartbeat confidence adjusted using longer-form review.`
  };
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
      captureId: decision.captureId ?? null,
      sessionId: decision.sessionId ?? null
    },
    execute: () => getStore().saveDecision(decision),
    summarize: () => decision.action
  });
}

export async function runHeartbeat(
  limit = loadConfig().heartbeat.heartbeat.batch_size,
  trace?: {
    runId?: string;
  }
): Promise<HeartbeatOutcome> {
  loadSystemLayer();
  const config = loadConfig();
  const store = getStore();
  const adapter = getMemoryAdapter();
  const now = nowIso();

  const captures = (await store.listCaptures({
    statuses: ["unprocessed"],
    limit
  })).sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const outcome: HeartbeatOutcome = {
    processed: [],
    promoted: [],
    pendingOwner: [],
    ignored: []
  };
  const autoThreshold = config.confidence.confidence.ltm_write.auto_threshold;
  const askThreshold = config.confidence.confidence.ltm_write.ask_threshold;

  for (const capture of captures) {
    const related =
      trace?.runId == null
        ? await adapter.search(capture.message, 3)
        : await executeTool({
            runId: trace.runId,
            toolName: "search_memory",
            inputSummary: capture.id,
            metadata: {
              captureId: capture.id,
              query: capture.message
            },
            execute: () => adapter.search(capture.message, 3),
            summarize: (result) => `${result.length} related signal(s)`
          });
    const deepClassification =
      trace?.runId == null
        ? await deepenClassification(capture, related.length)
        : await executeTool({
            runId: trace.runId,
            toolName: "heartbeat_classification",
            inputSummary: capture.id,
            metadata: {
              captureId: capture.id,
              relatedCount: related.length
            },
            execute: () => deepenClassification(capture, related.length),
            summarize: (result) =>
              `${result.category ?? "unclassified"}:${result.confidence ?? "null"}`
          });
    const quality =
      trace?.runId == null
        ? evaluateContentQuality(capture.message, related)
        : await executeTool({
            runId: trace.runId,
            toolName: "evaluate_content_quality",
            inputSummary: capture.id,
            metadata: {
              captureId: capture.id,
              relatedCount: related.length
            },
            execute: async () => evaluateContentQuality(capture.message, related),
            summarize: (result) => result.result
          });

    let updated: CaptureLogEntry = {
      ...capture,
      deepClassification,
      contentQuality: {
        result: quality.result,
        reason: quality.reason,
        relatedIds: related.map((item) => item.id)
      },
      updatedAt: now
    };

    let decisionAction = "classification";
    let autoApproved = false;
    let confidence = deepClassification.confidence ?? null;
    let thresholdUsed: DecisionLogEntry["thresholdUsed"] = "ask";
    const ownerApproved = Boolean(updated.reviewNotes?.approved);

    if (capture.clarification?.question && !capture.clarification.response) {
      updated = {
        ...updated,
        status: "pending_owner",
        contentQuality: {
          result: "needs_context",
          reason: "Owner clarification is still required before promotion.",
          relatedIds: related.map((item) => item.id)
        }
      };
      decisionAction = "owner_review_required";
      outcome.processed.push(updated);
      outcome.pendingOwner.push(updated);
    } else if (quality.result === "noise" || quality.result === "duplicate") {
      updated = {
        ...updated,
        status: "processed",
        processedAt: now,
        rejectedReason: quality.reason
      };
      decisionAction = "classification";
      autoApproved = true;
      thresholdUsed = "auto";
      outcome.ignored.push(updated);
      outcome.processed.push(updated);
    } else if (confidence != null && confidence < askThreshold && !ownerApproved) {
      updated = {
        ...updated,
        status: "processed",
        processedAt: now,
        rejectedReason: `Confidence ${confidence.toFixed(2)} fell below the LTM review threshold (${askThreshold.toFixed(2)}).`
      };
      decisionAction = "classification";
      thresholdUsed = "ask";
      outcome.ignored.push(updated);
      outcome.processed.push(updated);
    } else if (
      quality.result === "needs_context" ||
      quality.result === "needs_research" ||
      !deepClassification.category ||
      deepClassification.confidence == null ||
      (!ownerApproved &&
        (Boolean(updated.reviewNotes?.disagreement) ||
          Boolean(updated.reviewNotes?.question))) ||
      (!ownerApproved && deepClassification.confidence < autoThreshold)
    ) {
      updated = {
        ...updated,
        status: "pending_owner"
      };
      decisionAction = "owner_review_required";
      outcome.pendingOwner.push(updated);
      outcome.processed.push(updated);
    } else {
      const writeResult =
        trace?.runId == null
          ? await adapter.write({
              capture: updated,
              category: deepClassification.category!,
              related,
              note: quality.reason.includes("Contrarian signal") ? quality.reason : undefined
            })
          : await executeTool({
              runId: trace.runId,
              toolName: "promote_capture",
              inputSummary: updated.id,
              metadata: {
                captureId: updated.id,
                category: deepClassification.category
              },
              execute: () =>
                adapter.write({
                  capture: updated,
                  category: deepClassification.category!,
                  related,
                  note: quality.reason.includes("Contrarian signal")
                    ? quality.reason
                    : undefined
                }),
              summarize: (result) => result.libraryId
            });

      updated = {
        ...updated,
        status: "processed",
        processedAt: now,
        rejectedReason: undefined,
        libraryId: writeResult.libraryId,
        reviewNotes: ownerApproved
          ? {
              ...updated.reviewNotes,
              approved: false
            }
          : updated.reviewNotes
      };
      decisionAction = "ltm_write";
      autoApproved = !ownerApproved;
      thresholdUsed = ownerApproved ? "manual" : "auto";
      outcome.promoted.push(updated);
      outcome.processed.push(updated);
    }

    await store.saveCapture(updated);

    const decision: DecisionLogEntry = {
      id: makeId("decision"),
      action: decisionAction,
      input: updated.message,
      captureId: updated.id,
      sessionId: updated.sessionId,
      confidence,
      thresholdUsed,
      autoApproved,
      evalAgentModel: process.env.ANTHROPIC_API_KEY
        ? config.engine.engine.model_for_eval_agent
        : "heuristic",
      decision: {
        category: updated.deepClassification?.category ?? null,
        status: updated.status,
        quality: updated.contentQuality?.result ?? null,
        libraryId: updated.libraryId ?? null
      },
      metadata: {
        reasoning: updated.contentQuality?.reason ?? updated.deepClassification?.reasoning,
        relatedIds: updated.contentQuality?.relatedIds ?? []
      },
      createdAt: nowIso()
    };

    await saveDecision(decision, trace);
  }

  if (trace?.runId) {
    await executeTool({
      runId: trace.runId,
      toolName: "queue_notification",
      inputSummary: `pending_owner:${outcome.pendingOwner.length}`,
      metadata: {
        pendingOwner: outcome.pendingOwner.length
      },
      execute: () => queueHeartbeatNotification(outcome),
      summarize: () => `queued review notifications for ${outcome.pendingOwner.length} capture(s)`
    });
  } else {
    await queueHeartbeatNotification(outcome);
  }

  return outcome;
}
