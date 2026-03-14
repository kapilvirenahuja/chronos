# Chronos Product Specification (v4.0.0)

> Product specification for Chronos - a personal knowledge and judgment harness built on IDD, Phoenix, and PCAM

---

## Document Context

**Product**: Chronos
**Purpose**: Personal AI and knowledge work harness
**Philosophical frame**: IDD / Life OS
**Execution architecture**: Phoenix + PCAM
**Version**: 4.0.0
**Last Updated**: 2026-03-14
**Status**: Active product specification

This document defines what Chronos is, how it behaves for the user, and which architectural principles are non-negotiable.

Implementation choices, runtime topology, libraries, deployment patterns, and vendor decisions are intentionally moved out of this document. Those live in [technical-approach.md](.meridian/product/technical-approach.md).

---

## 1. Product Identity

Chronos is a second brain for personal knowledge work.

It is not a generic chatbot and it is not a software delivery copilot. It exists to help the owner capture thoughts, clarify thinking, preserve signal, revisit decisions, and steadily improve judgment over time.

Chronos is grounded in the owner's knowledge system. It should feel like a disciplined, memory-aware thinking partner rather than a conversational assistant that improvises from training data.

### Core Jobs

1. Capture valuable signals with minimal friction.
2. Turn vague thinking into clarified thinking.
3. Maintain short-term and long-term memory without collapsing them into one layer.
4. Surface durable knowledge while rejecting noise.
5. Deliver the response in the right channel and format without making the user manage the routing.

### Non-Goals

- Free-form social chat
- General web concierge behavior
- SDLC execution and engineering delivery workflows
- Ungrounded advice that is not traceable to memory, session context, or explicit reasoning
- Autonomous changes to the product's own structure without human approval

---

## 2. Architectural Invariants

These invariants define Chronos. Any implementation that violates them is not Chronos, even if the features appear similar.

### 2.1 Architecture Comes First

- **IDD / Life OS** define the product framing: Chronos starts from user intent, not literal phrasing.
- **Phoenix** defines the system pattern language: `Signal -> Recipe -> Agent -> Skill -> Memory`.
- **PCAM** defines the execution structure:
  - **Perception** receives and normalizes signals.
  - **Cognition** interprets intent, builds or selects the path, and reasons over context.
  - **Agency** acts through controlled capabilities and external actions.
  - **Manifestation** stores, retrieves, renders, and consolidates memory and artifacts.

### 2.2 Memory Is First-Class

- Chronos is a personal knowledge system, not just a response engine.
- Memory is not an optional add-on. It is part of the architecture.
- Short-term memory and long-term memory serve different purposes and must remain distinct.
- Durable knowledge should be promoted intentionally, not sprayed into storage after every interaction.

### 2.3 Recipes Define What, Agents Determine How

- A recipe defines the bounded contract for a kind of work.
- An agent operates inside that recipe's constraints.
- Skills remain explicit capability units rather than hidden inside ad hoc prompts.
- Memory grounds the work; it does not decorate it after the fact.

### 2.4 Anthropic or Claude Is Not the Architecture

- Model providers and SDKs are implementation machinery.
- Chronos must not be conceptually described as "an Anthropic app."
- The product model remains valid even if the implementation layer changes later.

### 2.5 Product Behavior Is More Important Than Runtime Convenience

- Silent capture is a product decision.
- Response gates are a product decision.
- Topic-based sessions are a product decision.
- Human oversight for ambiguous or risky memory actions is a product decision.
- Autonomous channel selection is a product decision.

---

## 3. The Phoenix Model

Chronos operates through the following chain:

| Element | Meaning in Chronos |
|---------|--------------------|
| **Signal** | A normalized piece of incoming work from a messaging channel, web, heartbeat, or another source |
| **Recipe** | The bounded contract that determines what kind of work is being done and what output gates are valid |
| **Agent** | A role performing bounded or agentic reasoning within the recipe |
| **Skill** | A named capability used by the agent to carry out part of the work |
| **Memory** | The session state, durable knowledge, logs, and artifacts that ground and preserve the work |

### Product Rule

Chronos must preserve this chain. It must not collapse into:

- Signal -> model call -> answer
- Signal -> hardcoded workflow -> answer
- Signal -> "agent persona" -> answer

Phoenix exists to keep memory, role, bounded behavior, and execution structure explicit.

---

## 4. PCAM in Product Terms

### Perception

Perception is how Chronos receives and normalizes signals.

Examples:
- a Discord or WhatsApp message
- a web review action
- a scheduled heartbeat event

Perception determines what came in, who it came from, which session it belongs to, and whether it is allowed to proceed.

### Cognition

Cognition is the brain of Chronos.

It decides:
- what the user is actually trying to do
- which recipe applies
- whether clarification is needed
- whether work should remain bounded or become more agentic
- which response gate has been reached
- which channel should carry the response

### Agency

Agency is how Chronos acts on the world.

Examples:
- sending a messaging channel response
- generating an access-controlled web page (token-authenticated URL)
- writing to a source-of-truth memory system
- queuing a notification
- invoking controlled tools during a deeper reasoning flow

### Manifestation

Manifestation is how Chronos preserves and reveals what happened.

Examples:
- STM session state
- long-term signal library (vault)
- decision audit log
- review surfaces
- session summaries
- promoted memory artifacts

---

## 5. Channels

Chronos is channel-agnostic at input and adaptive at output.

### v1 Input Channels

- **Messaging (Discord / WhatsApp)**: fast capture, direct commands, strategic interaction from anywhere
- **Web**: review surfaces, reading surfaces, actions on artifacts
- **Heartbeat**: scheduled system-originated signal

### Deferred Input Channels

- **Telegram**: planned for progressive channel rollout
- **Voice**: planned for ambient capture
- **Claude Code CLI**: planned for local client channel and Chronos-aware context operations

### Output Principle

The user does not decide the response channel by default. Chronos does.

Chronos should choose the channel based on:
- task shape
- complexity of the response
- need for action or review
- need for reading comfort
- urgency and interruption cost

### Product Rule

A short confirmation or small clarification can stay inline in the messaging channel.

A richer artifact such as a strategic brief, session summary, or review document should be delivered as a web surface when that better serves the work.

---

## 6. Trust Model

### MVP

Chronos is owner-only.

- One owner
- Full access
- Unknown authors are rejected

### Future

The architecture should support trusted and guest tiers later, but the product behavior for MVP should remain simple:
- no partial access matrix
- no scoped collaborative memory
- no guest STM

---

## 7. Sessions and Memory

### Sessions

Sessions are topic-based, not channel-based.

The user should be able to:
- create a new session
- load an existing session
- clear the current session
- list sessions

These operations are exposed via messaging channel commands and web surface. One Discord channel can host many sessions because the session is a conceptual workspace, not a transport primitive.

### Signal Store

The signal store is the intake layer for raw captures. It holds signals before they are classified or processed. This is distinct from STM — the signal store is a durable inbox, not a reasoning workspace.

### Short-Term Memory

STM is the active workspace for ongoing reasoning within a session.

It should contain:
- current state
- relevant loaded context (domain cartridge projection)
- active intents
- intermediate artifacts
- the current clarification or decision state

STM is session-scoped. Agents reason from STM, not by directly searching the vault.

### Long-Term Memory (Vault)

Long-term memory is the durable knowledge layer, organized as a vault with radars and signals.

**Radars** are classification lenses — keyword sets and signal mappings that determine which knowledge is relevant to a given query or context.

**Signals** are the actual knowledge artifacts — mental models, frameworks, practices, validated insights, promoted patterns.

The vault stores:
- signals worth keeping
- patterns and concepts
- structured knowledge artifacts
- promoted insights after review or sufficient confidence

### Domain Cartridges

A domain cartridge is the runtime projection of vault knowledge for a given role profile. When a recipe initializes, it loads the relevant cartridge — the role profile combined with matched vault signals — into STM. This is how the vault's knowledge becomes available to agents without agents searching the vault directly.

### Decision Audit Log

Chronos maintains a persistent decision audit log as part of its memory story. The log records:
- decisions made during recipe execution
- owner feedback on artifacts and classifications
- confidence scores at decision points
- source signals that informed each decision

The decision log is stored in the system of record (not in STM) and is queryable. It provides the traceability backbone required for the owner to trust the system's outputs over time.

### Logs and Artifacts

Chronos also maintains:
- capture log
- review artifacts
- session summaries

These are part of the memory story even when they are not promoted into durable knowledge.

### Product Rule

Agents reason from STM and session-grounded context, not by directly rummaging through the raw vault. The memory system must preserve grounding and traceability.

---

## 8. Core Product Behaviors

### 8.1 Capture

Capture is the lowest-friction path in the product.

Expected behavior:
- the owner dumps a thought quickly via the messaging channel
- Chronos stores the signal immediately in the signal store
- Chronos stays silent on successful capture
- Chronos only interrupts when ambiguity or risk is high enough to justify interruption

This is the post-office model:
- drop off the thought
- trust the system to process it
- do not force a conversational acknowledgment every time

### 8.2 Classify (Heartbeat — Fast Cadence)

Classification is the background process that turns raw captures into structured signals.

Expected behavior:
- runs on a fast heartbeat cadence (e.g., every 30 minutes)
- loads unclassified signals from the signal store
- loads the domain cartridge for classification context
- applies best-effort classification using radar matching
- applies confidence policy
- high-confidence classifications are stored automatically
- low-confidence classifications are surfaced for owner review via web channel
- logs audit trail for all classification decisions

This is the fast loop. It keeps the signal store from becoming a black hole.

### 8.3 Ask / Consult

Chronos should support deeper strategic work when the user asks for help thinking. In the technical approach, this maps to **Recipe 2: Consult CTO Research Pipeline**.

The vision defines five core intents: capture, retrieve, synthesize, decide, and brief. In v1, the Consult recipe handles **retrieve** and **synthesize** intents. The **decide** and **brief** intents are deferred to future versions (see §16).

Expected behavior:
- initialize session context first (load domain cartridge into STM)
- clarify when the request is underspecified
- synthesize when enough understanding exists
- remain grounded in memory and session context
- avoid generic consultancy language
- all outputs include confidence scores and source citations tracing to specific vault signals

This is where Chronos shifts from quick intake into guided reasoning.

### 8.4 Memory Promotion (Heartbeat — Long Cadence)

Memory promotion is the process that turns accumulated patterns into durable knowledge. It runs as a separate recipe on a long cadence (monthly or quarterly).

Expected behavior:
- identify stable patterns across accumulated signals in the signal store and STM
- promote validated insights to the vault (long-term memory)
- archive or discard noise that didn't gain reinforcement over time
- surface ambiguous items for owner review via web channel
- proactively surface novel connections, contradictions, and gaps across the knowledge base
- notify the owner via messaging channel when novel connections are found

Memory promotion is what turns raw accumulation into actual knowledge compounding. It is a cognition recipe, not a deterministic job.

### 8.5 Review

The owner must be able to review questionable or important items asynchronously.

Review applies to both capture-origin signals (from classification) and consult-origin artifacts:

**Capture review:**
- review low-confidence classifications surfaced by the heartbeat
- adjust confidence or reclassify
- approve or reject signals for promotion

**Consult review:**
- review research artifacts produced by the Consult recipe
- provide feedback for revision
- approve final artifacts

All review happens via the web channel. Review actions feed back into the processing loop:
- reclassified signals are re-ingested by the next heartbeat run
- revised artifacts are updated in-place with an audit trail of what changed and why
- reviewed items do not get stranded outside the processing loop

### 8.6 Session Continuity

Chronos should preserve the continuity of thinking across turns.

Examples:
- clarification loops continue in the same session
- previously loaded context remains available
- session summaries preserve what was decided or clarified

---

## 9. Response Gates

For deeper recipe-driven work, Chronos may only surface user-visible output at a valid gate.

### Valid Gates

- **Clarification**: Chronos needs specific input to proceed well.
- **Blocked**: Chronos cannot proceed because a hard condition is missing or conflicting.
- **Synthesis**: Chronos has enough understanding to deliver a meaningful result.
- **Error**: Chronos cannot recover from a failure without user involvement.

### Product Rule

Intermediate work is internal. The user should not see internal routing plans, scores, or execution chatter unless the product explicitly calls for it.

This rule protects the feel of the product. Chronos should feel deliberate, not noisy.

---

## 10. Oversight and Autonomy

Chronos is agentic, but not reckless.

### Autonomy Principle

Chronos should use the minimum autonomy required for the job.

### Levels

| Level | Meaning | Product Examples |
|------|---------|------------------|
| **L0** | Pure deterministic execution | normalization, permission checks, session bookkeeping |
| **L1** | One bounded model decision | quick classification during capture |
| **L2** | Multi-step bounded reasoning inside a recipe | clarify and synthesize a strategic query |
| **L3** | Agentic exploration inside a controlled sandbox | deeper heartbeat or multi-agent strategic work |
| **L4** | Self-directed structural proposals with owner approval | future self-improvement flows |

### Product Rule

Autonomy should scale with trust and evidence.

High-confidence routine work may proceed quietly. Ambiguous or risky work must surface for review.

---

## 11. Confidence Scoring

Every synthesis and retrieval output produced by Chronos must carry a confidence score.

### What Confidence Represents

Confidence reflects how well-grounded the output is in the owner's captured knowledge:

- **High confidence**: output is directly supported by multiple vault signals with clear relevance
- **Medium confidence**: output is supported by some signals but requires inference or interpolation
- **Low confidence**: output draws primarily on model training knowledge or thin signal coverage

### Product Rules

- Confidence scores are visible to the owner on all structured artifacts and synthesis outputs
- When training-sourced knowledge is used (not grounded in vault signals), it is explicitly labeled
- Low-confidence outputs should indicate what additional signals would increase confidence
- The decision audit log records the confidence score at each decision point

---

## 12. Product Surfaces

Chronos produces both action surfaces and reading surfaces.

### Action Surfaces

Used when the owner needs to intervene.

Examples:
- capture review (low-confidence classifications)
- clarification response page
- session actions (create, load, clear, list)

### Reading Surfaces

Used when the content deserves a better medium than inline chat.

Examples:
- strategy brief
- session summary
- decision review

### Product Rule

The web channel is not just for forms. It is also the place where richer artifacts can be comfortably read and acted upon.

---

## 13. Role Scope

Chronos is a personal AI for the owner's thinking.

The first role profile is CTO. Each role profile defines a domain cartridge: the radar configurations, signal categories, intent handlers, and output framing appropriate for that role.

Future role profiles (PM, Entrepreneur) will be added as additive cartridges on the same architecture. The CTO profile validates the core cartridge mechanism; subsequent profiles expand reach without requiring structural changes.

The role system exists so Chronos can reason in a role-grounded way without becoming a generic assistant.

---

## 14. Deferred Scope

These are deliberately outside the current product scope:

- collaborative memory sharing
- trust-tiered multi-user access
- fully online authoring of every system element
- self-modification without review
- unconstrained browsing or research behavior by default
- treating every inbound message as a free-form chat turn
- cold-start onboarding wizard ("import your thinking") — planned post-v1
- Telegram, voice, and Claude Code CLI channels — planned for progressive rollout
- decide and brief intents as standalone recipe-backed behaviors

---

## 15. Product Acceptance Scenarios

### 15.1 Rapid Capture Test

The owner captures multiple thoughts quickly from the messaging channel.

Expected result:
- Chronos stays mostly silent
- all captures are recorded in the signal store
- the next heartbeat classifies them appropriately

### 15.2 Clarification Test

The owner asks a vague strategic question.

Expected result:
- Chronos asks grounded clarification questions
- the response is specific and useful
- the final result stays in the same session context
- the output includes confidence scores and source citations

### 15.3 Review Loop Test

The owner reviews a pending item (from capture classification or consult artifact) and then the relevant recipe runs again.

Expected result:
- the review materially changes the next decision
- reviewed items do not get stranded outside the processing loop

### 15.4 Channel Selection Test

The owner asks for a richer output that is awkward inline.

Expected result:
- Chronos produces a readable web artifact
- the messaging channel receives a compact pointer to it

### 15.5 Memory Integrity Test

Chronos processes a mix of signal and noise.

Expected result:
- strong signals are preserved
- weak or low-value noise is filtered out
- the decision trail remains inspectable via the decision audit log

### 15.6 Proactive Synthesis Test

The memory promotion recipe runs on its long cadence.

Expected result:
- novel connections across signals are surfaced to the owner
- the notification arrives via messaging channel with a web link to the full synthesis
- the owner can review, confirm, or dismiss the connections

---

## 16. v1 Scope Summary

### Intents Supported

| Intent | v1 Status | Recipe |
|--------|-----------|--------|
| **Capture** | Active | Recipe 1: Capture & Classify |
| **Retrieve** | Active | Recipe 2: Consult CTO |
| **Synthesize** | Active | Recipe 2: Consult CTO |
| **Decide** | Deferred | — |
| **Brief** | Deferred | — |

### Channels Supported

| Channel | v1 Status | Role |
|---------|-----------|------|
| **Discord** | Active | Messaging input/output |
| **WhatsApp** | Deferred | Planned post-v1 |
| **Web** | Active | Review, reading, action surfaces |
| **Heartbeat** | Active | System-originated scheduled signal |
| **Telegram** | Deferred | Progressive channel rollout |
| **Voice** | Deferred | Ambient capture |
| **Claude Code CLI** | Deferred | Local client channel |

### Role Profiles

| Profile | v1 Status |
|---------|-----------|
| **CTO** | Active |
| **PM** | Deferred |
| **Entrepreneur** | Deferred |

---

## 17. Relationship to the Technical Architecture Doc

This product spec is the conceptual and behavioral source of truth.

The technical architecture doc exists to answer a different question:

> How do we implement this product faithfully, without confusing implementation machinery for the architecture itself?

Read [technical-approach.md](.meridian/product/technical-approach.md) for:
- runtime topology
- agent execution strategy
- tooling and library choices
- how the orchestration model works
- how the memory model is implemented
- how the current implementation should evolve without breaking the product
