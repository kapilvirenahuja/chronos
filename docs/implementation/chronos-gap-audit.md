# Chronos Gap Audit

> Current implementation audit against the product spec, technical approach, and low-level design.

---

## 1. Purpose

This document records the concrete gaps between:
- the current implementation
- the current product spec
- the current technical design

It should be updated as implementation progresses.

---

## 2. Resolved in This Pass

### G-001 Spec split completed

Status: resolved

- Product behavior and architectural truth now live in [`.claude/specs/chronos-features/chronos-features.md`](/Users/kapilahuja/cto/builder/chronos/.claude/specs/chronos-features/chronos-features.md)
- Technical explanation now lives in [chronos-technical-approach.md](/Users/kapilahuja/cto/builder/chronos/docs/architecture/chronos-technical-approach.md)

### G-002 Missing engineering docs

Status: resolved

Added:
- [chronos-low-level-design.md](/Users/kapilahuja/cto/builder/chronos/docs/architecture/chronos-low-level-design.md)
- [chronos-evals-and-scenarios.md](/Users/kapilahuja/cto/builder/chronos/docs/evals/chronos-evals-and-scenarios.md)
- [chronos-implementation-task-list.md](/Users/kapilahuja/cto/builder/chronos/docs/implementation/chronos-implementation-task-list.md)

### G-003 `/ask` bypassed the shared signal normalization path

Status: partially resolved

What changed:
- `/ask` now normalizes into the shared signal envelope and goes through `processSignal()`
- HTTP ingress can now choose `dispatch` vs `enqueue` mode through the shared signal submission path

Remaining gap:
- deeper work is still executed inline rather than through a run queue / worker model

### G-004 STM workspace collisions under concurrent ask flows

Status: resolved

What changed:
- STM workspace ids are now unique per run and no longer collide at second-level timestamp granularity

### G-005 No persisted signal or run model

Status: partially resolved

What changed:
- `SignalEnvelope` is now persisted through the store layer
- `ExecutionRun` records now exist and track queued, running, awaiting-user, completed, and failed states
- queued runs can now be dispatched through `/api/runs/dispatch`
- `/api/signal` and `/api/heartbeat` can now stop at enqueue and return a queued receipt instead of forcing inline execution

Remaining gap:
- the queue and worker are still in-process abstractions, not a separately deployed runtime

### G-006 No explicit agent runtime boundary

Status: partially resolved

What changed:
- `/ask` now runs through an explicit agent runtime wrapper
- agent invocation records are persisted for `phoenix:strategy-guardian`
- the ask flow now records tool calls for routing, skill execution, decision logging, and signed page issuance

Remaining gap:
- this still wraps the current local strategy-guardian implementation
- there is not yet a full external Claude agent runtime integration

### G-007 No artifact or tool-call audit model

Status: resolved in part

What changed:
- tool call records now exist across ask, capture, heartbeat, and review actions
- signed page artifacts are now persisted as first-class artifact records

Remaining gap:
- the audit surface is still Chronos-local; it is not yet backed by a full external agent runtime hook model

---

## 3. Open Gaps

### G-101 No canonical persisted signal record

Severity: resolved in part

Current state:
- signals are normalized and persisted

Remaining gap:
- not all product flows are yet queued before deeper execution
- some routes still process inline even though they now use the canonical signal envelope

Impact:
- ingress audit is improved, but not yet complete

### G-102 No execution run model

Severity: resolved in part

Current state:
- runs are now first-class records
- queued/running/completed/awaiting-user states exist

Remaining gap:
- retry policy is still basic
- not all product flows are yet represented as first-class runs

### G-103 No queue / worker split

Severity: high

Current state:
- queue-style dispatch exists in-process
- edge can now enqueue without dispatch on `/api/signal` and `/api/heartbeat`
- inline execution is still the default mode for compatibility

Impact:
- still not aligned with the target external worker deployment
- stronger separation is still needed for Discord and future deeper agentic flows

### G-104 No explicit agent runtime boundary

Severity: medium

Current state:
- `consult-cto` now records agent invocation through an explicit runtime wrapper
- underlying execution still uses local TypeScript orchestration and local skill dispatch

Impact:
- improved runtime visibility
- still not the full target design

### G-105 Skills are not yet a tool-backed runtime surface

Severity: high

Current state:
- ask routing and skill execution now emit explicit tool-call records
- capture, heartbeat, and review flows now emit tool-call records for their major operations

Impact:
- auditability is much better
- there is still no full permissioned Agent SDK / MCP-backed tool surface

### G-106 Review actions still mutate capture state directly

Severity: medium

Current state:
- review actions are normalized as signals at the edge
- review actions now persist run records and tool-call audit for capture updates and decision logging
- the underlying review mutation still happens in local runtime code rather than through a deeper agent path

Impact:
- review is no longer an untracked side-channel
- it is still not a full agent-runtime flow

### G-107 Web artifacts are not first-class persisted outputs

Severity: resolved

Current state:
- signed web pages are persisted as first-class artifact records through the store layer

Impact:
- artifact issuance is now auditable and queryable

### G-108 Session commands are not yet on the canonical signal path

Severity: resolved

Current state:
- `new`, `load`, `clear`, and `sessions` now normalize through the shared signal path
- signals and runs are persisted for these commands

### G-109 No agent invocation or tool-call audit records

Severity: resolved in part

Current state:
- decisions are logged
- agent invocation traces now exist
- tool-call traces now exist across the main runtime paths

Impact:
- observability is materially stronger
- the remaining gap is the lack of a provider-backed Agent SDK hook stream

### G-110 Heartbeat is not yet a first-class run

Severity: resolved in part

Current state:
- heartbeat works and uses a hybrid decision ladder
- heartbeat runs are now represented through the run model when invoked through the signal path
- heartbeat tool activity is now auditable

Impact:
- the signal-path execution story is now consistent
- direct library calls can still bypass the run boundary when intentionally used in code/tests

---

## 4. Immediate Next Gaps to Fix

Priority order:

1. G-103 queue / worker split
2. G-104 explicit agent runtime provider
3. G-105 full Agent SDK / MCP-backed tool surface
4. G-106 review actions as fully deeper runs
5. Discord async interaction correctness in queued mode

These are now the highest-value remaining architectural blockers.
