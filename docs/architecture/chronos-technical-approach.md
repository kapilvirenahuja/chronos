# Chronos Technical Approach

> Chronos architecture comes first. Claude SDK is an implementation choice inside that architecture.

---

## 0. How to Read This Document

This document is intentionally written for someone who understands the Chronos product and architecture goals, but does **not** already understand agents, Anthropic, or agent runtimes.

Internally, this work should be understood as a **harness engineering effort**.

Externally, the product remains **Chronos**.

If you are new to this space, read it in this order:

1. Architecture first
2. What "agentic" means here
3. Where Claude SDK fits
4. Runtime topology
5. Tools, memory, and agents
6. Migration plan

The goal is not only to define the implementation. The goal is to make the implementation understandable enough that you can judge whether it is the right one.

This document is the technical companion to the product spec at [`.claude/specs/chronos-features/chronos-features.md`](/Users/kapilahuja/cto/builder/chronos/.claude/specs/chronos-features/chronos-features.md).

---

## 1. Architecture First: IDD, PKM, Phoenix, PCAM

Before talking about SDKs or workers, we need to anchor the system in the architecture that already defines Chronos.

### 1.1 IDD and PKM / Life OS

Chronos is a personal knowledge system.

That means:
- the unit of value is not "a good answer"
- the unit of value is "better thinking that compounds over time"

The product is built around:
- capturing signals
- clarifying intent
- preserving durable knowledge
- revisiting decisions
- improving judgment

This is why memory is first-class and why the product must remain grounded in the owner's knowledge system.

### 1.2 Phoenix Is the Pattern Language

Phoenix gives us the system chain:

`Signal -> Recipe -> Agent -> Skill -> Memory`

This matters because it prevents the system from collapsing into one opaque prompt.

Each part has a different job:

| Phoenix element | Why it exists |
|-----------------|---------------|
| **Signal** | Normalize incoming work before reasoning starts |
| **Recipe** | Define the contract and boundaries for a kind of work |
| **Agent** | Carry out bounded or agentic reasoning within the recipe |
| **Skill** | Expose named capabilities rather than hidden prompt behavior |
| **Memory** | Ground and preserve the work over time |

### 1.3 PCAM Is the Execution Structure

PCAM explains how Chronos runs:

| Layer | Role |
|-------|------|
| **Perception** | Receive and normalize signals |
| **Cognition** | Interpret intent, reason over context, decide what should happen |
| **Agency** | Use tools and take controlled actions |
| **Manifestation** | Persist, render, and retrieve memory and artifacts |

This is the architecture. It is not optional. It is not replaced by any vendor SDK.

### 1.4 The Most Important Rule

Chronos is **not** "an Anthropic app."

Chronos is a PKM system shaped by Phoenix and PCAM.

Anthropic tooling is one way to implement some of the reasoning and agent runtime behavior inside that architecture.

---

## 2. Glossary

These terms are easy to blur together. We should be precise.

| Term | Meaning in plain language |
|------|----------------------------|
| **Model call** | A single request to Claude that returns an answer |
| **Workflow** | A mostly fixed series of steps controlled by code |
| **Agent** | A reasoning actor that can choose actions within bounded constraints |
| **Tool** | A capability the agent can call, such as reading STM or issuing a review page |
| **MCP** | A standard way to expose tools and resources to an agent runtime |
| **STM** | Short-term memory for the active session or run |
| **LTM** | Long-term memory for durable knowledge |
| **Response gate** | The conditions under which Chronos is allowed to surface output |
| **One-shot flow** | One bounded model call plus deterministic code around it |
| **Agentic flow** | A longer reasoning loop with tools, decisions, and possibly delegated specialist agents |

Chronos should use **agent** as the default term.

If one agent delegates work to another, that is still an agent pattern. We do not need to make `subagent` a core architectural concept unless the implementation truly depends on that distinction.

---

## 3. What "Agentic" Means in Chronos

People use the word "agent" very loosely. In practice, three different things are often mixed together.

### 3.1 A Normal Model Call

This is the simplest case:

1. send prompt
2. get response
3. continue in code

This is useful when the task is small and bounded:
- classify a capture
- score confidence
- draft one short artifact

### 3.2 A Tool Loop

This is the next step up:

1. ask the model what to do
2. the model requests a tool
3. code executes the tool
4. code gives the result back to the model
5. repeat until done

This is more agentic because the model is no longer just returning text. It is participating in a loop with the environment.

### 3.3 A True Agent Runtime

This is a fuller system where the model can operate as an agent with:
- tools
- permissions
- hooks
- sessions
- possibly delegated specialist agents
- bounded autonomy

This is the right mental model for deeper Chronos flows like:
- `/ask`
- clarification loops
- multi-step strategy work
- parts of heartbeat that require real judgment

### 3.4 What Chronos Is Not

Chronos is not:
- a single prompt with a persona
- a bag of autonomous agents wandering around without structure
- a workflow engine pretending to be agentic

Chronos should be a hybrid system:
- code controls structure, safety, persistence, and gates
- model-driven agents handle judgment where judgment is actually needed

---

## 4. Anthropic: What It Gives Us vs What We Must Build

This is the section that usually creates confusion.

### 4.1 The Plain Anthropic SDK

Anthropic's regular SDK is for model calls.

It is good for:
- one-shot requests
- classification
- confidence scoring
- bounded content generation

If we use only this SDK, then **we** must build:
- the execution loop
- the tool orchestration
- the session model
- agent delegation patterns
- permissions and hook behavior

### 4.2 The Claude Agent Runtime / SDK Layer

Anthropic also provides an agent-style runtime model around Claude tooling.

This is the layer we want for deeper Chronos work because it gives us a better substrate for:
- tool use
- agent delegation when needed
- hooks
- permission policies
- session-oriented runs

That does **not** mean we hand Chronos over to Anthropic. It means we use the runtime as a lower-level execution substrate inside Cognition and Agency.

### 4.3 Side-by-Side Comparison

| Approach | What it feels like | Strength | Weakness |
|---------|---------------------|----------|----------|
| **Messages API only** | "Call Claude and get text back" | Simple, fast, cheap | Not enough for real agent loops unless we build the rest |
| **Chronos current implementation** | "Hardcoded workflow with occasional Claude calls" | Works for bounded paths, easy to reason about | Not truly agentic; markdown agents are mostly metadata |
| **Chronos target implementation** | "PCAM/Phoenix engine with agent runtime where needed" | Preserves product architecture and enables real agent behavior | More moving parts; requires a worker runtime and tool contracts |

### 4.4 The Key Design Decision

We should not use the agent runtime everywhere.

That would add cost and complexity where it buys us nothing.

Instead:
- use bounded model calls for L1 paths such as capture classification
- use the agent runtime for Level 2+ flows where tool loops and subagent reasoning are actually valuable

That is both cheaper and more faithful to the product.

---

## 5. Where Claude SDK Fits Inside PCAM

This is the most important framing in the whole document.

Claude SDK is **not** the system. It is one implementation layer inside the system.

### 5.1 PCAM Mapping

| Component | PCAM layer | Execution type | Claude SDK involved? | Why |
|-----------|------------|----------------|----------------------|-----|
| Discord/web/Claude Code ingress | Perception | Deterministic code | No | Normalize signals and enforce trust fast |
| Session resolution and signal normalization | Perception | Deterministic code | No | This is structure, not judgment |
| Step 0 STM initialization | Perception -> Manifestation | Deterministic code | No | Load state and relevant context before reasoning |
| Recipe selection and intent gate | Cognition | Deterministic code + bounded inference | Sometimes | Recipe availability is code; intent identification may use a model |
| `/capture` quick classification | Cognition | Bounded model use | Usually not agent runtime | One-shot is sufficient |
| `/ask` orchestration | Cognition | Agent runtime | Yes | Needs clarification, synthesis, tool use, and possible delegated agents |
| Memory-grounded analysis | Cognition | Agent runtime or bounded inference | Yes for deeper flows | This is where real reasoning happens |
| Sending Discord follow-up | Agency | Deterministic code | No | Delivery is a controlled external action |
| Issuing signed web pages | Agency | Deterministic code | No | Render/issue is controlled output, not model reasoning |
| Tool use during deeper reasoning | Agency | Agent runtime | Yes | Agent requests capabilities; code enforces them |
| STM writes, decision logs, review artifacts | Manifestation | Deterministic code | No | Persistence is not a judgment task |
| Heartbeat promotion logic | Manifestation + Cognition | Hybrid | Sometimes | Deterministic thresholds plus judgment-heavy review when needed |

### 5.2 Practical Interpretation

If a component is fundamentally about:
- permissions
- persistence
- normalization
- state transitions
- delivery guarantees

then Chronos code owns it.

If a component is fundamentally about:
- asking the right clarifying question
- deciding how to decompose a strategic problem
- synthesizing a brief from context
- exploring a line of thought with tools

then a model or agent runtime may own that piece.

That is the boundary.

### 5.3 Architecture Drift We Must Avoid

The technical design must not drift into any of these traps:

1. **Calling the system "an Anthropic app"**
   - Wrong because it hides the PKM and PCAM architecture.

2. **Treating PCAM as a thin wrapper around vendor primitives**
   - Wrong because PCAM should remain the design language.

3. **Treating agents as free-floating entities**
   - Wrong because Chronos agents are meaningful only in relation to recipes, skills, and memory grounding.

---

## 6. Chronos Concepts vs Implementation Mechanisms

This table is the bridge between architecture and engineering.

| Chronos concept | Architectural role | Implementation mechanism | Example |
|-----------------|-------------------|--------------------------|---------|
| `Signal` | Perception contract | Next/Vercel route + normalization code | `/api/discord` verifies request and produces normalized input |
| `Recipe` | Structured behavior contract | Markdown + interpreter code | `consult-cto` defines response gates and allowed intents |
| `Agent` | Bounded or agentic reasoning actor | Claude subagent or bounded model call | `strategy-guardian` handles strategic clarification |
| `Skill` | Executable capability unit | Tool, MCP endpoint, or deterministic function | `search_memory`, `read_stm`, `issue_signed_page` |
| `Memory` | Manifestation substrate | STM store + search index + source-of-truth memory store | session state, promoted signals, review logs |

This is the right way to think about implementation.

Not:
- "Claude SDK replaces agents"
- "subagents replace recipes"
- "tools replace skills"

But:
- "Claude SDK helps execute some agents"
- "tools are one runtime form for skills"
- "recipes still govern behavior"

---

## 7. The Current Implementation: What It Gets Right and What It Gets Wrong

### 7.1 What It Gets Right

The current code already preserves some important Chronos instincts:

- capture is quiet by default
- heartbeat exists as a distinct asynchronous process
- review surfaces exist
- STM exists as an explicit concept
- recipe, agent, and skill files exist in authored markdown
- confidence and content quality are treated as separate concerns

### 7.2 The Current Anti-Pattern

The main problem is that markdown agent files are mostly being treated as metadata while the real logic lives in TypeScript functions and switches.

That creates a gap:
- the docs say "agentic"
- the runtime behaves more like a structured workflow with model calls sprinkled in

In other words:
- the product language is richer than the execution model

### 7.3 Why This Matters

That gap causes confusion in three places:

1. **Product understanding**
   - It sounds like agents are doing the work when local code is actually doing most of it.

2. **Authoring**
   - Changing markdown does not reliably change runtime behavior in a first-class way.

3. **Future evolution**
   - As soon as we want deeper agentic behavior, the current workflow shape becomes the ceiling.

---

## 8. Runtime Topology in Plain English

The easiest way to understand the target runtime is to imagine two parts of the system.

### 8.1 Part One: The Fast Front Door

This part should be responsible for:
- receiving Discord requests
- receiving Claude Code or web signals
- validating them
- normalizing them
- acknowledging them quickly
- serving signed review and reading pages

This is the **Perception/Manifestation edge service**.

It should stay fast and predictable.

### 8.2 Part Two: The Thinking Engine

This part should be responsible for:
- loading session context
- running deeper recipe flows
- invoking subagents
- using tools
- generating strategic artifacts
- queuing further actions

This is the **Cognition/Agency worker service**.

It should be allowed to run longer and think more deeply than a request-response edge function.

### 8.3 Why Split Them

Without this split, we get one of two bad outcomes:

1. edge requests become too heavy and brittle
2. we fake agent behavior by collapsing it back into hardcoded workflows

The split is not infrastructure theater. It exists to preserve PCAM more faithfully:

- Perception stays fast
- Cognition gets room to reason
- Agency gets controlled tool execution
- Manifestation persists outputs and artifacts cleanly

---

## 9. Runtime Topology in System Terms

### 9.1 Edge Service

The edge service should handle:
- Discord ingress
- web actions
- Claude Code ingress
- signed page rendering
- lightweight health/admin routes

Practical deployment target:
- Next.js on Vercel or equivalent

### 9.2 Queue

The queue is the handoff between fast input and deeper execution.

It should carry:
- normalized signal
- session id
- recipe id
- execution pattern
- retry metadata

Why it exists:
- ingress should not block on deep reasoning
- Discord needs fast acknowledgments
- retries and idempotency become manageable

### 9.3 Worker Service

The worker should handle:
- agentic execution
- tool loops
- subagent invocation
- heartbeat batches
- structured artifact generation

Practical deployment target:
- a long-lived Node worker service

### 9.4 Persistence Layer

Chronos needs persistence for:
- STM state
- capture log
- decision log
- review artifacts
- queued outputs

This remains part of Manifestation even when used by Cognition.

### 9.5 Search and Source-of-Truth Memory

Chronos should preserve the split between:
- a fast search layer for retrieval
- a durable source-of-truth memory layer

This lets Cognition retrieve context quickly while keeping durable knowledge in its native long-term home.

---

## 10. Walkthroughs: What Happens Next

These examples matter because they make the architecture concrete.

### 10.1 `/capture`

What happens next:

1. Discord sends a request to the edge service.
2. The edge service verifies the request and normalizes it into a `Signal`.
3. Perception resolves author and session.
4. Cognition uses a bounded path:
   - classify quickly
   - attach a confidence estimate
   - decide whether it can remain quiet
5. Manifestation writes the capture and the decision trail.
6. If confidence is healthy and nothing is ambiguous, no user response is sent.
7. Heartbeat processes it later.

Why this should **not** use the full agent runtime:
- it is latency-sensitive
- it is structurally simple
- it does not require iterative tool use

### 10.2 `/ask`

What happens next:

1. A normalized `Signal` enters through Discord, web, or Claude Code.
2. Perception resolves trust, session, and recipe.
3. Step 0 initializes STM and loads relevant context.
4. The worker runs the recipe inside Cognition.
5. A Chronos agent such as `strategy-guardian` operates through the agent runtime.
6. The agent can use allowed tools:
   - read STM
   - search memory
   - write STM outputs
   - issue a clarification page
7. If the request is vague, the flow reaches the **clarification gate** and surfaces only what the user needs to answer.
8. If enough understanding exists, the flow reaches the **synthesis gate** and produces a brief.
9. Manifestation stores the session state, artifacts, and decision trail.

Why this **should** use the agent runtime:
- the path is iterative
- clarification can loop
- subagents may become useful
- tools are needed for grounded reasoning

### 10.3 Heartbeat

What happens next:

1. A scheduled signal triggers heartbeat.
2. Manifestation selects pending captures.
3. Deterministic rules handle easy cases first:
   - obvious noise
   - obvious duplicates
   - threshold-based reject or promote
4. Cognition escalates only the harder cases to deeper reasoning.
5. When needed, an agentic run:
   - reclassifies
   - compares to related memory
   - decides whether to promote, hold, or surface for review
6. Agency may queue owner-facing review artifacts or notifications.
7. Manifestation writes the final state.

Why heartbeat is hybrid:
- much of the work is mechanical
- only a subset truly needs agentic judgment

---

## 11. Tools, Skills, Memory, and Agents

This is where people often assume "tool" and "skill" are the same thing. They are related, but not identical.

### 11.1 Skill vs Tool

In Chronos:
- a **skill** is an architectural capability unit
- a **tool** is one runtime mechanism for exposing that capability to an agent

Examples:

| Skill idea | Runtime form |
|-----------|--------------|
| read STM context | tool or deterministic function |
| search long-term memory | tool or MCP resource |
| issue signed review page | tool, but controlled by Chronos code |
| write decision log | usually deterministic code, sometimes exposed as a narrow tool |

### 11.2 Recommended Tool Surface

The agent runtime should get a narrow, explicit set of Chronos-native tools:

- `search_memory`
- `read_stm`
- `write_stm`
- `append_session_history`
- `write_decision_log`
- `issue_signed_page`
- `queue_notification`
- `record_review_action`

The point is not to give the agent "everything." The point is to expose the minimum set needed for good work.

### 11.3 Agents and Delegation

Chronos should be understandable in terms of agents first.

That means the base architectural unit is:
- `orchestrator`
- `strategy-guardian`
- `advisor`

If an implementation later allows one agent to delegate to another, that should be treated as a runtime convenience, not as a new architectural layer.

Agent delegation is only justified when:
- the delegated agent has a truly distinct role
- the delegated agent needs a narrower context or tool set
- delegation improves quality more than it adds complexity

### 11.4 Memory Grounding Rule

Agentic execution does **not** weaken the memory rule.

The rule remains:
- Chronos agents reason from session-grounded context
- memory access is mediated
- durable memory is not treated as an unbounded dumping ground

That is how the PKM architecture survives the move to a stronger agent runtime.

---

## 12. Why This Fits Chronos Better Than the Current Implementation

### 12.1 It Preserves the Product Feel

The redesign keeps:
- silent capture
- asynchronous heartbeat
- topic sessions
- review surfaces
- autonomous channel selection

These remain product behavior, not runtime accidents.

### 12.2 It Makes Agents Real Without Making Them Unbounded

Today, agents are mostly declarative wrappers around hardcoded logic.

The target design makes them operationally meaningful:
- they can use tools
- they can operate in sessions
- they can delegate
- they can still be constrained by recipes, gates, and memory rules

### 12.3 It Respects PCAM

The split runtime is not a departure from PCAM.

It is a more faithful implementation of PCAM:
- fast Perception at the edge
- deeper Cognition in the worker
- controlled Agency through tools and output actions
- strong Manifestation through explicit persistence and surfaces

### 12.4 It Keeps Simple Things Simple

A common mistake in agentic systems is to turn every task into a full agent loop.

Chronos should not do that.

Capture is still capture.
Heartbeat is still mostly batch processing.
Only the deeper reasoning paths should pay the full complexity cost.

---

## 13. Libraries, Packages, and Deployment Choices

This section is intentionally last because implementation details should make sense only after the architecture does.

### 13.1 Libraries We Already Use

| Library | Why it exists now |
|---------|-------------------|
| `@anthropic-ai/sdk` | Bounded model calls for classification and generation |
| `next` / `react` | Web and API surfaces |
| `pg` | Postgres persistence |
| `zod` | Validation and runtime contract enforcement |
| `yaml` | Config parsing |

### 13.2 Libraries We Intend to Add

| Library or runtime | Purpose in Chronos |
|--------------------|--------------------|
| Claude agent runtime SDK | Execute deeper agentic flows with tools, hooks, and subagents |
| Queue library or managed queue | Decouple ingress from long-running work |
| MCP-compatible tool layer | Expose Chronos tools to agents in a structured way |

### 13.3 Practical Runtime Choice

Recommended target:
- **Edge**: Next.js / Vercel
- **Worker**: long-lived Node service
- **Persistence**: Postgres for session and audit state
- **Retrieval layer**: semantic search/index layer
- **Durable memory source**: native source-of-truth store

### 13.4 Why Not Keep Everything Vercel-Only

Vercel-only is attractive because it is operationally simple.

But for deeper agentic flows it creates pressure to:
- compress reasoning into request timeouts
- avoid proper tool loops
- fake subagent behavior in code

That would preserve convenience at the cost of architectural truth.

### 13.5 Why Not Use the Agent Runtime for Everything

Because that would:
- increase latency
- increase cost
- complicate debugging
- add no value to simple bounded tasks

Chronos should be agentic-first in **capability**, not agentic-everywhere in **implementation**.

---

## 14. Migration From the Current Implementation

This migration should happen in layers, not as a big bang.

### 14.1 Stage 1: Clean the Specs

- Keep the product spec product-only
- add this technical architecture doc
- align terminology across product and code

### 14.2 Stage 2: Introduce the Runtime Split

- keep the current edge surfaces
- add queue and worker boundaries
- route deeper work through the queue first, even before the full agent runtime lands

### 14.3 Stage 3: Move `/ask` to the Agent Runtime

- preserve Step 0 as deterministic Chronos logic
- preserve recipe gating and response gates
- move iterative reasoning and subagent execution into the worker runtime

### 14.4 Stage 4: Move Judgment-Heavy Heartbeat Paths

- keep deterministic reject/promote gates in code
- use deeper agentic review only where needed
- ensure review actions re-enter the same processing loop

### 14.5 Stage 5: Rationalize Markdown and Runtime

- make recipe markdown operationally meaningful
- make agent markdown operationally meaningful
- stop relying on metadata-only parsing where runtime logic lives elsewhere

---

## 15. What Must Stay True After the Migration

If the implementation is correct, these statements should remain true:

1. You can explain Chronos without mentioning Anthropic in the first sentence.
2. You can trace every major runtime component back to a PCAM layer.
3. You can trace every use of Claude tooling back to a Chronos concept.
4. Capture remains quiet and low-friction.
5. `/ask` becomes more genuinely agentic without becoming structurally sloppy.
6. Memory remains a grounding system, not an afterthought.
7. Recipes still define what is allowed.
8. Agents still operate under constraints.
9. Skills remain explicit capability units.
10. The system still feels like Chronos rather than a framework demo.

---

## 16. Decision Checklist for Future Changes

Any future runtime proposal should answer these questions before it is accepted:

1. Which PCAM layer owns this component?
2. Is this deterministic code, bounded model use, or agent runtime?
3. Which Chronos concept does it implement?
4. Does it preserve `Signal -> Recipe -> Agent -> Skill -> Memory`?
5. Does it strengthen or weaken memory grounding?
6. Does it protect the product feel or introduce implementation leakage?
7. Is the added complexity justified by a real product gain?

If a proposal cannot answer those questions clearly, it probably does not belong in Chronos.
