# Chronos — Claude Code Instructions

> Project-level instructions for Claude Code when working in this repository

---

## What Is Chronos

Chronos is a personal AI for strategic leaders — a dual-tempo, intent-driven PCAM runtime that captures, classifies, synthesizes, and compounds knowledge.

### Naming Hierarchy

| Layer | Name | What It Is |
|-------|------|-----------|
| **Philosophy** | **IDD** — Intent-Driven Design | Mental model for building anything intent-first |
| **Philosophical Models** | **PCAM** — Perception, Cognition, Agency, Manifestation | Structural thinking model |
| **Architecture** | **Phoenix** — Pattern Language | Signal → Recipe → Agent → Skill → Memory |
| **Product** | **Chronos** | Life OS + Phoenix + PCAM → personal AI & knowledge work |

### PCAM in Chronos

| Layer | Role | Implementation |
|-------|------|---------------|
| **Perception** | Signals in | Channel gateway (Discord), heartbeat scheduler |
| **Cognition** | Reasoning + orchestration | Agent loop (Anthropic SDK `tool_runner`), recipe prompts, domain cartridges (RAG) |
| **Agency** | Tools out | Skills as `@beta_tool` functions (classify, research, synthesize, publish, notify, promote) |
| **Manifestation** | Memory + artifacts | Signal store, STM, vault (radars + signals + pgvector), audit log, web artifacts |

---

## Source of Truth

All product and technical documentation lives in `.meridian/product/`:

| Document | Purpose |
|----------|---------|
| `vision.md` | Why Chronos exists (LOCKED) |
| `chronos-features.md` | Product spec v4.0.0 — what it does, how it behaves |
| `technical-approach.md` | Technical approach — architecture, recipes, orchestration model |
| `chronos-scenarios.md` | 54 verification scenarios (35 automated, 19 hybrid) |
| `chronos-lld.md` | Low-level design v2.0 — implementation blueprint, schemas, code patterns, phase breakdown |

**Always read the relevant product doc before making architectural decisions.** The LLD is the implementation guide.

---

## Architecture: Split System

Chronos is a **split-architecture** system with two deployment units sharing one database:

### Python Engine (Railway)

Long-running process hosting:
- Discord bot (persistent WebSocket via discord.py 2.x)
- Agent loop (Anthropic SDK `tool_runner` with compaction)
- Heartbeat scheduler (APScheduler)
- Embedding pipeline (voyage-3)
- Internal REST API (FastAPI — called by Next.js web)

### Next.js Web (Vercel)

Server-rendered web surfaces:
- Artifact reading pages (`/artifacts/[id]`)
- Review surfaces (`/review`)
- Session management (`/sessions`)
- Decision audit log viewer (`/decisions`)
- API routes for Vercel Cron and review action proxy

### Shared Infrastructure

- **Neon Postgres** (pgvector enabled) — system of record
- **Upstash Redis** — scheduling state, ephemeral cache
- **Langfuse Cloud** — observability

### Communication

- Next.js reads directly from Neon Postgres (Drizzle ORM)
- Next.js calls Python engine API for write operations (review actions, recipe resume, heartbeat trigger)
- Engine API authenticated via shared secret (`ENGINE_API_SECRET`)

---

## Technology Stack

### Python Engine

| Component | Technology |
|-----------|-----------|
| LLM | Anthropic SDK (`tool_runner` with compaction) |
| Observability | Langfuse v3 (`AnthropicInstrumentor` + `@observe`) |
| Embeddings | voyage-3 (via VoyageAI API) |
| Discord | discord.py 2.x (slash commands, message listener) |
| Scheduler | APScheduler |
| Internal API | FastAPI |

### Next.js Web

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| DB Client | Drizzle ORM |
| Hosting | Vercel |
| Cron | Vercel Cron |

### No External Dependencies Beyond

- **No LangChain/LangGraph** — agentic orchestration via Claude tool_runner
- **No OpenAI** — all LLM + embeddings via Anthropic ecosystem (Anthropic SDK + voyage-3)
- **No separate migration framework** — brand new product, schema managed via SQL + Drizzle push

---

## Project Structure

```
chronos/
├── .meridian/product/              # Product docs (vision, spec, LLD, scenarios)
├── philosophy/                     # IDD, Phoenix, PCAM foundations (reference)
├── memory/                         # LTM: knowledge, standards, formats
│
├── engine/                         # Python engine (Railway)
│   ├── chronos/
│   │   ├── main.py                 # Discord bot + scheduler + internal API startup
│   │   ├── config.py               # Environment config
│   │   ├── channels/               # Perception: envelope, Discord adapter, gateway, router
│   │   ├── trust/                  # Trust plane: owner auth
│   │   ├── engine/                 # Cognition: agent loop, recipe loader, gates, cartridge (RAG)
│   │   ├── recipes/                # Recipe definitions (prompts + tool sets)
│   │   ├── skills/                 # Agency: @beta_tool functions
│   │   ├── memory/                 # Manifestation: signal store, STM, vault, audit log, artifacts, embeddings
│   │   ├── sessions/               # Session CRUD + STM persistence
│   │   ├── api/                    # Internal REST API (for Next.js to call)
│   │   ├── scheduler/              # Heartbeat triggers
│   │   └── observability/          # Langfuse setup + evals
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── web/                            # Next.js web channel (Vercel)
│   ├── src/
│   │   ├── app/                    # App Router pages + API routes
│   │   ├── components/             # React components
│   │   └── lib/                    # DB client, engine client, auth
│   ├── package.json
│   └── vercel.json
│
├── db/
│   └── schema.sql                  # Postgres schema (single source of truth)
│
├── vault/                          # CTO domain cartridge seed data
│   ├── radars/
│   └── signals/
│
└── .env.example
```

---

## Key Architecture Concepts

### Recipes Define What, Agents Determine How

- A **recipe** = system prompt + available skills (as tools) + gate conditions
- The **agent loop** = Anthropic SDK `tool_runner` cycle — Claude reads the recipe, picks tools, executes, repeats until a response gate
- Orchestration is **agentic, not hardcoded** — different inputs produce different execution paths

### Three Recipes in v1

| Recipe | Tempo | Trigger |
|--------|-------|---------|
| **Capture & Classify** | Fast (30-min heartbeat) | Discord message + scheduled heartbeat |
| **Consult CTO** | Slow (on-demand) | Owner asks `/ask` on Discord |
| **Memory Promotion** | Long (monthly) | Scheduled long-cadence heartbeat |

### Memory Layers (Distinct, Do Not Collapse)

| Layer | What It Is | Storage |
|-------|-----------|---------|
| **Signal Store** | Raw captures before classification | Postgres `signals` table |
| **STM** | Session reasoning workspace | Postgres `sessions.stm_state` JSONB |
| **Vault** | Durable knowledge (radars + signals) | Postgres `vault_signals` + filesystem mirror |
| **Audit Log** | Append-only decision trail | Postgres `audit_log` table |

### Domain Cartridges (RAG-Based)

At recipe init:
1. Embed query via voyage-3
2. Vector search vault_signals by cosine similarity (pgvector)
3. Boost results matching radar keywords
4. Cap at ~50k token budget
5. Load into STM

Agents read from STM, never from vault directly.

### Response Gates

Recipes only surface output at valid gates: **Clarification**, **Synthesis**, **Blocked**, **Error**. Gate detection via special tool calls (`ask_clarification`, `pause_for_review`, `report_blocked`).

### Engine API Contract

The Python engine exposes a headless REST API consumed by Next.js. All write operations that affect recipe state go through this API. The contract is defined in `memory/standards/api/engine-api-contract.md`. Both engine and web are developed against this contract — mock-first, integrate later.

---

## Day 1 Scope

- **Discord only** — no WhatsApp, Telegram, or voice
- **CTO role profile only** — PM and Entrepreneur deferred
- **3 intents active**: capture, retrieve, synthesize — decide and brief deferred
- **voyage-3 embeddings** — no OpenAI dependency

---

## Implementation Phases

The LLD (§12) defines 9 vertical slices. Each phase delivers testable scenarios:

| Phase | Delivers | Cumulative Scenarios |
|-------|----------|---------------------|
| 0 | Prerequisites (accounts, credentials) | 0 |
| 1 | Silent capture + trust | 7 |
| 2 | Vault + heartbeat classification | 15 |
| 3 | Capture review (web + notification) | 21 |
| 4 | Consult CTO (clarify + synthesize + sessions) | 41 |
| 5 | Consult review + revision | 45 |
| 6 | Memory promotion | 50 |
| 7 | Audit viewer + session pages + evals | 54 |
| 8 | Production deploy | 54 + smoke |

**Nothing moves forward until the current phase's scenarios pass.**

---

## When Working in This Repo

1. **Read the product docs first** — `.meridian/product/` is the source of truth
2. **Read the LTM** — `memory/` has knowledge, standards, and formats for every component
3. **Follow the LLD** — it specifies schemas, code patterns, and phase breakdown
4. **Map work to scenarios** — every feature traces to a `SC-*` scenario ID
5. **Use the tech stack as specified** — no new frameworks without discussion
6. **Build against the API contract** — engine and web develop independently, integrate via contract
7. **Audit everything** — every decision goes to audit log, every recipe run gets a Langfuse trace
8. **Keep skills as `@beta_tool` functions** — this is how the agent loop discovers capabilities

---

**Version**: 6.0.0
**Last Updated**: 2026-03-14
