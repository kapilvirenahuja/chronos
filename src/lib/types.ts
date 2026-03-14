export type CaptureStatus =
  | "unprocessed"
  | "processed"
  | "pending_owner"
  | "ignored"
  | "failed";

export type ContentQuality =
  | "signal"
  | "duplicate"
  | "noise"
  | "needs_research"
  | "needs_context";

export type Channel =
  | "discord"
  | "web"
  | "claude_code"
  | "system"
  | "heartbeat"
  | "web_action"
  | "webhook";

export type SignalKind =
  | "capture"
  | "ask"
  | "web_action"
  | "heartbeat"
  | "session_command";

export interface SignalEnvelope {
  id: string;
  kind: SignalKind;
  channel: Channel;
  authorId: string;
  sessionId?: string;
  topic?: string;
  createdAt: string;
  payload: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
}

export type ExecutionPattern = "one_shot" | "agentic";
export type ExecutionRunStatus =
  | "queued"
  | "running"
  | "awaiting_user"
  | "completed"
  | "failed";
export type ResponseGate = "none" | "clarification" | "blocked" | "synthesis" | "error";

export interface ExecutionRun {
  id: string;
  signalId: string;
  recipeId: string;
  executionPattern: ExecutionPattern;
  status: ExecutionRunStatus;
  gate: ResponseGate;
  assignedAgent?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentInvocationRecord {
  id: string;
  runId: string;
  recipeId: string;
  agentName: string;
  phase: "analysis" | "clarification" | "synthesis" | "heartbeat_review";
  status: "running" | "completed" | "failed";
  modelMode: "bounded_model" | "agent_runtime";
  startedAt: string;
  completedAt?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallRecord {
  id: string;
  runId: string;
  agentInvocationId?: string;
  toolName: string;
  status: "requested" | "executed" | "blocked" | "failed";
  createdAt: string;
  inputSummary?: string;
  outputSummary?: string;
  blockedReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactRecord {
  id: string;
  runId?: string;
  artifactType:
    | "strategy_brief"
    | "capture_review"
    | "decision_review"
    | "session_summary"
    | "clarification_page";
  channel: "web" | "discord_inline";
  path: string;
  accessToken: string;
  createdAt: string;
  expiresAt?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CaptureClassification {
  category: string | null;
  confidence: number | null;
  keywords: string[];
  reasoning: string;
  ambiguous: boolean;
  clarificationQuestion?: string;
}

export interface CaptureLogEntry {
  id: string;
  message: string;
  sessionId: string;
  authorId: string;
  source: Channel;
  status: CaptureStatus;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  quickClassification?: CaptureClassification;
  deepClassification?: CaptureClassification;
  clarification?: {
    question: string;
    askedAt: string;
    response?: string;
    respondedAt?: string;
  };
  contentQuality?: {
    result: ContentQuality;
    reason: string;
    relatedIds: string[];
  };
  libraryId?: string;
  rejectedReason?: string;
  reviewNotes?: {
    adjustedConfidence?: number;
    disagreement?: string;
    question?: string;
    approved?: boolean;
    lastActionAt?: string;
  };
}

export interface DecisionLogEntry {
  id: string;
  action: string;
  input?: string;
  captureId?: string;
  sessionId?: string;
  confidence?: number | null;
  thresholdUsed?: "auto" | "ask" | "manual" | "none";
  autoApproved: boolean;
  userResponse?: string | null;
  evalAgentModel?: string | null;
  decision: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  kind: "heartbeat_review";
  channel: "discord";
  status: "queued" | "sent" | "failed";
  content: string;
  deliverAt: string;
  createdAt: string;
  sentAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  topic: string;
  status: "active" | "archived";
  channel: Channel;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  lastSignalAt: string;
  context: Array<{
    id: string;
    title: string;
    excerpt: string;
    category: string | null;
    score: number;
  }>;
  history: Array<{
    at: string;
    role: "user" | "system";
    text: string;
    source: Channel;
  }>;
  metadata?: Record<string, unknown>;
}

export interface RoutingPlan {
  id: string;
  created_at: string;
  query: string;
  confidence: number;
  steps: Array<{
    order: number;
    mode: "sequential" | "parallel";
    depends_on: number[];
    agents: Array<{
      agent: string;
      intent: string;
      goal: string;
      inputs?: Record<string, unknown>;
    }>;
  }>;
  synthesizer: {
    agent: string;
    inputs: Record<string, unknown>;
  };
  metadata: {
    intent_domain: string;
    sequencing_rules: string;
    replan_count: number;
  };
}

export interface MemorySearchResult {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  category: string | null;
  score: number;
}

export interface CaptureOutcome {
  kind: "silent" | "message" | "ignored";
  message?: string;
  capture?: CaptureLogEntry;
}

export interface HeartbeatOutcome {
  processed: CaptureLogEntry[];
  promoted: CaptureLogEntry[];
  pendingOwner: CaptureLogEntry[];
  ignored: CaptureLogEntry[];
}
