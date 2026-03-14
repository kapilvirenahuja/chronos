import { loadConfig } from "@/lib/config";
import { BlobChronosStore } from "@/lib/store/blob-store";
import { FileChronosStore } from "@/lib/store/file-store";
import { PostgresChronosStore } from "@/lib/store/postgres-store";
import { resolveFromRoot } from "@/lib/utils";

import type {
  AgentInvocationRecord,
  ArtifactRecord,
  CaptureLogEntry,
  CaptureStatus,
  DecisionLogEntry,
  ExecutionRun,
  NotificationRecord,
  SignalEnvelope,
  SessionRecord,
  ToolCallRecord
} from "@/lib/types";

export interface ChronosStore {
  saveSignal(signal: SignalEnvelope): Promise<SignalEnvelope>;
  getSignal(signalId: string): Promise<SignalEnvelope | null>;
  listSignals(options?: {
    kinds?: SignalEnvelope["kind"][];
    authorId?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<SignalEnvelope[]>;
  saveRun(run: ExecutionRun): Promise<ExecutionRun>;
  getRun(runId: string): Promise<ExecutionRun | null>;
  listRuns(options?: {
    statuses?: ExecutionRun["status"][];
    signalId?: string;
    recipeId?: string;
    limit?: number;
  }): Promise<ExecutionRun[]>;
  saveAgentInvocation(record: AgentInvocationRecord): Promise<AgentInvocationRecord>;
  listAgentInvocations(options?: {
    runId?: string;
    agentName?: string;
    limit?: number;
  }): Promise<AgentInvocationRecord[]>;
  saveToolCall(record: ToolCallRecord): Promise<ToolCallRecord>;
  listToolCalls(options?: {
    runId?: string;
    agentInvocationId?: string;
    toolName?: string;
    limit?: number;
  }): Promise<ToolCallRecord[]>;
  saveArtifact(record: ArtifactRecord): Promise<ArtifactRecord>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
  listArtifacts(options?: {
    runId?: string;
    artifactType?: ArtifactRecord["artifactType"];
    sessionId?: string;
    limit?: number;
  }): Promise<ArtifactRecord[]>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(authorId?: string): Promise<SessionRecord[]>;
  saveSession(session: SessionRecord): Promise<SessionRecord>;
  getCapture(captureId: string): Promise<CaptureLogEntry | null>;
  listCaptures(options?: {
    statuses?: CaptureStatus[];
    sessionId?: string;
    limit?: number;
  }): Promise<CaptureLogEntry[]>;
  saveCapture(capture: CaptureLogEntry): Promise<CaptureLogEntry>;
  saveDecision(decision: DecisionLogEntry): Promise<DecisionLogEntry>;
  listDecisions(limit?: number): Promise<DecisionLogEntry[]>;
  saveNotification(notification: NotificationRecord): Promise<NotificationRecord>;
  listNotifications(options?: {
    statuses?: NotificationRecord["status"][];
    dueBefore?: string;
    limit?: number;
  }): Promise<NotificationRecord[]>;
}

let storeCache: ChronosStore | null = null;

export function getStore(): ChronosStore {
  if (storeCache) {
    return storeCache;
  }

  const config = loadConfig();
  const storeMode =
    process.env.CHRONOS_STORE ??
    (process.env.POSTGRES_URL
      ? "postgres"
      : process.env.BLOB_READ_WRITE_TOKEN
        ? "blob"
        : "file");

  storeCache =
    storeMode === "postgres"
      ? new PostgresChronosStore()
      : storeMode === "blob"
        ? new BlobChronosStore()
      : new FileChronosStore(
          resolveFromRoot(
            process.env.CHRONOS_FILE_STORE_PATH ?? ".chronos-data/chronos.json"
          ),
          config
        );

  return storeCache;
}

export function resetStoreForTests(): void {
  storeCache = null;
}
