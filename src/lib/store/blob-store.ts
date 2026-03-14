import { get, list, put } from "@vercel/blob";

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

import type { ChronosStore } from "@/lib/store";

const SESSION_PREFIX = "state/sessions/";
const SIGNAL_PREFIX = "state/signals/";
const RUN_PREFIX = "state/runs/";
const AGENT_INVOCATION_PREFIX = "state/agent-invocations/";
const TOOL_CALL_PREFIX = "state/tool-calls/";
const ARTIFACT_PREFIX = "state/artifacts/";
const CAPTURE_PREFIX = "state/captures/";
const DECISION_PREFIX = "state/decisions/";
const NOTIFICATION_PREFIX = "state/notifications/";

export class BlobChronosStore implements ChronosStore {
  async saveSignal(signal: SignalEnvelope): Promise<SignalEnvelope> {
    await this.writeEntity(`${SIGNAL_PREFIX}${signal.id}.json`, signal);
    return signal;
  }

  async getSignal(signalId: string): Promise<SignalEnvelope | null> {
    return this.readEntity<SignalEnvelope>(`${SIGNAL_PREFIX}${signalId}.json`);
  }

  async listSignals(options?: {
    kinds?: SignalEnvelope["kind"][];
    authorId?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<SignalEnvelope[]> {
    let signals = await this.readCollection<SignalEnvelope>(SIGNAL_PREFIX);
    signals = signals.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    if (options?.kinds?.length) {
      signals = signals.filter((signal) => options.kinds?.includes(signal.kind));
    }

    if (options?.authorId) {
      signals = signals.filter((signal) => signal.authorId === options.authorId);
    }

    if (options?.sessionId) {
      signals = signals.filter((signal) => signal.sessionId === options.sessionId);
    }

    return typeof options?.limit === "number"
      ? signals.slice(0, options.limit)
      : signals;
  }

  async saveRun(run: ExecutionRun): Promise<ExecutionRun> {
    await this.writeEntity(`${RUN_PREFIX}${run.id}.json`, run);
    return run;
  }

  async getRun(runId: string): Promise<ExecutionRun | null> {
    return this.readEntity<ExecutionRun>(`${RUN_PREFIX}${runId}.json`);
  }

  async listRuns(options?: {
    statuses?: ExecutionRun["status"][];
    signalId?: string;
    recipeId?: string;
    limit?: number;
  }): Promise<ExecutionRun[]> {
    let runs = await this.readCollection<ExecutionRun>(RUN_PREFIX);
    runs = runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    if (options?.statuses?.length) {
      runs = runs.filter((run) => options.statuses?.includes(run.status));
    }

    if (options?.signalId) {
      runs = runs.filter((run) => run.signalId === options.signalId);
    }

    if (options?.recipeId) {
      runs = runs.filter((run) => run.recipeId === options.recipeId);
    }

    return typeof options?.limit === "number" ? runs.slice(0, options.limit) : runs;
  }

  async saveAgentInvocation(
    record: AgentInvocationRecord
  ): Promise<AgentInvocationRecord> {
    await this.writeEntity(`${AGENT_INVOCATION_PREFIX}${record.id}.json`, record);
    return record;
  }

  async listAgentInvocations(options?: {
    runId?: string;
    agentName?: string;
    limit?: number;
  }): Promise<AgentInvocationRecord[]> {
    let records = await this.readCollection<AgentInvocationRecord>(
      AGENT_INVOCATION_PREFIX
    );
    records = records.sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    );

    if (options?.runId) {
      records = records.filter((record) => record.runId === options.runId);
    }

    if (options?.agentName) {
      records = records.filter((record) => record.agentName === options.agentName);
    }

    return typeof options?.limit === "number"
      ? records.slice(0, options.limit)
      : records;
  }

  async saveToolCall(record: ToolCallRecord): Promise<ToolCallRecord> {
    await this.writeEntity(`${TOOL_CALL_PREFIX}${record.id}.json`, record);
    return record;
  }

  async listToolCalls(options?: {
    runId?: string;
    agentInvocationId?: string;
    toolName?: string;
    limit?: number;
  }): Promise<ToolCallRecord[]> {
    let records = await this.readCollection<ToolCallRecord>(TOOL_CALL_PREFIX);
    records = records.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    if (options?.runId) {
      records = records.filter((record) => record.runId === options.runId);
    }

    if (options?.agentInvocationId) {
      records = records.filter(
        (record) => record.agentInvocationId === options.agentInvocationId
      );
    }

    if (options?.toolName) {
      records = records.filter((record) => record.toolName === options.toolName);
    }

    return typeof options?.limit === "number"
      ? records.slice(0, options.limit)
      : records;
  }

  async saveArtifact(record: ArtifactRecord): Promise<ArtifactRecord> {
    await this.writeEntity(`${ARTIFACT_PREFIX}${record.id}.json`, record);
    return record;
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord | null> {
    return this.readEntity<ArtifactRecord>(`${ARTIFACT_PREFIX}${artifactId}.json`);
  }

  async listArtifacts(options?: {
    runId?: string;
    artifactType?: ArtifactRecord["artifactType"];
    sessionId?: string;
    limit?: number;
  }): Promise<ArtifactRecord[]> {
    let records = await this.readCollection<ArtifactRecord>(ARTIFACT_PREFIX);
    records = records.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    if (options?.runId) {
      records = records.filter((record) => record.runId === options.runId);
    }

    if (options?.artifactType) {
      records = records.filter((record) => record.artifactType === options.artifactType);
    }

    if (options?.sessionId) {
      records = records.filter((record) => record.sessionId === options.sessionId);
    }

    return typeof options?.limit === "number"
      ? records.slice(0, options.limit)
      : records;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.readEntity<SessionRecord>(`${SESSION_PREFIX}${sessionId}.json`);
  }

  async listSessions(authorId?: string): Promise<SessionRecord[]> {
    const sessions = await this.readCollection<SessionRecord>(SESSION_PREFIX);
    return sessions
      .filter((session) => !authorId || session.authorId === authorId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async saveSession(session: SessionRecord): Promise<SessionRecord> {
    await this.writeEntity(`${SESSION_PREFIX}${session.id}.json`, session);
    return session;
  }

  async getCapture(captureId: string): Promise<CaptureLogEntry | null> {
    return this.readEntity<CaptureLogEntry>(`${CAPTURE_PREFIX}${captureId}.json`);
  }

  async listCaptures(options?: {
    statuses?: CaptureStatus[];
    sessionId?: string;
    limit?: number;
  }): Promise<CaptureLogEntry[]> {
    let captures = await this.readCollection<CaptureLogEntry>(CAPTURE_PREFIX);
    captures = captures.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    if (options?.statuses?.length) {
      captures = captures.filter((capture) =>
        options.statuses?.includes(capture.status)
      );
    }

    if (options?.sessionId) {
      captures = captures.filter((capture) => capture.sessionId === options.sessionId);
    }

    return typeof options?.limit === "number"
      ? captures.slice(0, options.limit)
      : captures;
  }

  async saveCapture(capture: CaptureLogEntry): Promise<CaptureLogEntry> {
    await this.writeEntity(`${CAPTURE_PREFIX}${capture.id}.json`, capture);
    return capture;
  }

  async saveDecision(decision: DecisionLogEntry): Promise<DecisionLogEntry> {
    await this.writeEntity(`${DECISION_PREFIX}${decision.id}.json`, decision);
    return decision;
  }

  async listDecisions(limit?: number): Promise<DecisionLogEntry[]> {
    const decisions = (await this.readCollection<DecisionLogEntry>(DECISION_PREFIX)).sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt)
    );

    return typeof limit === "number" ? decisions.slice(0, limit) : decisions;
  }

  async saveNotification(
    notification: NotificationRecord
  ): Promise<NotificationRecord> {
    await this.writeEntity(
      `${NOTIFICATION_PREFIX}${notification.id}.json`,
      notification
    );
    return notification;
  }

  async listNotifications(options?: {
    statuses?: NotificationRecord["status"][];
    dueBefore?: string;
    limit?: number;
  }): Promise<NotificationRecord[]> {
    let notifications = await this.readCollection<NotificationRecord>(
      NOTIFICATION_PREFIX
    );
    notifications = notifications.sort((left, right) =>
      left.deliverAt.localeCompare(right.deliverAt)
    );

    if (options?.statuses?.length) {
      notifications = notifications.filter((notification) =>
        options.statuses?.includes(notification.status)
      );
    }

    if (options?.dueBefore) {
      notifications = notifications.filter(
        (notification) => notification.deliverAt <= options.dueBefore!
      );
    }

    return typeof options?.limit === "number"
      ? notifications.slice(0, options.limit)
      : notifications;
  }

  private async readCollection<T>(prefix: string): Promise<T[]> {
    const { blobs } = await list({
      prefix,
      limit: 1000
    });

    const values = (await Promise.all(
      blobs.map((blob) => this.readEntity<T>(blob.pathname))
    )) as Array<T | null>;

    return values.filter((value): value is T => value !== null);
  }

  private async readEntity<T>(pathname: string): Promise<T | null> {
    const result = await get(pathname, { access: "public" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const raw = await new Response(result.stream).text();
    if (!raw.trim()) {
      return null;
    }

    return JSON.parse(raw) as T;
  }

  private async writeEntity(pathname: string, value: unknown): Promise<void> {
    await put(pathname, JSON.stringify(value, null, 2), {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 0
    });
  }
}
