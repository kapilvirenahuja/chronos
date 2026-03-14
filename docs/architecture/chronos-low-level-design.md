# Chronos Low-Level Technical Design

> Low-level design for the Chronos harness engineering effort. Chronos remains the external product name.

---

## 1. Purpose

This document translates the product spec and technical approach into concrete runtime design.

It answers:
- which components exist
- which PCAM layer owns them
- how requests move through the system
- which interfaces and records we need
- which parts are deterministic code vs bounded model use vs agent runtime

This is the bridge between architecture and implementation.

---

## 2. Design Principles

### 2.1 Architecture preservation

The implementation must preserve:
- IDD / Life OS as product framing
- Phoenix as `Signal -> Recipe -> Agent -> Skill -> Memory`
- PCAM as execution structure

### 2.2 Harness engineering stance

Chronos is implemented as a harness-engineered system:
- deterministic code enforces structure, permissions, gating, and persistence
- models or agents perform bounded judgment where judgment is required

### 2.3 Agent scope

Chronos should use `agent` as the primary runtime concept.

If agent delegation is added later, it is still a specialization of the agent layer, not a new architectural layer.

### 2.4 Minimum-autonomy-by-default

Use:
- deterministic code when no judgment is needed
- bounded model use when a single decision is enough
- agent runtime only when iterative reasoning or tool use is materially useful

---

## 3. Current Runtime Snapshot

### 3.1 What exists today

Current code already provides:
- edge APIs for Discord, signals, heartbeat, web actions
- session records
- capture log
- decision log
- notification queue
- signed web review surfaces
- a bounded `/ask` flow

### 3.2 Main current architectural gaps

The current implementation still has these core gaps:

1. Level 2+ execution is still mostly an in-process workflow, not a true agent runtime.
2. Markdown recipes and agents are partially operational but still rely heavily on hardcoded TypeScript branching.
3. There is no general signal queue or worker boundary for deep cognition.
4. `/api/discord` and `/api/signal` still execute work inline rather than handing deep work off.
5. Agent skills are runtime functions, not a clean tool surface exposed through an agent layer.

This low-level design closes those gaps.

---

## 4. Target Runtime Topology

## 4.1 Components

| Component | PCAM owner | Responsibility |
|-----------|------------|----------------|
| Edge API service | Perception + Manifestation | Normalize signals, verify auth/signatures, serve pages, acknowledge fast |
| Run queue | Perception -> Cognition handoff | Buffer deeper work and make retries/idempotency explicit |
| Worker service | Cognition + Agency | Execute recipe flows, invoke agents, use tools, create artifacts |
| Persistence layer | Manifestation | Store sessions, captures, decisions, run state, artifacts |
| Retrieval layer | Manifestation supporting Cognition | Search LTM quickly and return grounded context |
| Source-of-truth memory adapter | Agency + Manifestation | Write durable knowledge to the owner's native memory system |

## 4.2 Runtime split

### Edge service

Responsibilities:
- receive Discord interactions
- receive web and Claude Code signals
- normalize input into a single signal envelope
- persist ingress records
- enqueue deeper work
- return protocol-correct acknowledgments
- serve signed review and reading pages

### Worker service

Responsibilities:
- load session state
- initialize STM
- run recipe logic
- invoke agents
- expose tools for memory and artifact operations
- update state and decision logs
- emit final manifestations

### Queue

Responsibilities:
- durable handoff from edge to worker
- retries
- idempotency
- scheduling
- visibility into in-flight work

---

## 5. Module Map

### 5.1 Edge-side modules

| Module | Purpose | Current code base |
|--------|---------|-------------------|
| `signal-normalizer` | Build canonical signal envelope | currently split across `app/api/*` and `src/lib/engine/signals.ts` |
| `trust-gate` | Resolve owner/unknown author behavior | `src/lib/engine/trust.ts` |
| `command-ingress` | Parse Discord commands into signals | `app/api/discord/route.ts`, `src/lib/engine/commands.ts` |
| `web-surface-router` | Serve signed pages and review actions | `app/review/*`, `src/lib/web-pages.ts` |
| `run-enqueuer` | Persist and enqueue deeper work | new module |

### 5.2 Worker-side modules

| Module | Purpose |
|--------|---------|
| `recipe-runtime` | Load recipe, enforce gates, sequence steps |
| `stm-initializer` | Build or resume STM before deeper reasoning |
| `agent-runtime` | Execute an agent with a bounded context and tool surface |
| `tool-registry` | Expose Chronos-native tools to agents |
| `heartbeat-runtime` | Run hybrid batch + judgment flow |
| `artifact-runtime` | Build and persist briefs, reviews, summaries |

### 5.3 Persistence modules

| Module | Purpose |
|--------|---------|
| `session-store` | Session and current-session state |
| `capture-store` | Capture log and review state |
| `decision-store` | Decision audit log |
| `run-store` | Run queue, execution state, retries |
| `artifact-store` | Signed page payloads and generated artifacts |

---

## 6. Core Data Contracts

## 6.1 Signal envelope

This should become the canonical ingress contract.

```ts
type SignalEnvelope = {
  id: string;
  kind: "capture" | "ask" | "web_action" | "heartbeat" | "session_command";
  channel:
    | "discord"
    | "web"
    | "claude_code"
    | "heartbeat"
    | "web_action"
    | "system";
  authorId: string;
  sessionId?: string;
  topic?: string;
  createdAt: string;
  payload: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
};
```

### Rules

- All ingress paths normalize into this envelope before any Cognition logic begins.
- No route should bypass normalization.
- The envelope is the Perception output contract.

## 6.2 Execution run

This is the canonical unit of queued work.

```ts
type ExecutionRun = {
  id: string;
  signalId: string;
  recipeId: string;
  executionPattern: "one_shot" | "agentic";
  status: "queued" | "running" | "awaiting_user" | "completed" | "failed";
  gate: "none" | "clarification" | "blocked" | "synthesis" | "error";
  assignedAgent?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
};
```

### Rules

- Edge creates the run.
- Worker owns state transitions.
- User-visible output is attached only once a valid gate is reached.

## 6.3 Agent invocation record

```ts
type AgentInvocation = {
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
};
```

## 6.4 Tool call record

```ts
type ToolCallRecord = {
  id: string;
  runId: string;
  agentInvocationId: string;
  toolName: string;
  status: "requested" | "executed" | "blocked" | "failed";
  createdAt: string;
  inputSummary?: string;
  outputSummary?: string;
  blockedReason?: string;
};
```

## 6.5 Artifact record

```ts
type ArtifactRecord = {
  id: string;
  runId: string;
  artifactType:
    | "strategy_brief"
    | "capture_review"
    | "decision_review"
    | "session_summary"
    | "clarification_page";
  channel: "web" | "discord_inline";
  storageKey: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};
```

---

## 7. Storage Design

## 7.1 Existing records to keep

Keep:
- `SessionRecord`
- `CaptureLogEntry`
- `DecisionLogEntry`
- `NotificationRecord`

These already map well to Manifestation.

## 7.2 New records to add

Add:
- `SignalEnvelope` persistence
- `ExecutionRun`
- `AgentInvocation`
- `ToolCallRecord`
- `ArtifactRecord`

### Why these records matter

- `SignalEnvelope`: auditable ingress
- `ExecutionRun`: explicit run state and retries
- `AgentInvocation`: real agent traceability
- `ToolCallRecord`: tool audit
- `ArtifactRecord`: stable artifact handling separate from route logic

## 7.3 Store abstraction changes

The store interface should grow in a backward-compatible way:

```ts
interface ChronosStore {
  saveSignal(signal: SignalEnvelope): Promise<SignalEnvelope>;
  getSignal(signalId: string): Promise<SignalEnvelope | null>;
  queueRun(run: ExecutionRun): Promise<ExecutionRun>;
  getRun(runId: string): Promise<ExecutionRun | null>;
  listRuns(filter?: {...}): Promise<ExecutionRun[]>;
  saveAgentInvocation(record: AgentInvocation): Promise<AgentInvocation>;
  listAgentInvocations(runId: string): Promise<AgentInvocation[]>;
  saveToolCall(record: ToolCallRecord): Promise<ToolCallRecord>;
  listToolCalls(agentInvocationId: string): Promise<ToolCallRecord[]>;
  saveArtifact(record: ArtifactRecord): Promise<ArtifactRecord>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
}
```

---

## 8. Execution Patterns

## 8.1 One-shot pattern

Used for:
- capture
- quick classification
- bounded confidence scoring

Flow:
1. normalize signal
2. trust gate
3. one bounded model call if needed
4. deterministic decision ladder
5. write state
6. return or stay silent

## 8.2 Agentic pattern

Used for:
- `/ask`
- clarification loops
- deeper strategic reasoning
- selected heartbeat review paths

Flow:
1. normalize signal
2. create run
3. initialize STM
4. load recipe
5. enforce intent availability
6. invoke assigned agent
7. allow only approved tools
8. reach valid response gate
9. persist artifacts and state
10. deliver manifestation

---

## 9. Tool Surface

These are the target agent tools.

| Tool | PCAM layer | Purpose |
|------|------------|---------|
| `read_stm` | Cognition via Manifestation | Read current STM state |
| `write_stm` | Agency -> Manifestation | Append analysis/results to STM |
| `search_memory` | Cognition via Manifestation | Retrieve relevant long-term memory |
| `append_session_history` | Manifestation | Record a user/system message in session history |
| `write_decision_log` | Manifestation | Persist decision audit entries |
| `issue_signed_page` | Agency | Create a review or reading artifact |
| `queue_notification` | Agency | Schedule owner-facing notifications |
| `promote_capture` | Agency -> Manifestation | Commit a capture into durable memory |
| `record_review_action` | Manifestation | Save owner feedback that should affect later processing |

### Tool rules

- Agents do not get raw database access.
- Agents do not get raw filesystem access for durable state.
- Every tool call is auditable.
- Tools should expose intention-level operations, not storage internals.

---

## 10. `/ask` Low-Level Sequence

1. Edge receives `/ask`.
2. Edge verifies trust and normalizes to `SignalEnvelope(kind="ask")`.
3. Edge resolves current session or creates one.
4. Edge creates `ExecutionRun(executionPattern="agentic")`.
5. Edge enqueues the run and returns an acknowledgment suitable for the channel.
6. Worker picks up the run.
7. Worker loads recipe `consult-cto`.
8. Worker initializes STM if needed.
9. Worker enforces the recipe's intent gate.
10. Worker invokes the assigned agent.
11. Agent uses approved tools to:
    - inspect STM
    - inspect relevant memory
    - write intermediate outputs
12. If clarification is required:
    - worker marks run `awaiting_user`
    - worker writes a clarification artifact or inline response
13. If synthesis is ready:
    - worker stores the artifact
    - worker marks run `completed`
    - worker emits the final manifestation

### Non-negotiable behavior

- Step 0 happens before deeper reasoning.
- No user-visible intermediate execution chatter.
- Output only at valid response gates.

---

## 11. Heartbeat Low-Level Sequence

1. Scheduler or manual command produces `SignalEnvelope(kind="heartbeat")`.
2. Worker loads eligible captures.
3. Deterministic filters process easy cases:
   - obvious noise
   - obvious duplicate
   - below ask threshold
   - above auto threshold
4. Only uncertain cases enter deeper judgment.
5. If deeper judgment is needed, the worker invokes the appropriate agent path.
6. Promotion or review artifacts are recorded.
7. Decision log is updated.
8. Notifications are queued if the owner must act.

---

## 12. Discord and Web Low-Level Design

## 12.1 Discord ingress

Requirements:
- verify signatures
- respond within Discord protocol limits
- never block on deep cognition
- use defer/ack patterns correctly

### Edge contract

Discord route should:
- parse command
- normalize signal
- create or enqueue work
- return minimal valid interaction response

### Worker contract

Worker should:
- complete the work
- emit follow-up messages or web artifacts when needed

## 12.2 Web artifacts

Web artifacts should become first-class stored outputs.

They should not be treated only as route-level rendering convenience.

Each artifact should have:
- type
- payload
- access token or signed key
- TTL
- source run id

---

## 13. Observability and Audit

The implementation must make it easy to answer:
- what signal came in?
- what recipe handled it?
- which agent ran?
- which tools were used?
- what gate was reached?
- what artifact or memory write was produced?
- why did the system auto-approve, defer, or reject?

Required observability records:
- signal log
- execution run log
- agent invocation log
- tool call log
- decision log
- artifact log

---

## 14. Acceptance Criteria for Implementation

The low-level design is considered implemented when:

1. All ingress paths produce the same normalized signal envelope.
2. Deep cognition paths use a run queue and worker boundary.
3. `/ask` reaches clarification and synthesis gates through the new execution model.
4. Review actions re-enter the same run model instead of mutating state out-of-band.
5. Agent work is auditable through invocation and tool-call records.
6. Web artifacts are stored and addressable as first-class outputs.
7. Heartbeat remains mostly deterministic but escalates hard cases cleanly.

---

## 15. Immediate Gap Summary Against Current Code

These are the first implementation gaps to close after this design:

1. Introduce `SignalEnvelope` and `ExecutionRun`.
2. Add run persistence to the store abstraction.
3. Move `/ask` off direct inline execution and behind the run model.
4. Introduce an explicit agent runtime boundary instead of direct TypeScript skill chaining.
5. Convert current skill functions into a tool-backed runtime surface.
6. Make web artifacts first-class stored outputs rather than route-local compositions.
