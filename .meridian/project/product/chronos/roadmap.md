# Chronos — Product Roadmap

**Status:** DRAFT
**Date:** 2026-03-04
**Vision:** .meridian/project/product/chronos/vision.md (LOCKED v0.1.0)
**Brief:** .meridian/project/product/chronos/brief-20260304.html (Approved)
**Epics:** 12
**Horizon:** 12 months

---

## Epic Summary

| ID | Name | Strategic Goal | Horizon | Priority | Effort | Depends On | Foundation | GitHub Issue |
|----|------|---------------|---------|----------|--------|------------|------------|-------------|
| E1 | Engine Foundation + Capture Pipeline | SG1, SG5 | Near | P1 | XL | -- | Yes | TBD |
| E2 | Heartbeat Classification + LTM Promotion | SG2, SG5 | Near | P1 | L | E1, E4 | Yes | TBD |
| E3 | Discord Channel Integration | SG3 | Near | P1 | M | E1 | Yes | TBD |
| E4 | Two-Layer Memory Architecture | SG2 | Near | P1 | XL | E1 | Yes | TBD |
| E5 | Clarify Intent + Full Orchestration Pipeline | SG1, SG2 | Mid | P1 | XL | E1, E4, E8 | Yes | TBD |
| E6 | Confidence Scoring + Decision Audit Log | SG5 | Mid | P1 | L | E1, E2 | No | TBD |
| E7 | Web Layer + Autonomous Channel Selection | SG3 | Mid | P2 | L | E3, E5 | No | TBD |
| E8 | Session Management + STM Persistence | SG1, SG2 | Near | P1 | L | E1, E4 | Yes | TBD |
| E9 | Intent Breadth (Decide, Validate, Advise) | SG1, SG4 | Mid | P2 | XL | E5, E6 | No | TBD |
| E10 | CTO Role Profile + Role-Specific Manifesting | SG4 | Long | P2 | L | E9 | No | TBD |
| E11 | Proactive Synthesis (Advanced Heartbeat) | SG2 | Long | P2 | L | E2, E4, E6 | No | TBD |
| E12 | Multi-Channel Expansion (Claude Code Client + Future) | SG3 | Long | P3 | M | E1, E5 | No | TBD |

---

## Epic Details

### E1: Engine Foundation + Capture Pipeline

**Horizon:** Near (0-3 months) | **Priority:** P1 | **Effort:** XL | **Foundation:** Yes
**Strategic Goals:** SG1 (Intent-Driven Knowledge Interaction), SG5 (Trust Through Traceability)
**Depends On:** --

#### IDD Core

**Strategic Rationale:**
E1 is the critical-path root of the entire roadmap. Nothing ships without the engine. This epic establishes the Chronos serverless engine on Vercel with the full system layer (SOUL, RULES, USER, MEMORY, HEARTBEAT), signal normalization pipeline, trust resolution (owner-only for MVP), and the capture intent as the first one-shot pipeline. The deferred response pattern for Discord's 3-second acknowledgment window must be designed and validated here -- it is not deferrable because every channel interaction depends on it.

**User Value:**
A user can send a message to Chronos and have their thinking captured and stored reliably. This is the atomic unit of value -- if capture does not work, nothing downstream works. The capture_log in Postgres provides the raw material for all subsequent processing (heartbeat, retrieval, synthesis).

**Success Metrics:**
- Capture-to-stored latency under 5 seconds
- Deferred response pattern reliably handles Discord 3s ack window (zero dropped interactions in testing)
- System layer loads correctly on cold start within Vercel function timeout
- capture_log entries are queryable and correctly normalized

**Key Risks:**
- Discord 3s ack window vs Vercel cold start -- deferred response pattern must be in scope from day one (feasibility: medium risk)
- System layer loading overhead on cold start -- must validate that SOUL + RULES + USER + MEMORY + HEARTBEAT load within acceptable time
- Vercel Hobby plan 60s function timeout constrains processing pipeline depth

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E2: Heartbeat Classification + LTM Promotion

**Horizon:** Near (0-3 months) | **Priority:** P1 | **Effort:** L | **Foundation:** Yes
**Strategic Goals:** SG2 (Compounding Knowledge Base), SG5 (Trust Through Traceability)
**Depends On:** E1 (Engine), E4 (Memory)

#### IDD Core

**Strategic Rationale:**
Heartbeat closes the capture value loop. Without it, captured thinking sits unprocessed in capture_log -- stored but not compounding. This epic implements the Vercel cron batch-processing pipeline that takes unprocessed entries, runs deep classification against the knowledge taxonomy, applies content quality filtering (signal vs noise vs duplicate), confidence scoring via a Haiku eval agent, and promotes qualifying signals to LTM via the adapter.write() interface (Layer 1 + sync to Layer 2).

**User Value:**
Captured thinking automatically becomes searchable, classified knowledge. The user does not need to manually organize, tag, or curate their input. The system does the knowledge work of determining what matters and where it belongs. This is the transition from "I stored a note" to "the system learned something."

**Success Metrics:**
- 80%+ of captured signals correctly classified against taxonomy
- Signal/noise filtering achieves precision > 0.85 (low false-promotion rate)
- LTM promotion latency within daily cron cycle (accepted per Vercel Hobby constraints)
- Confidence scores on promoted signals are calibrated (high-confidence signals rated valuable by user at 90%+ rate)

**Key Risks:**
- Vercel Hobby cron runs once/day -- batch volume ceiling must be monitored as capture volume grows
- Haiku eval agent cost per classification call -- must stay within budget at expected daily volumes
- Dependency on E4 adapter interface being stable before heartbeat can write to LTM

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E3: Discord Channel Integration

**Horizon:** Near (0-3 months) | **Priority:** P1 | **Effort:** M | **Foundation:** Yes
**Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
**Depends On:** E1 (Engine)

#### IDD Core

**Strategic Rationale:**
Discord is the sole MVP input channel (Decision D3 from brief). The Interactions API approach (HTTP POST to Vercel /api/discord) avoids WebSocket infrastructure and separate worker processes, keeping the architecture serverless. Slash commands (/capture, /new, /load, /clear, /sessions) provide structured entry points that map cleanly to intents. Topic-based session management enables multi-turn interactions within Discord's UX constraints.

**User Value:**
A user can capture strategic thinking, manage sessions, and interact with Chronos entirely through Discord -- a tool they likely already have open. The slash command interface is low-friction: no context switching to a separate app, no web login, no CLI setup. Capture happens where thinking happens.

**Success Metrics:**
- All five slash commands functional and responsive
- Deferred response pattern (from E1) integrated -- zero timeout errors on user-facing interactions
- Topic-based session switching works within Discord thread/channel model
- Capture via Discord has identical downstream quality to any future channel

**Key Risks:**
- Discord Interactions API quirks and limitations (rate limits, message formatting constraints)
- Slash command registration and update lifecycle management
- User expectation management -- Discord is a messaging tool, not a knowledge tool. UX must feel natural, not forced.

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E4: Two-Layer Memory Architecture

**Horizon:** Near (0-3 months) | **Priority:** P1 | **Effort:** XL | **Foundation:** Yes
**Strategic Goal:** SG2 (Compounding Knowledge Base)
**Depends On:** E1 (Engine)

#### IDD Core

**Strategic Rationale:**
E4 is the highest-risk near-term investment (Decision D2 from brief). The two-layer architecture (Layer 1 as source of truth via memory adapter, Layer 2 as search index via Upstash Vector) is the foundation for all knowledge operations. The adapter interface with calibration, agentic discovery, and read/write/search/sync runtime contract defines how every other epic interacts with memory. The TICK framework for context scoring determines what gets loaded into STM and how relevance is assessed. This epic's adapter interface must stabilize before E2 (heartbeat), E8 (sessions), and all downstream epics can build.

**User Value:**
The user's knowledge is stored reliably (Layer 1) and searchable semantically (Layer 2). When they ask Chronos to retrieve or synthesize, the memory architecture delivers relevant signals from their own thinking -- not generic LLM training data. The quality gating inherent in the two-layer design means retrieval results are curated, not raw dumps.

**Success Metrics:**
- Adapter interface defined and stable (no breaking changes after E2/E8 begin)
- Layer 1 source of truth pinned and validated (prerequisite per ASK 2 from brief)
- Layer 2 search returns semantically relevant results with > 0.8 precision at top-5
- TICK context scoring produces meaningfully different rankings for different session topics
- Upstash Vector free-tier rate limits validated against projected query volume

**Key Risks:**
- Layer 1 source of truth must be pinned before adapter interface is defined -- cascades to E2 and E8 (HIGH RISK)
- Upstash Vector free-tier rate limits may be insufficient -- fallback is self-managed vector search, changing effort
- Adapter interface instability would ripple through heartbeat, sessions, and all downstream epics
- TICK framework calibration requires real usage data that does not exist yet at build time

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E5: Clarify Intent + Full Orchestration Pipeline

**Horizon:** Mid (3-6 months) | **Priority:** P1 | **Effort:** XL | **Foundation:** Yes
**Strategic Goals:** SG1 (Intent-Driven Knowledge Interaction), SG2 (Compounding Knowledge Base)
**Depends On:** E1 (Engine), E4 (Memory), E8 (Sessions)

#### IDD Core

**Strategic Rationale:**
E5 is the mid-horizon critical path. It is the first intent that proves the full PCAM pipeline end-to-end: DAG-based routing, agent skill chains, signal-grounded clarifying questions with LTM citations, multi-turn session state, and strategic brief synthesis output. The orchestration architecture established here is the template for all subsequent intents (E9). If clarify works through the full pipeline, the architecture is validated. If it does not, every subsequent intent inherits the same problems.

**User Value:**
A user can have a multi-turn strategic conversation with Chronos where the system asks clarifying questions grounded in their own captured knowledge, synthesizes their responses, and produces a strategic brief. This is the first interaction that feels like a thinking partner rather than a capture tool. It demonstrates the core vision: intent-driven, knowledge-grounded, compounding.

**Success Metrics:**
- Clarify intent correctly detected at 85%+ accuracy
- Clarifying questions cite specific signals from user's LTM (100% citation rate)
- Multi-turn session state maintained correctly across 5+ interaction turns
- Strategic brief synthesis rated "useful" by user at 80%+ rate
- Full pipeline (detection -> routing -> agent -> skill -> synthesis) completes within 60s Vercel timeout

**Key Risks:**
- Multi-agent orchestration within 60s -- DAG depth beyond 4-5 sequential agents risks timeout (medium risk)
- Quality of clarifying questions depends on LTM richness -- sparse knowledge bases produce shallow questions
- Session state management across turns must be robust (E8 dependency)
- This is the first real test of the PCAM architecture under production constraints

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E6: Confidence Scoring + Decision Audit Log

**Horizon:** Mid (3-6 months) | **Priority:** P1 | **Effort:** L | **Foundation:** No
**Strategic Goal:** SG5 (Trust Through Traceability)
**Depends On:** E1 (Engine), E2 (Heartbeat)

#### IDD Core

**Strategic Rationale:**
Trust is the differentiator that makes Chronos viable for high-stakes decisions. E6 implements the trust contract: a separate Haiku eval agent for confidence scoring on all outputs, and a decision audit log in Postgres that records every autonomous action with input, decision, confidence level, reasoning, and source citations. This is queryable by the owner, creating full transparency into what the system did and why.

**User Value:**
Every output from Chronos carries a confidence score. Every autonomous action (classification, promotion, synthesis) is logged with full reasoning trace. When a CTO uses Chronos to prepare a board briefing, they can verify exactly which captured signals informed the output and how confident the system is in each claim. This is the difference between "trust me" and "here's my work."

**Success Metrics:**
- 100% of outputs carry confidence scores
- Decision audit log captures every autonomous action with complete metadata
- Confidence scores are calibrated (high-confidence outputs rated accurate by user at 90%+ rate)
- Audit log is queryable with sub-second response time
- Zero instances of unlogged autonomous actions

**Key Risks:**
- Haiku eval agent adds latency and cost to every output -- must not push total response time past 60s
- Confidence calibration requires ground truth data that accumulates slowly
- Audit log storage growth must be monitored (every action logged)

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E7: Web Layer + Autonomous Channel Selection

**Horizon:** Mid (3-6 months) | **Priority:** P2 | **Effort:** L | **Foundation:** No
**Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
**Depends On:** E3 (Discord), E5 (Clarify)

#### IDD Core

**Strategic Rationale:**
Some outputs are too complex for Discord's message format (strategic briefs, multi-section analyses, interactive decision trees). E7 enables the engine to generate HTML pages for complex responses and send URLs to Discord. More importantly, it introduces autonomous channel selection: cognition decides whether to respond inline in Discord or generate a web page, using a deterministic three-layer rule system derived from USER.md preferences. This is the first step toward the system making UX decisions autonomously.

**User Value:**
Complex outputs are rendered as clean, readable web pages rather than cramped Discord messages. The user receives a URL they can open, share, or bookmark. Actionable elements on web pages (approve, reject, refine) send signals back to the engine, creating a bidirectional interaction beyond Discord's constraints. The system makes the right channel choice without the user having to ask.

**Success Metrics:**
- Web page generation completes within 10s of engine decision to use web channel
- Autonomous channel selection matches user preference 90%+ of the time
- Actionable elements on web pages correctly trigger engine signals
- Web pages are mobile-responsive (Discord mobile users can follow URLs)

**Key Risks:**
- URL strategy (blob store vs server-side render) must be decided before build
- Generated pages must be secure (owner-only access, no public URLs without explicit sharing)
- Vercel Hobby plan bandwidth constraints for serving generated pages

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E8: Session Management + STM Persistence

**Horizon:** Near (0-3 months) | **Priority:** P1 | **Effort:** L | **Foundation:** Yes
**Strategic Goals:** SG1 (Intent-Driven Knowledge Interaction), SG2 (Compounding Knowledge Base)
**Depends On:** E1 (Engine), E4 (Memory)

#### IDD Core

**Strategic Rationale:**
Sessions are the prerequisite for any multi-turn interaction. Without persistent session state, every message to Chronos is a cold start. E8 implements topic-based session management in Postgres with CRUD operations via Discord slash commands (/new, /load, /clear, /sessions). STM is initialized from LTM semantic search at session start, updated per interaction, and isolated per topic. Token budget management (7K STM + 25K history) ensures context windows are used efficiently.

**User Value:**
A user can start a session on "Q2 technology strategy," capture several thoughts across multiple messages, switch to "hiring plan," then return to the Q2 session with full context preserved. The system remembers where they left off. STM initialization from LTM means sessions start with relevant knowledge pre-loaded, not from scratch.

**Success Metrics:**
- Session CRUD operations respond within 2 seconds
- STM initialization from LTM loads relevant signals (precision > 0.7 at top-10)
- Session isolation verified -- no context leakage between topics
- Token budget management keeps total context within model limits
- Session persistence survives engine restarts (Postgres-backed)

**Key Risks:**
- STM initialization depends on E4 adapter interface being stable
- Token budget management must be precise -- overflows cause truncation, underflows waste capacity
- Session data in Postgres adds storage costs that scale with usage

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E9: Intent Breadth (Decide, Validate, Advise)

**Horizon:** Mid (3-6 months) | **Priority:** P2 | **Effort:** XL | **Foundation:** No
**Strategic Goals:** SG1 (Intent-Driven Knowledge Interaction), SG4 (Role-Specific Strategic Intelligence)
**Depends On:** E5 (Clarify), E6 (Confidence Scoring)

#### IDD Core

**Strategic Rationale:**
E9 expands active intents beyond capture and clarify to include decide, validate, consult, advise, and design. Each intent requires classification rules, agent assignment, skill chain, and manifestation rules. This epic proves that the orchestration architecture from E5 scales across intent types -- it is the generalization test for the PCAM pipeline. Decision D4 from the brief notes that this bundles five distinct implementations under XL and needs decomposition at planning time.

**User Value:**
Chronos becomes genuinely multi-capable. A user can ask for a decision framework (decide), validate a strategic position against their own historical thinking (validate), get advisory input grounded in their knowledge base (advise), or request a design exploration (design). Each intent produces outputs tailored to the request type, not generic responses.

**Success Metrics:**
- Each of the five intents achieves 85%+ detection accuracy
- Intent-specific outputs rated "useful" by user at 75%+ rate
- Orchestration pipeline handles all intent types within 60s timeout
- No regression in capture or clarify intent quality after expansion
- Each intent produces manifested output in the correct format (brief, decision matrix, validation report, etc.)

**Key Risks:**
- Five distinct implementations hidden under XL -- needs task decomposition (medium risk)
- Opus synthesis calls can accumulate toward 60s timeout if chained across complex intents
- Intent classification confusion increases with more active intents
- Quality calibration across five intents requires significant testing effort

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E10: CTO Role Profile + Role-Specific Manifesting

**Horizon:** Long (6-12 months) | **Priority:** P2 | **Effort:** L | **Foundation:** No
**Strategic Goal:** SG4 (Role-Specific Strategic Intelligence)
**Depends On:** E9 (Intent Breadth)

#### IDD Core

**Strategic Rationale:**
E10 delivers the first persona-specific experience, proving the differentiation thesis. The CTO role profile includes a full intent set, technology-bet domain grounding, and manifestation templates tuned for CTO decision contexts. More importantly, it establishes an abstracted role-profile system where PM and Founder profiles can be added via markdown authoring without engine changes. This is the extensibility proof.

**User Value:**
A CTO user gets outputs that speak their language: technology-bet framing, architecture trade-off analysis, team capability assessments, board-ready technical strategy summaries. The system does not produce generic "AI assistant" responses -- it produces outputs that match how a CTO actually thinks and communicates. This is the experience that makes Chronos feel like it was built for them specifically.

**Success Metrics:**
- CTO profile has 5+ role-specific intent handlers active
- CTO users rate relevance 30%+ higher than generic mode (per vision SG4 metric)
- Adding a new role profile requires only markdown authoring (no engine code changes)
- Manifestation templates produce outputs that pass CTO-audience quality bar

**Key Risks:**
- CTO domain grounding requires deep understanding of CTO decision contexts -- LTM must be rich enough
- Abstracted role-profile system must be genuinely extensible, not just "works for CTO"
- Persona-specific outputs risk feeling forced or stereotyped if not well-calibrated

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E11: Proactive Synthesis (Advanced Heartbeat)

**Horizon:** Long (6-12 months) | **Priority:** P2 | **Effort:** L | **Foundation:** No
**Strategic Goal:** SG2 (Compounding Knowledge Base)
**Depends On:** E2 (Heartbeat), E4 (Memory), E6 (Confidence Scoring)

#### IDD Core

**Strategic Rationale:**
E11 evolves heartbeat from classification to proactive synthesis -- the core differentiator that makes Chronos's knowledge base actively valuable rather than passively searchable. Pattern detection across the knowledge base surfaces connections the user has not explicitly asked for: contradictions between captured positions taken months apart, gaps in strategic coverage, emerging themes across signals, and cross-domain connections that suggest new thinking directions. The vision targets 2+ novel connections per week rated valuable by the owner.

**User Value:**
The system surprises the user with insights they did not ask for. A CTO captures a technology bet assessment on Monday, a competitive analysis on Wednesday, and a team capability note on Friday. The following week, heartbeat surfaces: "Your Tuesday assessment of microservices maturity contradicts your March position on team autonomy -- here is the tension and three ways to resolve it." This is the "compounding" promise made real.

**Success Metrics:**
- 2+ novel connections per week rated valuable by owner (per vision SG2 metric)
- Pattern detection covers contradiction, gap, theme, and cross-signal connection types
- Proactive synthesis outputs include confidence scores and source citations (E6 dependency)
- Batching strategy keeps processing within 60s cron timeout as corpus grows

**Key Risks:**
- Pattern detection over growing corpus requires batching strategy for 60s cron (medium risk)
- "Novel connections" that are trivial or obvious will erode trust rather than build it
- Corpus size at 6-12 months may be insufficient for meaningful pattern detection
- Defining "valuable" for automated scoring is inherently difficult -- requires human feedback loop

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

---

### E12: Multi-Channel Expansion (Claude Code Client + Future)

**Horizon:** Long (6-12 months) | **Priority:** P3 | **Effort:** M | **Foundation:** No
**Strategic Goal:** SG3 (Multi-Channel Strategic Capture)
**Depends On:** E1 (Engine), E5 (Clarify)

#### IDD Core

**Strategic Rationale:**
E12 establishes Claude Code as a client channel calling the engine /api/signal endpoint -- same pipeline as Discord. Two modes: engine API call (for context operations like retrieval and synthesis) and local-only (for code/file work that does not need the knowledge engine). This proves the channel-agnostic pattern: if Claude Code works as a second channel with zero engine changes, then Telegram, WhatsApp, email, and voice can follow the same pattern.

**User Value:**
A user working in their code editor can invoke Chronos for strategic context without switching to Discord. "What was our architecture decision on event sourcing?" gets answered inline in the terminal, grounded in their captured thinking. The capture-from-anywhere promise extends to the developer's primary workspace.

**Success Metrics:**
- Claude Code client calls engine API successfully with zero engine-side changes
- Both modes (engine API and local-only) work correctly with clear mode switching
- Capture quality from Claude Code channel is identical to Discord channel
- Channel-agnostic pattern documented and validated for future channel additions

**Key Risks:**
- Claude Code integration model may have constraints not present in Discord (no slash commands, different auth model)
- Two-mode operation (engine vs local) adds UX complexity -- user must understand when they are talking to Chronos vs local Claude
- Low priority (P3) means this may slip beyond 12-month horizon if mid-horizon epics expand

#### Technical Context

> TBD -- To be filled by /plan-architecture

#### Blast Radius

> TBD -- To be filled by /plan-architecture

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
Mid-Horizon Gate: E5 (validates entire orchestration architecture)
```

---

## Key Decisions (from Approved Brief)

| ID | Decision | Impact | Status |
|----|----------|--------|--------|
| D1 | Foundation-heavy near horizon (5/5 near epics are foundation) | First 3 months deliver infrastructure, not user-facing differentiation. MVP value loop is the minimum proof point. | Approved |
| D2 | E4 (Two-Layer Memory) as highest-risk near-term investment | Layer 1 source must be pinned before adapter interface. Cascades to E2, E8, and downstream. | Approved |
| D3 | Discord as sole MVP input channel | Claude Code deferred to E12 (long horizon). Discord 3s ack window requires deferred response pattern in E1. | Approved |
| D4 | E9 (Intent Breadth) scoped as XL, deferred to P2 mid-horizon | Five implementations bundled -- needs decomposition at planning time. | Approved |

---

## Assumptions (from Approved Brief)

| ID | Assumption | Risk if Wrong |
|----|-----------|--------------|
| A1 | Solo builder capacity sufficient for near-horizon scope | E2 is most likely deferral candidate |
| A2 | Vercel Hobby plan constraints acceptable for MVP | 60s timeout is primary risk for E5, E9 |
| A3 | Discord 3s ack window solvable with deferred response | Must be validated in E1, not deferred |
| A4 | Intent detection accuracy achievable with current LLMs | E5 and E9 timelines shift right if not |
| A5 | CTO persona sufficient for early validation | E10 carries more risk if architecture does not generalize |

---

## Exclusions (12-Month Scope)

- Multi-user / team features
- Mobile-native clients
- Self-hosted / on-premise deployment
- PM and Founder persona profiles (system supports them; roadmap does not build them)
- Import / migration tooling
- LLM provider portability

---

*This roadmap is a DRAFT artifact. It will be validated by /plan-architecture for technical context and blast radius before execution begins.*
