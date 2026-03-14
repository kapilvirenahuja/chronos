import { makeId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { ToolCallRecord } from "@/lib/types";

export async function executeTool<T>(input: {
  runId?: string;
  agentInvocationId?: string;
  toolName: string;
  inputSummary?: string;
  metadata?: Record<string, unknown>;
  execute: () => Promise<T>;
  summarize?: (result: T) => string | undefined;
}): Promise<T> {
  const record =
    input.runId == null
      ? null
      : ({
          id: makeId("tool"),
          runId: input.runId,
          agentInvocationId: input.agentInvocationId,
          toolName: input.toolName,
          status: "requested",
          createdAt: nowIso(),
          inputSummary: input.inputSummary,
          metadata: input.metadata ?? {}
        } satisfies ToolCallRecord);

  if (record) {
    await getStore().saveToolCall(record);
  }

  try {
    const result = await input.execute();

    if (record) {
      await getStore().saveToolCall({
        ...record,
        status: "executed",
        outputSummary: input.summarize?.(result)
      });
    }

    return result;
  } catch (error) {
    if (record) {
      await getStore().saveToolCall({
        ...record,
        status: "failed",
        blockedReason: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
}
