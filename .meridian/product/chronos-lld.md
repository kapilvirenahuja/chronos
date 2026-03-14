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
│   (Railway/Fly.io)   │     │                          │
│                      │     │  /artifacts/[id]         │
│  Discord Bot (WS)    │◄───►│  /review                 │
│  Agent Loop          │ API │  /api/webhooks/heartbeat │
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
| Embeddings | `voyage-3` (via Anthropic) or `text-embedding-3-small` (OpenAI) | Signal and query embedding for RAG |
| Task Scheduling | APScheduler | 30-min heartbeat, long-cadence promotion |
| HTTP Server | FastAPI (internal API only) | Engine API for Next.js to call |

### Next.js Web

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Server components, API routes, Vercel-native |
| Styling | Tailwind CSS | Fast UI development |
| Database Client | Drizzle ORM or Prisma | TypeScript-native Postgres access |
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
├── engine/                         # Python engine (Railway/Fly.io)
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
│   │       ├── db.ts               # Drizzle/Prisma client (reads from Neon)
│   │       ├── engine-client.ts    # HTTP client to Python engine API
│   │       └── auth.ts             # Token verification
│   │
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── vercel.json
│
├── db/
│   └── migrations/                 # Shared Postgres migrations (Drizzle or Alembic)
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
    recipe          VARCHAR(100) NOT NULL,
    session_id      UUID REFERENCES sessions(id),
    decision_type   VARCHAR(50) NOT NULL,
    input           JSONB NOT NULL,
    output          JSONB NOT NULL,
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
    """Embed text using voyage-3 via Anthropic's embedding endpoint."""
    # If using voyage-3 via VoyageAI:
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

During heartbeat classification, signals are matched semantically against vault signals to determine radar category:

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

Unchanged from v1.0 — `tool_runner` wrapper with state persistence and gate detection. See §2 of previous LLD version for full code. Key addition:

### 4.1 Context Window Management (Updated)

- `tool_runner` compaction at 100k tokens
- Domain cartridge loading uses RAG (vector search) — only semantically relevant signals loaded
- STM token budget: 50k for vault context
- Signal embeddings stored in Postgres, not recomputed per query

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

@bot.tree.command(name="session", description="Manage sessions")
@app_commands.describe(action="new|load|clear|list", topic="Session topic (for new)")
async def session_cmd(interaction: discord.Interaction, action: str, topic: str = ""):
    await interaction.response.defer()
    envelope = normalize_discord_interaction(interaction, action, topic)
    result = await route_session_command(envelope)
    await interaction.followup.send(result)

@bot.tree.command(name="ask", description="Ask Chronos a strategic question")
@app_commands.describe(question="Your question")
async def ask_cmd(interaction: discord.Interaction, question: str):
    await interaction.response.defer()
    envelope = normalize_discord_interaction(interaction, question=question)
    await start_consult(envelope)

@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    envelope = normalize_discord_message(message)
    await handle_inbound(envelope)
    await bot.process_commands(message)
```

### 6.3 Gateway — Inbound Dispatch

```python
async def handle_inbound(envelope: MessageEnvelope):
    # 1. Trust check
    if not verify_owner(envelope.sender_id):
        await log_rejection(envelope)
        return

    # 2. Intent detection: capture or consult?
    intent = detect_intent(envelope.text)

    if intent == "capture":
        await store_signal(envelope)     # store + embed, silent
        return

    if intent in ("retrieve", "synthesize"):
        await start_consult(envelope)
        return
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

@app.post("/heartbeat/trigger", dependencies=[Depends(verify_engine_secret)])
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

Unchanged from v1.0. System prompts, tool sets, and gate conditions as defined in §6 of the previous version. Key update: the `search_vault` skill now uses vector search instead of keyword-only.

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

## 12. Implementation Task Breakdown (Revised)

### Phase 0: Prerequisites (manual)

| Task | What | Who |
|------|------|-----|
| **T0a** | Create Anthropic API key | Owner |
| **T0b** | Create VoyageAI API key (for embeddings) | Owner |
| **T0c** | Create Discord app + bot in Developer Portal, enable `message_content` intent, get token | Owner |
| **T0d** | Create Discord test server (guild), invite bot | Owner |
| **T0e** | Create Langfuse Cloud account, get keys | Owner |
| **T0f** | Create Neon Postgres (pgvector enabled) via Vercel | Owner |
| **T0g** | Create Upstash Redis via Vercel | Owner |
| **T0h** | Create Railway account, link to repo | Owner |

### Phase 1: Foundation (parallel)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T1: DB schema + migrations** | All tables from §1 including pgvector, vault_signals, signal_relationships | `db/migrations/` | ~250 |
| **T2: Python engine scaffold** | `pyproject.toml`, config, `__init__` files, env setup, Dockerfile | `engine/chronos/config.py`, `pyproject.toml`, `Dockerfile` | ~150 |
| **T3: Next.js scaffold** | `create-next-app`, Tailwind, Drizzle/Prisma setup, env config | `web/` scaffold | ~100 |
| **T4: CTO seed data + embed script** | 7 radar definitions, 10-15 seed signals, embedding script | `vault/`, `engine/chronos/scripts/seed.py` | ~600 |
| **T5: Observability setup** | Langfuse init, `AnthropicInstrumentor` | `engine/chronos/observability/setup.py` | ~50 |

### Phase 2: Memory Layer (depends on T1, T2)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T6: Signal store + embedding pipeline** | Store, query, update status, embed on write | `signal_store.py`, `embeddings.py` | ~200 |
| **T7: Vault reader + vector search** | Load radars, vector search vault_signals, keyword boost | `vault.py`, `embeddings.py` | ~150 |
| **T8: Session manager + STM** | CRUD, STM persistence/restore | `sessions/manager.py`, `memory/stm.py` | ~150 |
| **T9: Audit log** | Append-only write, query with filters | `memory/audit_log.py` | ~80 |
| **T10: Artifact store** | CRUD, token generation | `memory/artifacts.py` | ~80 |
| **T11: Signal relationships** | CRUD, find contradictions, find clusters | `memory/relationships.py` | ~120 |

### Phase 3: Core Engine (depends on T5, T7, T8, T9)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T12: Agent loop + gates** | `tool_runner` wrapper, state persistence, gate detection, resume | `engine/agent_loop.py`, `gates.py`, `resume.py` | ~250 |
| **T13: Recipe loader** | Load recipe definitions | `engine/recipe_loader.py` | ~60 |
| **T14: Domain cartridge (RAG)** | Embed query, vector search, keyword boost, token budget, STM load | `engine/cartridge.py` | ~150 |
| **T15: Trust layer** | Owner verification, rejection logging | `trust/auth.py` | ~40 |

### Phase 4: Channels + Web (depends on T6, T12, T15)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T16: Envelope + gateway + router** | Envelope, inbound dispatch, intent detection, output routing | `channels/envelope.py`, `gateway.py`, `router.py` | ~200 |
| **T17: Discord adapter** | Bot setup, slash commands (`/session`, `/ask`), message capture | `channels/discord_adapter.py` | ~150 |
| **T18: Engine internal API** | FastAPI routes for review actions, heartbeat trigger, status | `api/routes.py`, `api/auth.py` | ~100 |
| **T19: Web — artifact pages** | `/artifacts/[id]` with confidence, citations, training labels | `web/src/app/artifacts/` | ~200 |
| **T20: Web — review surfaces** | `/review` queue, `/review/[id]` with actions, engine API calls | `web/src/app/review/` | ~250 |
| **T21: Web — session + audit pages** | `/sessions`, `/decisions` with filters | `web/src/app/sessions/`, `web/src/app/decisions/` | ~200 |

### Phase 5: Skills (depends on T6, T7, T9, T10, T11, T14)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T22: Classification skill** | `classify_signal`, `flag_for_review` (uses RAG for suggestions) | `skills/classify.py` | ~100 |
| **T23: Research + synthesis skills** | `search_vault` (vector), `create_artifact` (with confidence) | `skills/research.py`, `synthesize.py` | ~150 |
| **T24: Publish + notify skills** | `publish_artifact`, `notify_discord` | `skills/publish.py`, `notify.py` | ~80 |
| **T25: Gate tools** | `ask_clarification`, `pause_for_review`, `report_blocked` | `skills/gates.py` | ~60 |
| **T26: Promotion skills** | `promote_to_vault`, `archive_signal`, `discover_relationships`, `surface_contradiction`, `surface_connection` | `skills/promote.py` | ~150 |

### Phase 6: Recipes (depends on T12, T13, T22-T26)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T27: Recipe 1 — Capture & Classify** | System prompt, tool set, heartbeat trigger | `recipes/capture.py`, `scheduler/heartbeat.py` | ~120 |
| **T28: Recipe 2 — Consult CTO** | System prompt, tool set, clarify/synthesize flow | `recipes/consult.py` | ~100 |
| **T29: Recipe 3 — Memory Promotion** | System prompt, tool set, relationship discovery, long-cadence trigger | `recipes/promotion.py` | ~100 |

### Phase 7: Integration + Deploy (depends on all above)

| Task | Scope | Files | Est. Lines |
|------|-------|-------|-----------|
| **T30: Python main** | Discord bot + scheduler + internal API startup, observability init | `chronos/main.py` | ~80 |
| **T31: Vercel config** | `vercel.json` cron, env vars, build config | `web/vercel.json` | ~20 |
| **T32: Railway deploy** | Dockerfile, env vars, deploy config | `engine/Dockerfile`, Railway config | ~30 |

### Phase 8: Tests (depends on relevant phases)

| Task | Scope | Scenarios |
|------|-------|-----------|
| **T33: Capture + classify tests** | SC-CAP-*, SC-CLS-* | 9 |
| **T34: Consult tests** | SC-CON-*, SC-GAT-*, SC-CNF-* | 14 |
| **T35: Promotion tests** | SC-MEM-* | 4 |
| **T36: Review + session + channel tests** | SC-REV-*, SC-SES-*, SC-CHN-* | 14 |
| **T37: Trust + audit + integration tests** | SC-TRU-*, SC-AUD-*, SC-PHX-*, SC-OBS-*, SC-DOM-* | 13 |

### Task DAG

```
T0a-T0h (manual prerequisites)
    │
T1  T2  T3  T4  T5          ← Phase 1 (parallel)
│   │   │   │   │
├───┼───┼───┼───┤
│               │
T6  T7  T8  T9  T10  T11    ← Phase 2 (parallel)
│   │   │   │   │     │
├───┼───┼───┼───┼─────┤
│                     │
T12  T13  T14  T15           ← Phase 3 (parallel)
│    │    │    │
├────┼────┼────┤
│              │
T16 T17 T18 T19 T20 T21     ← Phase 4 (parallel)
│                    │
T22 T23 T24 T25 T26          ← Phase 5 (parallel)
│               │
├───────────────┤
│               │
T27  T28  T29                ← Phase 6 (parallel)
│    │    │
├────┼────┤
│
T30  T31  T32                ← Phase 7 (parallel)
│
T33 T34 T35 T36 T37          ← Phase 8 (parallel test suites)
```

**Total: 37 tasks (8 prereqs + 29 implementation), 8 phases, ~4000 lines across Python + TypeScript**
