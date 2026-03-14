import fs from "node:fs";
import { Pool } from "pg";

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
import { resolveFromRoot } from "@/lib/utils";

import type { ChronosStore } from "@/lib/store";

let poolCache: Pool | null = null;
let schemaEnsured = false;

function getPool(): Pool {
  if (!poolCache) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("POSTGRES_URL is required when CHRONOS_STORE=postgres");
    }
    poolCache = new Pool({ connectionString });
  }
  return poolCache;
}

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) {
    return;
  }

  if (process.env.CHRONOS_AUTO_MIGRATE !== "true") {
    schemaEnsured = true;
    return;
  }

  const schemaSql = fs.readFileSync(resolveFromRoot("db/schema.sql"), "utf8");
  await getPool().query(schemaSql);
  schemaEnsured = true;
}

export class PostgresChronosStore implements ChronosStore {
  async saveSignal(signal: SignalEnvelope): Promise<SignalEnvelope> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO signal_log (
        id, kind, channel, author_id, session_id, topic, created_at, payload, source_metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        channel = EXCLUDED.channel,
        author_id = EXCLUDED.author_id,
        session_id = EXCLUDED.session_id,
        topic = EXCLUDED.topic,
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload,
        source_metadata = EXCLUDED.source_metadata
      `,
      [
        signal.id,
        signal.kind,
        signal.channel,
        signal.authorId,
        signal.sessionId ?? null,
        signal.topic ?? null,
        signal.createdAt,
        JSON.stringify(signal.payload),
        JSON.stringify(signal.sourceMetadata ?? {})
      ]
    );

    return signal;
  }

  async getSignal(signalId: string): Promise<SignalEnvelope | null> {
    await ensureSchema();
    const result = await getPool().query("SELECT * FROM signal_log WHERE id = $1", [
      signalId
    ]);
    return result.rows[0] ? mapSignalRow(result.rows[0]) : null;
  }

  async listSignals(options?: {
    kinds?: SignalEnvelope["kind"][];
    authorId?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<SignalEnvelope[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.kinds?.length) {
      conditions.push(`kind = ANY($${index}::text[])`);
      values.push(options.kinds);
      index += 1;
    }

    if (options?.authorId) {
      conditions.push(`author_id = $${index}`);
      values.push(options.authorId);
      index += 1;
    }

    if (options?.sessionId) {
      conditions.push(`session_id = $${index}`);
      values.push(options.sessionId);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM signal_log
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapSignalRow);
  }

  async saveRun(run: ExecutionRun): Promise<ExecutionRun> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO execution_run (
        id, signal_id, recipe_id, execution_pattern, status, gate, assigned_agent,
        retry_count, created_at, updated_at, started_at, completed_at, failure_reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        signal_id = EXCLUDED.signal_id,
        recipe_id = EXCLUDED.recipe_id,
        execution_pattern = EXCLUDED.execution_pattern,
        status = EXCLUDED.status,
        gate = EXCLUDED.gate,
        assigned_agent = EXCLUDED.assigned_agent,
        retry_count = EXCLUDED.retry_count,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        failure_reason = EXCLUDED.failure_reason,
        metadata = EXCLUDED.metadata
      `,
      [
        run.id,
        run.signalId,
        run.recipeId,
        run.executionPattern,
        run.status,
        run.gate,
        run.assignedAgent ?? null,
        run.retryCount,
        run.createdAt,
        run.updatedAt,
        run.startedAt ?? null,
        run.completedAt ?? null,
        run.failureReason ?? null,
        JSON.stringify(run.metadata ?? {})
      ]
    );

    return run;
  }

  async getRun(runId: string): Promise<ExecutionRun | null> {
    await ensureSchema();
    const result = await getPool().query("SELECT * FROM execution_run WHERE id = $1", [
      runId
    ]);
    return result.rows[0] ? mapRunRow(result.rows[0]) : null;
  }

  async listRuns(options?: {
    statuses?: ExecutionRun["status"][];
    signalId?: string;
    recipeId?: string;
    limit?: number;
  }): Promise<ExecutionRun[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.statuses?.length) {
      conditions.push(`status = ANY($${index}::text[])`);
      values.push(options.statuses);
      index += 1;
    }

    if (options?.signalId) {
      conditions.push(`signal_id = $${index}`);
      values.push(options.signalId);
      index += 1;
    }

    if (options?.recipeId) {
      conditions.push(`recipe_id = $${index}`);
      values.push(options.recipeId);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM execution_run
      ${whereClause}
      ORDER BY updated_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapRunRow);
  }

  async saveAgentInvocation(
    record: AgentInvocationRecord
  ): Promise<AgentInvocationRecord> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO agent_invocation (
        id, run_id, recipe_id, agent_name, phase, status, model_mode,
        started_at, completed_at, summary, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        recipe_id = EXCLUDED.recipe_id,
        agent_name = EXCLUDED.agent_name,
        phase = EXCLUDED.phase,
        status = EXCLUDED.status,
        model_mode = EXCLUDED.model_mode,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        summary = EXCLUDED.summary,
        metadata = EXCLUDED.metadata
      `,
      [
        record.id,
        record.runId,
        record.recipeId,
        record.agentName,
        record.phase,
        record.status,
        record.modelMode,
        record.startedAt,
        record.completedAt ?? null,
        record.summary ?? null,
        JSON.stringify(record.metadata ?? {})
      ]
    );

    return record;
  }

  async listAgentInvocations(options?: {
    runId?: string;
    agentName?: string;
    limit?: number;
  }): Promise<AgentInvocationRecord[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.runId) {
      conditions.push(`run_id = $${index}`);
      values.push(options.runId);
      index += 1;
    }

    if (options?.agentName) {
      conditions.push(`agent_name = $${index}`);
      values.push(options.agentName);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM agent_invocation
      ${whereClause}
      ORDER BY started_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapAgentInvocationRow);
  }

  async saveToolCall(record: ToolCallRecord): Promise<ToolCallRecord> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO tool_call (
        id, run_id, agent_invocation_id, tool_name, status, created_at,
        input_summary, output_summary, blocked_reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        agent_invocation_id = EXCLUDED.agent_invocation_id,
        tool_name = EXCLUDED.tool_name,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        blocked_reason = EXCLUDED.blocked_reason,
        metadata = EXCLUDED.metadata
      `,
      [
        record.id,
        record.runId,
        record.agentInvocationId ?? null,
        record.toolName,
        record.status,
        record.createdAt,
        record.inputSummary ?? null,
        record.outputSummary ?? null,
        record.blockedReason ?? null,
        JSON.stringify(record.metadata ?? {})
      ]
    );

    return record;
  }

  async listToolCalls(options?: {
    runId?: string;
    agentInvocationId?: string;
    toolName?: string;
    limit?: number;
  }): Promise<ToolCallRecord[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.runId) {
      conditions.push(`run_id = $${index}`);
      values.push(options.runId);
      index += 1;
    }

    if (options?.agentInvocationId) {
      conditions.push(`agent_invocation_id = $${index}`);
      values.push(options.agentInvocationId);
      index += 1;
    }

    if (options?.toolName) {
      conditions.push(`tool_name = $${index}`);
      values.push(options.toolName);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM tool_call
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapToolCallRow);
  }

  async saveArtifact(record: ArtifactRecord): Promise<ArtifactRecord> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO artifact_log (
        id, run_id, artifact_type, channel, path, access_token, created_at,
        expires_at, session_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        artifact_type = EXCLUDED.artifact_type,
        channel = EXCLUDED.channel,
        path = EXCLUDED.path,
        access_token = EXCLUDED.access_token,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at,
        session_id = EXCLUDED.session_id,
        metadata = EXCLUDED.metadata
      `,
      [
        record.id,
        record.runId ?? null,
        record.artifactType,
        record.channel,
        record.path,
        record.accessToken,
        record.createdAt,
        record.expiresAt ?? null,
        record.sessionId ?? null,
        JSON.stringify(record.metadata ?? {})
      ]
    );

    return record;
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord | null> {
    await ensureSchema();
    const result = await getPool().query("SELECT * FROM artifact_log WHERE id = $1", [
      artifactId
    ]);
    return result.rows[0] ? mapArtifactRow(result.rows[0]) : null;
  }

  async listArtifacts(options?: {
    runId?: string;
    artifactType?: ArtifactRecord["artifactType"];
    sessionId?: string;
    limit?: number;
  }): Promise<ArtifactRecord[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.runId) {
      conditions.push(`run_id = $${index}`);
      values.push(options.runId);
      index += 1;
    }

    if (options?.artifactType) {
      conditions.push(`artifact_type = $${index}`);
      values.push(options.artifactType);
      index += 1;
    }

    if (options?.sessionId) {
      conditions.push(`session_id = $${index}`);
      values.push(options.sessionId);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM artifact_log
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapArtifactRow);
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    await ensureSchema();
    const result = await getPool().query("SELECT * FROM stm WHERE id = $1", [sessionId]);
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async listSessions(authorId?: string): Promise<SessionRecord[]> {
    await ensureSchema();
    const result = authorId
      ? await getPool().query(
          "SELECT * FROM stm WHERE author_id = $1 ORDER BY updated_at DESC",
          [authorId]
        )
      : await getPool().query("SELECT * FROM stm ORDER BY updated_at DESC");

    return result.rows.map(mapSessionRow);
  }

  async saveSession(session: SessionRecord): Promise<SessionRecord> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO stm (id, topic, status, channel, author_id, created_at, updated_at, last_signal_at, context, history, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        topic = EXCLUDED.topic,
        status = EXCLUDED.status,
        channel = EXCLUDED.channel,
        author_id = EXCLUDED.author_id,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        last_signal_at = EXCLUDED.last_signal_at,
        context = EXCLUDED.context,
        history = EXCLUDED.history,
        metadata = EXCLUDED.metadata
      `,
      [
        session.id,
        session.topic,
        session.status,
        session.channel,
        session.authorId,
        session.createdAt,
        session.updatedAt,
        session.lastSignalAt,
        JSON.stringify(session.context ?? []),
        JSON.stringify(session.history ?? []),
        JSON.stringify(session.metadata ?? {})
      ]
    );

    return session;
  }

  async getCapture(captureId: string): Promise<CaptureLogEntry | null> {
    await ensureSchema();
    const result = await getPool().query(
      "SELECT * FROM capture_log WHERE id = $1",
      [captureId]
    );
    return result.rows[0] ? mapCaptureRow(result.rows[0]) : null;
  }

  async listCaptures(options?: {
    statuses?: CaptureStatus[];
    sessionId?: string;
    limit?: number;
  }): Promise<CaptureLogEntry[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.statuses?.length) {
      conditions.push(`status = ANY($${index}::text[])`);
      values.push(options.statuses);
      index += 1;
    }

    if (options?.sessionId) {
      conditions.push(`session_id = $${index}`);
      values.push(options.sessionId);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM capture_log
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapCaptureRow);
  }

  async saveCapture(capture: CaptureLogEntry): Promise<CaptureLogEntry> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO capture_log (
        id, message, session_id, author_id, source, status, created_at, updated_at,
        processed_at, quick_classification, deep_classification, clarification, content_quality, library_id, rejected_reason, review_notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        message = EXCLUDED.message,
        session_id = EXCLUDED.session_id,
        author_id = EXCLUDED.author_id,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        processed_at = EXCLUDED.processed_at,
        quick_classification = EXCLUDED.quick_classification,
        deep_classification = EXCLUDED.deep_classification,
        clarification = EXCLUDED.clarification,
        content_quality = EXCLUDED.content_quality,
        library_id = EXCLUDED.library_id,
        rejected_reason = EXCLUDED.rejected_reason,
        review_notes = EXCLUDED.review_notes
      `,
      [
        capture.id,
        capture.message,
        capture.sessionId,
        capture.authorId,
        capture.source,
        capture.status,
        capture.createdAt,
        capture.updatedAt,
        capture.processedAt ?? null,
        JSON.stringify(capture.quickClassification ?? null),
        JSON.stringify(capture.deepClassification ?? null),
        JSON.stringify(capture.clarification ?? null),
        JSON.stringify(capture.contentQuality ?? null),
        capture.libraryId ?? null,
        capture.rejectedReason ?? null,
        JSON.stringify(capture.reviewNotes ?? {})
      ]
    );

    return capture;
  }

  async saveDecision(decision: DecisionLogEntry): Promise<DecisionLogEntry> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO decision_log (
        id, action, input, capture_id, session_id, confidence, threshold_used, auto_approved, user_response, eval_agent_model, decision, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)
      ON CONFLICT (id) DO UPDATE SET
        action = EXCLUDED.action,
        input = EXCLUDED.input,
        capture_id = EXCLUDED.capture_id,
        session_id = EXCLUDED.session_id,
        confidence = EXCLUDED.confidence,
        threshold_used = EXCLUDED.threshold_used,
        auto_approved = EXCLUDED.auto_approved,
        user_response = EXCLUDED.user_response,
        eval_agent_model = EXCLUDED.eval_agent_model,
        decision = EXCLUDED.decision,
        metadata = EXCLUDED.metadata,
        created_at = EXCLUDED.created_at
      `,
      [
        decision.id,
        decision.action,
        decision.input ?? null,
        decision.captureId ?? null,
        decision.sessionId ?? null,
        decision.confidence ?? null,
        decision.thresholdUsed ?? null,
        decision.autoApproved,
        decision.userResponse ?? null,
        decision.evalAgentModel ?? null,
        JSON.stringify(decision.decision),
        JSON.stringify(decision.metadata ?? {}),
        decision.createdAt
      ]
    );

    return decision;
  }

  async listDecisions(limit?: number): Promise<DecisionLogEntry[]> {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT * FROM decision_log ORDER BY created_at DESC${typeof limit === "number" ? ` LIMIT ${limit}` : ""}`
    );
    return result.rows.map(mapDecisionRow);
  }

  async saveNotification(
    notification: NotificationRecord
  ): Promise<NotificationRecord> {
    await ensureSchema();
    await getPool().query(
      `
      INSERT INTO notification_queue (
        id, kind, channel, status, content, deliver_at, created_at, sent_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        channel = EXCLUDED.channel,
        status = EXCLUDED.status,
        content = EXCLUDED.content,
        deliver_at = EXCLUDED.deliver_at,
        created_at = EXCLUDED.created_at,
        sent_at = EXCLUDED.sent_at,
        metadata = EXCLUDED.metadata
      `,
      [
        notification.id,
        notification.kind,
        notification.channel,
        notification.status,
        notification.content,
        notification.deliverAt,
        notification.createdAt,
        notification.sentAt ?? null,
        JSON.stringify(notification.metadata ?? {})
      ]
    );

    return notification;
  }

  async listNotifications(options?: {
    statuses?: NotificationRecord["status"][];
    dueBefore?: string;
    limit?: number;
  }): Promise<NotificationRecord[]> {
    await ensureSchema();
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options?.statuses?.length) {
      conditions.push(`status = ANY($${index}::text[])`);
      values.push(options.statuses);
      index += 1;
    }

    if (options?.dueBefore) {
      conditions.push(`deliver_at <= $${index}`);
      values.push(options.dueBefore);
      index += 1;
    }

    const limitClause =
      typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await getPool().query(
      `
      SELECT * FROM notification_queue
      ${whereClause}
      ORDER BY deliver_at ASC
      ${limitClause}
      `,
      values
    );

    return result.rows.map(mapNotificationRow);
  }
}

function mapSessionRow(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    topic: String(row.topic),
    status: row.status as SessionRecord["status"],
    channel: row.channel as SessionRecord["channel"],
    authorId: String(row.author_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastSignalAt: new Date(String(row.last_signal_at)).toISOString(),
    context:
      (row.context as SessionRecord["context"] | null) ?? [],
    history:
      (row.history as SessionRecord["history"] | null) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {}
  };
}

function mapSignalRow(row: Record<string, unknown>): SignalEnvelope {
  return {
    id: String(row.id),
    kind: row.kind as SignalEnvelope["kind"],
    channel: row.channel as SignalEnvelope["channel"],
    authorId: String(row.author_id),
    sessionId: (row.session_id as string | null) ?? undefined,
    topic: (row.topic as string | null) ?? undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    payload: (row.payload as Record<string, unknown>) ?? {},
    sourceMetadata:
      (row.source_metadata as Record<string, unknown> | null) ?? undefined
  };
}

function mapRunRow(row: Record<string, unknown>): ExecutionRun {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    recipeId: String(row.recipe_id),
    executionPattern: row.execution_pattern as ExecutionRun["executionPattern"],
    status: row.status as ExecutionRun["status"],
    gate: row.gate as ExecutionRun["gate"],
    assignedAgent: (row.assigned_agent as string | null) ?? undefined,
    retryCount: Number(row.retry_count),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    startedAt:
      row.started_at == null ? undefined : new Date(String(row.started_at)).toISOString(),
    completedAt:
      row.completed_at == null
        ? undefined
        : new Date(String(row.completed_at)).toISOString(),
    failureReason: (row.failure_reason as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined
  };
}

function mapAgentInvocationRow(row: Record<string, unknown>): AgentInvocationRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    recipeId: String(row.recipe_id),
    agentName: String(row.agent_name),
    phase: row.phase as AgentInvocationRecord["phase"],
    status: row.status as AgentInvocationRecord["status"],
    modelMode: row.model_mode as AgentInvocationRecord["modelMode"],
    startedAt: new Date(String(row.started_at)).toISOString(),
    completedAt:
      row.completed_at == null
        ? undefined
        : new Date(String(row.completed_at)).toISOString(),
    summary: (row.summary as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined
  };
}

function mapToolCallRow(row: Record<string, unknown>): ToolCallRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    agentInvocationId: (row.agent_invocation_id as string | null) ?? undefined,
    toolName: String(row.tool_name),
    status: row.status as ToolCallRecord["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    inputSummary: (row.input_summary as string | null) ?? undefined,
    outputSummary: (row.output_summary as string | null) ?? undefined,
    blockedReason: (row.blocked_reason as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined
  };
}

function mapArtifactRow(row: Record<string, unknown>): ArtifactRecord {
  return {
    id: String(row.id),
    runId: (row.run_id as string | null) ?? undefined,
    artifactType: row.artifact_type as ArtifactRecord["artifactType"],
    channel: row.channel as ArtifactRecord["channel"],
    path: String(row.path),
    accessToken: String(row.access_token),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt:
      row.expires_at == null ? undefined : new Date(String(row.expires_at)).toISOString(),
    sessionId: (row.session_id as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined
  };
}

function mapCaptureRow(row: Record<string, unknown>): CaptureLogEntry {
  return {
    id: String(row.id),
    message: String(row.message),
    sessionId: String(row.session_id),
    authorId: String(row.author_id),
    source: row.source as CaptureLogEntry["source"],
    status: row.status as CaptureLogEntry["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    processedAt:
      row.processed_at == null ? undefined : new Date(String(row.processed_at)).toISOString(),
    quickClassification:
      (row.quick_classification as CaptureLogEntry["quickClassification"]) ?? undefined,
    deepClassification:
      (row.deep_classification as CaptureLogEntry["deepClassification"]) ?? undefined,
    clarification:
      (row.clarification as CaptureLogEntry["clarification"]) ?? undefined,
    contentQuality:
      (row.content_quality as CaptureLogEntry["contentQuality"]) ?? undefined,
    libraryId: (row.library_id as string | null) ?? undefined,
    rejectedReason: (row.rejected_reason as string | null) ?? undefined,
    reviewNotes: (row.review_notes as CaptureLogEntry["reviewNotes"]) ?? undefined
  };
}

function mapDecisionRow(row: Record<string, unknown>): DecisionLogEntry {
  return {
    id: String(row.id),
    action: String(row.action),
    input: (row.input as string | null) ?? undefined,
    captureId: (row.capture_id as string | null) ?? undefined,
    sessionId: (row.session_id as string | null) ?? undefined,
    confidence: (row.confidence as number | null) ?? undefined,
    thresholdUsed:
      (row.threshold_used as DecisionLogEntry["thresholdUsed"] | null) ?? undefined,
    autoApproved: Boolean(row.auto_approved),
    userResponse: (row.user_response as string | null) ?? undefined,
    evalAgentModel: (row.eval_agent_model as string | null) ?? undefined,
    decision: (row.decision as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapNotificationRow(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    kind: row.kind as NotificationRecord["kind"],
    channel: row.channel as NotificationRecord["channel"],
    status: row.status as NotificationRecord["status"],
    content: String(row.content),
    deliverAt: new Date(String(row.deliver_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    sentAt: row.sent_at == null ? undefined : new Date(String(row.sent_at)).toISOString(),
    metadata: (row.metadata as Record<string, unknown>) ?? {}
  };
}
