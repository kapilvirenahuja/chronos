# Chronos Evals and Scenarios

> Evaluation scenarios for the Chronos harness engineering effort. These tests exist to prove the product still behaves like Chronos while the runtime becomes more agentic.

---

## 1. Purpose

These evals answer two questions:

1. Does the product still behave correctly?
2. Does the implementation still respect Phoenix and PCAM?

This document mixes:
- automated regression targets
- manual scenario tests
- architecture checks for agentic behavior

---

## 2. Evaluation Principles

### 2.1 Product before implementation style

A technically impressive runtime that breaks:
- silent capture
- response gates
- session continuity
- memory grounding

is a failed implementation.

### 2.2 Architecture checks matter

We are not only testing outputs. We are also testing whether the runtime shape remains faithful to:
- Perception
- Cognition
- Agency
- Manifestation

### 2.3 Prefer scenario-based evals

Chronos is a product, not a utility library. The most useful evals look like real user interactions and verify both visible behavior and stored state.

---

## 3. Environment Matrix

| Environment | Purpose |
|-------------|---------|
| Local file store | fast development regression checks |
| Preview deployment | end-to-end channel and integration checks |
| Production-like staging | runtime topology, queue, and persistence validation |

---

## 4. Product Evals

## 4.1 Capture

### E-CAP-01 Clear capture stays quiet

**Input**
- Discord `/capture`
- or `POST /api/signal` with a clear strategic thought

**Expected visible result**
- no noisy conversational response
- if Discord requires an interaction ack, it remains minimal and non-conversational

**Expected state**
- capture log entry created
- quick classification stored
- no clarification required

### E-CAP-02 Ambiguous capture asks only when needed

**Input**
- vague capture such as "that architecture thing from yesterday"

**Expected visible result**
- clarification is requested
- no fake certainty

**Expected state**
- original capture is preserved
- clarification question attached to that same capture

### E-CAP-03 Clarification reply updates the original capture

**Input**
- answer the ambiguity follow-up

**Expected visible result**
- no duplicate new capture is created

**Expected state**
- original capture now contains `clarification.response`
- heartbeat can process it later

### E-CAP-04 Operational smoke tests are rejected as noise

**Input**
- capture such as "Preview smoke test after deploy"

**Expected visible result**
- no unnecessary review burden

**Expected state**
- heartbeat marks it ignored or rejected
- it does not remain in `pending_owner`

---

## 4.2 Ask / Consult

### E-ASK-01 Vague ask reaches clarification gate

**Input**
- `/ask Help me think through my AI strategy`

**Expected visible result**
- clarification questions only
- no internal routing plans or execution chatter

**Expected state**
- session initialized
- STM exists
- clarification artifact or inline clarification output stored

### E-ASK-02 Clarification response resumes the same session

**Input**
- answer the clarification

**Expected visible result**
- final brief or next valid clarification

**Expected state**
- same session id reused
- same STM lineage reused

### E-ASK-03 Inactive intent is blocked

**Input**
- ask for a planned but inactive intent

**Expected visible result**
- blocked message
- active intents listed

**Expected state**
- no invalid agent execution

### E-ASK-04 Rich output routes to web

**Input**
- ask for a complex multi-part strategic brief

**Expected visible result**
- signed web page URL or rendered web artifact reference
- no giant inline wall of text

**Expected state**
- artifact record stored
- run completes at synthesis gate

---

## 4.3 Sessions

### E-SES-01 Session lifecycle

**Input**
- `/new`
- `/sessions`
- `/load`
- `/clear`

**Expected visible result**
- current session tracking behaves predictably

**Expected state**
- one session marked current
- clear archives the current session

### E-SES-02 Topic isolation

**Input**
- create two sessions on different topics
- ask in one, then load the other

**Expected visible result**
- contexts do not bleed together

**Expected state**
- STM or session state remains isolated per session

---

## 4.4 Heartbeat

### E-HB-01 Strong signal auto-promotes

**Input**
- a high-confidence, non-duplicate strategic capture

**Expected visible result**
- no owner interruption

**Expected state**
- promoted into durable memory
- decision log records auto path

### E-HB-02 Mid-confidence item becomes pending owner

**Input**
- capture with confidence between ask threshold and auto threshold

**Expected visible result**
- review surface available

**Expected state**
- `pending_owner`
- no auto-promotion

### E-HB-03 Low-confidence item is rejected

**Input**
- capture below ask threshold

**Expected visible result**
- no unnecessary review burden

**Expected state**
- ignored or rejected
- not `pending_owner`

### E-HB-04 Review changes the next heartbeat result

**Input**
- review a pending capture
- run heartbeat again

**Expected visible result**
- reprocessing behaves differently based on the review

**Expected state**
- review is part of the processing loop

---

## 4.5 Web and Notification Surfaces

### E-WEB-01 Signed capture review works

**Input**
- open review page

**Expected visible result**
- signed access flow
- captures render correctly

### E-WEB-02 Decision review surface works

**Input**
- ask for decision history

**Expected visible result**
- reading surface loads with audit information

### E-NOT-01 Notification queue dispatches only when due

**Input**
- queue a review notification
- dispatch before and after due time

**Expected visible result**
- no early dispatch
- due dispatch succeeds

---

## 5. Architecture Evals

These are not only user-visible. They verify the implementation shape.

## 5.1 PCAM checks

### A-PCAM-01 Perception normalization

All ingress paths must normalize to the same signal shape before Cognition logic runs.

### A-PCAM-02 Step 0 happens before deeper reasoning

For `/ask` and other Level 2+ flows:
- STM exists before agent reasoning begins

### A-PCAM-03 Agency remains controlled

External actions must go through explicit code-owned interfaces, not ad hoc model text.

### A-PCAM-04 Manifestation is explicit

Runs, decisions, artifacts, and session state must persist in inspectable records.

## 5.2 Phoenix checks

### A-PHX-01 Signal remains explicit

No route should bypass the signal normalization layer.

### A-PHX-02 Recipe remains explicit

No Level 2+ flow should bypass recipe constraints and response gates.

### A-PHX-03 Agent remains explicit

Deeper reasoning should be attributable to a named agent role, not only a generic helper function.

### A-PHX-04 Skill remains explicit

Agent capabilities should remain named and inspectable, even if implemented as tools.

### A-PHX-05 Memory remains grounding

The agent must reason through STM/memory interfaces, not through hidden raw store access.

---

## 6. Automated Regression Targets

These should be implemented as automated tests where possible.

| Target | Existing status | Required direction |
|--------|-----------------|--------------------|
| Capture happy path | present | keep |
| Capture ambiguity + follow-up | present | keep |
| Session lifecycle | present | keep |
| Heartbeat confidence ladder | present | keep |
| Notification queue | present | keep |
| Ask clarification flow | present | keep |
| Signed page generation | partial | expand |
| Discord interaction correctness | weak | add |
| Signal normalization consistency | weak | add |
| Run queue and worker handoff | missing | add |
| Agent invocation audit | missing | add |
| Tool call audit | missing | add |
| Artifact store behavior | missing | add |

---

## 7. Manual End-to-End Scenarios

## 7.1 Discord-first owner day

1. `/new topic: AI strategy`
2. `/capture`
3. `/capture`
4. `/ask`
5. answer clarification
6. open brief
7. run heartbeat
8. review pending capture
9. rerun heartbeat

Expected:
- one coherent topic session
- quiet capture behavior
- clear ask flow
- review loop changes heartbeat outcome

## 7.2 Claude Code-assisted thinking

1. send a Chronos-aware context query from Claude Code
2. load prior session context
3. ask for a strategic summary
4. receive a concise result or linked artifact

Expected:
- same product behavior as Discord
- only the channel differs

## 7.3 Heartbeat maintenance day

1. capture several thoughts
2. wait or manually trigger heartbeat
3. review ambiguous ones
4. confirm durable memory was updated appropriately

Expected:
- noise filtered out
- strong signals promoted
- decision trail visible

---

## 8. Failure Scenarios

## 8.1 Unknown author

Expected:
- rejected cleanly
- no hidden side effects

## 8.2 Missing session

Expected:
- clear message or deterministic fallback
- no silent corruption of current-session state

## 8.3 Agent/tool failure

Expected:
- run marked failed or blocked
- audit trail preserved
- no half-complete hidden state transitions

## 8.4 Search returns nothing

Expected:
- honest "no relevant context" behavior
- no padding with irrelevant memory

## 8.5 Queue retry

Expected:
- duplicate work prevented
- idempotent writes where needed

---

## 9. Shipping Criteria

The redesign is ready only when:

1. Product evals pass.
2. Architecture evals pass.
3. Automated regressions cover the new run model.
4. Manual Discord/web scenarios behave correctly.
5. The system still feels like Chronos, not a demo of agent tooling.
