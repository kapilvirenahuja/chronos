# Chronos v1 — Technical Approach

> How Chronos implements the product spec faithfully, without confusing implementation machinery for the architecture itself.

**Status:** Draft
**Version:** 1.1.0
**Last Updated:** 2026-03-14

---

## Overview

Chronos v1 is a dual-tempo, intent-driven PCAM runtime serving three recipes:

1. **Capture & Classify** — fast-tempo signal intake and background classification
2. **Consult CTO Research Pipeline** — slow-tempo research, synthesis, and artifact publishing
3. **Memory Promotion** — long-cadence pattern promotion from STM/signal store to vault

These three recipes validate the full architecture: signal intake, agentic reasoning, human-in-the-loop review, memory promotion, and multi-channel output.

---

## Core Principles

1. Signals are stored before processing.
2. Fast-thinking handles capture and classification.
3. Slow-thinking handles research and synthesis.
4. Memory is split into signal store, short-term memory, and long-term memory (vault).
5. Long-term memory evolves through a promotion recipe (cognition layer).
6. Every action is auditable via the decision audit log.

---

## Architecture Layers

```
Channels → Access & Identity → Intent Resolution → Tempo Router
→ Recipe Control → PCAM Runtime → Skills & Tools → Memory & Artifacts
```

Cross-cutting:
- Trust Plane
- Audit & Observability (Langfuse)

---

## Orchestration Model

### Recipe-as-Prompt, Claude-as-Orchestrator

Chronos does not use a workflow framework for orchestration. Recipes are agentic — Claude reasons through the recipe contract and decides execution path dynamically.

**Recipe** = system prompt + state contract + available skills (as tools) + gate conditions

**Agent loop** = Anthropic SDK tool-use cycle. Claude reads the recipe contract, sees current state, picks the next skill to invoke, executes, updates state, repeats until a response gate is reached.

```
while not gate_reached:
    response = claude(
        system = recipe_prompt,
        messages = [state, history],
        tools = recipe.skills
    )
    execute_tool_calls(response)
    update_state(postgres)
    check_gates(response)
```

The orchestration is not hardcoded. Claude decides which skill to call next based on the recipe contract and current state. Different inputs produce different execution paths through the same recipe.

### Human Pause Points

When a recipe reaches a human-in-the-loop checkpoint (e.g., `awaiting_review`), Claude's tool call returns a pause action. The runtime:

1. Persists full state to Postgres
2. Sends notification via the appropriate channel
3. Stops the agent loop

When the owner responds (via web action or messaging channel), a new invocation resumes from saved state.

### Non-Determinism Mitigation

Agentic orchestration means Claude may vary execution ordering. Mitigations:

- Recipe prompts are explicit about required ordering and constraints
- Runtime gate checks enforce hard invariants (not just prompt-level)
- Langfuse evals detect deviation from expected patterns (see Observability section)

---

## Channels

### Messaging Channel (Discord / WhatsApp)

- User submits signals and talks to the system
- Chronos uses this for real-time actions, notifications, and compact pointers to web artifacts
- Fast, low-friction, conversational

### Web Channel

- Long-form and detailed documents
- Review surfaces for capture classifications and consult artifacts
- Reading surfaces for strategy briefs, session summaries, decision reviews
- Action surfaces for feedback on artifacts
- Access-controlled via token-authenticated URLs

### Deferred Channels

- **Telegram**: planned for progressive messaging channel rollout
- **Voice**: planned for ambient capture
- **Claude Code CLI**: planned for local client channel

### Output Routing

Chronos selects the output channel based on task shape:
- Short confirmations and clarifications → messaging channel
- Rich artifacts (briefs, summaries, reviews) → web channel with messaging notification
- Low-confidence classification review items → web channel with messaging notification

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Cognition & Synthesis | Anthropic SDK | Model calls, tool use, agent loop |
| Observability & Evals | Langfuse | Tracing, cost tracking, model evaluation, pattern deviation detection |
| System of Record | Postgres | State, signals, artifacts, decision audit log |
| Queues & Runtime State | Redis | Job queues, ephemeral runtime state |

### What We Don't Use

- **No LangGraph/LangChain** — orchestration is agentic via Claude tool-use loop, not framework-driven graphs
- **No separate orchestration framework** — recipes define contracts, Claude reasons through them

---

## Recipe 1: Capture & Classify

**Tempo:** Fast
**Purpose:** Use messaging channel as a dump pad for signals, with background classification.

### Capture Flow

```
Messaging Channel → Gateway → Signal Store → Acknowledge (silent)
```

Signals are stored immediately in the signal store before any processing occurs.

### Heartbeat (every 30 minutes)

1. Load unclassified signals from signal store
2. Load domain cartridge (role profile + matched vault signals via radar scanning)
3. Classify signals using radar matching
4. Apply confidence policy
5. High-confidence: store classification results
6. Low-confidence: surface for owner review via web channel, notify via messaging channel
7. Log all classification decisions to decision audit log

### Review Queue

Low-confidence classifications are surfaced as a review queue on the web channel. When the owner reviews:
- Reclassified signals are updated in the signal store
- The next heartbeat run picks up the owner's corrections
- All review actions are logged to the decision audit log

---

## Recipe 2: Consult CTO Research Pipeline

**Tempo:** Slow
**Purpose:** Deep research, synthesis, and structured artifact creation.
**Intents served:** retrieve, synthesize (from the vision's five core intents)

### Workflow

1. Receive consult request
2. Resolve scope
3. Load domain cartridge (CTO role profile + matched vault signals into STM)
4. Run deep research
5. Synthesize findings
6. Create structured artifact (with confidence scores and source citations)
7. Render HTML
8. Publish artifact to web channel
9. Notify via messaging channel
10. Await review (human pause)
11. Revise if required

### States

```
queued → running → publishing → awaiting_review → revising → completed → blocked
```

### Review & Revision

- Owner reviews via web channel (HTML artifact)
- Feedback triggers revision in-place (no new version — same artifact updated)
- Decision audit log records what feedback was given and what changes were made

---

## Recipe 3: Memory Promotion

**Tempo:** Long (monthly or quarterly)
**Layer:** Cognition
**Trigger:** Heartbeat on long cadence

### Purpose

Move durable patterns from the signal store and STM into the vault (long-term memory). Surface novel connections proactively. This is what turns raw signal accumulation into compounding knowledge.

### Workflow

1. Scan accumulated signals and classifications for stable patterns
2. Evaluate pattern durability (reinforcement over time, consistency across signals)
3. Promote validated insights to vault as new signals under appropriate radar categories
4. Archive or discard noise that didn't gain reinforcement
5. Surface novel connections, contradictions, and gaps across the knowledge base
6. Publish a promotion summary to the web channel
7. Notify the owner via messaging channel with a pointer to the summary
8. Await owner review for ambiguous items (human pause)
9. Incorporate owner feedback and finalize promotions

### Proactive Synthesis

The promotion recipe is where proactive synthesis lives. When the recipe identifies connections the owner hasn't explicitly asked about — contradictions between signals, emerging patterns across time, gaps in coverage — it surfaces these via the web channel. This is the product mechanism behind the vision's "proactive synthesis via heartbeat" differentiator.

---

## Artifact Model

Two forms of output:

### Structured Artifact
- Sections
- Sources (traceable to specific vault signals, with signal paths)
- Confidence score (how well-grounded in vault knowledge)
- Metadata (recipe, session, timestamp, role profile)
- Version

### HTML Artifact
- Rendered presentation layer for review and reading
- Served via web channel with token-authenticated URLs
- Includes visible confidence score and source citations

---

## Memory Model

### Signal Store (Inbox)

The signal store is the intake layer. It holds raw captures before classification.

Contains:
- Raw signals from messaging channels
- Classification status (unclassified, classified, review-pending)
- Capture metadata (channel, timestamp, author)

The signal store is not STM. It is a durable inbox that persists across sessions.

### Short-Term Memory (Session Workspace)

STM is the active reasoning workspace for a session. It is created when a recipe initializes and scoped to that session.

Contains:
- Current recipe state
- Loaded domain cartridge (role profile + matched vault signals)
- Active intents
- Intermediate artifacts
- Current clarification or decision state

Agents read from STM, not from the vault directly. The domain cartridge loading step (during recipe initialization) is what populates STM with relevant vault knowledge.

### Long-Term Memory (Vault)

The vault is the durable knowledge layer, organized with radars and signals.

**Radars** are classification lenses — keyword sets and signal mappings organized by strategic dimension. They determine which vault signals are relevant to a given query or classification task.

**Signals** are the actual knowledge artifacts, organized by category:
- Mental models and frameworks
- Validated insights
- Stable patterns promoted from the signal store
- Durable preferences

### Domain Cartridges

A domain cartridge is the runtime projection of vault knowledge for a given role profile. It consists of:

1. **Role profile** — the persona definition (CTO, PM, Entrepreneur) with its intent handlers, output framing, and domain vocabulary
2. **Matched signals** — vault signals selected by scanning the query/context against radars

The cartridge is loaded into STM at recipe initialization. This is how vault knowledge becomes available to agents without agents searching the vault directly.

### Decision Audit Log

A persistent, append-only log stored in Postgres. Records:

| Field | Description |
|-------|-------------|
| Timestamp | When the decision was made |
| Recipe | Which recipe was executing |
| Session | Which session context |
| Decision type | classification, synthesis, promotion, revision |
| Input | What was being decided on |
| Output | What the decision was |
| Confidence | Score at decision point |
| Sources | Vault signal paths that informed the decision |
| Owner feedback | If review occurred, what the owner said |
| Changes made | If revision occurred, what changed |

### Promotion Pipeline

Runs as Recipe 3 on long cadence. Evaluates signal store patterns for durability and promotes to vault. See Recipe 3 for full workflow.

---

## Trust Layer

### MVP: Owner-Only

- Single owner, full access
- Unknown authors rejected

### Mechanisms

- Policies (what's allowed per recipe)
- Guardrails (model output constraints)
- Confidence thresholds (when to proceed vs. surface for review)
- Human-in-the-loop checkpoints (review gates in recipes)

---

## Session Management

Sessions are topic-based, not channel-based. The runtime exposes four operations:

| Operation | Messaging Channel | Web Channel |
|-----------|------------------|-------------|
| Create new session | Command (e.g., `/session new <topic>`) | — |
| Load existing session | Command (e.g., `/session load <id>`) | Session list page |
| Clear current session | Command (e.g., `/session clear`) | — |
| List sessions | Command (e.g., `/session list`) | Session list page |

Session state is persisted in Postgres. When a session is loaded, its STM is restored, allowing the owner to resume reasoning where they left off.

---

## Observability (Langfuse)

Langfuse wraps the Anthropic SDK client to provide full trace observability.

### What Gets Traced

| Metric | Purpose |
|--------|---------|
| Cost per recipe run | Economic monitoring |
| Latency per skill invocation | Performance tracking |
| Model quality on classifications | Eval: does classification match owner corrections? |
| Execution order per recipe | Eval: does the agentic path match expected patterns? |
| Gate sequence | Eval: are response gates reached in valid order? |
| Confidence score distribution | Eval: is the system well-calibrated? |

### Deviation Detection

Langfuse evals flag when:
- A recipe invokes skills in an unexpected order
- Confidence scores are consistently miscalibrated (owner frequently overrides)
- Recipe runs exceed expected cost or latency bounds

---

## Runtime Components

What gets built:

1. **Recipe loader** — reads recipe definition (prompt, skills, gates, state schema)
2. **Agent loop** — Anthropic SDK tool-use cycle with state persistence
3. **Skill registry** — tools Claude can invoke (classify, research, synthesize, render, notify, promote)
4. **State store** — Postgres tables tracking recipe runs, sessions, and current state
5. **Signal store** — Postgres tables for raw captures and classification status
6. **Decision audit log** — Postgres append-only log for all decisions and owner feedback
7. **Resume handler** — picks up paused runs when human feedback arrives
8. **Channel gateway** — normalizes input from Discord/WhatsApp, routes output to appropriate channel
9. **Session manager** — CRUD operations for topic-based sessions with STM persistence
10. **Langfuse integration** — wraps Anthropic SDK client for full trace observability and evals

---

## Summary

Chronos v1 operates three loops:

**Fast Loop:** Signal capture and classification (30-min heartbeat)

**Slow Loop:** Research → artifact publishing → review → revision (on-demand)

**Long Loop:** Memory promotion — signal store patterns to vault (monthly/quarterly), with proactive synthesis

All orchestration is agentic. Recipes define the contract. Claude determines the path. Every decision is auditable.
