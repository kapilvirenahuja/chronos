import { makeId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { AgentInvocationRecord } from "@/lib/types";

export async function executeAgent<T>(input: {
  runId?: string;
  recipeId: string;
  agentName: string;
  phase: AgentInvocationRecord["phase"];
  modelMode: AgentInvocationRecord["modelMode"];
  metadata?: Record<string, unknown>;
  execute: (context: { agentInvocationId?: string }) => Promise<T>;
  summarize?: (result: T) => string | undefined;
}): Promise<T> {
  const record =
    input.runId == null
      ? null
      : ({
          id: makeId("agent"),
          runId: input.runId,
          recipeId: input.recipeId,
          agentName: input.agentName,
          phase: input.phase,
          status: "running",
          modelMode: input.modelMode,
          startedAt: nowIso(),
          metadata: input.metadata ?? {}
        } satisfies AgentInvocationRecord);

  if (record) {
    await getStore().saveAgentInvocation(record);
  }

  try {
    const result = await input.execute({
      agentInvocationId: record?.id
    });

    if (record) {
      await getStore().saveAgentInvocation({
        ...record,
        status: "completed",
        completedAt: nowIso(),
        summary: input.summarize?.(result)
      });
    }

    return result;
  } catch (error) {
    if (record) {
      await getStore().saveAgentInvocation({
        ...record,
        status: "failed",
        completedAt: nowIso(),
        summary: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
}
