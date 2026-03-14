# Chronos v1 — Low-Level Design

> Implementation blueprint derived from the product spec (v4.0.0) and technical approach (v1.1.0).
> Each section is scoped to fit a single implementation context window.

**Version:** 2.0.0
**Date:** 2026-03-14
**Source:** chronos-features.md, technical-approach.md, chronos-scenarios.md

---

## Architecture Overview

Chronos v1 is a split-architecture system:

- **Python Engine** — long-running process: Discord bot, agent loop, heartbeat scheduler, embedding pipeline
- **Next.js Web** — Vercel-hosted: artifact pages, review surfaces, session UI, API routes for webhooks

Both share **Neon Postgres** (with pgvector) as the system of record. The Python engine exposes an internal REST API that the Next.js app calls for recipe operations (resume, review actions). The Next.js app exposes public routes for artifact viewing and webhook ingestion.

```
┌─────────────────────┐     ┌──────────────────────────┐
│   Python Engine      │     │   Next.js Web (Vercel)   │
│   (Railway)   │     │                          │
│                      │     │  /artifacts/[id]         │
│  Discord Bot (WS)    │◄───►│  /review                 │
│  Agent Loop          │ API │  /api/heartbeat          │
│  Heartbeat Scheduler │     │  /api/review/[id]/action │
│  Embedding Pipeline  │     │  /sessions               │
│                      │     │                          │
└──────────┬───────────┘     └────────────┬─────────────┘
           │                              │
           └──────────┬───────────────────┘
                      │
           ┌──────────▼───────────┐
           │  Neon Postgres       │
           │  (pgvector enabled)  │
           │  + Upstash Redis     │
           └──────────────────────┘
```

---

## Technology Decisions

### Python Engine

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| LLM Cognition | `anthropic` SDK | Native `tool_runner` with compaction, `@beta_tool` |
| Observability | Langfuse Python SDK v3 | `AnthropicInstrumentor` for zero-code tracing |
| Discord | discord.py 2.x | Slash commands via `app_commands`, persistent WebSocket |
| Embeddings | voyage-3 (VoyageAI — Anthropic ecosystem) | Signal and query embedding for RAG (1024 dim) |
| Task Scheduling | APScheduler | 30-min heartbeat, long-cadence promotion |
| HTTP Server | FastAPI (internal API only) | Engine API for Next.js to call |

### Next.js Web

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Server components, API routes, Vercel-native |
| Styling | Tailwind CSS | Fast UI development |
| Database Client | Drizzle ORM | TypeScript-native Postgres access |
| Hosting | Vercel | Zero-config Next.js deployment |
| Cron | Vercel Cron | Triggers heartbeat endpoint on Python engine |

### Shared Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Database | Neon Postgres (pgvector) | Vercel-native, vector search built in |
| Cache/Queue | Upstash Redis | Vercel-native, serverless Redis |
| Observability | Langfuse Cloud | Hosted, no infra to manage |

### Day 1 Scope

- **Discord only** — WhatsApp deferred
- **Vercel** for web, **Railway or Fly.io** for Python engine
- **Neon Postgres** with pgvector enabled
- **Upstash Redis** for scheduling state

---

## Key SDK Patterns

### Agent Loop (Python)

`client.beta.messages.tool_runner()` with compaction enabled. Each recipe defines tools as `@beta_tool` decorated functions. The runner handles multi-turn tool use, auto-compacts at 100k tokens.

### Observability (Python)

`AnthropicInstrumentor().instrument()` + `@observe` decorators. Zero manual wrapping for Anthropic calls; workflow-level spans via decorators.

### RAG (Python + Postgres)

Signals are embedded on write using `voyage-3`. Queries are embedded at search time. pgvector `<=>` cosine distance operator ranks results. Radar keyword overlap boosts ranking.

---

## Project Structure

```
chronos/
├── .meridian/product/              # Product docs (vision, spec, LLD, scenarios)
├── philosophy/                     # IDD, Phoenix, PCAM foundations
│
├── engine/                         # Python engine (Railway)
│   ├── chronos/
│   │   ├── __init__.py
│   │   ├── main.py                 # Discord bot + scheduler + internal API startup
│   │   ├── config.py               # Environment config (pydantic-settings)
│   │   │
│   │   ├── channels/               # PCAM: Perception
│   │   │   ├── envelope.py         # MessageEnvelope dataclass
│   │   │   ├── discord_adapter.py  # Discord bot, slash commands, normalizer
│   │   │   ├── router.py           # Output routing (inline vs web)
│   │   │   └── gateway.py          # Inbound dispatch: envelope → trust → signal store or recipe
│   │   │
│   │   ├── trust/
│   │   │   └── auth.py             # Owner verification, rejection logging
│   │   │
│   │   ├── engine/                 # PCAM: Cognition
│   │   │   ├── agent_loop.py       # tool_runner wrapper with state persistence + gates
│   │   │   ├── recipe_loader.py    # Load recipe definition
│   │   │   ├── resume.py           # Resume paused recipe
│   │   │   ├── gates.py            # Response gate detection
│   │   │   └── cartridge.py        # Domain cartridge: RAG + radar → STM load
│   │   │
│   │   ├── recipes/                # Recipe definitions (prompts + tool sets)
│   │   │   ├── capture.py          # Recipe 1: capture + heartbeat classification
│   │   │   ├── consult.py          # Recipe 2: consult CTO research pipeline
│   │   │   └── promotion.py        # Recipe 3: memory promotion
│   │   │
│   │   ├── skills/                 # PCAM: Agency (@beta_tool functions)
│   │   │   ├── registry.py         # Skill registry
│   │   │   ├── classify.py         # Classify signal against radars
│   │   │   ├── research.py         # Deep research (vector search + vault retrieval)
│   │   │   ├── synthesize.py       # Synthesize findings into structured artifact
│   │   │   ├── notify.py           # Send notification via Discord
│   │   │   ├── publish.py          # Publish artifact (write to DB, generate URL)
│   │   │   ├── promote.py          # Promote patterns to vault
│   │   │   └── gates.py            # Gate tools (ask_clarification, pause_for_review, etc.)
│   │   │
│   │   ├── memory/                 # PCAM: Manifestation
│   │   │   ├── signal_store.py     # Signal CRUD + embedding on write
│   │   │   ├── stm.py             # Session STM (Postgres JSON)
│   │   │   ├── vault.py            # Vault read/write (radars + signals)
│   │   │   ├── embeddings.py       # Embedding pipeline (voyage-3)
│   │   │   ├── audit_log.py        # Decision audit log (append-only)
│   │   │   └── artifacts.py        # Artifact CRUD
│   │   │
│   │   ├── sessions/
│   │   │   └── manager.py          # Session CRUD, STM persistence/restore
│   │   │
│   │   ├── api/                    # Internal REST API (for Next.js to call)
│   │   │   ├── routes.py           # FastAPI routes: resume, review actions, status
│   │   │   └── auth.py             # Internal API auth (shared secret)
│   │   │
│   │   ├── scheduler/
│   │   │   └── heartbeat.py        # 30-min classify, monthly promote
│   │   │
│   │   └── observability/
│   │       └── setup.py            # Langfuse init, AnthropicInstrumentor
│   │
│   ├── tests/                      # Python tests (engine, skills, recipes)
│   ├── pyproject.toml
│   └── Dockerfile
│
├── web/                            # Next.js web channel (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── artifacts/[id]/page.tsx       # Artifact reading surface
│   │   │   ├── review/page.tsx               # Review queue (capture + consult)
│   │   │   ├── review/[id]/page.tsx          # Single review item
│   │   │   ├── sessions/page.tsx             # Session list
│   │   │   ├── sessions/[id]/page.tsx        # Session detail
│   │   │   ├── decisions/page.tsx            # Decision audit log viewer
│   │   │   └── api/
│   │   │       ├── review/[id]/action/route.ts    # Review actions → calls engine API
│   │   │       ├── heartbeat/route.ts             # Vercel Cron → triggers engine
│   │   │       └── auth/route.ts                  # Token validation
│   │   │
│   │   ├── components/
│   │   │   ├── artifact-viewer.tsx
│   │   │   ├── review-card.tsx
│   │   │   ├── confidence-badge.tsx
│   │   │   ├── source-citation.tsx
│   │   │   └── session-list.tsx
│   │   │
│   │   └── lib/
│   │       ├── db.ts               # Drizzle ORM client (reads from Neon)
│   │       ├── engine-client.ts    # HTTP client to Python engine API
│   │       └── auth.ts             # Token verification
│   │
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── vercel.json
│
├── db/
│   └── schema.sql                  # Postgres schema (single source of truth, applied via Drizzle push)
│
├── vault/                          # CTO domain cartridge seed data
│   ├── radars/
│   └── signals/
│
└── .env.example
```

---

## 1. Database Schema (Neon Postgres + pgvector)

### 1.1 Enable pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 signals

```sql
CREATE TYPE signal_status AS ENUM (
    'unclassified', 'classified', 'review_pending', 'rejected', 'archived', 'promoted'
);

CREATE TABLE signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_text        TEXT NOT NULL,
    channel         VARCHAR(50) NOT NULL,        -- 'discord'
    author_id       VARCHAR(100) NOT NULL,
    channel_msg_id  VARCHAR(100),
    status          signal_status NOT NULL DEFAULT 'unclassified',
    radar_category  VARCHAR(100),
    confidence      FLOAT,
    embedding       vector(1024),                -- voyage-3 embeddings (1024 dim)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    classified_at   TIMESTAMPTZ,
    reviewed_at     TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_signals_status ON signals (status);
CREATE INDEX idx_signals_created ON signals (created_at);
CREATE INDEX idx_signals_embedding ON signals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 1.3 vault_signals

Vault signals are also stored in Postgres (not just filesystem) so they can be vector-searched alongside captured signals.

```sql
CREATE TABLE vault_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path            VARCHAR(500) NOT NULL UNIQUE,  -- 'signals/ai/augmentation-principle.md'
    radar_category  VARCHAR(100) NOT NULL,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    embedding       vector(1024),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_signals_radar ON vault_signals (radar_category);
CREATE INDEX idx_vault_signals_embedding ON vault_signals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 1.4 signal_relationships (Graph Layer)

```sql
CREATE TYPE relationship_type AS ENUM (
    'reinforces',       -- signal A strengthens signal B
    'contradicts',      -- signal A conflicts with signal B
    'extends',          -- signal A builds on signal B
    'supersedes'        -- signal A replaces signal B
);

CREATE TABLE signal_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL,               -- can be signals.id or vault_signals.id
    source_type     VARCHAR(20) NOT NULL,         -- 'signal' or 'vault_signal'
    target_id       UUID NOT NULL,
    target_type     VARCHAR(20) NOT NULL,
    relationship    relationship_type NOT NULL,
    confidence      FLOAT,
    evidence        TEXT,                         -- why this relationship exists
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(50) DEFAULT 'system'  -- 'system' or 'owner'
);

CREATE INDEX idx_relationships_source ON signal_relationships (source_id, source_type);
CREATE INDEX idx_relationships_target ON signal_relationships (target_id, target_type);
CREATE INDEX idx_relationships_type ON signal_relationships (relationship);
```

### 1.5 sessions

```sql
CREATE TYPE session_status AS ENUM ('active', 'inactive');

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic           VARCHAR(500) NOT NULL,
    status          session_status NOT NULL DEFAULT 'active',
    stm_state       JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_status ON sessions (status);
CREATE INDEX idx_sessions_active ON sessions (last_active_at DESC);
```

### 1.6 recipe_runs

```sql
CREATE TYPE recipe_state AS ENUM (
    'queued', 'running', 'publishing', 'awaiting_review',
    'revising', 'completed', 'blocked'
);

CREATE TABLE recipe_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe          VARCHAR(100) NOT NULL,
    session_id      UUID REFERENCES sessions(id),
    state           recipe_state NOT NULL DEFAULT 'queued',
    agent_state     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_runs_state ON recipe_runs (state);
```

### 1.7 artifacts

```sql
CREATE TABLE artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_run_id   UUID REFERENCES recipe_runs(id),
    structured      JSONB NOT NULL,              -- {sections, sources, confidence, metadata}
    html_content    TEXT,
    access_token    VARCHAR(64) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.8 audit_log

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipe          VARCHAR(100),                -- null for trust_rejection (no recipe context)
    session_id      UUID REFERENCES sessions(id),
    decision_type   VARCHAR(50) NOT NULL,        -- classification, synthesis, promotion, revision, review, trust_rejection
    input           JSONB NOT NULL,
    output          JSONB NOT NULL DEFAULT '{}', -- empty for trust_rejection
    confidence      FLOAT,
    sources         JSONB DEFAULT '[]',
    owner_feedback  TEXT,
    changes_made    TEXT,
    trace_id        VARCHAR(100)
);

-- Append-only: no UPDATE/DELETE grants
CREATE INDEX idx_audit_recipe ON audit_log (recipe);
CREATE INDEX idx_audit_type ON audit_log (decision_type);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);
CREATE INDEX idx_audit_confidence ON audit_log (confidence);
```

### 1.9 radars

```sql
CREATE TABLE radars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    keywords        TEXT[] NOT NULL,              -- keyword array for matching
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 2. RAG: Embedding Pipeline + Vector Search

### 2.1 Embedding Pipeline (Python)

```python
from anthropic import Anthropic  # or openai for text-embedding-3-small
import httpx

EMBEDDING_MODEL = "voyage-3"
EMBEDDING_DIM = 1024

async def embed_text(text: str) -> list[float]:
    """Embed text using voyage-3 via VoyageAI API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
            json={"input": [text], "model": "voyage-3"}
        )
        return response.json()["data"][0]["embedding"]

async def embed_and_store_signal(signal_id: str, raw_text: str):
    """Embed a signal on capture and store the vector."""
    embedding = await embed_text(raw_text)
    await update_signal_embedding(signal_id, embedding)

async def embed_and_store_vault_signal(path: str, content: str, radar: str):
    """Embed a vault signal and upsert to vault_signals table."""
    embedding = await embed_text(content)
    await upsert_vault_signal(path, content, radar, embedding)
```

### 2.2 Vector Search (Domain Cartridge Loading)

```python
from langfuse import observe

@observe(name="load_cartridge")
async def load_cartridge(query: str, role: str = "cto") -> DomainCartridge:
    """
    Load domain cartridge using RAG:
    1. Embed the query
    2. Vector search vault_signals by cosine similarity
    3. Boost results that match radar keywords
    4. Cap at token budget
    5. Load into STM
    """
    role_profile = load_role_profile(role)

    # Embed query
    query_embedding = await embed_text(query)

    # Vector search with keyword boost
    matched_signals = await vector_search_vault(
        embedding=query_embedding,
        limit=50,                    # fetch candidates
        min_similarity=0.3,
    )

    # Keyword boost: signals whose radar keywords overlap with query get a score boost
    query_words = set(query.lower().split())
    for signal in matched_signals:
        radar = await load_radar(signal.radar_category)
        keyword_overlap = len(query_words & set(radar.keywords))
        signal.combined_score = signal.similarity + (keyword_overlap * 0.1)

    matched_signals.sort(key=lambda s: s.combined_score, reverse=True)

    # Token budget
    selected = []
    token_count = 0
    TOKEN_BUDGET = 50_000

    for signal in matched_signals:
        signal_tokens = estimate_tokens(signal.content)
        if token_count + signal_tokens > TOKEN_BUDGET:
            break
        selected.append(signal)
        token_count += signal_tokens

    return DomainCartridge(
        role_profile=role_profile,
        matched_signals=selected,
        radars_matched=list(set(s.radar_category for s in selected)),
    )
```

### 2.3 SQL: Vector Search Query

```sql
-- Find top-K vault signals by cosine similarity to query embedding
SELECT id, path, radar_category, title, content,
       1 - (embedding <=> $1::vector) AS similarity
FROM vault_signals
WHERE 1 - (embedding <=> $1::vector) > $2  -- min_similarity threshold
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

### 2.4 Signal Classification with RAG

During heartbeat classification, signals are matched semantically against vault signals to determine radar category. **Confidence threshold: 0.7** — signals below this are flagged for owner review.

```python
async def classify_with_rag(signal_id: str, signal_text: str) -> dict:
    """Use vector similarity to suggest radar category for a signal."""
    signal_embedding = await embed_text(signal_text)

    # Find most similar vault signals
    similar = await vector_search_vault(
        embedding=signal_embedding,
        limit=5,
        min_similarity=0.4,
    )

    if not similar:
        return {"category": None, "confidence": 0.0}

    # Most common radar category among top matches
    categories = [s.radar_category for s in similar]
    top_category = max(set(categories), key=categories.count)
    confidence = categories.count(top_category) / len(categories)

    return {"category": top_category, "confidence": confidence}
```

---

## 3. Graph Layer: Signal Relationships

The promotion recipe uses relationship queries to find patterns, contradictions, and connections.

### 3.1 Create Relationship

```python
async def create_relationship(
    source_id: str, source_type: str,
    target_id: str, target_type: str,
    relationship: str, confidence: float, evidence: str
):
    """Create a relationship edge between two signals."""
    await db.execute("""
        INSERT INTO signal_relationships
            (source_id, source_type, target_id, target_type, relationship, confidence, evidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, source_id, source_type, target_id, target_type, relationship, confidence, evidence)
```

### 3.2 Find Contradictions

```sql
-- Find all contradictions involving a given signal
SELECT sr.*,
    CASE WHEN sr.source_type = 'vault_signal' THEN vs.content ELSE s.raw_text END AS source_text,
    CASE WHEN sr.target_type = 'vault_signal' THEN vs2.content ELSE s2.raw_text END AS target_text
FROM signal_relationships sr
LEFT JOIN vault_signals vs ON sr.source_id = vs.id AND sr.source_type = 'vault_signal'
LEFT JOIN signals s ON sr.source_id = s.id AND sr.source_type = 'signal'
LEFT JOIN vault_signals vs2 ON sr.target_id = vs2.id AND sr.target_type = 'vault_signal'
LEFT JOIN signals s2 ON sr.target_id = s2.id AND sr.target_type = 'signal'
WHERE sr.relationship = 'contradicts'
ORDER BY sr.confidence DESC;
```

### 3.3 Find Reinforcing Clusters (Promotion Candidates)

```sql
-- Find signals that reinforce each other (cluster detection)
SELECT s.radar_category, COUNT(*) AS cluster_size,
    array_agg(s.id) AS signal_ids
FROM signal_relationships sr
JOIN signals s ON sr.source_id = s.id AND sr.source_type = 'signal'
WHERE sr.relationship = 'reinforces'
    AND s.status = 'classified'
GROUP BY s.radar_category
HAVING COUNT(*) >= 3  -- minimum cluster size for promotion consideration
ORDER BY cluster_size DESC;
```

### 3.4 Relationship Discovery (Promotion Recipe Skill)

The promotion recipe uses Claude to discover relationships between signals:

```python
@beta_tool
async def discover_relationships(signal_ids: list[str]) -> str:
    """Analyze a batch of signals to discover relationships between them.

    Args:
        signal_ids: List of signal UUIDs to analyze for relationships
    """
    signals = await load_signals(signal_ids)

    # Use vector similarity to find potentially related vault signals
    for signal in signals:
        similar_vault = await vector_search_vault(
            embedding=signal.embedding,
            limit=5,
            min_similarity=0.5,
        )
        for vault_signal in similar_vault:
            # Claude determines relationship type as part of the agent loop
            # This tool just surfaces the candidates
            pass

    return f"Found {len(signals)} signals for relationship analysis"
```

---

## 4. Core Runtime: Agent Loop (Python)

### 4.1 Agent Loop

```python
from anthropic import Anthropic, beta_tool
from langfuse import observe

@observe(name="agent_loop")
async def run_recipe(
    recipe_run_id: str,
    recipe_prompt: str,
    tools: list,               # list of @beta_tool functions
    messages: list,            # conversation history (restored from DB on resume)
    gate_conditions: dict,     # gate detection rules per recipe
    session_id: str,
) -> GateResult:
    client = Anthropic()

    runner = client.beta.messages.tool_runner(
        model="claude-sonnet-4-20250514",
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
        messages.append({"role": "assistant", "content": response.content})
        await persist_agent_state(recipe_run_id, messages)

        gate = check_gates(response, gate_conditions)
        if gate:
            return gate

    return GateResult(gate_type="synthesis", output=response.content)
```

### 4.2 State Persistence for Human Pause

```python
async def pause_recipe(recipe_run_id: str, state: str, notification: dict):
    await update_recipe_state(recipe_run_id, state)
    await send_notification(notification)
    # Agent loop ends here. Resume handler picks up later.
```

### 4.3 Resume Handler

```python
@observe(name="resume_recipe")
async def resume_recipe(recipe_run_id: str, human_input: dict):
    run = await load_recipe_run(recipe_run_id)
    messages = run.agent_state["messages"]
    messages.append({"role": "user", "content": format_human_feedback(human_input)})

    await log_decision(
        recipe=run.recipe,
        decision_type="review",
        input=human_input,
        owner_feedback=human_input.get("feedback"),
    )

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

### 4.4 Context Window Management

- `tool_runner` compaction at 100k tokens — auto-summarizes older turns
- Domain cartridge loading uses RAG (vector search) — only semantically relevant signals loaded
- STM token budget: 50k for vault context
- Signal embeddings stored in Postgres, not recomputed per query
- Each skill tool returns structured string, not verbose prose

---

## 5. Response Gates

Unchanged. Gate tools (`ask_clarification`, `pause_for_review`, `report_blocked`) trigger deterministic gate detection. See §3 of previous version.

---

## 6. Channel Gateway (Python — Discord Only Day 1)

### 6.1 MessageEnvelope

```python
@dataclass
class MessageEnvelope:
    channel: str                              # "discord"
    channel_message_id: str
    sender_id: str
    chat_id: str
    text: str
    timestamp: datetime
    reply: Callable[[str], Awaitable[None]]
    meta: dict = field(default_factory=dict)
    command: Optional[str] = None
    command_args: Optional[dict] = None
```

### 6.2 Discord Adapter

```python
import discord
from discord import app_commands
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

# --- Slash commands: direct recipe routing (no intent detection) ---

@bot.tree.command(name="capture", description="Capture a thought or signal")
@app_commands.describe(text="Your thought, signal, or article")
async def capture_cmd(interaction: discord.Interaction, text: str):
    envelope = normalize_discord_interaction(interaction, command="capture", text=text)
    await handle_command(envelope)
    await interaction.response.send_message("✓", ephemeral=True, delete_after=2)

@bot.tree.command(name="ask", description="Ask Chronos a strategic question")
@app_commands.describe(question="Your question")
async def ask_cmd(interaction: discord.Interaction, question: str):
    await interaction.response.defer()
    envelope = normalize_discord_interaction(interaction, command="ask", text=question)
    await handle_command(envelope)

@bot.tree.command(name="session", description="Manage sessions")
@app_commands.describe(action="new|load|clear|list", topic="Session topic (for new)")
async def session_cmd(interaction: discord.Interaction, action: str, topic: str = ""):
    await interaction.response.defer()
    envelope = normalize_discord_interaction(interaction, command="session", text=f"{action} {topic}")
    await handle_command(envelope)

# --- Plain messages: intent detection via heuristic ---

@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    envelope = normalize_discord_message(message)
    await handle_inbound(envelope)
    await bot.process_commands(message)
```

### 6.3 Routing: Three Layers

**See `memory/knowledge/architecture/intent-detection.md` for the full design.**

```python
# Layer 1: Command routing — slash commands map directly to recipes
async def handle_command(envelope: MessageEnvelope):
    if not verify_owner(envelope.sender_id):
        await log_rejection(envelope)
        return

    if envelope.command == "capture":
        await store_signal(envelope)          # store + embed, silent
    elif envelope.command == "ask":
        await start_consult(envelope)         # start consult recipe
    elif envelope.command == "session":
        await route_session_command(envelope)  # session CRUD

# Layer 2: Intent detection — free-form messages, keyword heuristic
async def handle_inbound(envelope: MessageEnvelope):
    if not verify_owner(envelope.sender_id):
        await log_rejection(envelope)
        return

    intent = detect_intent(envelope.text)

    if intent == "consult":
        await start_consult(envelope)
    else:
        # Default: capture (post-office model)
        await store_signal(envelope)

def detect_intent(text: str) -> str:
    """Keyword heuristic. Default is capture. Consult requires clear question pattern."""
    consult_patterns = [
        text.strip().endswith("?"),
        text.lower().startswith(("what ", "how ", "why ", "should ", "compare ", "analyze ")),
        "help me think" in text.lower(),
        "what do i know about" in text.lower(),
    ]
    return "consult" if any(consult_patterns) else "capture"

# Layer 3: Content classification — happens inside Recipe 1 heartbeat (LLM call, async)
# NOT here. See recipes/capture.py and skills/classify.py.
```

---

## 7. Web Channel (Next.js on Vercel)

### 7.1 Key Pages

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/artifacts/[id]?token=xxx` | Read a synthesis artifact | Direct DB read (Neon) |
| `/review` | Review queue (capture + consult items) | Direct DB read |
| `/review/[id]` | Single review item with actions | DB read + engine API call on action |
| `/sessions` | Session list | Direct DB read |
| `/sessions/[id]` | Session detail + STM state | Direct DB read |
| `/decisions` | Decision audit log viewer with filters | Direct DB read |

### 7.2 API Routes

```typescript
// app/api/review/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { token, action, feedback } = await req.json()

  if (!verifyOwnerToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Call Python engine API to execute the action
  const engineResponse = await fetch(`${ENGINE_API_URL}/review/${params.id}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENGINE_API_SECRET}`,
    },
    body: JSON.stringify({ action, feedback }),
  })

  return NextResponse.json(await engineResponse.json())
}
```

### 7.3 Artifact Viewer Component

```tsx
// components/artifact-viewer.tsx
export function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  return (
    <article className="max-w-3xl mx-auto">
      <h1>{artifact.structured.title}</h1>
      <ConfidenceBadge score={artifact.structured.confidence} />

      {artifact.structured.sections.map(section => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <div>{section.content}</div>
        </section>
      ))}

      <h3>Sources</h3>
      {artifact.structured.sources.map(source => (
        <SourceCitation key={source.signal_path} {...source} />
      ))}

      {artifact.structured.training_sourced?.length > 0 && (
        <div className="border-l-4 border-yellow-400 pl-4">
          <h4>Training-Sourced (not from your knowledge)</h4>
          {artifact.structured.training_sourced.map(claim => (
            <p key={claim}>{claim}</p>
          ))}
        </div>
      )}

      {artifact.structured.confidence_gaps?.length > 0 && (
        <div>
          <h4>What would increase confidence</h4>
          <ul>{artifact.structured.confidence_gaps.map(g => <li key={g}>{g}</li>)}</ul>
        </div>
      )}
    </article>
  )
}
```

---

## 8. Python Engine Internal API

The Python engine exposes a small FastAPI app for the Next.js web to call:

```python
# api/routes.py
from fastapi import FastAPI, HTTPException, Header

app = FastAPI()

async def verify_engine_secret(authorization: str = Header()):
    if authorization != f"Bearer {ENGINE_API_SECRET}":
        raise HTTPException(status_code=403)

@app.post("/review/{item_id}/action", dependencies=[Depends(verify_engine_secret)])
async def review_action(item_id: str, body: ReviewActionBody):
    if body.action == "reclassify":
        await reclassify_signal(item_id, body.new_category)
    elif body.action == "reject":
        await reject_signal(item_id)
    elif body.action == "approve":
        await approve_artifact(item_id)
    elif body.action == "feedback":
        await resume_recipe(item_id, {"feedback": body.text})
    return {"status": "ok"}

@app.post("/api/v1/heartbeat/classify", dependencies=[Depends(verify_engine_secret)])
async def trigger_heartbeat():
    """Vercel Cron calls this to trigger classification heartbeat."""
    await heartbeat_classify()
    return {"status": "ok"}

@app.get("/status")
async def health():
    return {"status": "healthy"}
```

---

## 9. Recipe Definitions (Python)

Each recipe is a Python module defining: `PROMPT` (system prompt), `TOOLS` (list of @beta_tool), `GATE_CONDITIONS` (dict). See `memory/standards/recipes/prompt-standards.md` for prompt requirements.

### 9.1 Recipe 1: Capture & Classify

```python
HEARTBEAT_PROMPT = """
You are the Chronos classification engine. Your job is to classify unclassified signals
using the domain cartridge provided in the context.

For each signal:
1. Read the signal text
2. Match it against the radar categories in the cartridge
3. Assign a radar category and confidence score (0.0-1.0)
4. If confidence < 0.7, use the `flag_for_review` tool instead of `classify_signal`

You must classify ALL provided signals. Do not skip any.
After classifying all signals, use the `complete_batch` tool.

Every classification decision MUST be logged. Use the tools — do not classify in text.
"""

TOOLS = [classify_signal, flag_for_review, complete_batch]
GATE_CONDITIONS = {"complete_batch": "synthesis"}
```

### 9.2 Recipe 2: Consult CTO

```python
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
4. Every claim must have a source. If you use training knowledge, label it explicitly
   as "training-sourced."
5. Include a confidence score (0.0-1.0) reflecting how well-grounded the output is.
6. After creating the artifact, use `publish_and_notify` then `pause_for_review`.

NEVER output intermediate reasoning to the user. Only surface output at gates:
clarification, synthesis, blocked, or error.
"""

TOOLS = [
    ask_clarification,      # → clarification gate
    search_vault,           # vector search for matching signals
    create_artifact,        # structured artifact with confidence + citations
    render_html,            # structured → HTML
    publish_and_notify,     # publish to web, notify Discord
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

### 9.3 Recipe 3: Memory Promotion

```python
PROMOTION_PROMPT = """
You are the Chronos memory promotion engine. You analyze accumulated signals
for stable patterns that deserve promotion to long-term memory (vault).

Your workflow:
1. Review all classified signals from the past period
2. Identify reinforced themes (multiple signals supporting the same pattern)
3. For each candidate pattern:
   - If clearly durable (3+ reinforcing signals): use `promote_to_vault`
   - If ambiguous: use `flag_for_review`
   - If noise (unreinforced): use `archive_signal`
4. Scan for contradictions between existing vault signals and new patterns.
   Surface contradictions using `surface_contradiction`.
5. Scan for novel connections across different radar categories.
   Surface connections using `surface_connection`.
6. After processing all candidates, use `publish_promotion_summary` then `pause_for_review`.

Every promotion, archive, and relationship decision MUST be logged.
"""

TOOLS = [
    promote_to_vault, archive_signal, flag_for_review,
    discover_relationships, surface_contradiction, surface_connection,
    publish_promotion_summary, pause_for_review, report_blocked,
]
GATE_CONDITIONS = {
    "pause_for_review": "awaiting_review",
    "report_blocked": "blocked",
}
```

---

## 10. Vault Seed Data Structure

### 10.1 Radars (Postgres + filesystem mirror)

Each radar is defined both in the `radars` table and as a markdown file:

```markdown
---
name: ai-intelligence
keywords: [ai, agents, llm, machine learning, augmentation, intelligence, neural, transformer, reasoning, prompt]
---

# AI & Intelligence

Covers artificial intelligence strategy, agent architectures, LLM capabilities,
augmentation principles, and AI-native product patterns.
```

### 10.2 Signals (Postgres + filesystem mirror)

Each signal is a markdown file AND a row in `vault_signals` with embedding:

```markdown
---
title: The Augmentation Principle
radar: ai-intelligence
---

AI should augment human capabilities, not replace human judgment.
The augmentation principle states that...
```

### 10.3 Seed Script

A Python script reads `vault/radars/*.md` and `vault/signals/**/*.md`, embeds each, and upserts to Postgres. Run once on setup, then whenever vault files change.

---

## 11. Deployment

### 11.1 Topology

| Service | Platform | Why |
|---------|----------|-----|
| Next.js Web | Vercel | Native Next.js hosting, edge functions, cron |
| Python Engine | Railway | Persistent process for Discord bot + scheduler |
| Postgres | Neon (via Vercel) | pgvector, serverless, Vercel-native integration |
| Redis | Upstash (via Vercel) | Serverless Redis, Vercel-native |
| Observability | Langfuse Cloud | Managed, no infra |

### 11.2 Environment Variables

**Python Engine (Railway):**
```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
OWNER_DISCORD_ID=...
DATABASE_URL=postgres://...@neon.tech/chronos
REDIS_URL=redis://...@upstash.io:6379
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
ENGINE_API_SECRET=shared-secret-for-next-to-call
WEB_BASE_URL=https://chronos.vercel.app
```

**Next.js Web (Vercel):**
```
DATABASE_URL=postgres://...@neon.tech/chronos
ENGINE_API_URL=https://chronos-engine.railway.app
ENGINE_API_SECRET=shared-secret-for-next-to-call
OWNER_TOKEN_SECRET=jwt-signing-secret
```

### 11.3 Vercel Cron

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/heartbeat",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

The Vercel Cron hits a Next.js API route that calls the Python engine's heartbeat trigger endpoint.

### 11.4 Railway Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY engine/ .
RUN pip install -e .
CMD ["python", "-m", "chronos.main"]
```

---

## 12. Implementation Phases (Vertical Slices)

Each phase delivers a working end-to-end capability. After each phase, the listed scenarios are testable and must pass before moving to the next phase. Tests are written within each phase, not deferred.

---

### Phase 0: Prerequisites (manual, owner)

| # | What | Needed For |
|---|------|-----------|
| 0a | Create Anthropic API key | All cognition |
| 0b | Create VoyageAI API key | Embeddings |
| 0c | Create Discord app + bot (Developer Portal), enable `message_content` intent | Discord channel |
| 0d | Create Discord test server, invite bot | Testing |
| 0e | Create Langfuse Cloud account + keys | Observability |
| 0f | Create Neon Postgres (pgvector enabled) via Vercel | All persistence |
| 0g | Create Upstash Redis via Vercel | Scheduling |
| 0h | Create Railway account | Engine deployment |

**Exit gate:** `.env` files populated, Discord bot online in test server, `SELECT 1` succeeds on Neon.

---

### Phase 1: Scaffold + Silent Capture (end-to-end)

**Goal:** Owner sends a Discord message → signal stored in Postgres → silent (no response). Non-owner rejected.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 1.1 | Python engine scaffold: `pyproject.toml`, config, Dockerfile, DB connection | `engine/` scaffold |
| 1.2 | Next.js scaffold: `create-next-app`, Tailwind, Drizzle ORM, DB connection | `web/` scaffold |
| 1.3 | DB schema: `signals`, `radars` tables + pgvector extension | `db/schema.sql` |
| 1.4 | Signal store: insert signal + embed on write | `memory/signal_store.py`, `embeddings.py` |
| 1.5 | Trust layer: owner verification, rejection logging | `trust/auth.py` |
| 1.6 | Discord adapter: bot startup, message listener, envelope normalization | `channels/discord_adapter.py`, `envelope.py` |
| 1.7 | Gateway: inbound dispatch (trust check → store signal → silent) | `channels/gateway.py` |
| 1.8 | Observability: Langfuse init + AnthropicInstrumentor | `observability/setup.py` |
| 1.9 | Main entrypoint: Discord bot + FastAPI startup | `main.py` |
| 1.10 | Tests for this phase | `tests/test_capture.py`, `tests/test_trust.py` |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-CAP-001 | Silent single capture via Discord | Automated |
| SC-CAP-002 | Silent burst capture (5 signals in 30s) | Automated |
| SC-CAP-003 | Capture stores before processing | Automated |
| SC-CAP-004 | Unknown author rejected | Automated |
| SC-TRU-001 | Owner authenticated and accepted | Automated |
| SC-TRU-002 | Non-owner rejected | Automated |
| SC-OBS-001 | Langfuse trace created (capture path) | Automated |

**Exit gate:** 7 scenarios passing. Bot running in Discord test server. Signals appearing in Neon Postgres.

---

### Phase 2: Vault + Heartbeat Classification

**Goal:** Vault seeded with radars + signals. Heartbeat classifies unclassified signals. High-confidence auto-classified. Low-confidence flagged. All decisions audit-logged.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 2.1 | DB schema: `vault_signals`, `audit_log`, `recipe_runs` tables | `db/schema.sql` |
| 2.2 | CTO seed data: 7 radars + 10-15 signals as markdown files | `vault/radars/*.md`, `vault/signals/**/*.md` |
| 2.3 | Vault seed script: read markdown → embed → upsert to Postgres | `scripts/seed.py` |
| 2.4 | Vault reader + vector search (RAG) | `memory/vault.py` |
| 2.5 | Domain cartridge loader: embed query → vector search → keyword boost → token budget | `engine/cartridge.py` |
| 2.6 | Audit log: append-only write + query with filters | `memory/audit_log.py` |
| 2.7 | Agent loop + gate detection: `tool_runner` wrapper, state persistence | `engine/agent_loop.py`, `gates.py` |
| 2.8 | Recipe loader | `engine/recipe_loader.py` |
| 2.9 | Classification skill: `classify_signal`, `flag_for_review`, `complete_batch` | `skills/classify.py` |
| 2.10 | Recipe 1: Capture & Classify prompt + tool set | `recipes/capture.py` |
| 2.11 | Heartbeat scheduler: 30-min trigger | `scheduler/heartbeat.py` |
| 2.12 | Tests for this phase | `tests/test_classify.py`, `tests/test_audit.py` |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-CLS-001 | Heartbeat classifies unclassified signals | Automated |
| SC-CLS-002 | High-confidence classification stored automatically | Automated |
| SC-CLS-003 | Low-confidence surfaces for review (flag created) | Hybrid |
| SC-CLS-004 | Domain cartridge loaded before classification (Langfuse trace) | Automated |
| SC-CLS-005 | Audit trail records all classification decisions | Automated |
| SC-AUD-001 | Classification decisions logged with all fields | Automated |
| SC-DOM-001 | CTO cartridge loads appropriate signals | Hybrid |
| SC-PHX-002 | Recipe chain visible in Langfuse (not collapsed) | Automated |

**Exit gate:** 8 scenarios passing. Heartbeat running. Signals being classified. Audit log populated.

---

### Phase 3: Capture Review (Web + Discord Notification)

**Goal:** Owner can review low-confidence classifications on the web. Reclassify, reject, or approve. Actions feed back into the processing loop. Discord notifies when items need review.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 3.1 | DB schema: add any missing review-related columns | `db/schema.sql` |
| 3.2 | Web: review queue page (`/review`) — list review-pending signals | `web/src/app/review/page.tsx` |
| 3.3 | Web: single review item page (`/review/[id]`) — actions: reclassify, reject, approve | `web/src/app/review/[id]/page.tsx` |
| 3.4 | Web: token authentication for owner access | `web/src/lib/auth.ts` |
| 3.5 | Engine internal API: review action endpoint | `api/routes.py` |
| 3.6 | Notify skill: send Discord notification with web link | `skills/notify.py` |
| 3.7 | Output router: low-confidence → web + Discord pointer | `channels/router.py` |
| 3.8 | Wire: heartbeat → low-confidence → notify + review queue | Integration wiring |
| 3.9 | Tests for this phase | `tests/test_review.py`, `tests/test_channels.py` |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-REV-001 | Capture review — reclassify a signal | Automated |
| SC-REV-002 | Capture review — reject a signal | Automated |
| SC-REV-005 | Reviewed items re-enter processing loop | Automated |
| SC-CHN-004 | Low-confidence review notification goes to Discord | Automated |
| SC-TRU-003 | Web review surface enforces token authentication | Automated |

**Exit gate:** 5 scenarios passing. Full capture loop working: Discord → store → heartbeat → classify → review → reclassify → next heartbeat respects correction.

---

### Phase 4: Consult CTO — Clarify + Synthesize

**Goal:** Owner asks `/ask` on Discord → Chronos clarifies or synthesizes → produces artifact with confidence + citations → publishes to web → notifies Discord. No intermediate chatter.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 4.1 | DB schema: `sessions`, `artifacts` tables | `db/schema.sql` |
| 4.2 | Session manager: create, load, clear, list + STM persistence | `sessions/manager.py`, `memory/stm.py` |
| 4.3 | Discord `/session` slash command | `channels/discord_adapter.py` update |
| 4.4 | Discord `/ask` slash command → starts consult recipe | `channels/discord_adapter.py` update |
| 4.5 | Gateway: intent detection (capture vs retrieve/synthesize) | `channels/gateway.py` update |
| 4.6 | Gate tools: `ask_clarification`, `pause_for_review`, `report_blocked` | `skills/gates.py` |
| 4.7 | Research skill: `search_vault` (vector search) | `skills/research.py` |
| 4.8 | Synthesis skill: `create_artifact` with confidence + citations + training labels | `skills/synthesize.py` |
| 4.9 | Render + publish: structured → HTML, publish to web, generate token URL | `skills/publish.py` |
| 4.10 | Artifact store: CRUD + token generation | `memory/artifacts.py` |
| 4.11 | Recipe 2: Consult CTO prompt + tool set + gate conditions | `recipes/consult.py` |
| 4.12 | Resume handler: pick up paused recipe when owner responds | `engine/resume.py` |
| 4.13 | Web: artifact page (`/artifacts/[id]`) with confidence badge, citations, training labels | `web/src/app/artifacts/` |
| 4.14 | Output router: clarification → inline Discord, synthesis → web + pointer | `channels/router.py` update |
| 4.15 | Tests for this phase | `tests/test_consult.py`, `tests/test_gates.py`, `tests/test_confidence.py`, `tests/test_sessions.py` |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-CON-001 | Consult initializes STM with domain cartridge | Automated |
| SC-CON-002 | Clarification for underspecified request | Hybrid |
| SC-CON-003 | Synthesis with confidence scores and source citations | Hybrid |
| SC-CON-004 | Consult produces no intermediate chatter | Automated |
| SC-CON-005 | Consult artifact awaits review (human pause) | Automated |
| SC-CON-007 | Retrieve intent returns existing vault knowledge | Hybrid |
| SC-GAT-001 | Clarification gate produces grounded questions | Hybrid |
| SC-GAT-002 | Blocked gate explains what is needed | Hybrid |
| SC-GAT-003 | Error gate provides recovery path | Automated |
| SC-GAT-004 | Synthesis gate delivers complete artifact | Hybrid |
| SC-CNF-001 | Synthesis output carries confidence score | Hybrid |
| SC-CNF-002 | Low-confidence output indicates what would increase confidence | Hybrid |
| SC-CNF-003 | Training-sourced knowledge explicitly labeled | Hybrid |
| SC-SES-001 | Create a new session via Discord | Automated |
| SC-SES-002 | Load an existing session | Hybrid |
| SC-SES-003 | Clear current session | Automated |
| SC-SES-004 | List sessions via Discord | Automated |
| SC-CHN-001 | Short response stays in Discord | Automated |
| SC-CHN-002 | Rich artifact routes to web with Discord pointer | Hybrid |
| SC-CHN-003 | Web artifact is token-authenticated | Automated |
| SC-AUD-002 | Synthesis decisions logged | Automated |

**Exit gate:** 21 scenarios passing. Full consult loop: ask → clarify → synthesize → artifact on web → Discord pointer. Sessions working.

---

### Phase 5: Consult Review + Revision

**Goal:** Owner reviews consult artifact on web → approves or gives feedback → feedback triggers in-place revision → audit trail records everything.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 5.1 | Web: consult review surface — artifact display + feedback form + approve button | `web/src/app/review/` update |
| 5.2 | Engine API: feedback endpoint → triggers resume_recipe | `api/routes.py` update |
| 5.3 | Revise artifact skill: update in-place (same ID) | `skills/synthesize.py` update |
| 5.4 | Audit log: record feedback, changes made | `memory/audit_log.py` wiring |
| 5.5 | Tests for this phase | `tests/test_review.py` additions |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-CON-006 | Owner feedback triggers revision | Hybrid |
| SC-REV-003 | Consult review — provide feedback for revision | Hybrid |
| SC-REV-004 | Consult review — approve artifact | Automated |
| SC-AUD-003 | Owner feedback recorded in audit log | Automated |

**Exit gate:** 4 scenarios passing. Full review cycle: artifact → feedback → revision → re-publish.

---

### Phase 6: Memory Promotion

**Goal:** Monthly recipe scans accumulated signals, discovers relationships, promotes patterns to vault, surfaces contradictions and connections, notifies owner.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 6.1 | DB schema: `signal_relationships` table | `db/schema.sql` |
| 6.2 | Signal relationships: CRUD, find contradictions, find clusters | `memory/relationships.py` |
| 6.3 | Promotion skills: `promote_to_vault`, `archive_signal`, `discover_relationships`, `surface_contradiction`, `surface_connection`, `publish_promotion_summary` | `skills/promote.py` |
| 6.4 | Recipe 3: Memory Promotion prompt + tool set | `recipes/promotion.py` |
| 6.5 | Long-cadence scheduler trigger | `scheduler/heartbeat.py` update |
| 6.6 | Web: promotion review surface (approve/dismiss candidates, resolve contradictions) | `web/src/app/review/` update |
| 6.7 | Tests for this phase | `tests/test_promotion.py` |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-MEM-001 | Promotion identifies stable patterns | Hybrid |
| SC-MEM-002 | Proactive synthesis surfaces novel connections | Hybrid |
| SC-MEM-003 | Ambiguous promotion items surface for review | Hybrid |
| SC-MEM-004 | Contradictions surfaced with dual citations | Hybrid |
| SC-AUD-004 | Promotion decisions logged | Automated |

**Exit gate:** 5 scenarios passing. Full promotion loop: signals → pattern detection → promote/archive → contradictions surfaced → owner review.

---

### Phase 7: Audit Viewer + Session Pages + Polish

**Goal:** Web surfaces for decision audit log (filterable), session management, and observability evals. All remaining scenarios pass.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 7.1 | Web: decision audit log page (`/decisions`) with filters | `web/src/app/decisions/` |
| 7.2 | Web: session list + detail pages (`/sessions`) | `web/src/app/sessions/` |
| 7.3 | Audit log query API with filters | Engine API update |
| 7.4 | Langfuse evals: confidence calibration, pattern deviation | `observability/` |
| 7.5 | Cross-channel session: same session from different interactions | Wiring |
| 7.6 | Tests for this phase | Remaining test files |

#### Scenarios that must pass

| ID | Scenario | Type |
|----|----------|------|
| SC-AUD-005 | Audit log is queryable with filters | Automated |
| SC-SES-005 | Sessions are topic-based, not channel-based | Automated |
| SC-OBS-002 | Confidence calibration eval detects miscalibration | Automated |
| SC-PHX-001 | Signal-to-memory chain is traceable | Hybrid |

**Exit gate:** 4 scenarios passing. All 54 scenarios now covered.

---

### Phase 8: Deploy

**Goal:** System running in production. Discord bot on Railway, web on Vercel, cron firing.

#### What gets built

| # | Scope | Key Files |
|---|-------|-----------|
| 8.1 | Railway deploy: Dockerfile, env vars, health check | `engine/Dockerfile` |
| 8.2 | Vercel deploy: `vercel.json`, cron config, env vars | `web/vercel.json` |
| 8.3 | Vercel Cron → heartbeat trigger wiring | `web/src/app/api/heartbeat/route.ts` |
| 8.4 | Smoke test: capture → classify → consult → review in production | Manual |

**Exit gate:** System live. Owner can capture via Discord, heartbeat classifies, `/ask` produces artifacts on web.

---

### Phase Summary

| Phase | Delivers | Scenarios Passing | Cumulative |
|-------|----------|-------------------|-----------|
| 0 | Infrastructure accounts + credentials | — | 0 |
| 1 | Silent capture + trust | 7 | 7 |
| 2 | Vault + heartbeat classification | 8 | 15 |
| 3 | Capture review (web + notification) | 5 | 20 |
| 4 | Consult CTO (clarify + synthesize + sessions) | 21 | 41 |
| 5 | Consult review + revision | 4 | 45 |
| 6 | Memory promotion | 5 | 50 |
| 7 | Audit viewer + session pages + evals | 4 | 54 |
| 8 | Production deploy | smoke test | 54 |

**Total: 9 phases, 54 scenarios, each phase testable independently**
