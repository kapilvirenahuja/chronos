# Chronos Implementation Task List

> Dependency-ordered task list for Codex to implement the Chronos redesign end to end.

---

## 1. How to Use This List

Rules for execution:

1. Read the product spec first.
2. Read the technical approach second.
3. Read the low-level design third.
4. Implement tasks in dependency order.
5. After each major slice:
   - run tests
   - review implementation vs spec/design
   - fix gaps before moving on

This list is intentionally written for iterative implementation loops.

---

## 2. Phase 0: Spec and Design Baseline

### T0.1 Align all docs

**Goal**
- Make product spec, technical approach, low-level design, evals, and task list internally consistent.

**Depends on**
- none

**Done when**
- terminology is consistent
- Chronos is described as the product
- harness engineering is described as the implementation effort
- PCAM and Phoenix remain the dominant design language

### T0.2 Create a gap checklist from the current implementation

**Goal**
- Turn the current codebase gaps into an explicit checklist.

**Depends on**
- T0.1

**Done when**
- every major gap is mapped to one later task in this file

---

## 3. Phase 1: Runtime Foundations

### T1.1 Introduce canonical signal normalization

**Goal**
- All ingress paths produce the same `SignalEnvelope`.

**Depends on**
- T0.2

**Main work**
- create shared signal-envelope types
- normalize Discord, web, Claude Code, heartbeat, and session commands into that shape
- remove ad hoc route-specific shape drift

**Done when**
- edge code does not feed Cognition directly with route-specific payloads

### T1.2 Add execution run persistence

**Goal**
- Introduce `ExecutionRun` and persist it through the store abstraction.

**Depends on**
- T1.1

**Main work**
- extend store interfaces
- add storage support for queued/running/completed runs
- keep existing captures/sessions/decisions intact

**Done when**
- every deeper request has a persisted run record

### T1.3 Add signal persistence and run audit primitives

**Goal**
- Persist signals, runs, and basic audit records.

**Depends on**
- T1.2

**Main work**
- add signal store
- add agent invocation store
- add tool call store
- define idempotency boundaries

**Done when**
- a single run can be reconstructed from stored records

---

## 4. Phase 2: Edge and Queue Split

### T2.1 Introduce a queue boundary

**Goal**
- Separate fast ingress from deeper execution.

**Depends on**
- T1.3

**Main work**
- add queue abstraction
- add enqueue/dequeue semantics
- add retry metadata

**Done when**
- edge can hand off work without executing the full cognition path inline

### T2.2 Move `/ask` to enqueue + worker

**Goal**
- `/ask` becomes the first full queue-backed path.

**Depends on**
- T2.1

**Main work**
- edge creates run and acknowledges
- worker consumes queued `/ask` runs
- maintain current product behavior

**Done when**
- `/ask` no longer depends on synchronous route execution

### T2.3 Fix Discord interaction flow for queued work

**Goal**
- Make Discord interaction handling production-correct.

**Depends on**
- T2.2

**Main work**
- proper defer/ack flow
- follow-up delivery for completed queued work
- no invalid inline protocol behavior

**Done when**
- Discord works cleanly even when work happens asynchronously

---

## 5. Phase 3: Step 0 and Recipe Runtime

### T3.1 Formalize Step 0 as a runtime boundary

**Goal**
- STM initialization happens as an explicit pre-agent phase.

**Depends on**
- T2.2

**Main work**
- extract STM initialization into dedicated runtime code
- persist Step 0 completion in run state

**Done when**
- no Level 2+ run can skip STM initialization

### T3.2 Formalize recipe loading and intent gate enforcement

**Goal**
- Recipes become real runtime contracts rather than loose reference material.

**Depends on**
- T3.1

**Main work**
- centralize recipe loading
- centralize active/planned intent gate checks
- prevent execution of inactive intents

**Done when**
- no Level 2+ agent path can bypass recipe constraints

### T3.3 Formalize response gate enforcement

**Goal**
- Clarification, blocked, synthesis, and error become explicit runtime states.

**Depends on**
- T3.2

**Main work**
- store gate state on runs
- ensure no intermediate chatter leaks to user channels

**Done when**
- user-visible output is emitted only at valid gates

---

## 6. Phase 4: Agent Runtime and Tool Surface

### T4.1 Add an explicit agent runtime boundary

**Goal**
- Replace direct hardcoded skill chaining with an agent runtime abstraction.

**Depends on**
- T3.3

**Main work**
- create a runtime module that executes named Chronos agents
- keep a local fallback path while migrating
- record agent invocations

**Done when**
- `/ask` and later heartbeat paths call an agent runtime boundary, not direct route-local logic

### T4.2 Convert skill capabilities into explicit tools

**Goal**
- Make capabilities auditable and expose them through a tool surface.

**Depends on**
- T4.1

**Main work**
- define tool registry
- expose `read_stm`, `write_stm`, `search_memory`, `issue_signed_page`, and other required tools
- keep storage internals hidden from the agent layer

**Done when**
- agent capabilities are explicit, named, and auditable

### T4.3 Wire Claude agent runtime for Level 2+ flows

**Goal**
- Use the real Claude agent runtime for deeper reasoning flows.

**Depends on**
- T4.2

**Main work**
- integrate SDK/runtime
- bind Chronos agent names to runtime execution
- enforce permissions and hooks

**Done when**
- `/ask` can run through the agent runtime with Chronos-native tools

### T4.4 Keep bounded paths on the regular Anthropic SDK

**Goal**
- Prevent over-engineering of simple paths.

**Depends on**
- T4.3

**Main work**
- preserve capture classification and similar bounded tasks as one-shot flows
- keep model selection configurable by environment

**Done when**
- simple paths stay simple and cheap

---

## 7. Phase 5: Heartbeat and Review Loop

### T5.1 Move heartbeat onto the run model

**Goal**
- Heartbeat should be a first-class run, not a standalone ad hoc batch.

**Depends on**
- T2.1

**Main work**
- represent heartbeat invocations as runs
- persist run and decision state consistently

**Done when**
- heartbeat is inspectable using the same run primitives as `/ask`

### T5.2 Preserve deterministic decision ladder

**Goal**
- Keep obvious heartbeat decisions in code.

**Depends on**
- T5.1

**Main work**
- preserve thresholds
- preserve low-confidence rejection
- preserve auto-promotion path

**Done when**
- heartbeat remains mostly deterministic where it should be

### T5.3 Escalate only hard heartbeat cases into deeper reasoning

**Goal**
- Use agent runtime only for ambiguous review-grade cases.

**Depends on**
- T5.2

**Main work**
- add escalation criteria
- invoke deeper reasoning only when useful

**Done when**
- heartbeat is hybrid, not fully agentic by default

### T5.4 Rework review actions into first-class signals

**Goal**
- Reviews re-enter the same processing loop as other work.

**Depends on**
- T1.1

**Main work**
- normalize review actions into signals
- create runs when needed
- avoid direct out-of-band mutation paths

**Done when**
- review is no longer a side-channel that can strand items

---

## 8. Phase 6: Artifacts, Web Surfaces, and Notifications

### T6.1 Add first-class artifact records

**Goal**
- Treat briefs, review pages, and summaries as explicit outputs.

**Depends on**
- T1.3

**Main work**
- persist artifact metadata
- map runs to artifacts
- unify signed page issuance

**Done when**
- artifacts are not only route-local page payloads

### T6.2 Separate reading surfaces from action surfaces cleanly

**Goal**
- Preserve the product UX model in implementation.

**Depends on**
- T6.1

**Main work**
- define artifact types
- keep appropriate actions per artifact
- maintain signed access and TTL handling

**Done when**
- channel behavior matches the product spec

### T6.3 Complete notification scheduling and dispatch

**Goal**
- Make due review prompts reliable.

**Depends on**
- T5.1

**Main work**
- preserve queue semantics
- preserve quiet hours / delivery windows
- ensure Discord delivery remains controlled

**Done when**
- owner review notifications are reliable and auditable

---

## 9. Phase 7: Evals and Regression Hardening

### T7.1 Convert eval document into executable tests where possible

**Goal**
- Move core scenarios into automated regression coverage.

**Depends on**
- T4.4
- T5.4
- T6.2

**Main work**
- add run-model tests
- add Discord interaction correctness tests
- add artifact store tests
- add tool audit tests

**Done when**
- high-risk runtime changes are covered

### T7.2 Add manual release checklist

**Goal**
- Ensure preview/prod testing remains disciplined.

**Depends on**
- T7.1

**Main work**
- codify Discord, web, and heartbeat scenarios from the eval doc

**Done when**
- release testing is repeatable

---

## 10. Continuous Implementation Loop

After each completed task cluster, Codex should run this loop:

1. Read the relevant spec and design sections again.
2. Review the implementation that now exists.
3. Identify remaining gaps or regressions.
4. Fix the gaps.
5. Re-run tests and build.
6. Repeat before moving to the next phase.

This is not optional. It is the operating rule for implementation.

---

## 11. Immediate Next Tasks

If implementation resumes now, Codex should do these next:

1. T0.2 Create the explicit gap checklist from the current runtime.
2. T1.1 Introduce canonical signal normalization.
3. T1.2 Add execution run persistence.
4. T2.1 Introduce the queue boundary.
5. T2.2 Move `/ask` behind enqueue + worker.
