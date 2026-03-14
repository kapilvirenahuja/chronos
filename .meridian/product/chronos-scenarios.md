# Chronos v1 — User Verification Scenarios

> Acceptance scenarios for Chronos v1 product specification (v4.0.0) and technical approach (v1.1.0).
> Each scenario is individually testable with clear pass/fail criteria.

**Version:** 1.0.0
**Date:** 2026-03-14
**Source Specs:** chronos-features.md v4.0.0, technical-approach.md v2.0.0

---

## Legend

| Automation Type | Meaning |
|----------------|---------|
| **Automated** | Full API/integration/e2e test — no human eyes needed |
| **Hybrid** | Automated setup and assertions, but one or more quality judgments require human review |

---

## Group 1: Capture (Recipe 1 — Capture Flow)

### SC-CAP-001: Silent single capture via messaging channel

**Description:** Owner sends a single thought ("AI agents will replace middleware within 3 years") via Discord.

**Expected behavior:**
- Signal is stored in the signal store within 2 seconds
- Chronos does NOT send any acknowledgment message back to the channel
- Signal store record contains: raw text, channel (Discord), timestamp, author ID

**Pass criteria:**
- Signal exists in signal store with correct metadata
- No outbound message was sent to the Discord channel

**Automation:** Automated (API test) — send message via Discord bot API, query signal store, assert no outbound message in channel.

---

### SC-CAP-002: Silent burst capture (multiple signals in rapid succession)

**Description:** Owner sends 5 thoughts within 30 seconds via Discord.

**Expected behavior:**
- All 5 signals are stored individually in the signal store
- Chronos remains silent for all 5
- Each signal has distinct timestamps and preserves ordering

**Pass criteria:**
- 5 distinct signal records exist in signal store
- Timestamps are ordered correctly
- Zero outbound messages

**Automation:** Automated (API test) — send 5 messages via Discord, query signal store for count, ordering, and absence of outbound messages.

---

### SC-CAP-003: Capture stores before processing

**Description:** Owner sends a signal. Before the next heartbeat runs, verify the signal is already persisted.

**Expected behavior:**
- Signal is in the signal store with status `unclassified`
- No classification has been attempted yet

**Pass criteria:**
- Signal store record exists with `unclassified` status
- No entry in decision audit log for this signal

**Automation:** Automated (integration test) — send message, immediately query signal store and audit log.

---

### SC-CAP-004: Unknown author is rejected

**Description:** A message arrives from a Discord user who is not the configured owner.

**Expected behavior:**
- Signal is NOT stored in the signal store
- No response is sent to the channel

**Pass criteria:**
- Signal store has no record for this message
- Trust layer logged a rejection

**Automation:** Automated (API test) — send message from non-owner account, assert signal store is empty, assert rejection log entry.

---

## Group 2: Classify (Recipe 1 — Heartbeat Classification)

### SC-CLS-001: Heartbeat classifies unclassified signals

**Description:** 3 unclassified signals exist in the signal store. The 30-minute heartbeat fires.

**Expected behavior:**
- All 3 signals are classified using radar matching against the CTO domain cartridge
- Each classification result includes a confidence score
- Classification decisions are logged in the decision audit log

**Pass criteria:**
- All 3 signals have status changed from `unclassified` to `classified` or `review_pending`
- Decision audit log contains 3 entries with: decision type = `classification`, confidence score, source signal paths

**Automation:** Automated (integration test) — seed signal store, trigger heartbeat, assert classification status and audit log entries.

---

### SC-CLS-002: High-confidence classification is stored automatically

**Description:** A signal clearly matches a single radar category (e.g., "Kubernetes service mesh patterns for microservices" clearly maps to technology radar).

**Expected behavior:**
- Classification is applied without owner intervention
- Status becomes `classified`
- No review item is created

**Pass criteria:**
- Signal status = `classified`
- No review-pending entry for this signal
- Audit log records confidence >= threshold

**Automation:** Automated (integration test) — seed a clearly-categorizable signal, trigger heartbeat, assert status and absence of review item.

---

### SC-CLS-003: Low-confidence classification surfaces for review

**Description:** A signal is ambiguous (e.g., "The flywheel effect applies to both product growth and team culture" — could be leadership or innovation radar).

**Expected behavior:**
- Signal status set to `review_pending`
- A review item is created on the web channel
- Owner receives a notification via messaging channel pointing to the review surface

**Pass criteria:**
- Signal status = `review_pending`
- Web channel review queue contains this signal
- Messaging channel received a notification with a link to the review surface
- Audit log records confidence < threshold

**Automation:** Hybrid — automated for status, review queue existence, notification delivery, and audit log.

**Manual element:** Human verifies that the presented classification options are reasonable given the ambiguous signal content.

---

### SC-CLS-004: Domain cartridge is loaded before classification

**Description:** Heartbeat fires with unclassified signals.

**Expected behavior:**
- The CTO domain cartridge (role profile + matched vault signals via radar scanning) is loaded before any classification occurs
- Classification reasoning references cartridge content, not raw vault

**Pass criteria:**
- Langfuse trace shows cartridge loading step before classification skill invocation
- No direct vault reads appear in the trace after cartridge loading

**Automation:** Automated (trace assertion) — trigger heartbeat, inspect Langfuse trace for ordering and vault access patterns.

---

### SC-CLS-005: Audit trail records all classification decisions

**Description:** Heartbeat classifies 5 signals (3 high-confidence, 2 low-confidence).

**Expected behavior:**
- Decision audit log has 5 entries
- Each entry has: timestamp, recipe, decision type, input, output, confidence, sources

**Pass criteria:**
- 5 audit log entries exist with all required fields populated
- Confidence scores vary between entries (not all identical)
- Source paths reference vault signals

**Automation:** Automated (integration test) — seed signals, trigger heartbeat, query audit log for completeness.

---

## Group 3: Consult CTO Research Pipeline (Recipe 2)

### SC-CON-001: Consult initializes STM with domain cartridge

**Description:** Owner sends a consult request via Discord: "What are the trade-offs between event sourcing and CRUD for our core domain?"

**Expected behavior:**
- A session is created (or existing session is used)
- CTO domain cartridge is loaded into STM
- STM contains matched vault signals relevant to the query
- Agents read from STM, not vault directly

**Pass criteria:**
- STM workspace exists with loaded cartridge
- Vault signals related to architecture/technology appear in STM context
- Langfuse trace shows no direct vault reads after cartridge loading

**Automation:** Automated (integration test) — send consult request, inspect STM contents and Langfuse trace.

---

### SC-CON-002: Clarification for underspecified request

**Description:** Owner sends a vague request: "Help me think about AI strategy."

**Expected behavior:**
- Chronos reaches the Clarification response gate
- Questions are grounded in vault signals (with source citations)
- Questions are specific and actionable, not generic
- No synthesis is attempted before clarification

**Pass criteria:**
- Response gate = Clarification
- Each question includes a source citation referencing a vault signal path
- No synthesis artifact was produced
- Response stays in the messaging channel (short enough for inline)

**Automation:** Hybrid — automated for response gate type, citation presence, absence of synthesis artifact.

**Manual element:** Human evaluates question quality — are they grounded, specific, and useful? Would a real user find them helpful for clarifying their thinking?

---

### SC-CON-003: Synthesis with confidence scores and source citations

**Description:** Owner has clarified their intent. Enough understanding exists. Chronos proceeds to synthesis.

**Expected behavior:**
- Structured artifact is created with sections, sources, and confidence score
- Sources trace to specific vault signal paths
- If training-sourced knowledge is used, it is explicitly labeled
- Artifact is published to web channel as HTML
- Messaging channel receives a compact pointer (link)

**Pass criteria:**
- Structured artifact exists with all required metadata fields
- Confidence score is present and visible
- Source citations map to real vault signal paths
- Training-sourced claims (if any) are labeled as such
- Web channel serves the HTML artifact at a token-authenticated URL
- Messaging channel received a link notification

**Automation:** Hybrid — automated for artifact structure, metadata completeness, citation validity, URL accessibility, notification delivery.

**Manual element:** Human reads the synthesis artifact and evaluates: Is the reasoning coherent? Do the citations actually support the claims? Is the confidence score reasonable given the source coverage?

---

### SC-CON-004: Consult produces no intermediate chatter

**Description:** Owner sends a consult request. Observe the messaging channel during processing.

**Expected behavior:**
- No routing plans, internal scores, or execution status messages appear in the messaging channel
- Only valid response gates produce output (Clarification, Synthesis, Blocked, Error)

**Pass criteria:**
- Zero intermediate messages in the messaging channel between the request and the response gate output
- The response that does appear matches one of the four valid gate types

**Automation:** Automated (e2e test) — send request, monitor channel for all outbound messages, assert count and type.

---

### SC-CON-005: Consult artifact awaits review (human pause)

**Description:** Consult recipe produces an artifact. The recipe enters `awaiting_review` state.

**Expected behavior:**
- Recipe state is persisted to Postgres as `awaiting_review`
- Agent loop has stopped
- Artifact is accessible on the web channel
- Owner has been notified via messaging channel

**Pass criteria:**
- Recipe run state in Postgres = `awaiting_review`
- No further agent loop activity after the pause
- Artifact URL is accessible and renders correctly

**Automation:** Automated (integration test) — trigger consult, wait for state transition, assert state, agent loop termination, and URL accessibility.

---

### SC-CON-006: Owner feedback triggers revision

**Description:** Owner reviews a consult artifact on the web channel and provides feedback ("Add more detail on the migration risks").

**Expected behavior:**
- Recipe state transitions from `awaiting_review` to `revising`
- The same artifact is updated in-place (not a new artifact)
- Decision audit log records what feedback was given and what changes were made
- Owner is notified when revision is complete

**Pass criteria:**
- Artifact ID remains the same before and after revision
- Artifact content now addresses the feedback
- Audit log contains: owner feedback text, changes description
- Recipe state reaches `completed` or `awaiting_review` again

**Automation:** Hybrid — automated for state transitions, artifact ID persistence, audit log entries.

**Manual element:** Human reads the revised artifact to confirm the revision genuinely addresses the feedback rather than superficially appending text.

---

### SC-CON-007: Retrieve intent returns existing vault knowledge

**Description:** Owner asks "What do I know about the augmentation principle?" — a retrieve intent.

**Expected behavior:**
- Chronos matches against vault signals
- Returns relevant signals with source paths
- Does not fabricate knowledge not in the vault
- Confidence score reflects vault coverage

**Pass criteria:**
- Response references actual vault signal paths
- Content matches what exists in those vault signals
- If vault has limited coverage, confidence is low and this is stated
- No hallucinated "knowledge" that does not exist in the vault

**Automation:** Hybrid — automated for citation validity and vault signal existence.

**Manual element:** Human compares the response against actual vault contents to confirm nothing was fabricated.

---

## Group 4: Memory Promotion (Recipe 3)

### SC-MEM-001: Promotion recipe identifies stable patterns

**Description:** Signal store contains 20+ signals accumulated over weeks. Multiple signals reinforce the same theme (e.g., 5 signals about "composable architecture patterns"). The promotion recipe runs.

**Expected behavior:**
- The reinforced theme is identified as a stable pattern
- Pattern is promoted to the vault as a new signal under the appropriate radar category
- Noise (unreinforced, one-off signals) is archived or discarded

**Pass criteria:**
- Vault contains a new signal for the promoted pattern
- The new signal is mapped under the correct radar
- Unreinforced signals are marked as archived
- Audit log records the promotion decision with sources

**Automation:** Hybrid — automated for vault signal creation, radar mapping, archive status, audit log.

**Manual element:** Human evaluates whether the system correctly identified a real pattern vs. a spurious correlation, and whether the promoted vault signal accurately captures the insight.

---

### SC-MEM-002: Proactive synthesis surfaces novel connections

**Description:** The promotion recipe identifies a connection the owner has not explicitly asked about (e.g., "Your signals about team autonomy and your signals about microservices boundaries share a structural pattern around bounded contexts").

**Expected behavior:**
- The connection is surfaced via the web channel as a synthesis artifact
- Owner receives a notification via messaging channel with a link
- The notification is concise (not the full synthesis)

**Pass criteria:**
- Web channel has a new synthesis artifact showing the connection
- Messaging channel received a notification with a link
- The notification text is compact (< 280 characters)

**Automation:** Hybrid — automated for artifact creation, notification delivery, notification length.

**Manual element:** Human reads the connection synthesis and judges: Is this a real insight or a trivial/false pattern? Would this be useful to the owner?

---

### SC-MEM-003: Ambiguous promotion items surface for review

**Description:** The promotion recipe encounters a pattern that is borderline — reinforced but not clearly durable.

**Expected behavior:**
- Item is surfaced for owner review via web channel
- Owner can approve or dismiss
- Owner's decision is incorporated into the final promotion

**Pass criteria:**
- Review surface presents the ambiguous item with context
- Owner action (approve/dismiss) is recorded in audit log
- Approved item is promoted; dismissed item is archived
- Recipe state reflects the human pause and resumption

**Automation:** Hybrid — automated for review queue, state transitions, audit log.

**Manual element:** Human evaluates whether the review surface provides sufficient context (the pattern, the source signals, the uncertainty) for a real decision.

---

### SC-MEM-004: Contradictions across knowledge base are surfaced

**Description:** Two vault signals or accumulated patterns contradict each other (e.g., one signal advocates "move fast, break things" while another advocates "stability-first architecture").

**Expected behavior:**
- The contradiction is identified and surfaced
- Both sides are presented with source citations
- Owner can resolve, annotate, or acknowledge the tension

**Pass criteria:**
- Contradiction is presented with citations to both conflicting sources
- Owner can take an action (resolve/annotate/acknowledge)
- Action is recorded in audit log

**Automation:** Hybrid — automated for contradiction presence, citation validity, action recording.

**Manual element:** Human judges whether the identified contradiction is real or spurious.

---

## Group 5: Review (Capture and Consult Origin)

### SC-REV-001: Capture review — reclassify a signal

**Description:** Owner opens the web review surface, sees a low-confidence classification, and reclassifies the signal to a different radar category.

**Expected behavior:**
- Signal classification is updated in the signal store
- Next heartbeat run uses the owner's classification (does not re-override)
- Audit log records the reclassification with owner feedback

**Pass criteria:**
- Signal store shows updated classification
- After next heartbeat, signal retains owner's classification
- Audit log has reclassification entry

**Automation:** Automated (integration test) — programmatically reclassify via web API, trigger heartbeat, assert classification persists.

---

### SC-REV-002: Capture review — reject a signal

**Description:** Owner reviews a classified signal and rejects it (decides it is noise, not worth keeping).

**Expected behavior:**
- Signal is marked as rejected/archived
- Signal does not appear in future classification or promotion runs
- Audit log records the rejection

**Pass criteria:**
- Signal status = rejected/archived
- Subsequent heartbeat and promotion runs skip this signal
- Audit log entry exists

**Automation:** Automated (integration test) — reject via API, run heartbeat and promotion, assert signal is skipped.

---

### SC-REV-003: Consult review — provide feedback for revision

**Description:** Owner opens a consult artifact on the web, provides textual feedback.

**Expected behavior:**
- Feedback is recorded
- Recipe transitions to `revising` state
- Revised artifact is published in-place
- Audit log records feedback and changes

**Pass criteria:**
- Same as SC-CON-006

**Automation:** Same as SC-CON-006.

---

### SC-REV-004: Consult review — approve artifact

**Description:** Owner reviews a consult artifact and approves it without changes.

**Expected behavior:**
- Recipe transitions to `completed`
- Artifact remains accessible
- Audit log records approval

**Pass criteria:**
- Recipe state = `completed`
- Artifact URL still serves the artifact
- Audit log records approval action

**Automation:** Automated (integration test) — approve via API, assert state and log.

---

### SC-REV-005: Reviewed items re-enter processing loop

**Description:** Owner reclassifies a signal during review. The next heartbeat picks it up.

**Expected behavior:**
- Reclassified signal is ingested by the next heartbeat without requiring re-capture
- The owner's correction becomes the ground truth

**Pass criteria:**
- Signal's classification matches the owner's reclassification after the next heartbeat
- No new signal store entry was created (same signal, updated classification)

**Automation:** Automated (integration test) — reclassify, trigger heartbeat, assert persistence.

---

## Group 6: Sessions

### SC-SES-001: Create a new session via messaging channel

**Description:** Owner sends `/session new AI strategy exploration` via Discord.

**Expected behavior:**
- New session is created in Postgres with topic "AI strategy exploration"
- STM workspace is initialized for this session
- Confirmation is sent in the messaging channel

**Pass criteria:**
- Session record exists in Postgres with correct topic
- STM workspace state exists
- Discord channel shows confirmation with session ID

**Automation:** Automated (e2e test) — send command, assert database record, STM state, and channel response.

---

### SC-SES-002: Load an existing session

**Description:** Owner sends `/session load <id>` where `<id>` is a previously created session.

**Expected behavior:**
- Session STM is restored from persisted state
- Previously loaded context is available again
- Any in-progress reasoning can continue

**Pass criteria:**
- STM contains the same domain cartridge and active intents as when the session was last active
- Subsequent queries within this session reference prior context

**Automation:** Hybrid — automated for STM restoration and context availability.

**Manual element:** Human sends a follow-up question that references prior session context and verifies Chronos correctly references it.

---

### SC-SES-003: Clear current session

**Description:** Owner sends `/session clear` via Discord.

**Expected behavior:**
- STM is cleared
- Session record is preserved (not deleted) but marked inactive
- Next interaction starts fresh

**Pass criteria:**
- STM is empty after clear
- Session record still exists in Postgres with inactive status
- New query does not reference any prior context from the cleared session

**Automation:** Automated (integration test) — clear session, assert STM state, assert session record preserved, send new query and verify no prior context leaks.

---

### SC-SES-004: List sessions via messaging channel

**Description:** Owner sends `/session list` via Discord.

**Expected behavior:**
- Chronos returns a list of sessions with topics and timestamps
- List is ordered by most recent activity
- List is compact enough for the messaging channel

**Pass criteria:**
- Response contains all existing sessions
- Each entry shows topic and last-active timestamp
- Response fits within messaging channel limits

**Automation:** Automated (e2e test) — create multiple sessions, send list command, assert all appear with correct data.

---

### SC-SES-005: Sessions are topic-based, not channel-based

**Description:** Owner creates a session via Discord `/session new`, then sends an `/ask` in a different Discord channel referencing the same session.

**Expected behavior:**
- The same session can be loaded from any Discord channel
- Session context is preserved regardless of which channel the command was sent from

**Pass criteria:**
- Session loaded from a different Discord channel contains the same STM
- No new duplicate session is created

**Automation:** Automated (integration test) — create session via Discord, load session from different channel context, assert same STM.

---

## Group 7: Channels and Output Routing

### SC-CHN-001: Short response stays in messaging channel

**Description:** Owner asks a simple question that yields a brief answer (e.g., "What session am I in?").

**Expected behavior:**
- Response is delivered inline in the messaging channel
- No web artifact is created

**Pass criteria:**
- Response appears in the messaging channel
- No HTML artifact was generated or published

**Automation:** Automated (e2e test) — send simple query, assert inline response, assert no web artifact.

---

### SC-CHN-002: Rich artifact routes to web with messaging pointer

**Description:** Owner asks for a strategic synthesis that produces a multi-section artifact.

**Expected behavior:**
- Artifact is published to the web channel as an HTML page
- Messaging channel receives a compact pointer (link) to the artifact
- The pointer is brief (not the full artifact inline)

**Pass criteria:**
- Web channel has a new HTML artifact at a token-authenticated URL
- Messaging channel message contains a URL and is < 500 characters
- Artifact is readable and navigable via the web

**Automation:** Hybrid — automated for URL generation, messaging notification length, URL accessibility.

**Manual element:** Human opens the web URL and evaluates readability, formatting, and navigation quality.

---

### SC-CHN-003: Web artifact is token-authenticated

**Description:** Access the web artifact URL without the authentication token.

**Expected behavior:**
- Request is rejected (401 or 403)
- Artifact is only accessible with the correct token

**Pass criteria:**
- Unauthenticated request returns 401/403
- Authenticated request returns 200 with artifact content

**Automation:** Automated (API test) — request URL without token, assert rejection; request with token, assert success.

---

### SC-CHN-004: Low-confidence review notification goes to messaging channel

**Description:** Heartbeat produces low-confidence classifications.

**Expected behavior:**
- Review items are created on the web channel
- Messaging channel receives a notification with a link to the review surface

**Pass criteria:**
- Web review queue populated
- Messaging notification sent with link
- Link resolves to the correct review surface

**Automation:** Automated (integration test) — trigger heartbeat with ambiguous signals, assert review queue, notification, and link resolution.

---

## Group 8: Confidence Scoring

### SC-CNF-001: Synthesis output carries confidence score

**Description:** Consult recipe produces a synthesis artifact.

**Expected behavior:**
- Artifact includes a visible confidence score
- Score reflects vault signal coverage (not arbitrary)

**Pass criteria:**
- Confidence score is present in both structured artifact and HTML rendering
- Score is between 0 and 1 (or equivalent scale)

**Automation:** Hybrid — automated for score presence and range.

**Manual element:** Human compares the confidence score against the actual vault signal coverage to judge calibration.

---

### SC-CNF-002: Low-confidence output indicates what would increase confidence

**Description:** Consult recipe produces a synthesis with low confidence.

**Expected behavior:**
- Output explicitly states what additional signals or knowledge would increase confidence
- These gaps are specific, not generic ("more signals about X" not "more information")

**Pass criteria:**
- Gap description is present in the artifact
- Gap references specific knowledge areas or signal types

**Automation:** Hybrid — automated for gap section presence.

**Manual element:** Human reads the gap description and judges: Is it specific enough to be actionable?

---

### SC-CNF-003: Training-sourced knowledge is explicitly labeled

**Description:** Consult recipe produces a synthesis where some claims are from vault signals and some are from model training knowledge.

**Expected behavior:**
- Claims grounded in vault signals have source citations
- Claims from training knowledge are labeled as "training-sourced" or equivalent
- The two types are visually distinguishable

**Pass criteria:**
- At least one claim has a vault citation
- At least one claim (if training-sourced) is labeled as such
- The labeling is visible in the rendered artifact

**Automation:** Hybrid — automated for label presence in artifact structure.

**Manual element:** Human cross-references cited vault signals with the claims to verify accuracy.

---

## Group 9: Decision Audit Log

### SC-AUD-001: Classification decisions are logged

**Description:** Heartbeat classifies signals.

**Expected behavior:**
- Each classification produces an audit log entry
- Entry contains: timestamp, recipe, session, decision type, input, output, confidence, sources

**Pass criteria:**
- All required fields are non-null
- Decision type = `classification`
- Sources reference vault signal paths

**Automation:** Automated (integration test) — trigger heartbeat, query audit log, validate schema completeness.

---

### SC-AUD-002: Synthesis decisions are logged

**Description:** Consult recipe produces a synthesis.

**Expected behavior:**
- Audit log entry records the synthesis decision
- Sources trace to the vault signals that informed the synthesis

**Pass criteria:**
- Entry exists with decision type = `synthesis`
- Sources are valid vault signal paths
- Confidence score matches the artifact's confidence score

**Automation:** Automated (integration test) — trigger consult, query audit log, cross-reference with artifact.

---

### SC-AUD-003: Owner feedback is recorded in audit log

**Description:** Owner provides feedback on a review item (capture or consult).

**Expected behavior:**
- Audit log records the feedback text
- Changes made as a result are recorded
- The entry links back to the original decision entry

**Pass criteria:**
- Owner feedback field is populated with actual feedback text
- Changes made field describes what was modified
- Entry references the original decision's timestamp or ID

**Automation:** Automated (integration test) — provide feedback via API, query audit log for feedback and changes fields.

---

### SC-AUD-004: Promotion decisions are logged

**Description:** Memory promotion recipe promotes signals to vault.

**Expected behavior:**
- Each promotion produces an audit log entry
- Entry records what was promoted, from which source signals, and with what confidence

**Pass criteria:**
- Entry exists with decision type = `promotion`
- Sources reference the signal store entries that contributed to the pattern
- Output references the new vault signal path

**Automation:** Automated (integration test) — run promotion, query audit log.

---

### SC-AUD-005: Audit log is queryable

**Description:** Owner queries the decision audit log to understand past decisions.

**Expected behavior:**
- Log can be filtered by: recipe, decision type, date range, confidence range
- Results are ordered chronologically

**Pass criteria:**
- API supports filter parameters
- Filters return correct subsets
- Results are chronologically ordered

**Automation:** Automated (API test) — insert diverse log entries, query with various filters, assert correctness.

---

## Group 10: Trust Model

### SC-TRU-001: Owner is authenticated and has full access

**Description:** Owner sends a message via Discord from the configured owner account.

**Expected behavior:**
- Message is accepted
- Signal is stored
- All operations are available

**Pass criteria:**
- Signal stored successfully
- All session commands work
- Consult requests are processed

**Automation:** Automated (e2e test) — send messages as owner, assert acceptance.

---

### SC-TRU-002: Non-owner is rejected

**Description:** Messages arrive from unknown Discord users who are not the configured owner.

**Expected behavior:**
- Messages are rejected before reaching signal store
- No signals are created
- Rejection is logged to audit log with decision_type = 'trust_rejection'

**Pass criteria:**
- Signal store has no entries for non-owner messages
- Audit log contains a trust_rejection entry with the sender_id

**Automation:** Automated (API test) — send from non-owner Discord account, assert signal store empty, assert audit log entry.

---

### SC-TRU-003: Web channel enforces token authentication

**Description:** Attempt to access web surfaces (review, reading, action) without valid token.

**Expected behavior:**
- All web endpoints return 401/403 without a valid token

**Pass criteria:**
- No web surface is accessible without authentication

**Automation:** Automated (API test) — crawl all web endpoints without token, assert all reject.

---

## Group 11: Response Gates

### SC-GAT-001: Clarification gate produces grounded questions

**Description:** Consult recipe reaches Clarification gate.

**Expected behavior:**
- Only the clarifying questions are surfaced to the user
- No internal state, routing plan, or scores are visible
- Questions cite vault signal sources

**Pass criteria:**
- Output contains only questions (no internal artifacts)
- Each question has a signal citation
- No routing plans, scores, or execution traces in the output

**Automation:** Hybrid — automated for output content analysis and citation presence.

**Manual element:** Human reads the questions and judges groundedness and usefulness.

---

### SC-GAT-002: Blocked gate explains what is needed

**Description:** Recipe encounters a hard blocker (e.g., required signal category is completely empty in vault).

**Expected behavior:**
- Chronos explains the blocker clearly
- Explains what the user can do to unblock
- Does not attempt to proceed with degraded output

**Pass criteria:**
- Response identifies the specific blocker
- Response suggests concrete unblocking action
- No synthesis artifact was produced

**Automation:** Hybrid — automated for response gate type and absence of synthesis.

**Manual element:** Human evaluates clarity of the blocker explanation and whether the suggested action is practical.

---

### SC-GAT-003: Error gate provides recovery path

**Description:** Recipe encounters an unrecoverable error (e.g., model call failure).

**Expected behavior:**
- Chronos explains the failure
- Suggests recovery (retry, rephrase, or contact)
- Does not produce partial/broken artifacts

**Pass criteria:**
- Error message is clear (not a raw stack trace)
- Recovery suggestion is present
- No broken artifacts published

**Automation:** Automated (integration test) — simulate model failure, assert error response format and absence of artifacts.

---

### SC-GAT-004: Synthesis gate delivers complete artifact

**Description:** Recipe reaches Synthesis gate with sufficient understanding.

**Expected behavior:**
- Complete artifact is produced with all required sections
- Confidence score and citations are included
- Artifact is routed to the appropriate channel

**Pass criteria:**
- Artifact has: sections, sources, confidence, metadata
- Channel routing follows output routing rules (web for rich content)

**Automation:** Hybrid — automated for artifact completeness and routing.

**Manual element:** Human reads the artifact and evaluates completeness and coherence.

---

## Group 12: Observability (Langfuse)

### SC-OBS-001: Recipe runs produce Langfuse traces

**Description:** Any recipe executes (capture heartbeat, consult, promotion).

**Expected behavior:**
- Langfuse trace is created for the full recipe run
- Trace includes: cost, latency per skill, model calls, gate sequence

**Pass criteria:**
- Langfuse dashboard shows the trace
- All expected metrics are populated

**Automation:** Automated (integration test) — trigger recipe, query Langfuse API for trace existence and metric presence.

---

### SC-OBS-002: Confidence calibration eval detects miscalibration

**Description:** Owner frequently overrides high-confidence classifications.

**Expected behavior:**
- Langfuse eval detects the pattern of overrides
- Deviation is flagged

**Pass criteria:**
- After N overrides of high-confidence classifications, Langfuse eval triggers a miscalibration flag

**Automation:** Automated (integration test) — seed overrides, run eval, assert flag.

---

## Group 13: Phoenix Chain Integrity

### SC-PHX-001: Signal-to-memory chain is traceable

**Description:** A signal enters via capture, gets classified, gets consulted against, and eventually a related pattern gets promoted to vault.

**Expected behavior:**
- At each step the signal's journey is traceable through: signal store → classification → STM context → synthesis citation → promotion source
- The decision audit log provides the full chain

**Pass criteria:**
- Audit log entries for classification, synthesis, and promotion all reference traceable identifiers
- Following the chain from capture to vault promotion produces a coherent narrative

**Automation:** Hybrid — automated for identifier traceability across audit log entries.

**Manual element:** Human follows the full chain in the audit log and evaluates whether the trail is understandable and trustworthy.

---

### SC-PHX-002: Recipe contract is not collapsed

**Description:** Inspect the execution of any recipe.

**Expected behavior:**
- Execution follows Signal → Recipe → Agent → Skill → Memory
- No execution collapses into: Signal → model call → answer

**Pass criteria:**
- Langfuse trace shows distinct recipe initialization, skill invocations, and memory operations
- Agent loop is visible with multiple tool-use cycles (not a single model call)

**Automation:** Automated (trace analysis) — inspect Langfuse traces for structural completeness.

---

## Group 14: Domain Cartridge and Role Profile

### SC-DOM-001: CTO cartridge loads appropriate signals

**Description:** A query about "engineering team scaling" triggers cartridge loading.

**Expected behavior:**
- CTO role profile is loaded
- Radar scanning matches leadership and technology radars
- Relevant vault signals are loaded into STM

**Pass criteria:**
- STM contains CTO role profile
- Matched signals are from relevant radar categories (not random)
- Irrelevant radar categories are not loaded

**Automation:** Hybrid — automated for cartridge loading and radar matching.

**Manual element:** Human reviews which signals were loaded and judges whether the radar matching selected genuinely relevant knowledge.

---

## Scenario Summary

| Group | Count | Automated | Hybrid |
|-------|-------|-----------|--------|
| Capture | 4 | 4 | 0 |
| Classify | 5 | 4 | 1 |
| Consult | 7 | 3 | 4 |
| Memory Promotion | 4 | 0 | 4 |
| Review | 5 | 5 | 0 |
| Sessions | 5 | 4 | 1 |
| Channels & Routing | 4 | 3 | 1 |
| Confidence Scoring | 3 | 0 | 3 |
| Decision Audit Log | 5 | 5 | 0 |
| Trust Model | 3 | 3 | 0 |
| Response Gates | 4 | 1 | 3 |
| Observability | 2 | 2 | 0 |
| Phoenix Chain | 2 | 1 | 1 |
| Domain Cartridge | 1 | 0 | 1 |
| **Total** | **54** | **35** | **19** |

All 19 hybrid scenarios have explicit manual elements documented. Every scenario has at least an automated component for setup and structural assertions — human evaluation is only required where output quality or semantic correctness cannot be machine-verified.
