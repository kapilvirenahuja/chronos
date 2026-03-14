# Chronos Product Specification (v3.1.0)

> Product specification for Chronos - a personal knowledge and judgment harness built on IDD, Phoenix, and PCAM

---

## Document Context

**Product**: Chronos  
**Purpose**: Personal AI and knowledge work harness  
**Philosophical frame**: IDD / Life OS  
**Execution architecture**: Phoenix + PCAM  
**Version**: 3.1.0  
**Last Updated**: 2026-03-13  
**Status**: Active product specification

This document defines what Chronos is, how it behaves for the user, and which architectural principles are non-negotiable.

Implementation choices, runtime topology, libraries, deployment patterns, and vendor decisions are intentionally moved out of this document. Those live in [docs/architecture/chronos-technical-approach.md](/Users/kapilahuja/cto/builder/chronos/docs/architecture/chronos-technical-approach.md).

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
| **Signal** | A normalized piece of incoming work from Discord, web, Claude Code, heartbeat, or another channel |
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
- a Discord slash command
- a web review action
- a Claude Code request for context
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
- sending a Discord response
- generating a signed web page
- writing to a source-of-truth memory system
- queuing a notification
- invoking controlled tools during a deeper reasoning flow

### Manifestation

Manifestation is how Chronos preserves and reveals what happened.

Examples:
- STM session state
- long-term signal library
- decision audit log
- review surfaces
- session summaries
- promoted memory artifacts

---

## 5. Channels

Chronos is channel-agnostic at input and adaptive at output.

### Input Channels

- **Discord**: fast capture, direct commands, strategic interaction from anywhere
- **Web**: review surfaces, reading surfaces, actions on artifacts
- **Claude Code**: local client channel for Chronos-aware context operations
- **Heartbeat**: scheduled system-originated signal

### Output Principle

The user does not decide the response channel by default. Chronos does.

Chronos should choose the channel based on:
- task shape
- complexity of the response
- need for action or review
- need for reading comfort
- urgency and interruption cost

### Product Rule

A short confirmation or small clarification can stay inline.

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

One Discord channel can host many sessions because the session is a conceptual workspace, not a transport primitive.

### Short-Term Memory

STM is the active workspace for ongoing work.

It should contain:
- current state
- relevant loaded context
- active intents
- intermediate artifacts
- the current clarification or decision state

### Long-Term Memory

Long-term memory is the durable knowledge layer.

It stores:
- signals worth keeping
- patterns and concepts
- structured knowledge artifacts
- promoted insights after review or sufficient confidence

### Logs and Artifacts

Chronos also maintains:
- capture log
- decision log
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
- the owner dumps a thought quickly
- Chronos logs it reliably
- Chronos applies best-effort classification
- Chronos stays silent on successful capture
- Chronos only interrupts when ambiguity or risk is high enough to justify interruption

This is the post-office model:
- drop off the thought
- trust the system to process it
- do not force a conversational acknowledgment every time

### 8.2 Ask / Consult

Chronos should support deeper strategic work when the user asks for help thinking.

Expected behavior:
- initialize session context first
- clarify when the request is underspecified
- synthesize when enough understanding exists
- remain grounded in memory and session context
- avoid generic consultancy language

This is where Chronos shifts from quick intake into guided reasoning.

### 8.3 Heartbeat

Heartbeat is the product mechanism that keeps capture useful over time.

Expected behavior:
- process pending captures asynchronously
- reject obvious noise
- promote strong signals
- surface ambiguous or contested items for owner review
- update the durable memory layer and decision trail

Heartbeat is what turns raw accumulation into actual knowledge maintenance.

### 8.4 Review

The owner must be able to review questionable or important items asynchronously.

Examples:
- adjust confidence
- disagree with classification
- ask heartbeat to verify something
- approve an item for reprocessing or promotion

Review must feed back into the same product loop. It cannot be a dead-end annotation surface.

### 8.5 Session Continuity

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

## 11. Product Surfaces

Chronos produces both action surfaces and reading surfaces.

### Action Surfaces

Used when the owner needs to intervene.

Examples:
- capture review
- clarification response page
- session actions

### Reading Surfaces

Used when the content deserves a better medium than inline chat.

Examples:
- strategy brief
- session summary
- decision review

### Product Rule

The web channel is not just for forms. It is also the place where richer artifacts can be comfortably read and acted upon.

---

## 12. Role Scope

Chronos is a personal AI for the owner's thinking.

The first role profile is CTO, but the product direction allows other role profiles over time.

Examples of future role profiles:
- PM
- Entrepreneur

The role system exists so Chronos can reason in a role-grounded way without becoming a generic assistant.

---

## 13. Deferred Scope

These are deliberately outside the current product scope:

- collaborative memory sharing
- trust-tiered multi-user access
- fully online authoring of every system element
- self-modification without review
- unconstrained browsing or research behavior by default
- treating every inbound message as a free-form chat turn

---

## 14. Product Acceptance Scenarios

### 14.1 Rapid Capture Test

The owner captures multiple thoughts quickly from Discord.

Expected result:
- Chronos stays mostly silent
- all captures are recorded
- heartbeat later processes them appropriately

### 14.2 Clarification Test

The owner asks a vague strategic question.

Expected result:
- Chronos asks grounded clarification questions
- the response is specific and useful
- the final result stays in the same session context

### 14.3 Review Loop Test

The owner reviews a pending item and then heartbeat runs again.

Expected result:
- the review materially changes the next decision
- reviewed items do not get stranded outside the processing loop

### 14.4 Channel Selection Test

The owner asks for a richer output that is awkward inline.

Expected result:
- Chronos produces a readable web artifact
- Discord or Claude Code receives a compact pointer to it

### 14.5 Memory Integrity Test

Chronos processes a mix of signal and noise.

Expected result:
- strong signals are preserved
- weak or low-value noise is filtered out
- the decision trail remains inspectable

---

## 15. Relationship to the Technical Architecture Doc

This product spec is the conceptual and behavioral source of truth.

The technical architecture doc exists to answer a different question:

> How do we implement this product faithfully, without confusing implementation machinery for the architecture itself?

Read [docs/architecture/chronos-technical-approach.md](/Users/kapilahuja/cto/builder/chronos/docs/architecture/chronos-technical-approach.md) for:
- runtime topology
- agent execution strategy
- tooling and library choices
- queue and worker model
- how Claude SDK fits inside PCAM and Phoenix
- how the current implementation should evolve without breaking the product
