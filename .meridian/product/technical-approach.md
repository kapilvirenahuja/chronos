# Chronos v1 — Technical Approach

> How Chronos implements the product spec faithfully, without confusing implementation machinery for the architecture itself.

**Status:** Active
**Version:** 2.0.0
**Last Updated:** 2026-03-14

---

## Overview

Chronos v1 is a dual-tempo, intent-driven PCAM runtime serving three recipes:

1. **Capture & Classify** — fast-tempo signal intake and background classification
2. **Consult CTO Research Pipeline** — slow-tempo research, synthesis, and artifact publishing
3. **Memory Promotion** — long-cadence pattern promotion from signal store to vault

---

## Core Principles

1. Signals are stored before processing.
2. Fast-thinking handles capture and classification.
3. Slow-thinking handles research and synthesis.
4. Memory is split into signal store, short-term memory, and long-term memory (vault).
5. Long-term memory evolves through a promotion recipe (cognition layer).
6. Every action is auditable via the decision audit log.

---

## System Architecture

Chronos is a **split-architecture** system with two deployment units sharing one database.

### Python Engine (Railway)

A long-running process hosting:
- **Discord bot** — persistent WebSocket connection for signal capture and commands
- **Agent loop** — Anthropic SDK `tool_runner` with compaction for agentic recipe execution
- **Heartbeat scheduler** — APScheduler for 30-min classification and monthly promotion triggers
- **Embedding pipeline** — voyage-3 for signal and vault embeddings
- **Internal REST API** — FastAPI endpoints consumed by the Next.js web app

### Next.js Web (Vercel)

Server-rendered web surfaces:
- **Artifact pages** — reading surfaces for synthesis outputs with confidence badges and citations
- **Review surfaces** — action surfaces for capture review and consult review
- **Session management** — list, detail, and STM state viewer
- **Decision audit log** — filterable viewer for the append-only decision trail
- **API routes** — Vercel Cron triggers, review action proxy to engine API

### Communication Pattern

```
┌─────────────────────┐     ┌──────────────────────────┐
│   Python Engine      │     │   Next.js Web (Vercel)   │
│   (Railway)          │     │                          │
│                      │     │  Reads: Neon Postgres    │
│  Discord Bot (WS)    │◄───►│  Writes: via Engine API  │
│  Agent Loop          │ API │                          │
│  Heartbeat Scheduler │     │  Vercel Cron → Engine    │
│  Embedding Pipeline  │     │  Review Actions → Engine │
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

- Next.js reads directly from Postgres (Drizzle ORM)
- Next.js calls Engine API for all write operations (review actions, recipe resume, heartbeat trigger)
- Engine API authenticated via shared secret
- Engine sends Discord notifications; web generates token-authenticated artifact URLs

---

## Orchestration Model

### Recipe-as-Prompt, Claude-as-Orchestrator

Chronos does not use a workflow framework for orchestration. Recipes are agentic — Claude reasons through the recipe contract and decides execution path dynamically.

**Recipe** = system prompt + state contract + available skills (as tools) + gate conditions

**Agent loop** = Anthropic SDK `tool_runner` with compaction enabled. Claude reads the recipe contract, sees current state, picks the next skill to invoke, executes, updates state, repeats until a response gate is reached.

The orchestration is not hardcoded. Claude decides which skill to call next based on the recipe contract and current state. Different inputs produce different execution paths through the same recipe.

### Human Pause Points

When a recipe reaches a human-in-the-loop checkpoint (e.g., `awaiting_review`), Claude's tool call returns a pause action. The runtime:

1. Persists full state to Postgres
2. Sends notification via Discord
3. Stops the agent loop

When the owner responds (via web review action), a new invocation resumes from saved state.

### Non-Determinism Mitigation

Agentic orchestration means Claude may vary execution ordering. Mitigations:

- Recipe prompts are explicit about required ordering and constraints
- Runtime gate checks enforce hard invariants (not just prompt-level)
- Langfuse evals detect deviation from expected patterns

---

## Channels

### Discord (v1)

- User submits signals and talks to the system via messages and slash commands
- Chronos uses Discord for real-time notifications and compact pointers to web artifacts

### Web (Next.js on Vercel)

- Long-form artifact reading surfaces
- Review surfaces for capture classifications and consult artifacts
- Session management and decision audit log viewer
- Access-controlled via token-authenticated URLs

### Deferred Channels

- **WhatsApp**: planned post-v1
- **Telegram**: planned for progressive rollout
- **Voice**: planned for ambient capture
- **Claude Code CLI**: planned for local client channel

### Output Routing

Chronos selects the output channel based on task shape:
- Short confirmations and clarifications → inline Discord message
- Rich artifacts (briefs, summaries, reviews) → web channel with Discord notification
- Low-confidence classification review items → web channel with Discord notification

---

## Technology Stack

### Python Engine

| Component | Technology | Purpose |
|-----------|-----------|---------|
| LLM Cognition | Anthropic SDK | `tool_runner` with compaction, `@beta_tool` skills |
| Embeddings | voyage-3 (VoyageAI) | Signal and query embedding for RAG (1024 dim) |
| Observability | Langfuse Python SDK v3 | `AnthropicInstrumentor` + `@observe` decorators |
| Discord | discord.py 2.x | Slash commands, message listener, persistent WebSocket |
| Scheduler | APScheduler | 30-min heartbeat, monthly promotion |
| Internal API | FastAPI | Headless REST API consumed by Next.js |

### Next.js Web

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | Next.js 15 (App Router) | Server components, API routes |
| Styling | Tailwind CSS | UI development |
| DB Client | Drizzle ORM | TypeScript-native Postgres reads |
| Hosting | Vercel | Zero-config deployment + Cron |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | Neon Postgres (pgvector) | System of record + vector search |
| Cache | Upstash Redis | Scheduling state, ephemeral cache |
| Observability | Langfuse Cloud | Traces, evals, cost tracking |

### What We Don't Use

- **No LangGraph/LangChain** — orchestration is agentic via Claude tool_runner
- **No OpenAI** — all LLM and embeddings via Anthropic ecosystem (Anthropic SDK + voyage-3)
- **No migration framework** — brand new product, schema via SQL + Drizzle push

---

## RAG: Embedding Pipeline + Vector Search

### How It Works

Signals and vault content are embedded using voyage-3 (1024 dimensions) and stored in Postgres via pgvector. Retrieval uses cosine similarity search with radar keyword boosting.

### Embedding Triggers

1. **Signal capture**: raw_text embedded on store → `signals.embedding`
2. **Vault seed/sync**: vault signal content embedded on import → `vault_signals.embedding`
3. **Query time**: query text embedded for cartridge loading

### Domain Cartridge Loading (RAG)

```
Query arrives
  → Embed query (voyage-3)
  → Vector search vault_signals by cosine similarity (pgvector)
  → Boost results matching radar keywords
  → Cap at ~50k token budget
  → Load into STM
```

### Classification with RAG

During heartbeat, signals are matched semantically against vault signals to suggest radar category. Confidence = agreement ratio among top-K matches.

---

## Recipe 1: Capture & Classify

**Tempo:** Fast
**Purpose:** Discord as a dump pad for signals, with background classification.

### Capture Flow

```
Discord message → Gateway → Trust check → Signal Store (silent, no response)
```

Signals are embedded (voyage-3) and stored immediately before any processing.

### Heartbeat (every 30 minutes)

1. Load unclassified signals from signal store
2. Load domain cartridge (RAG: vector search + keyword boost)
3. Classify signals using radar matching (agentic — Claude decides via tool_runner)
4. High-confidence: store classification
5. Low-confidence: flag for review, notify via Discord, surface on web
6. Log all classification decisions to audit log

### Review Queue

Low-confidence classifications surface on the web review page. Owner reclassifications persist — next heartbeat does not re-override.

---

## Recipe 2: Consult CTO Research Pipeline

**Tempo:** Slow
**Purpose:** Deep research, synthesis, and structured artifact creation.
**Intents served:** retrieve, synthesize

### Workflow

1. Receive consult request (Discord `/ask`)
2. Create/load session, initialize STM with domain cartridge (RAG)
3. If underspecified → Clarification gate (grounded questions with signal citations)
4. If retrieve → return matched vault signals with source paths
5. If synthesize → research → structured artifact with confidence + citations
6. Render HTML, publish to web, notify via Discord
7. Await review (human pause)
8. Revise if feedback provided (in-place, same artifact ID)

### States

```
queued → running → publishing → awaiting_review → revising → completed → blocked
```

### Artifact Requirements

- Confidence score on all outputs (0.0–1.0)
- Source citations tracing to vault signal paths
- Training-sourced claims explicitly labeled
- Low-confidence outputs describe specific gaps

---

## Recipe 3: Memory Promotion

**Tempo:** Long (monthly or quarterly)
**Layer:** Cognition
**Trigger:** Scheduled long-cadence heartbeat

### Purpose

Move durable patterns from signal store to vault. Surface contradictions and novel connections proactively.

### Workflow

1. Scan accumulated signals for stable patterns (reinforcement over time)
2. Discover relationships between signals (reinforces, contradicts, extends, supersedes)
3. Promote validated insights to vault under appropriate radar categories
4. Archive unreinforced noise
5. Surface contradictions and novel connections via web
6. Notify owner via Discord
7. Await review for ambiguous items (human pause)
8. Incorporate feedback, finalize promotions

---

## Engine API Contract

The Python engine exposes a headless REST API consumed by the Next.js web app. Both sides develop against this contract independently.

### Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/api/v1/review/{id}/action` | Execute review action (reclassify, reject, approve, feedback) | Engine secret |
| `POST` | `/api/v1/recipe/{id}/resume` | Resume paused recipe with human input | Engine secret |
| `POST` | `/api/v1/heartbeat/trigger` | Trigger classification heartbeat | Engine secret |
| `POST` | `/api/v1/heartbeat/promote` | Trigger promotion heartbeat | Engine secret |
| `GET`  | `/api/v1/status` | Health check | None |

### Review Action Request

```json
{
  "action": "reclassify | reject | approve | feedback",
  "new_category": "string (for reclassify)",
  "feedback": "string (for feedback)"
}
```

### Review Action Response

```json
{
  "status": "ok | error",
  "recipe_run_id": "uuid (if recipe resumed)",
  "error": "string (if error)"
}
```

### Resume Request

```json
{
  "feedback": "string",
  "action": "revise | approve"
}
```

---

## Memory Model

### Signal Store (Inbox)

Raw captures before classification. Stored in `signals` table with embedding vector.

### Short-Term Memory (STM)

Session reasoning workspace. JSONB in `sessions.stm_state`. Contains loaded domain cartridge + active intents.

### Long-Term Memory (Vault)

Durable knowledge organized with radars and signals. Stored in `vault_signals` table with embeddings + filesystem mirror in `vault/`.

### Signal Relationships (Graph Layer)

Relationships between signals stored in `signal_relationships` table: reinforces, contradicts, extends, supersedes. Used by promotion recipe for pattern detection and contradiction surfacing.

### Decision Audit Log

Append-only log in `audit_log` table. Records every classification, synthesis, promotion, revision, and review action with confidence scores and source citations.

---

## Trust Layer

### MVP: Owner-Only

- Single owner identified by Discord user ID
- Unknown authors silently rejected
- Web surfaces token-authenticated
- Engine API authenticated via shared secret

---

## Session Management

Sessions are topic-based, not channel-based. Four operations via Discord slash commands and web:

- Create new session
- Load existing session (restores STM)
- Clear current session
- List sessions

---

## Observability (Langfuse)

### What Gets Traced

- Cost per recipe run
- Latency per skill invocation
- Classification accuracy (vs owner corrections)
- Execution order per recipe
- Gate sequence validity
- Confidence score calibration

### Deviation Detection

Langfuse evals flag: unexpected skill ordering, confidence miscalibration, cost/latency bound violations.

---

## Deployment

| Service | Platform | Purpose |
|---------|----------|---------|
| Python Engine | Railway | Long-running: Discord bot, agent loop, scheduler, embedding pipeline |
| Next.js Web | Vercel | Web surfaces, API routes, Vercel Cron |
| Postgres | Neon (via Vercel) | pgvector enabled, system of record |
| Redis | Upstash (via Vercel) | Scheduling state, ephemeral cache |
| Observability | Langfuse Cloud | Traces, evals, cost tracking |

---

## Summary

Chronos v1 operates three loops:

**Fast Loop:** Signal capture and classification (30-min heartbeat)

**Slow Loop:** Research → artifact publishing → review → revision (on-demand)

**Long Loop:** Memory promotion — signal store patterns to vault (monthly/quarterly), with proactive synthesis

Split architecture: Python engine (Railway) + Next.js web (Vercel). Shared Neon Postgres with pgvector. All orchestration is agentic. Every decision is auditable. No external AI dependencies beyond Anthropic ecosystem.
