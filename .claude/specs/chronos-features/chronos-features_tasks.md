# Chronos Feature Set -- Task Breakdown

> Tasks for building Chronos based on the feature set specification

---

## Dependency Graph Overview

```
Phase 1 (MVP) ──────────────────────────────────────────────────────
  T1.1 Harden clarify intent
  T1.2 STM lifecycle hardening
  T1.3 Response gate consistency
  T1.4 MVP integration test suite
    └── depends on: T1.1, T1.2, T1.3

Phase 2 (Intent Breadth) ──────────────────────────────────────────
  T2.1 Activate decide intent
    └── depends on: T1.1 (clarify must work first)
  T2.2 Activate validate intent
    └── depends on: T1.1
  T2.3 Activate consult intent
    └── depends on: T1.1
  T2.4 Activate advise intent
    └── depends on: T1.1
  T2.5 Multi-intent sequencing
    └── depends on: T2.1, T2.2, T2.3, T2.4 (needs multiple intents)
  T2.6 Signal capture workflow
    └── depends on: T1.2 (STM lifecycle)
  T2.7 Task tracking integration
    └── depends on: T1.1

Phase 3 (Automation + Polish) ──────────────────────────────────────
  T3.1 Multi-channel gateway framework
    └── depends on: T1.3 (response gates)
  T3.2 Scheduled signal generation
    └── depends on: T3.1 (channels)
  T3.3 Vault consolidation recipe
    └── depends on: T2.6 (signal capture)
  T3.4 Multi-format output
    └── depends on: T1.3 (response gates)
  T3.5 Decision record generation
    └── depends on: T2.1 (decide intent)
  T3.6 Signal relevance scoring
    └── depends on: T1.2 (STM)
  T3.7 External tool integration framework
    └── depends on: T3.1 (channels)
  T3.8 Multi-agent coordination
    └── depends on: T2.5 (multi-intent)

Phase 4 (Multi-Channel + Learning) ────────────────────────────────
  T4.1 Cross-session learning
    └── depends on: T3.6 (relevance scoring)
  T4.2 Session state persistence
    └── depends on: T1.2 (STM lifecycle)
  T4.3 External source monitoring
    └── depends on: T3.1 (channels), T3.6 (relevance)
  T4.4 Delegated access framework
    └── depends on: T3.1 (channels), T3.7 (external tools)
  T4.5 Conversational context tracking
    └── depends on: T1.2 (STM), T4.2 (session persistence)
  T4.6 Contradiction detection
    └── depends on: T3.6 (relevance scoring), T2.6 (signal capture)
  T4.7 Vault health reports
    └── depends on: T3.3 (consolidation), T3.6 (relevance)
  T4.8 Personalized briefings
    └── depends on: T3.2 (scheduled), T4.1 (learning)

Phase 5 (Self-Improvement) ────────────────────────────────────────
  T5.1 Confidence calibration
    └── depends on: T4.1 (cross-session learning)
  T5.2 Self-modification proposals
    └── depends on: T4.1, T4.2
  T5.3 Knowledge export packages
    └── depends on: T3.4 (multi-format), T2.6 (signal capture)
  T5.4 Ambient perception
    └── depends on: T4.5 (conversational context), T3.7 (external tools)
```

---

## Phase 1: MVP Tasks

### T1.1: Harden Clarify Intent End-to-End

**Priority**: Critical
**Estimated effort**: Medium
**Parallelizable**: Yes (sub-tasks can be delegated)
**Dependencies**: None (foundational)

**Description**: The clarify intent works today but needs production hardening. This task ensures the full chain (analyze-request -> generate-questions -> evaluate-understanding) produces consistent, high-quality output.

**Sub-tasks**:
1. **T1.1a**: Audit `phoenix-perception-analyze-request` -- verify vagueness scoring produces consistent results across 10 test queries (research sub-agent)
2. **T1.1b**: Audit `phoenix-manifestation-generate-questions` -- verify signal citations are accurate and questions are actionable (research sub-agent)
3. **T1.1c**: Audit `phoenix-cognition-evaluate-understanding` -- verify completeness scoring correctly determines loop vs proceed (research sub-agent)
4. **T1.1d**: Test the full clarify flow against the test cases in `tests/consult-cto/clarify-intent-tests.md`
5. **T1.1e**: Fix any issues found in T1.1a-d

**Acceptance criteria**:
- All 7 existing test scenarios pass
- Vagueness score is reproducible (+/- 0.1) across runs
- Questions always include signal citations
- Completeness evaluation correctly triggers loop when dimensions are missing

---

### T1.2: STM Lifecycle Hardening

**Priority**: Critical
**Estimated effort**: Small
**Parallelizable**: Yes (with T1.1)
**Dependencies**: None

**Description**: STM workspaces must reliably initialize, update, and provide consistent state throughout a session. Verify that radar scanning loads the right signals and that state updates persist correctly.

**Sub-tasks**:
1. **T1.2a**: Verify STM initialization loads correct signals for 5 different query types (one per radar domain)
2. **T1.2b**: Verify STM update after user response correctly persists new information
3. **T1.2c**: Verify STM files are readable by all agents in the chain
4. **T1.2d**: Document STM cleanup behavior (when/how ephemeral state is removed)

**Acceptance criteria**:
- STM initialization produces context.md with correct radar matches
- State.md reflects current execution step accurately
- Intents.md captures detected intents with confidence scores
- No stale STM directories accumulate

---

### T1.3: Response Gate Consistency

**Priority**: High
**Estimated effort**: Small
**Parallelizable**: Yes (with T1.1, T1.2)
**Dependencies**: None

**Description**: Ensure all four response gates (clarification, synthesis, blocked, error) produce consistently formatted output. Currently only clarification and synthesis are exercised.

**Sub-tasks**:
1. **T1.3a**: Define output templates for all 4 gate types
2. **T1.3b**: Test blocked gate (simulate agent returning blocked status)
3. **T1.3c**: Test error gate (simulate unrecoverable failure)
4. **T1.3d**: Verify silent execution of Steps 0-2 (no output leakage before gates)

**Acceptance criteria**:
- All 4 gate types produce formatted output per template
- No text output occurs before a gate is reached
- Blocked and error gates include actionable recovery information

---

### T1.4: MVP Integration Test Suite

**Priority**: High
**Estimated effort**: Medium
**Parallelizable**: No (depends on T1.1, T1.2, T1.3)
**Dependencies**: T1.1, T1.2, T1.3

**Description**: Create a comprehensive integration test suite that validates the full MVP flow. This is the evidence that Phase 1 works.

**Sub-tasks**:
1. **T1.4a**: Define 5 end-to-end test scenarios covering: vague query, moderately specific query, query with no radar match, query requiring 3 clarification rounds, query that resolves in 1 round
2. **T1.4b**: Execute test scenarios and record results
3. **T1.4c**: Document known limitations and edge cases
4. **T1.4d**: Create regression test checklist for future changes

**Acceptance criteria**:
- All 5 scenarios produce expected outcomes
- Test evidence stored in `.claude/specs/chronos-features/evidence/`
- Known limitations documented

---

## Phase 2: Intent Breadth Tasks

### T2.1: Activate Decide Intent

**Priority**: High
**Estimated effort**: Large
**Dependencies**: T1.1

**Description**: Build the decide intent skill chain for strategy-guardian: challenge-assumptions -> stress-test -> verdict. Create the skills, wire them into the agent, and activate the intent binding in consult-cto.

**Sub-tasks**:
1. Define `phoenix-cognition-challenge-assumptions` skill
2. Define `phoenix-cognition-stress-test` skill
3. Define `phoenix-manifestation-verdict` skill
4. Wire skill chain into strategy-guardian agent definition
5. Update consult-cto recipe: change decide intent status to Active
6. Test with 3 decision scenarios

---

### T2.2: Activate Validate Intent

**Priority**: High
**Estimated effort**: Large
**Dependencies**: T1.1

**Description**: Build the validate intent skill chain. Shares some skills with decide but has distinct analysis path focused on risk identification and assumption surfacing.

**Sub-tasks**:
1. Define or reuse `phoenix-cognition-challenge-assumptions` skill (shared with T2.1)
2. Define `phoenix-perception-identify-risks` skill
3. Define `phoenix-manifestation-validation-report` skill
4. Wire chain into strategy-guardian
5. Update consult-cto recipe: change validate intent status to Active
6. Test with 3 validation scenarios

---

### T2.3: Activate Consult Intent

**Priority**: Medium
**Estimated effort**: Medium
**Dependencies**: T1.1

**Description**: Build the consult intent -- practical guidance for specific problems. Requires understanding-context and solution-framing skills.

**Sub-tasks**:
1. Define `phoenix-perception-diagnose-problem` skill
2. Define `phoenix-cognition-evaluate-solutions` skill
3. Define `phoenix-manifestation-guidance-brief` skill
4. Wire chain into strategy-guardian
5. Update consult-cto recipe: change consult intent status to Active
6. Test with 3 consulting scenarios

---

### T2.4: Activate Advise Intent

**Priority**: Medium
**Estimated effort**: Large
**Dependencies**: T1.1

**Description**: Build the advise intent for the advisor agent. All 4 advisor skills are planned: understand-context, assess-landscape, provide-perspective, synthesize-counsel.

**Sub-tasks**:
1. Define `advisor-perception-understand-context` skill
2. Define `advisor-cognition-assess-landscape` skill
3. Define `advisor-manifestation-provide-perspective` skill
4. Define `advisor-manifestation-synthesize-counsel` skill
5. Update advisor agent definition with complete skill chain
6. Update consult-cto recipe: change advise intent status to Active
7. Test with 3 advisory scenarios

---

### T2.5: Multi-Intent Sequencing

**Priority**: Medium
**Estimated effort**: Large
**Dependencies**: T2.1, T2.2, T2.3, T2.4

**Description**: Enable queries that contain multiple intents. Extend orchestrator to decompose, sequence, and execute multi-intent plans.

**Sub-tasks**:
1. Extend `phoenix-engine-identify-intents` to detect multiple intents per query
2. Extend `phoenix-engine-build-plan` to produce multi-step plans
3. Implement output passing between sequential agent invocations
4. Test with compound queries ("clarify X then decide Y")
5. Test with parallel-eligible queries

---

### T2.6: Signal Capture Workflow

**Priority**: Medium
**Estimated effort**: Medium
**Dependencies**: T1.2

**Description**: Enable writing new signals to vault during conversation. Build the capture-classify-persist pipeline.

**Sub-tasks**:
1. Define `phoenix-perception-classify-signal` skill (determine which radar(s))
2. Define `phoenix-agency-persist-signal` skill (write file, update radar mappings)
3. Define deduplication logic (check existing signals for overlap)
4. Create a signal-capture recipe or integrate as a meta-intent
5. Test with 3 capture scenarios

---

### T2.7: Task Tracking Integration

**Priority**: Low
**Estimated effort**: Small
**Dependencies**: T1.1

**Description**: Basic task capture and recall. Capture tasks mentioned during conversations, store in a structured format, surface when relevant.

**Sub-tasks**:
1. Define task storage format (markdown-based)
2. Define `phoenix-perception-detect-task` skill
3. Define `phoenix-agency-persist-task` skill
4. Integrate with consult-cto recipe (optional task extraction after synthesis)

---

## Phase 3-5: Summary Tasks

Phase 3-5 tasks are listed at a higher level. Detailed sub-tasks will be defined when Phase 2 is substantially complete.

### Phase 3

| Task | Description | Dependencies |
|------|-------------|--------------|
| T3.1 | Multi-channel gateway framework: define signal envelope schema, build channel adapter interface | T1.3 |
| T3.2 | Scheduled signal generation: cron-style trigger configuration, synthetic query templates | T3.1 |
| T3.3 | Vault consolidation recipe: duplicate detection, staleness scoring, gap analysis, health report | T2.6 |
| T3.4 | Multi-format output: markdown/JSON/HTML rendering from common output model | T1.3 |
| T3.5 | Decision record generation: ADR-style output from decide intent results | T2.1 |
| T3.6 | Signal relevance scoring: per-query signal ranking beyond binary radar match | T1.2 |
| T3.7 | External tool integration framework: skill wrapper pattern for APIs (calendar, GitHub, Slack) | T3.1 |
| T3.8 | Multi-agent coordination: parallel execution, shared STM locking, output merge | T2.5 |

### Phase 4

| Task | Description | Dependencies |
|------|-------------|--------------|
| T4.1 | Cross-session learning: pattern tracking, STM-to-vault promotion candidates | T3.6 |
| T4.2 | Session state persistence: session summaries, decision logs, unresolved items | T1.2 |
| T4.3 | External source monitoring: RSS/Readwise watchers with radar-based filtering | T3.1, T3.6 |
| T4.4 | Delegated access framework: trust tiers, per-recipe permissions, scoped vault views | T3.1, T3.7 |
| T4.5 | Conversational context tracking: multi-turn state, topic evolution, implicit follow-ups | T1.2, T4.2 |
| T4.6 | Contradiction detection: signal conflict identification, resolution workflow | T3.6, T2.6 |
| T4.7 | Vault health reports: periodic analysis, coverage metrics, actionable recommendations | T3.3, T3.6 |
| T4.8 | Personalized briefings: context-aware summaries, adaptive to user patterns | T3.2, T4.1 |

### Phase 5

| Task | Description | Dependencies |
|------|-------------|--------------|
| T5.1 | Confidence calibration: predicted vs actual confidence tracking, threshold tuning | T4.1 |
| T5.2 | Self-modification proposals: agent/recipe change suggestions with approval workflow | T4.1, T4.2 |
| T5.3 | Knowledge export packages: curated vault subsets in shareable formats | T3.4, T2.6 |
| T5.4 | Ambient perception: passive context from system state, pre-loaded context | T4.5, T3.7 |

---

## Execution Strategy Notes

### Parallelization Opportunities

- **Phase 1**: T1.1, T1.2, T1.3 can all run in parallel. T1.4 waits for all three.
- **Phase 2**: T2.1, T2.2, T2.3, T2.4 can run in parallel (independent intents). T2.5 waits for all four. T2.6 and T2.7 can run alongside the intent tasks.
- **Within tasks**: Sub-tasks marked (research sub-agent) can be delegated to parallel sub-agents.

### Sub-Agent Candidates

| Task | Sub-Agent Type | Reason |
|------|----------------|--------|
| T1.1a-c | Research/audit agent | Independent skill audits, no writes needed |
| T1.2a | Research agent | STM verification is read-only |
| T2.1-T2.4 (skill definition) | Explore agent | Pattern research across existing skills for consistency |
| T3.3 | Research agent | Vault analysis is read-heavy |

### Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Orchestration ceremony too heavy for simple queries | Phase 1 feels slow/ceremonial | Consider Level 1 bypass for simple intents in Phase 2 |
| Signal count growth degrades radar scanning | Phase 3+ performance | T3.6 (relevance scoring) addresses this; also consider keyword index |
| Multi-intent conflicts | Phase 2 complexity | Sequencing rules and conflict_with definitions already exist in cto-intents.md |
| External tool API instability | Phase 3+ reliability | Tool-agnostic design means fallback skills can be swapped in |

---

**Version**: 1.0.0
**Last Updated**: 2026-03-01
