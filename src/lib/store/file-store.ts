import fs from "node:fs/promises";
import path from "node:path";

import type { ChronosConfig } from "@/lib/config";
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

interface FileStoreState {
  signals: SignalEnvelope[];
  runs: ExecutionRun[];
  agentInvocations: AgentInvocationRecord[];
  toolCalls: ToolCallRecord[];
  artifacts: ArtifactRecord[];
  sessions: SessionRecord[];
  captures: CaptureLogEntry[];
  decisions: DecisionLogEntry[];
  notifications: NotificationRecord[];
}

const EMPTY_STATE: FileStoreState = {
  signals: [],
  runs: [],
  agentInvocations: [],
  toolCalls: [],
  artifacts: [],
  sessions: [],
  captures: [],
  decisions: [],
  notifications: []
};

export class FileChronosStore implements ChronosStore {
  constructor(
    private readonly filePath: string,
    private readonly _config: ChronosConfig
  ) {}

  async saveSignal(signal: SignalEnvelope): Promise<SignalEnvelope> {
    return this.writeState((state) => ({
      ...state,
      signals: [...state.signals.filter((item) => item.id !== signal.id), signal]
    })).then(() => signal);
  }

  async getSignal(signalId: string): Promise<SignalEnvelope | null> {
    const state = await this.readState();
    return state.signals.find((signal) => signal.id === signalId) ?? null;
  }

  async listSignals(options?: {
    kinds?: SignalEnvelope["kind"][];
    authorId?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<SignalEnvelope[]> {
    const state = await this.readState();
    let signals = [...state.signals].sort((left, right) =>
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
    return this.writeState((state) => ({
      ...state,
      runs: [...state.runs.filter((item) => item.id !== run.id), run]
    })).then(() => run);
  }

  async getRun(runId: string): Promise<ExecutionRun | null> {
    const state = await this.readState();
    return state.runs.find((run) => run.id === runId) ?? null;
  }

  async listRuns(options?: {
    statuses?: ExecutionRun["status"][];
    signalId?: string;
    recipeId?: string;
    limit?: number;
  }): Promise<ExecutionRun[]> {
    const state = await this.readState();
    let runs = [...state.runs].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );

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
    return this.writeState((state) => ({
      ...state,
      agentInvocations: [
        ...state.agentInvocations.filter((item) => item.id !== record.id),
        record
      ]
    })).then(() => record);
  }

  async listAgentInvocations(options?: {
    runId?: string;
    agentName?: string;
    limit?: number;
  }): Promise<AgentInvocationRecord[]> {
    const state = await this.readState();
    let records = [...state.agentInvocations].sort((left, right) =>
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
    return this.writeState((state) => ({
      ...state,
      toolCalls: [...state.toolCalls.filter((item) => item.id !== record.id), record]
    })).then(() => record);
  }

  async listToolCalls(options?: {
    runId?: string;
    agentInvocationId?: string;
    toolName?: string;
    limit?: number;
  }): Promise<ToolCallRecord[]> {
    const state = await this.readState();
    let records = [...state.toolCalls].sort((left, right) =>
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
    return this.writeState((state) => ({
      ...state,
      artifacts: [...state.artifacts.filter((item) => item.id !== record.id), record]
    })).then(() => record);
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord | null> {
    const state = await this.readState();
    return state.artifacts.find((artifact) => artifact.id === artifactId) ?? null;
  }

  async listArtifacts(options?: {
    runId?: string;
    artifactType?: ArtifactRecord["artifactType"];
    sessionId?: string;
    limit?: number;
  }): Promise<ArtifactRecord[]> {
    const state = await this.readState();
    let artifacts = [...state.artifacts].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    if (options?.runId) {
      artifacts = artifacts.filter((artifact) => artifact.runId === options.runId);
    }

    if (options?.artifactType) {
      artifacts = artifacts.filter(
        (artifact) => artifact.artifactType === options.artifactType
      );
    }

    if (options?.sessionId) {
      artifacts = artifacts.filter((artifact) => artifact.sessionId === options.sessionId);
    }

    return typeof options?.limit === "number"
      ? artifacts.slice(0, options.limit)
      : artifacts;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const state = await this.readState();
    return state.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async listSessions(authorId?: string): Promise<SessionRecord[]> {
    const state = await this.readState();
    return state.sessions
      .filter((session) => !authorId || session.authorId === authorId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async saveSession(session: SessionRecord): Promise<SessionRecord> {
    return this.writeState((state) => {
      const nextSessions = state.sessions.filter((item) => item.id !== session.id);
      nextSessions.push(session);
      return {
        ...state,
        sessions: nextSessions
      };
    }).then(() => session);
  }

  async getCapture(captureId: string): Promise<CaptureLogEntry | null> {
    const state = await this.readState();
    return state.captures.find((capture) => capture.id === captureId) ?? null;
  }

  async listCaptures(options?: {
    statuses?: CaptureStatus[];
    sessionId?: string;
    limit?: number;
  }): Promise<CaptureLogEntry[]> {
    const state = await this.readState();
    let captures = [...state.captures].sort((left, right) =>
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
    return this.writeState((state) => {
      const nextCaptures = state.captures.filter((item) => item.id !== capture.id);
      nextCaptures.push(capture);
      return {
        ...state,
        captures: nextCaptures
      };
    }).then(() => capture);
  }

  async saveDecision(decision: DecisionLogEntry): Promise<DecisionLogEntry> {
    return this.writeState((state) => ({
      ...state,
      decisions: [...state.decisions.filter((item) => item.id !== decision.id), decision]
    })).then(() => decision);
  }

  async listDecisions(limit?: number): Promise<DecisionLogEntry[]> {
    const state = await this.readState();
    const decisions = [...state.decisions].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    return typeof limit === "number" ? decisions.slice(0, limit) : decisions;
  }

  async saveNotification(
    notification: NotificationRecord
  ): Promise<NotificationRecord> {
    return this.writeState((state) => ({
      ...state,
      notifications: [
        ...state.notifications.filter((item) => item.id !== notification.id),
        notification
      ]
    })).then(() => notification);
  }

  async listNotifications(options?: {
    statuses?: NotificationRecord["status"][];
    dueBefore?: string;
    limit?: number;
  }): Promise<NotificationRecord[]> {
    const state = await this.readState();
    let notifications = [...state.notifications].sort((left, right) =>
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

  private async readState(): Promise<FileStoreState> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      if (!raw.trim()) {
        return EMPTY_STATE;
      }
      return {
        ...EMPTY_STATE,
        ...JSON.parse(raw)
      } satisfies FileStoreState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(EMPTY_STATE, null, 2));
        return EMPTY_STATE;
      }
      throw error;
    }
  }

  private async writeState(
    mutate: (state: FileStoreState) => FileStoreState
  ): Promise<void> {
    const current = await this.readState();
    const next = mutate(current);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(next, null, 2));
  }
}
