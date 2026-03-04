# Chronos — Engineering Roadmap View

**Audience:** Engineering
**Date:** 2026-03-04
**Source:** .meridian/project/product/chronos/roadmap.md (DRAFT)

---

## Epic Table

| ID | Name | Horizon | Priority | Effort | Depends On | Foundation | Risk | GitHub Issue |
|----|------|---------|----------|--------|------------|------------|------|-------------|
| E1 | Engine Foundation + Capture Pipeline | Near | P1 | XL | -- | Yes | Medium | TBD |
| E2 | Heartbeat Classification + LTM Promotion | Near | P1 | L | E1, E4 | Yes | Low | TBD |
| E3 | Discord Channel Integration | Near | P1 | M | E1 | Yes | Low | TBD |
| E4 | Two-Layer Memory Architecture | Near | P1 | XL | E1 | Yes | High | TBD |
| E5 | Clarify Intent + Full Orchestration Pipeline | Mid | P1 | XL | E1, E4, E8 | Yes | Medium | TBD |
| E6 | Confidence Scoring + Decision Audit Log | Mid | P1 | L | E1, E2 | No | Low | TBD |
| E7 | Web Layer + Autonomous Channel Selection | Mid | P2 | L | E3, E5 | No | Low | TBD |
| E8 | Session Management + STM Persistence | Near | P1 | L | E1, E4 | Yes | Low | TBD |
| E9 | Intent Breadth (Decide, Validate, Advise) | Mid | P2 | XL | E5, E6 | No | Medium | TBD |
| E10 | CTO Role Profile + Role-Specific Manifesting | Long | P2 | L | E9 | No | Low | TBD |
| E11 | Proactive Synthesis (Advanced Heartbeat) | Long | P2 | L | E2, E4, E6 | No | Medium | TBD |
| E12 | Multi-Channel Expansion (Claude Code Client + Future) | Long | P3 | M | E1, E5 | No | Low | TBD |

---

## Feasibility Flags

### E1: Engine Foundation + Capture Pipeline
- **Risk:** Medium
- **Blockers:**
  - Discord 3s ack window vs Vercel cold start -- deferred response pattern must be in E1 scope from day one
- **Foundation Required:** Yes

### E2: Heartbeat Classification + LTM Promotion
- **Risk:** Low
- **Blockers:**
  - Vercel Hobby cron once/day -- accepted by spec; batch volume ceiling must be monitored
- **Foundation Required:** Yes

### E3: Discord Channel Integration
- **Risk:** Low
- **Blockers:** None identified
- **Foundation Required:** Yes

### E4: Two-Layer Memory Architecture
- **Risk:** High
- **Blockers:**
  - Layer 1 source of truth must be pinned before adapter interface defined -- cascades to E2 and E8
  - Upstash Vector free-tier rate limits must be validated
- **Foundation Required:** Yes

### E5: Clarify Intent + Full Orchestration Pipeline
- **Risk:** Medium
- **Blockers:**
  - Multi-agent orchestration within 60s -- DAG depth beyond 4-5 sequential agents risks timeout
- **Foundation Required:** Yes

### E6: Confidence Scoring + Decision Audit Log
- **Risk:** Low
- **Blockers:** None identified
- **Foundation Required:** No

### E7: Web Layer + Autonomous Channel Selection
- **Risk:** Low
- **Blockers:**
  - URL strategy (blob store vs server-side render) must be decided before build
- **Foundation Required:** No

### E8: Session Management + STM Persistence
- **Risk:** Low
- **Blockers:**
  - STM initialization depends on E4 adapter interface being stable
- **Foundation Required:** Yes

### E9: Intent Breadth (Decide, Validate, Advise)
- **Risk:** Medium
- **Blockers:**
  - 5 distinct intent implementations hidden under XL -- needs task decomposition
  - Opus synthesis calls can accumulate toward 60s timeout if chained
- **Foundation Required:** No

### E10: CTO Role Profile + Role-Specific Manifesting
- **Risk:** Low
- **Blockers:** None identified
- **Foundation Required:** No

### E11: Proactive Synthesis (Advanced Heartbeat)
- **Risk:** Medium
- **Blockers:**
  - Pattern detection over growing corpus requires batching strategy for 60s cron
- **Foundation Required:** No

### E12: Multi-Channel Expansion (Claude Code Client + Future)
- **Risk:** Low
- **Blockers:** None identified
- **Foundation Required:** No

---

## Dependency Graph

```
E1 (Engine Foundation)
├── E3 (Discord Channel Integration)
├── E4 (Two-Layer Memory Architecture)
│   ├── E2 (Heartbeat Classification + LTM Promotion)
│   │   └── E6 (Confidence Scoring + Decision Audit Log)
│   │       ├── E9 (Intent Breadth) ── E10 (CTO Role Profile)
│   │       └── E11 (Proactive Synthesis)
│   └── E8 (Session Management + STM Persistence)
│       └── E5 (Clarify Intent + Full Orchestration Pipeline)
│           ├── E7 (Web Layer + Autonomous Channel Selection)
│           ├── E9 (Intent Breadth) ── E10 (CTO Role Profile)
│           └── E12 (Multi-Channel Expansion)
└── E6 (Confidence Scoring) [also depends on E2]

Critical Path: E1 → E4 → E8 → E5 → E9 → E10
Highest Risk Node: E4 (adapter interface stability cascades to E2, E8, and all downstream)
```

---

## Sequencing Risks and Cross-Epic Constraints

### Critical Sequencing Risks

1. **E4 Adapter Interface Stability**
   E4's adapter interface is consumed by E2 (heartbeat writes), E8 (STM reads), and transitively by E5 and everything downstream. If the adapter interface changes after E2 or E8 begin, both must be reworked. **Mitigation:** Pin adapter contract before E2/E8 start. Accept that E4 may need to deliver the interface spec before the full implementation is complete.

2. **E1 Cold Start vs Discord 3s Ack**
   Vercel serverless cold start can exceed 3 seconds. The deferred response pattern must be validated in E1, not deferred to E3. If E1 ships without a working deferred response, E3 is blocked on a retrofit.

3. **E5 60-Second Timeout Ceiling**
   E5's DAG-based orchestration chains multiple agents sequentially. Vercel Hobby enforces a 60s function timeout. DAG depth beyond 4-5 sequential agents risks timeout. This constrains E5's architecture and transitively E9 (which adds more intents to the same pipeline).

4. **E9 Decomposition Debt**
   E9 bundles 5 intent implementations under XL. If not decomposed before mid-horizon planning, sequencing between individual intents is invisible and parallelization opportunities are missed.

### Cross-Epic Constraints

| Constraint | Source | Affected Epics | Resolution |
|-----------|--------|----------------|------------|
| Layer 1 source must be pinned | E4 blocker | E2, E8, E5, E9, E10, E11 | Decision required before E4 starts |
| Upstash Vector rate limits | E4 blocker | E4, E2, E5 | Validation spike before E4 |
| Deferred response pattern | E1 scope | E1, E3 | Must be in E1, not deferred |
| Adapter interface contract | E4 output | E2, E8 | Pin interface before dependents start |
| 60s function timeout | Vercel Hobby | E5, E9, E11 | Architecture constraint on DAG depth |
| Token budget (7K STM + 25K history) | E8 design | E5, E9 | Context window management pattern |

---

## Effort Summary

### By Horizon

| Horizon | Epics | Total Effort |
|---------|-------|-------------|
| Near (0-3 months) | E1, E2, E3, E4, E8 | 2 XL + 1 M + 2 L |
| Mid (3-6 months) | E5, E6, E7, E9 | 2 XL + 2 L |
| Long (6-12 months) | E10, E11, E12 | 1 M + 2 L |

### By Effort Size

| Effort | Count | Epics |
|--------|-------|-------|
| XL | 4 | E1, E4, E5, E9 |
| L | 5 | E2, E6, E7, E8, E10 (also E11) |
| M | 2 | E3, E12 |

**Note:** L count is 6 (E2, E6, E7, E8, E10, E11). Total: 4 XL + 6 L + 2 M = 12 epics.

### By Priority

| Priority | Count | Epics |
|----------|-------|-------|
| P1 | 7 | E1, E2, E3, E4, E5, E6, E8 |
| P2 | 4 | E7, E9, E10, E11 |
| P3 | 1 | E12 |

### Foundation Investment

| Type | Count | Epics |
|------|-------|-------|
| Foundation | 6 | E1, E2, E3, E4, E5, E8 |
| Non-Foundation | 6 | E6, E7, E9, E10, E11, E12 |

---

*Engineering view generated from roadmap.md (DRAFT). Technical context and blast radius sections will be populated by /plan-architecture.*
