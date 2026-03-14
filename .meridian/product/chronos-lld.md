# Chronos v1 — Low-Level Design

> Implementation blueprint derived from the product spec (v4.0.0) and technical approach (v1.1.0).
> Each section is scoped to fit a single implementation context window.

**Version:** 1.0.0
**Date:** 2026-03-14
**Language:** Python 3.12+
**Source:** chronos-features.md, technical-approach.md, chronos-scenarios.md

---

## Technology Decisions

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| LLM Cognition | `anthropic` SDK | latest | Native tool use, `tool_runner` with compaction, streaming |
| Observability | Langfuse Python SDK v3 | latest | OTEL-based, `AnthropicInstrumentor` for zero-code tracing |
| Database | PostgreSQL 16 | — | System of record: signals, sessions, audit log, artifacts, recipe state |
| Queue/Cache | Redis 7 | — | Heartbeat scheduling, ephemeral runtime state |
| Web Framework | FastAPI | latest | Async, serves web channel (artifacts, review surfaces, webhooks) |
| Discord | discord.py 2.x | latest | Slash commands via `app_commands`, message listener |
| WhatsApp | Meta Cloud API direct | v21.0 | No intermediary; webhook inbound, REST outbound |
| Migrations | Alembic | latest | Postgres schema migrations |
| Task Scheduling | APScheduler or Redis-based | — | 30-min heartbeat, long-cadence promotion trigger |
| HTML Rendering | Jinja2 | latest | Artifact and review surface templates |

### Key SDK Patterns Used

**Agent Loop**: `client.beta.messages.tool_runner()` with compaction enabled — handles multi-turn tool use, auto-compacts when context exceeds threshold. Each recipe defines tools as `@beta_tool` decorated functions.

**Observability**: `AnthropicInstrumentor().instrument()` + `@observe` decorators on recipe/skill functions. Zero manual wrapping for Anthropic calls; workflow-level spans via decorators.

**Channels**: `MessageEnvelope` dataclass normalized by `DiscordAdapter` and `WhatsAppAdapter`. Each envelope carries an opaque `reply` callable for outbound.

---

## Project Structure

```
chronos/
├── src/
│   ├── chronos/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app + Discord bot startup
│   │   ├── config.py                # Environment config (pydantic-settings)
│   │   │
│   │   ├── channels/                # PCAM: Perception
│   │   │   ├── __init__.py
│   │   │   ├── envelope.py          # MessageEnvelope dataclass
│   │   │   ├── discord_adapter.py   # Discord bot, slash commands, normalizer
│   │   │   ├── whatsapp_adapter.py  # WhatsApp webhook, normalizer
│   │   │   ├── router.py            # Output routing (inline vs web)
│   │   │   └── gateway.py           # Inbound dispatch: envelope → trust → signal store or recipe
│   │   │
│   │   ├── trust/                   # Cross-cutting: Trust Plane
│   │   │   ├── __init__.py
│   │   │   └── auth.py              # Owner verification, rejection logging
│   │   │
│   │   ├── engine/                  # PCAM: Cognition
│   │   │   ├── __init__.py
│   │   │   ├── agent_loop.py        # tool_runner wrapper with state persistence + gates
│   │   │   ├── recipe_loader.py     # Load recipe definition (prompt, tools, gates, state schema)
│   │   │   ├── resume.py            # Resume paused recipe from Postgres state
│   │   │   ├── gates.py             # Response gate detection and enforcement
│   │   │   └── cartridge.py         # Domain cartridge: radar scan → vault signal matching → STM load
│   │   │
│   │   ├── recipes/                 # Recipe definitions (system prompts + tool sets)
│   │   │   ├── __init__.py
│   │   │   ├── capture.py           # Recipe 1: capture flow + heartbeat classification
│   │   │   ├── consult.py           # Recipe 2: consult CTO research pipeline
│   │   │   └── promotion.py         # Recipe 3: memory promotion
│   │   │
│   │   ├── skills/                  # PCAM: Agency (tools for agent loop)
│   │   │   ├── __init__.py
│   │   │   ├── registry.py          # Skill registry — maps skill names to @beta_tool functions
│   │   │   ├── classify.py          # Classify signal against radars
│   │   │   ├── research.py          # Deep research (web search, vault retrieval)
│   │   │   ├── synthesize.py        # Synthesize findings into structured artifact
│   │   │   ├── render.py            # Structured artifact → HTML via Jinja2
│   │   │   ├── notify.py            # Send notification via messaging channel
│   │   │   ├── publish.py           # Publish artifact to web channel
│   │   │   ├── promote.py           # Promote signal store patterns to vault
│   │   │   └── review.py            # Surface items for owner review
│   │   │
│   │   ├── memory/                  # PCAM: Manifestation
│   │   │   ├── __init__.py
│   │   │   ├── signal_store.py      # Signal CRUD (Postgres)
│   │   │   ├── stm.py               # Session STM (Postgres JSON)
│   │   │   ├── vault.py             # Vault read/write (radars + signals, filesystem or Postgres)
│   │   │   ├── audit_log.py         # Decision audit log (append-only Postgres)
│   │   │   └── artifacts.py         # Artifact CRUD (Postgres)
│   │   │
│   │   ├── sessions/
│   │   │   ├── __init__.py
│   │   │   └── manager.py           # Session CRUD, STM persistence/restore
│   │   │
│   │   ├── web/                     # Web channel surfaces
│   │   │   ├── __init__.py
│   │   │   ├── routes.py            # FastAPI routes: artifacts, review, sessions
│   │   │   ├── auth.py              # Token-authenticated URL validation
│   │   │   └── templates/           # Jinja2 templates for HTML artifacts + review surfaces
│   │   │
│   │   ├── scheduler/
│   │   │   ├── __init__.py
│   │   │   └── heartbeat.py         # 30-min heartbeat trigger, long-cadence promotion trigger
│   │   │
│   │   └── observability/
│   │       ├── __init__.py
│   │       └── setup.py             # Langfuse init, AnthropicInstrumentor, @observe helpers
│   │
│   └── tests/                       # Maps to chronos-scenarios.md groups
│       ├── test_capture.py          # SC-CAP-*
│       ├── test_classify.py         # SC-CLS-*
│       ├── test_consult.py          # SC-CON-*
│       ├── test_promotion.py        # SC-MEM-*
│       ├── test_review.py           # SC-REV-*
│       ├── test_sessions.py         # SC-SES-*
│       ├── test_channels.py         # SC-CHN-*
│       ├── test_confidence.py       # SC-CNF-*
│       ├── test_audit.py            # SC-AUD-*
│       ├── test_trust.py            # SC-TRU-*
│       ├── test_gates.py            # SC-GAT-*
│       ├── test_observability.py    # SC-OBS-*
│       └── test_integration.py      # SC-PHX-*, SC-DOM-*
│
├── db/
│   └── migrations/                  # Alembic migrations
│
├── vault/                           # CTO domain cartridge seed data (filesystem)
│   ├── radars/                      # Radar definitions (markdown with keyword sets)
│   └── signals/                     # Seed signals by category
│
├── pyproject.toml
├── alembic.ini
└── .env.example
```

---

## 1. Database Schema (Postgres)

### 1.1 signals

```sql
CREATE TYPE signal_status AS ENUM (
    'unclassified', 'classified', 'review_pending', 'rejected', 'archived'
);

CREATE TABLE signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_text        TEXT NOT NULL,
    channel         VARCHAR(50) NOT NULL,        -- 'discord', 'whatsapp'
    author_id       VARCHAR(100) NOT NULL,
    channel_msg_id  VARCHAR(100),                -- platform-native message ID
    status          signal_status NOT NULL DEFAULT 'unclassified',
    radar_category  VARCHAR(100),                -- set after classification
    confidence      FLOAT,                       -- classification confidence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    classified_at   TIMESTAMPTZ,
    reviewed_at     TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_signals_status ON signals (status);
CREATE INDEX idx_signals_created ON signals (created_at);
```

### 1.2 sessions

```sql
CREATE TYPE session_status AS ENUM ('active', 'inactive');

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic           VARCHAR(500) NOT NULL,
    status          session_status NOT NULL DEFAULT 'active',
    stm_state       JSONB DEFAULT '{}',          -- full STM snapshot
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_status ON sessions (status);
CREATE INDEX idx_sessions_active ON sessions (last_active_at DESC);
```

### 1.3 recipe_runs

```sql
CREATE TYPE recipe_state AS ENUM (
    'queued', 'running', 'publishing', 'awaiting_review',
    'revising', 'completed', 'blocked'
);

CREATE TABLE recipe_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe          VARCHAR(100) NOT NULL,       -- 'capture_classify', 'consult_cto', 'promotion'
    session_id      UUID REFERENCES sessions(id),
    state           recipe_state NOT NULL DEFAULT 'queued',
    agent_state     JSONB DEFAULT '{}',          -- persisted messages + tool history for resume
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_runs_state ON recipe_runs (state);
```

### 1.4 artifacts

```sql
CREATE TABLE artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_run_id   UUID REFERENCES recipe_runs(id),
    structured      JSONB NOT NULL,              -- {sections, sources, confidence, metadata}
    html_content    TEXT,                         -- rendered HTML
    access_token    VARCHAR(64) NOT NULL UNIQUE,  -- token for URL auth
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.5 audit_log

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipe          VARCHAR(100) NOT NULL,
    session_id      UUID REFERENCES sessions(id),
    decision_type   VARCHAR(50) NOT NULL,        -- 'classification', 'synthesis', 'promotion', 'revision', 'review'
    input           JSONB NOT NULL,
    output          JSONB NOT NULL,
    confidence      FLOAT,
    sources         JSONB DEFAULT '[]',          -- array of vault signal paths
    owner_feedback  TEXT,
    changes_made    TEXT,
    trace_id        VARCHAR(100)                 -- Langfuse trace ID for cross-reference
);

-- Append-only: no UPDATE/DELETE grants on this table
CREATE INDEX idx_audit_recipe ON audit_log (recipe);
CREATE INDEX idx_audit_type ON audit_log (decision_type);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);
CREATE INDEX idx_audit_confidence ON audit_log (confidence);
```

---

## 2. Core Runtime: Agent Loop

The agent loop is the execution engine for all recipes. It wraps the Anthropic SDK `tool_runner` with state persistence and response gate detection.

### 2.1 agent_loop.py — Key Design

```python
from anthropic import Anthropic, beta_tool
from langfuse import observe
from chronos.engine.gates import check_gates, GateResult
from chronos.memory.audit_log import log_decision

@observe(name="agent_loop")
async def run_recipe(
    recipe_run_id: str,
    recipe_prompt: str,
    tools: list,               # list of @beta_tool functions
    messages: list,            # conversation history (restored from DB on resume)
    gate_conditions: dict,     # gate detection rules per recipe
    session_id: str,
) -> GateResult:
    """
    Execute a recipe's agent loop until a response gate is reached or tools exhausted.

    Returns GateResult with gate_type and output.
    Persists state to Postgres after each tool-use round.
    """
    client = Anthropic()

    runner = client.beta.messages.tool_runner(
        model="claude-sonnet-4-20250514",        # fast model for most recipes
        max_tokens=8192,
        system=recipe_prompt,
        tools=tools,
        messages=messages,
        compaction_control={
            "enabled": True,
            "context_token_threshold": 100_000,
        },
    )

    for response in runner:
        # Persist conversation state after each round
        messages.append({"role": "assistant", "content": response.content})
        await persist_agent_state(recipe_run_id, messages)

        # Check response gates
        gate = check_gates(response, gate_conditions)
        if gate:
            return gate

    # If tool_runner exhausts (no more tool calls), treat as synthesis gate
    return GateResult(gate_type="synthesis", output=response.content)
```

### 2.2 State Persistence for Human Pause

When a gate requires human input (e.g., `awaiting_review`):

```python
async def pause_recipe(recipe_run_id: str, state: str, notification: dict):
    """Persist state and stop. Resume when human responds."""
    await update_recipe_state(recipe_run_id, state)  # e.g., 'awaiting_review'
    await send_notification(notification)              # messaging channel link
    # Agent loop ends here. Resume handler picks up later.
```

### 2.3 Resume Handler

```python
@observe(name="resume_recipe")
async def resume_recipe(recipe_run_id: str, human_input: dict):
    """Resume a paused recipe with human feedback."""
    run = await load_recipe_run(recipe_run_id)
    messages = run.agent_state["messages"]

    # Append human feedback as a user message
    messages.append({
        "role": "user",
        "content": format_human_feedback(human_input)
    })

    # Log feedback to audit
    await log_decision(
        recipe=run.recipe,
        session_id=run.session_id,
        decision_type="review",
        input=human_input,
        output={},
        owner_feedback=human_input.get("feedback"),
    )

    # Re-enter agent loop
    recipe = load_recipe(run.recipe)
    return await run_recipe(
        recipe_run_id=recipe_run_id,
        recipe_prompt=recipe.prompt,
        tools=recipe.tools,
        messages=messages,
        gate_conditions=recipe.gate_conditions,
        session_id=run.session_id,
    )
```

### 2.4 Context Window Management

**Problem**: Long-running recipes (consult with multiple clarification rounds) can exhaust the context window.

**Solution**: `tool_runner` compaction is enabled with a 100k token threshold. When conversation history exceeds this, the SDK auto-summarizes older turns. For recipes with very long vault context, we control what goes into STM:

- Domain cartridge loading selects only radar-matched signals (not entire vault)
- STM caps at configurable token budget (default 50k tokens of vault context)
- Each skill tool returns structured output, not verbose prose

---

## 3. Response Gates

### 3.1 gates.py

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class GateResult:
    gate_type: str          # 'clarification', 'synthesis', 'blocked', 'error'
    output: list            # content blocks to surface to user
    artifact_id: Optional[str] = None
    pause_state: Optional[str] = None   # recipe state to transition to

def check_gates(response, gate_conditions: dict) -> Optional[GateResult]:
    """
    Inspect the model response for gate signals.

    Gate detection strategy:
    - Tool call to `pause_for_review` → awaiting_review gate
    - Tool call to `ask_clarification` → clarification gate
    - Tool call to `report_blocked` → blocked gate
    - No more tool calls + text output → synthesis gate
    - Exception in tool execution → error gate
    """
    for block in response.content:
        if block.type == "tool_use":
            if block.name == "pause_for_review":
                return GateResult("awaiting_review", response.content, pause_state="awaiting_review")
            if block.name == "ask_clarification":
                return GateResult("clarification", response.content)
            if block.name == "report_blocked":
                return GateResult("blocked", response.content)
    return None
```

Gate tools are special tools included in every recipe that let Claude explicitly signal gate transitions. This keeps gate detection deterministic (tool call) rather than heuristic (text parsing).

---

## 4. Channel Gateway

### 4.1 envelope.py

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Awaitable, Optional

@dataclass
class MessageEnvelope:
    channel: str                              # "discord" | "whatsapp"
    channel_message_id: str
    sender_id: str
    chat_id: str
    text: str
    timestamp: datetime
    reply: Callable[[str], Awaitable[None]]   # outbound callable
    meta: dict = field(default_factory=dict)
    command: Optional[str] = None             # parsed slash command name
    command_args: Optional[dict] = None       # parsed command arguments
```

### 4.2 gateway.py — Inbound Dispatch

```python
from chronos.trust.auth import verify_owner
from chronos.memory.signal_store import store_signal
from chronos.sessions.manager import route_session_command
from chronos.engine.agent_loop import run_recipe

async def handle_inbound(envelope: MessageEnvelope):
    """Central dispatch for all inbound messages."""

    # 1. Trust check
    if not verify_owner(envelope.sender_id):
        await log_rejection(envelope)
        return  # silent rejection

    # 2. Session commands
    if envelope.command and envelope.command.startswith("session"):
        await route_session_command(envelope)
        return

    # 3. Intent detection: is this a capture or a consult?
    intent = detect_intent(envelope.text)

    if intent == "capture":
        # Store silently, no response
        await store_signal(
            raw_text=envelope.text,
            channel=envelope.channel,
            author_id=envelope.sender_id,
            channel_msg_id=envelope.channel_message_id,
        )
        return

    if intent in ("retrieve", "synthesize"):
        # Start or continue consult recipe
        await start_consult(envelope)
        return
```

### 4.3 Output Router

```python
from chronos.channels.envelope import MessageEnvelope

async def route_output(
    envelope: MessageEnvelope,
    gate_result,
    artifact_id: str = None,
):
    """Route recipe output to appropriate channel."""

    if gate_result.gate_type == "clarification":
        # Short enough for inline messaging
        text = format_clarification(gate_result.output)
        await envelope.reply(text)

    elif gate_result.gate_type in ("synthesis", "awaiting_review"):
        # Rich artifact → web channel + messaging pointer
        url = generate_artifact_url(artifact_id)
        await envelope.reply(f"Your brief is ready: {url}")

    elif gate_result.gate_type == "blocked":
        text = format_blocked(gate_result.output)
        await envelope.reply(text)

    elif gate_result.gate_type == "error":
        await envelope.reply("Something went wrong. Please try again or rephrase your request.")
```

---

## 5. Domain Cartridge Loader

### 5.1 cartridge.py

```python
from dataclasses import dataclass
from chronos.memory.vault import load_radars, load_signals_by_radar
from langfuse import observe

@dataclass
class DomainCartridge:
    role_profile: dict          # persona definition, output framing, domain vocabulary
    matched_signals: list       # list of {path, content, radar, relevance_score}
    radars_matched: list        # which radars fired

@observe(name="load_cartridge")
async def load_cartridge(query: str, role: str = "cto") -> DomainCartridge:
    """
    Load domain cartridge by scanning query against radars
    and selecting matched vault signals.

    Token budget: caps matched signals at ~50k tokens to leave room
    for recipe prompt and conversation history.
    """
    role_profile = load_role_profile(role)
    radars = await load_radars()

    # Scan query keywords against radar keyword sets
    matched_radars = []
    for radar in radars:
        score = keyword_match(query, radar.keywords)
        if score > 0.3:  # threshold
            matched_radars.append((radar, score))

    matched_radars.sort(key=lambda x: x[1], reverse=True)

    # Load signals from matched radars, respecting token budget
    signals = []
    token_count = 0
    TOKEN_BUDGET = 50_000

    for radar, score in matched_radars:
        radar_signals = await load_signals_by_radar(radar.name)
        for signal in radar_signals:
            signal_tokens = estimate_tokens(signal.content)
            if token_count + signal_tokens > TOKEN_BUDGET:
                break
            signals.append({
                "path": signal.path,
                "content": signal.content,
                "radar": radar.name,
                "relevance_score": score,
            })
            token_count += signal_tokens

    return DomainCartridge(
        role_profile=role_profile,
        matched_signals=signals,
        radars_matched=[r.name for r, _ in matched_radars],
    )
```

### 5.2 Vault Structure (Filesystem)

```
vault/
├── radars/
│   ├── ai-intelligence.md         # keywords: [ai, agents, llm, ...]
│   ├── technology.md              # keywords: [architecture, microservices, ...]
│   ├── leadership.md              # keywords: [team, culture, hiring, ...]
│   ├── innovation.md              # keywords: [disruption, moats, ...]
│   ├── evolutionary-architecture.md
│   ├── product.md
│   └── strategy.md
└── signals/
    ├── ai/
    │   ├── augmentation-principle.md
    │   └── intent-alignment.md
    ├── technology/
    │   ├── composable-architecture.md
    │   └── service-mesh-patterns.md
    └── leadership/
        ├── team-autonomy.md
        └── strategic-radars.md
```

Each radar file has a frontmatter with keywords:

```markdown
---
name: ai-intelligence
keywords: [ai, agents, llm, machine learning, augmentation, intelligence, neural, transformer]
signals_path: signals/ai/
---
```

---

## 6. Recipe Definitions

Each recipe is a Python module that defines: system prompt, tool set, gate conditions, and state schema.

### 6.1 Recipe 1: Capture & Classify

```python
# recipes/capture.py

HEARTBEAT_PROMPT = """
You are the Chronos classification engine. Your job is to classify unclassified signals
using the domain cartridge provided in the context.

For each signal:
1. Read the signal text
2. Match it against the radar categories in the cartridge
3. Assign a radar category and confidence score (0.0-1.0)
4. If confidence < 0.7, use the `flag_for_review` tool instead of `store_classification`

You must classify ALL provided signals. Do not skip any.
After classifying all signals, use the `complete_batch` tool.
"""

TOOLS = [classify_signal, flag_for_review, store_classification, complete_batch]

GATE_CONDITIONS = {
    "complete_batch": "synthesis",  # batch done → exit
}
```

### 6.2 Recipe 2: Consult CTO

```python
# recipes/consult.py

CONSULT_PROMPT = """
You are Chronos, a strategic thinking partner for a CTO.
You are grounded in the owner's knowledge — the domain cartridge in your context
contains their captured signals and mental models.

Your workflow:
1. Assess the request scope. Is it a retrieve (find existing knowledge) or
   synthesize (create new analysis)?
2. If the request is underspecified, use `ask_clarification` with grounded questions.
   Each question MUST cite a signal path from the cartridge.
3. If you have enough understanding, synthesize findings into a structured artifact
   using `create_artifact`.
4. Every claim must have a source. If you use training knowledge, label it explicitly.
5. Include a confidence score reflecting how well-grounded the output is in vault signals.
6. After creating the artifact, use `publish_and_notify` then `pause_for_review`.

NEVER output intermediate reasoning to the user. Only surface output at gates:
clarification, synthesis, blocked, or error.
"""

TOOLS = [
    ask_clarification,      # → clarification gate
    search_vault,           # retrieve matching signals
    create_artifact,        # structured artifact with confidence + citations
    render_html,            # structured → HTML
    publish_and_notify,     # publish to web, notify messaging
    pause_for_review,       # → awaiting_review gate
    report_blocked,         # → blocked gate
    revise_artifact,        # update existing artifact in-place
]

GATE_CONDITIONS = {
    "ask_clarification": "clarification",
    "pause_for_review": "awaiting_review",
    "report_blocked": "blocked",
}
```

### 6.3 Recipe 3: Memory Promotion

```python
# recipes/promotion.py

PROMOTION_PROMPT = """
You are the Chronos memory promotion engine. You analyze accumulated signals
for stable patterns that deserve promotion to long-term memory (vault).

Your workflow:
1. Review all classified signals from the past period
2. Identify reinforced themes (multiple signals supporting the same pattern)
3. For each candidate pattern:
   - If clearly durable: use `promote_to_vault`
   - If ambiguous: use `flag_for_review`
   - If noise: use `archive_signal`
4. Scan for contradictions between existing vault signals and new patterns.
   Surface contradictions using `surface_contradiction`.
5. Scan for novel connections across different radar categories.
   Surface connections using `surface_connection`.
6. After processing all candidates, use `publish_promotion_summary` then `pause_for_review`.
"""

TOOLS = [
    promote_to_vault,
    archive_signal,
    flag_for_review,
    surface_contradiction,
    surface_connection,
    publish_promotion_summary,
    pause_for_review,
    report_blocked,
]
```

---

## 7. Skills (Agent Tools)

Each skill is a `@beta_tool` function. Skills are the PCAM Agency layer — the tools Claude uses to act.

### 7.1 classify.py

```python
from anthropic import beta_tool

@beta_tool
async def classify_signal(signal_id: str, radar_category: str, confidence: float) -> str:
    """Classify a signal into a radar category with a confidence score.

    Args:
        signal_id: UUID of the signal to classify
        radar_category: The radar category name (e.g., 'ai-intelligence', 'technology')
        confidence: Classification confidence between 0.0 and 1.0
    """
    await update_signal_classification(signal_id, radar_category, confidence)
    await log_decision(
        decision_type="classification",
        input={"signal_id": signal_id},
        output={"radar_category": radar_category},
        confidence=confidence,
    )
    return f"Signal {signal_id} classified as {radar_category} (confidence: {confidence})"

@beta_tool
async def flag_for_review(signal_id: str, reason: str, candidate_categories: list[str]) -> str:
    """Flag a signal for owner review due to low classification confidence.

    Args:
        signal_id: UUID of the signal to flag
        reason: Why this signal is ambiguous
        candidate_categories: List of possible radar categories
    """
    await update_signal_status(signal_id, "review_pending")
    await create_review_item(signal_id, reason, candidate_categories)
    return f"Signal {signal_id} flagged for owner review"
```

### 7.2 synthesize.py

```python
@beta_tool
async def create_artifact(
    title: str,
    sections: list[dict],
    sources: list[dict],
    confidence: float,
    training_sourced_claims: list[str],
    confidence_gaps: list[str],
) -> str:
    """Create a structured artifact from synthesis results.

    Args:
        title: Artifact title
        sections: List of {heading, content} dicts
        sources: List of {claim, signal_path} dicts tracing claims to vault signals
        confidence: Overall confidence score (0.0-1.0)
        training_sourced_claims: Claims that come from model training, not vault signals
        confidence_gaps: Specific areas where more signals would increase confidence
    """
    artifact = await store_artifact(
        structured={
            "title": title,
            "sections": sections,
            "sources": sources,
            "confidence": confidence,
            "training_sourced": training_sourced_claims,
            "confidence_gaps": confidence_gaps,
        }
    )
    await log_decision(
        decision_type="synthesis",
        input={"title": title},
        output={"artifact_id": str(artifact.id)},
        confidence=confidence,
        sources=[s["signal_path"] for s in sources],
    )
    return f"Artifact created: {artifact.id}"
```

### 7.3 Gate Tools (included in all recipes)

```python
@beta_tool
def ask_clarification(questions: list[dict]) -> str:
    """Ask the owner clarifying questions before proceeding.
    Each question must include a signal_path citation from the domain cartridge.

    Args:
        questions: List of {question, signal_path, why_it_matters} dicts
    """
    # This tool triggers the clarification gate.
    # The agent loop detects this tool call and surfaces questions to the user.
    return "Questions presented to owner. Waiting for response."

@beta_tool
def pause_for_review(artifact_id: str, notification_text: str) -> str:
    """Pause execution and wait for owner review of an artifact.

    Args:
        artifact_id: UUID of the artifact to review
        notification_text: Compact notification text for messaging channel (< 280 chars)
    """
    return "Recipe paused. Owner notified."

@beta_tool
def report_blocked(reason: str, suggested_action: str) -> str:
    """Report that the recipe cannot proceed due to a hard blocker.

    Args:
        reason: What is blocking progress
        suggested_action: What the owner can do to unblock
    """
    return f"Blocked: {reason}"
```

---

## 8. Observability Setup

### 8.1 setup.py

```python
import os
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor
from langfuse import get_client

def init_observability():
    """Initialize Langfuse + Anthropic auto-instrumentation."""
    os.environ.setdefault("LANGFUSE_PUBLIC_KEY", "...")
    os.environ.setdefault("LANGFUSE_SECRET_KEY", "...")
    os.environ.setdefault("LANGFUSE_BASE_URL", "https://cloud.langfuse.com")

    langfuse = get_client()
    AnthropicInstrumentor().instrument()
    return langfuse
```

### 8.2 Eval: Confidence Calibration

```python
async def eval_confidence_calibration(period_days: int = 30):
    """
    Detect if owner frequently overrides high-confidence classifications.
    Run periodically (e.g., weekly).
    """
    overrides = await query_audit_log(
        decision_type="review",
        period_days=period_days,
    )

    high_conf_overrides = [
        o for o in overrides
        if o.confidence and o.confidence >= 0.7 and o.owner_feedback
    ]

    total_high_conf = await count_audit_entries(
        decision_type="classification",
        min_confidence=0.7,
        period_days=period_days,
    )

    if total_high_conf > 0:
        override_rate = len(high_conf_overrides) / total_high_conf
        if override_rate > 0.2:  # more than 20% overridden
            langfuse.create_score(
                name="confidence_miscalibration",
                value=override_rate,
                data_type="NUMERIC",
                comment=f"{len(high_conf_overrides)}/{total_high_conf} high-conf overridden",
            )
```

---

## 9. Web Channel (FastAPI)

### 9.1 routes.py

```python
from fastapi import FastAPI, HTTPException, Depends
from chronos.web.auth import verify_artifact_token

app = FastAPI()

@app.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str, token: str):
    if not verify_artifact_token(artifact_id, token):
        raise HTTPException(status_code=403, detail="Invalid token")
    artifact = await load_artifact(artifact_id)
    return HTMLResponse(artifact.html_content)

@app.get("/review")
async def review_queue(token: str):
    if not verify_owner_token(token):
        raise HTTPException(status_code=403, detail="Invalid token")
    items = await load_review_items()
    return render_review_surface(items)

@app.post("/review/{item_id}/action")
async def review_action(item_id: str, action: ReviewAction, token: str):
    if not verify_owner_token(token):
        raise HTTPException(status_code=403, detail="Invalid token")

    if action.type == "reclassify":
        await reclassify_signal(item_id, action.new_category)
    elif action.type == "reject":
        await reject_signal(item_id)
    elif action.type == "approve":
        await approve_artifact(item_id)
    elif action.type == "feedback":
        await resume_recipe(item_id, {"feedback": action.text})

    await log_decision(decision_type="review", ...)

@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    """WhatsApp inbound webhook."""
    data = await request.json()
    envelope = normalize_whatsapp(data)
    await handle_inbound(envelope)
    return {"status": "ok"}
```

---

## 10. Heartbeat Scheduler

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("interval", minutes=30)
async def heartbeat_classify():
    """Fast loop: classify unclassified signals."""
    unclassified = await load_unclassified_signals()
    if not unclassified:
        return

    cartridge = await load_cartridge(
        query=" ".join([s.raw_text[:100] for s in unclassified]),
        role="cto",
    )

    recipe = load_recipe("capture_classify")
    await run_recipe(
        recipe_run_id=create_recipe_run("capture_classify"),
        recipe_prompt=recipe.prompt,
        tools=recipe.tools,
        messages=format_classification_input(unclassified, cartridge),
        gate_conditions=recipe.gate_conditions,
        session_id=None,
    )

# Long cadence: configurable, default monthly
@scheduler.scheduled_job("cron", day=1, hour=2)  # 1st of each month at 2am
async def heartbeat_promote():
    """Long loop: promote patterns from signal store to vault."""
    recipe = load_recipe("promotion")
    await run_recipe(...)
```

---

## 11. Implementation Task Breakdown

Each task is scoped to fit in a single context window (~50k tokens of code + conversation). Tasks are sequenced as a DAG.

### Phase 1: Foundation (all parallel)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T1: Postgres schema + migrations** | Create all tables from §1, Alembic setup | `db/migrations/`, `alembic.ini` | ~200 |
| **T2: Config + project scaffold** | `pyproject.toml`, config, `__init__` files, env setup | `src/chronos/config.py`, `pyproject.toml`, `.env.example` | ~150 |
| **T3: Observability setup** | Langfuse init, `AnthropicInstrumentor`, `@observe` helpers | `src/chronos/observability/setup.py` | ~50 |

### Phase 2: Memory Layer (depends on T1)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T4: Signal store CRUD** | Store, query, update status, filter by status | `src/chronos/memory/signal_store.py` | ~120 |
| **T5: Session manager** | CRUD, STM persistence/restore, session commands | `src/chronos/sessions/manager.py`, `src/chronos/memory/stm.py` | ~150 |
| **T6: Audit log** | Append-only write, query with filters | `src/chronos/memory/audit_log.py` | ~80 |
| **T7: Artifact store** | CRUD, token generation, HTML storage | `src/chronos/memory/artifacts.py` | ~80 |
| **T8: Vault reader** | Load radars from filesystem, load signals by radar, keyword matching | `src/chronos/memory/vault.py` | ~100 |

### Phase 3: Core Engine (depends on T3, T5, T6)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T9: Agent loop + gates** | `tool_runner` wrapper, state persistence, gate detection, resume handler | `src/chronos/engine/agent_loop.py`, `gates.py`, `resume.py` | ~250 |
| **T10: Recipe loader** | Load recipe definitions (prompt, tools, gates) | `src/chronos/engine/recipe_loader.py` | ~60 |
| **T11: Domain cartridge loader** | Radar scanning, signal matching, token budgeting, STM population | `src/chronos/engine/cartridge.py` | ~150 |
| **T12: Trust layer** | Owner verification, rejection logging | `src/chronos/trust/auth.py` | ~40 |

### Phase 4: Channels (depends on T4, T9, T12)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T13: Message envelope + gateway** | Envelope dataclass, inbound dispatch, intent detection, output router | `src/chronos/channels/envelope.py`, `gateway.py`, `router.py` | ~200 |
| **T14: Discord adapter** | Bot setup, message listener, slash commands (`/session`, `/ask`), normalizer | `src/chronos/channels/discord_adapter.py` | ~150 |
| **T15: WhatsApp adapter** | Webhook handler, normalizer, outbound sender | `src/chronos/channels/whatsapp_adapter.py` | ~100 |
| **T16: Web channel (FastAPI)** | Artifact serving, review surface, token auth, Jinja2 templates | `src/chronos/web/routes.py`, `auth.py`, `templates/` | ~250 |

### Phase 5: Skills (depends on T4, T6, T7, T8, T11)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T17: Classification skill** | `classify_signal`, `flag_for_review` tools | `src/chronos/skills/classify.py` | ~80 |
| **T18: Research + synthesis skills** | `search_vault`, `create_artifact` tools | `src/chronos/skills/research.py`, `synthesize.py` | ~150 |
| **T19: Render + publish skills** | `render_html`, `publish_and_notify` tools | `src/chronos/skills/render.py`, `publish.py`, `notify.py` | ~120 |
| **T20: Gate tools** | `ask_clarification`, `pause_for_review`, `report_blocked` | Gate tools in `src/chronos/skills/` | ~60 |
| **T21: Promotion skills** | `promote_to_vault`, `archive_signal`, `surface_contradiction`, `surface_connection` | `src/chronos/skills/promote.py`, `review.py` | ~120 |

### Phase 6: Recipes (depends on T9, T10, T17-T21)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T22: Recipe 1 — Capture & Classify** | System prompt, tool set, heartbeat trigger | `src/chronos/recipes/capture.py`, `src/chronos/scheduler/heartbeat.py` | ~100 |
| **T23: Recipe 2 — Consult CTO** | System prompt, tool set, clarify/synthesize flow | `src/chronos/recipes/consult.py` | ~80 |
| **T24: Recipe 3 — Memory Promotion** | System prompt, tool set, long-cadence trigger | `src/chronos/recipes/promotion.py` | ~80 |

### Phase 7: Integration + App Startup (depends on all above)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T25: Main app** | FastAPI app, Discord bot startup, scheduler start, observability init | `src/chronos/main.py` | ~80 |
| **T26: CTO seed data** | Radar definitions, seed signals for testing | `vault/radars/*.md`, `vault/signals/**/*.md` | ~500 (content) |

### Phase 8: Tests (depends on relevant phases)

| Task | Scope | Files | Scenarios |
|------|-------|-------|-----------|
| **T27: Capture + classify tests** | SC-CAP-*, SC-CLS-* | `tests/test_capture.py`, `test_classify.py` | 9 |
| **T28: Consult tests** | SC-CON-*, SC-GAT-*, SC-CNF-* | `tests/test_consult.py`, `test_gates.py`, `test_confidence.py` | 14 |
| **T29: Promotion tests** | SC-MEM-* | `tests/test_promotion.py` | 4 |
| **T30: Review + session + channel tests** | SC-REV-*, SC-SES-*, SC-CHN-* | `tests/test_review.py`, `test_sessions.py`, `test_channels.py` | 14 |
| **T31: Trust + audit + integration tests** | SC-TRU-*, SC-AUD-*, SC-PHX-*, SC-OBS-*, SC-DOM-* | `tests/test_trust.py`, `test_audit.py`, `test_integration.py`, `test_observability.py` | 13 |

### Task DAG

```
T1  T2  T3              ← Phase 1 (parallel)
│   │   │
├───┼───┤
│       │
T4 T5 T6 T7 T8         ← Phase 2 (parallel, need T1)
│  │  │  │  │
├──┼──┼──┼──┤
│          │
T9 T10 T11 T12         ← Phase 3 (parallel, need Phase 2)
│   │   │   │
├───┼───┼───┤
│           │
T13 T14 T15 T16        ← Phase 4 (parallel, need Phase 3)
│               │
T17 T18 T19 T20 T21    ← Phase 5 (parallel, need Phase 2+3)
│               │
├───────────────┤
│               │
T22  T23  T24           ← Phase 6 (parallel, need Phase 3+5)
│    │    │
├────┼────┤
│
T25  T26                ← Phase 7 (need all above)
│
T27 T28 T29 T30 T31    ← Phase 8 (parallel test suites)
```

**Total: 31 tasks, 8 phases, ~3200 lines of application code + tests**

Each task produces 40-250 lines of code — well within a single context window. Dependencies are explicit. Parallel tasks within each phase can be executed simultaneously.
