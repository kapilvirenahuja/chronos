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
| **Perception** | Signals in | Channel gateway (Discord, WhatsApp), heartbeat scheduler |
| **Cognition** | Reasoning + orchestration | Agent loop (Anthropic SDK `tool_runner`), recipe prompts, domain cartridges |
| **Agency** | Tools out | Skills as `@beta_tool` functions (classify, research, synthesize, render, notify, promote) |
| **Manifestation** | Memory + artifacts | Signal store, STM, vault (radars + signals), audit log, web artifacts |

---

## Source of Truth

All product and technical documentation lives in `.meridian/product/`:

| Document | Purpose |
|----------|---------|
| `vision.md` | Why Chronos exists (LOCKED) |
| `chronos-features.md` | Product spec v4.0.0 — what it does, how it behaves |
| `technical-approach.md` | Technical approach v1.1.0 — architecture, recipes, orchestration model |
| `chronos-scenarios.md` | 54 verification scenarios (35 automated, 19 hybrid) |
| `chronos-lld.md` | Low-level design — implementation blueprint, schemas, code patterns, task breakdown |

**Always read the relevant product doc before making architectural decisions.** The LLD is the implementation guide.

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.12+ |
| LLM | Anthropic SDK (`tool_runner` with compaction) |
| Observability | Langfuse v3 (`AnthropicInstrumentor` + `@observe`) |
| Database | PostgreSQL 16 (signals, sessions, audit log, artifacts, recipe state) |
| Queue/Cache | Redis 7 (heartbeat scheduling, ephemeral state) |
| Web | FastAPI (artifact serving, review surfaces, WhatsApp webhook) |
| Discord | discord.py 2.x (slash commands, message listener) |
| WhatsApp | Meta Cloud API direct (webhook inbound, REST outbound) |
| Migrations | Alembic |
| Templates | Jinja2 (HTML artifacts, review surfaces) |

---

## Project Structure

```
chronos/
├── .meridian/product/          # Product docs (vision, spec, LLD, scenarios)
├── philosophy/                 # IDD, Phoenix, PCAM foundations
├── src/chronos/                # Application code
│   ├── main.py                 # FastAPI + Discord bot + scheduler startup
│   ├── config.py               # Environment config
│   ├── channels/               # Perception: envelope, adapters, gateway, router
│   ├── trust/                  # Trust plane: owner auth
│   ├── engine/                 # Cognition: agent loop, recipe loader, gates, cartridge
│   ├── recipes/                # Recipe definitions (prompts + tool sets)
│   ├── skills/                 # Agency: @beta_tool functions
│   ├── memory/                 # Manifestation: signal store, STM, vault, audit log, artifacts
│   ├── sessions/               # Session CRUD + STM persistence
│   ├── web/                    # Web channel: FastAPI routes, templates, token auth
│   ├── scheduler/              # Heartbeat triggers (30-min classify, monthly promote)
│   └── observability/          # Langfuse setup + evals
├── vault/                      # CTO domain cartridge seed data (filesystem)
│   ├── radars/                 # Radar definitions (keywords)
│   └── signals/                # Seed signals by category
├── db/migrations/              # Alembic migrations
├── tests/                      # Maps to scenario groups (SC-CAP-*, SC-CLS-*, etc.)
└── pyproject.toml
```

---

## Key Architecture Concepts

### Recipes Define What, Agents Determine How

- A **recipe** = system prompt + available skills (as tools) + gate conditions + state schema
- The **agent loop** = Anthropic SDK `tool_runner` cycle — Claude reads the recipe, picks tools, executes, repeats until a response gate
- Orchestration is **agentic, not hardcoded** — different inputs produce different execution paths through the same recipe

### Three Recipes in v1

| Recipe | Tempo | Trigger |
|--------|-------|---------|
| **Capture & Classify** | Fast (30-min heartbeat) | Messaging channel signal + scheduled heartbeat |
| **Consult CTO** | Slow (on-demand) | Owner asks a strategic question |
| **Memory Promotion** | Long (monthly) | Scheduled long-cadence heartbeat |

### Memory Layers (Distinct, Do Not Collapse)

| Layer | What It Is | Storage |
|-------|-----------|---------|
| **Signal Store** | Raw captures before classification | Postgres `signals` table |
| **STM** | Session reasoning workspace (domain cartridge + active intents) | Postgres `sessions.stm_state` |
| **Vault** | Durable knowledge (radars + signals) | Filesystem (`vault/`) |
| **Audit Log** | Append-only decision trail | Postgres `audit_log` table |

### Domain Cartridges

A domain cartridge is the runtime projection of vault knowledge for a role profile. At recipe init:
1. Scan query against radar keyword sets
2. Load matched vault signals (token-budgeted at ~50k)
3. Write into STM

Agents read from STM, never from vault directly.

### Response Gates

Recipes only surface output at valid gates: **Clarification**, **Synthesis**, **Blocked**, **Error**. Intermediate work is internal. Gate detection is via special tool calls (`ask_clarification`, `pause_for_review`, `report_blocked`).

---

## Implementation Task Breakdown

The LLD (`chronos-lld.md`) contains 31 tasks across 8 phases. Each task is scoped to 40-250 lines — fits in a single context window.

**Phase order**: Foundation → Memory Layer → Core Engine → Channels → Skills → Recipes → Integration → Tests

When implementing, read the relevant LLD section for that task's scope, files, and patterns.

---

## When Working in This Repo

1. **Read the product docs first** — `.meridian/product/` is the source of truth
2. **Follow the LLD** — it specifies exact file locations, schemas, and patterns
3. **Map work to scenarios** — every feature should trace to a `SC-*` scenario ID
4. **Use the tech stack as specified** — don't introduce new frameworks without discussion
5. **Keep skills as `@beta_tool` functions** — this is how the agent loop discovers capabilities
6. **Audit everything** — every decision goes to the audit log, every recipe run gets a Langfuse trace

---

**Version**: 5.0.0
**Last Updated**: 2026-03-14
**Changes**: Complete rewrite for Chronos v1. Removed all v3 references (agents, skills, commands, .phoenix-os, memory/engine). Aligned with product spec v4.0.0 and LLD v1.0.0.
