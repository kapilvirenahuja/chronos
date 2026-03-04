# Chronos — Roadmap Epics (Scoped from Vision)

> Extracted from LOCKED vision at `.meridian/project/product/chronos/vision.md`
> Scoped: 2026-03-04
> Time Horizon: 12 months

---

## Epic Summary

| ID | Name | SG | Bucket | Priority | Effort |
|----|------|----|--------|----------|--------|
| E1 | Engine Foundation + Capture Pipeline | SG1, SG5 | near (0-3mo) | P1 | XL |
| E2 | Heartbeat Classification + LTM Promotion | SG2, SG5 | near (0-3mo) | P1 | L |
| E3 | Discord Channel Integration | SG3 | near (0-3mo) | P1 | M |
| E4 | Two-Layer Memory Architecture | SG2 | near (0-3mo) | P1 | XL |
| E5 | Clarify Intent + Full Orchestration Pipeline | SG1 | mid (3-6mo) | P1 | XL |
| E6 | Confidence Scoring + Decision Audit Log | SG5 | mid (3-6mo) | P1 | L |
| E7 | Web Layer + Autonomous Channel Selection | SG3 | mid (3-6mo) | P2 | L |
| E8 | Session Management + STM Persistence | SG1, SG2 | near (0-3mo) | P1 | L |
| E9 | Intent Breadth (Decide, Validate, Advise) | SG1, SG4 | mid (3-6mo) | P2 | XL |
| E10 | CTO Role Profile + Role-Specific Manifesting | SG4 | long (6-12mo) | P2 | L |
| E11 | Proactive Synthesis (Advanced Heartbeat) | SG2 | long (6-12mo) | P2 | L |
| E12 | Multi-Channel Expansion (Claude Code Client + Future Channels) | SG3 | long (6-12mo) | P3 | M |

---

## Epic Details

### E1: Engine Foundation + Capture Pipeline

- **Strategic Goal:** SG1 (Intent-Driven Knowledge Interaction), SG5 (Trust Through Traceability)
- **Description:** Deploy the Chronos serverless engine on Vercel with system layer loading (SOUL, RULES, USER, MEMORY), signal normalization, intent detection for `capture`, and the one-shot capture pipeline. This is the platform — without it, nothing works. Includes owner-only trust resolution and capture_log writes to Postgres.
- **Bucket:** near (0-3mo)
- **Priority:** P1
- **Effort:** XL
- **Depends On:** none
- **Foundation Investment:** true (platform prerequisite for all other epics)
- **GitHub Issue Ref:** TBD

---

### E2: Heartbeat Classification + LTM Promotion

- **Strategic Goal:** SG2 (Compounding Knowledge Base), SG5 (Trust Through Traceability)
- **Description:** Implement the heartbeat cron (Vercel daily schedule) that batch-processes unprocessed capture_log entries. Deep classification against the owner's knowledge taxonomy, content quality filtering, and promotion of high-confidence signals to LTM via the memory adapter. Owner notification for ambiguous entries. This closes the capture value loop — without heartbeat, captured thoughts sit unprocessed.
- **Bucket:** near (0-3mo)
- **Priority:** P1
- **Effort:** L
- **Depends On:** E1, E4
- **Foundation Investment:** true (completes the MVP value loop)
- **GitHub Issue Ref:** TBD

---

### E3: Discord Channel Integration

- **Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
- **Description:** Implement Discord as the primary MVP input/output channel using the Interactions API (HTTP POST to Vercel endpoint). Slash commands for `/capture`, `/new`, `/load`, `/clear`, `/sessions`. No persistent WebSocket, no separate listener worker. Single-channel design with topic-based sessions managed via commands.
- **Bucket:** near (0-3mo)
- **Priority:** P1
- **Effort:** M
- **Depends On:** E1
- **Foundation Investment:** true (primary user interface for MVP)
- **GitHub Issue Ref:** TBD

---

### E4: Two-Layer Memory Architecture

- **Strategic Goal:** SG2 (Compounding Knowledge Base)
- **Description:** Build the two-layer memory system: Layer 1 (source of truth — owner's native knowledge store synced via adapter) and Layer 2 (search index — Elastic/Upstash Vector for semantic retrieval). Implement the memory adapter with calibration, read_schema, write_schema, and the TICK framework for context scoring. STM in Postgres, LTM via adapter. Engine never reads LTM from native storage directly — always via search index.
- **Bucket:** near (0-3mo)
- **Priority:** P1
- **Effort:** XL
- **Depends On:** E1
- **Foundation Investment:** true (memory is the product's core asset)
- **GitHub Issue Ref:** TBD

---

### E5: Clarify Intent + Full Orchestration Pipeline

- **Strategic Goal:** SG1 (Intent-Driven Knowledge Interaction)
- **Description:** Activate the `clarify` intent with the full PCAM orchestration pattern: DAG-based routing, agent execution with skill chains, signal-grounded clarification questions with library citations, multi-turn session state, and structured synthesis output. This is the Phase 1.5 milestone — the first intent that proves the complete engine pipeline works end-to-end with knowledge-grounded reasoning.
- **Bucket:** mid (3-6mo)
- **Priority:** P1
- **Effort:** XL
- **Depends On:** E1, E4, E8
- **Foundation Investment:** true (validates the full orchestration architecture)
- **GitHub Issue Ref:** TBD

---

### E6: Confidence Scoring + Decision Audit Log

- **Strategic Goal:** SG5 (Trust Through Traceability)
- **Description:** Implement the separate eval agent for confidence scoring on all retrieval and synthesis outputs. Build the decision audit log in Postgres as a day-1 requirement — every autonomous action (auto-classification, LTM promotion, routing decision) is logged with confidence score, reasoning, and source citations. Owner can query the log to understand what Chronos decided and why.
- **Bucket:** mid (3-6mo)
- **Priority:** P1
- **Effort:** L
- **Depends On:** E1, E2
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

### E7: Web Layer + Autonomous Channel Selection

- **Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
- **Description:** Implement the web output layer where the engine generates HTML pages for complex responses and sends URLs to Discord. Cognition autonomously decides channel based on content complexity and user preferences (three-layer rule system from D25). Phase 1 delivers proof-of-concept page generation; this epic makes it production-quality with design language from USER.md and actionable elements (confidence adjustments, clarification questions).
- **Bucket:** mid (3-6mo)
- **Priority:** P2
- **Effort:** L
- **Depends On:** E3, E5
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

### E8: Session Management + STM Persistence

- **Strategic Goal:** SG1 (Intent-Driven Knowledge Interaction), SG2 (Compounding Knowledge Base)
- **Description:** Implement topic-based session management in Postgres. Session creation, loading, clearing, and listing via Discord commands. STM row initialized from LTM via semantic search at session start, updated after each interaction, isolated per session (worktree-style). Agents read/write to shared session state. Token budget management for STM context window.
- **Bucket:** near (0-3mo)
- **Priority:** P1
- **Effort:** L
- **Depends On:** E1, E4
- **Foundation Investment:** true (required for any multi-turn intent)
- **GitHub Issue Ref:** TBD

---

### E9: Intent Breadth (Decide, Validate, Advise)

- **Strategic Goal:** SG1 (Intent-Driven Knowledge Interaction), SG4 (Role-Specific Strategic Intelligence)
- **Description:** Expand active intents beyond capture and clarify to include decide, validate, consult, advise, and design. Each intent requires its own classification rules, agent assignment, skill chain, and manifestation rules. This is the Phase 2 milestone — proving the intent-driven architecture scales to the full CTO intent set. Includes research synthesis capability (scan library, identify gaps, synthesize).
- **Bucket:** mid (3-6mo)
- **Priority:** P2
- **Effort:** XL
- **Depends On:** E5, E6
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

### E10: CTO Role Profile + Role-Specific Manifesting

- **Strategic Goal:** SG4 (Role-Specific Strategic Intelligence)
- **Description:** Formalize the CTO role profile with its full intent set, domain grounding rules, and manifestation templates. CTO outputs use technology-bet framing, architecture decision language, and stakeholder communication patterns. Lay the groundwork for PM and Entrepreneur profiles by abstracting the role-profile system so new profiles are added by authoring markdown, not modifying engine code. Target: 5+ role-specific intent handlers for CTO.
- **Bucket:** long (6-12mo)
- **Priority:** P2
- **Effort:** L
- **Depends On:** E9
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

### E11: Proactive Synthesis (Advanced Heartbeat)

- **Strategic Goal:** SG2 (Compounding Knowledge Base)
- **Description:** Evolve heartbeat beyond classification into proactive synthesis: pattern detection across the knowledge base, gap identification, contradiction surfacing, and cross-signal connection discovery. Target: 2+ novel connections surfaced per week that the user rates as valuable. This is the differentiator that makes knowledge compound — the system does not wait for queries but actively works the knowledge base.
- **Bucket:** long (6-12mo)
- **Priority:** P2
- **Effort:** L
- **Depends On:** E2, E4, E6
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

### E12: Multi-Channel Expansion (Claude Code Client + Future Channels)

- **Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
- **Description:** Implement Claude Code as a client channel calling the engine API for context operations (capture, query, brief). Same pipeline as Discord — normalized signal in, structured response out. Establish the channel-agnostic pattern so future channels (Telegram, WhatsApp, email, voice) plug in with minimal effort. Target: users capture from 2+ distinct channels within first 30 days.
- **Bucket:** long (6-12mo)
- **Priority:** P3
- **Effort:** M
- **Depends On:** E1, E5
- **Foundation Investment:** false
- **GitHub Issue Ref:** TBD

---

## Dependency Graph

```
E1 (Engine Foundation)
├── E3 (Discord)
├── E4 (Memory Architecture)
│   ├── E2 (Heartbeat) ← also depends on E1
│   ├── E8 (Sessions) ← also depends on E1
│   │   └── E5 (Clarify Pipeline) ← also depends on E1, E4
│   │       ├── E7 (Web Layer) ← also depends on E3
│   │       ├── E9 (Intent Breadth) ← also depends on E6
│   │       │   └── E10 (CTO Role Profile)
│   │       └── E12 (Multi-Channel)
│   └── E11 (Proactive Synthesis) ← also depends on E2, E6
└── E6 (Confidence + Audit Log) ← also depends on E2
```

## Bucket Summary

| Bucket | Epics | Theme |
|--------|-------|-------|
| **Near (0-3mo)** | E1, E2, E3, E4, E8 | MVP platform: engine, memory, capture loop, sessions, Discord |
| **Mid (3-6mo)** | E5, E6, E7, E9 | Full pipeline: clarify, confidence, web output, intent expansion |
| **Long (6-12mo)** | E10, E11, E12 | Differentiation: role profiles, proactive synthesis, multi-channel |
