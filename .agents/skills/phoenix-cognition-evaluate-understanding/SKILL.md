---
name: phoenix-cognition-evaluate-understanding
description: Evaluate response completeness and consolidate understanding. Cognition domain skill that assesses whether clarification is complete based on intent-defined criteria.
user-invocable: false
---

# Evaluate Understanding

Evaluate response completeness, consolidate understanding, and determine if clarification goals are met. This is a **Cognition** domain skill - reasoning about gathered information to assess completeness.

## When to Use

- **After**: User has responded to clarifying questions
- **After**: `phoenix-engine-stm-update` has captured the response
- **Trigger**: Clarification round complete, ready to evaluate
- **By**: Any agent that needs to evaluate understanding completeness

## PCAM Domain

**Cognition** - Reasoning, evaluating, deciding, assessing.

## Position in Chain

```
┌─────────────────────────────────┐
│  phoenix-perception-            │
│  analyze-request                │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  phoenix-manifestation-         │
│  generate-questions             │
└─────────────────────────────────┘
      │
      ▼ questions presented
┌─────────────────────────────────┐
│  User responds                  │
│  phoenix-engine-stm-update      │
└─────────────────────────────────┘
      │
      ▼ updated STM
┌─────────────────────────────────┐
│  phoenix-cognition-             │  ◄── YOU ARE HERE
│  evaluate-understanding         │
│  (Evaluation: Is it complete?)  │
└─────────────────────────────────┘
      │
      ▼ completeness assessment
      │
      │ Orchestrator determines next action inline
      │ (NOT returned by this skill)
```

**Important**: This skill does NOT determine routing. The orchestrator agent reads the completeness assessment and determines the next intent inline.

---

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `original_query` | Yes | The user's original query |
| `stm_path` | Yes | Path to STM workspace (contains all context) |
| `questions_asked` | Yes | Questions that were presented to user |
| `user_responses` | Yes | User's responses (from STM context.md) |
| `intent` | Yes | Current intent (`clarify`, `consult`, `decide`, etc.) |
| `intent_definition_path` | Yes | Path to intent definition (for completion criteria) |
| `clarification_round` | Yes | Which round of clarification this is (1, 2, 3) |
| `max_rounds` | No | Maximum clarification rounds before forcing proceed (default: 3) |

---

## Instructions

### Step 1: Load Completion Criteria from Intent Definition

Read the intent definition from `intent_definition_path` and extract completion criteria:

```markdown
### Completion Criteria

Output is complete when:
- All 4 dimensions (WHAT, WHO, WHY, CONSTRAINTS) are documented
- Strategic framing adds insight beyond user input
- At least 1 key decision is identified
- Recommended action is specific and immediately actionable
```

Extract required dimensions and criteria for the current intent.

---

### Step 2: Load All Context from STM

Read from STM workspace:

```
{stm_path}/
├── context.md      → Original signals + user responses
├── state.md        → Execution state, interaction log
├── intents.md      → Intent history
└── outputs/        → Previous analysis outputs
```

**Extract:**
- Original query
- Radar matches and loaded signals
- All user responses with timestamps
- Extracted facts from each response
- Current intent state

---

### Step 3: Evaluate Response Completeness

For each question that was asked, evaluate if the response adequately addresses it:

| Evaluation | Criteria | Score |
|------------|----------|-------|
| **Complete** | Specific, actionable answer provided | 1.0 |
| **Partial** | Some information, but still gaps | 0.5 |
| **Deflected** | User avoided or redirected | 0.2 |
| **Unanswered** | No response to this question | 0.0 |

**Response Completeness Score:**

```
completeness = sum(question_scores) / question_count
```

| Score | Interpretation |
|-------|----------------|
| 0.8 - 1.0 | Fully clarified, ready to proceed |
| 0.5 - 0.8 | Mostly clarified, can proceed with stated assumptions |
| 0.3 - 0.5 | Partially clarified, may need another round |
| 0.0 - 0.3 | Not clarified, definitely need another round |

---

### Step 4: Check Required Dimensions (from Intent Definition)

Verify each required dimension from the intent definition is now present:

| Dimension | Required | Status | Source |
|-----------|----------|--------|--------|
| WHAT | ✓ | ✅ Present | User response to Q1 |
| WHO | ✓ | ✅ Present | User response to Q2 |
| WHY | ✓ | ❌ Partial | User mentioned goal but not success metric |
| CONSTRAINTS | ✓ | ✅ Present | User response to Q4 |

---

### Step 5: Extract Resolved Understanding

Consolidate what we now know:

```markdown
## Resolved Understanding

### The Request
[One sentence summary of what user wants]

### Key Facts Gathered
| Dimension | Value | Source |
|-----------|-------|--------|
| WHAT | [specific target] | User response to Q1 |
| WHO | [users/customers] | User response to Q2 |
| WHY | [problem being solved] | User response to Q3 |
| CONSTRAINTS | [limitations] | User response to Q4 |

### Assumptions Made
[List any assumptions we're proceeding with due to incomplete responses]

### Still Unknown
[List anything we couldn't clarify but will proceed without]
```

---

### Step 6: Determine Completion Status

**Decision tree:**

```
If completeness_score >= 0.8 AND all required dimensions present:
  → status: clarified

If completeness_score >= 0.5 AND most required dimensions present:
  → status: proceed_with_assumptions
  → Document: what we're assuming and why

If completeness_score < 0.5 AND clarification_round < max_rounds:
  → status: needs_reclarification
  → Generate: focused follow-up questions (only for gaps)

If completeness_score < 0.5 AND clarification_round >= max_rounds:
  → status: proceed_with_assumptions
  → Document: forced proceed, what remains unclear

If contradiction detected:
  → status: contradiction_detected
  → Surface: contradiction details for resolution
```

---

### Step 7: Generate Summary

**Summary Structure:**

```markdown
## Evaluation Summary

### What We Understood
[2-3 sentences capturing the clarified request]

### Dimension Status
| Dimension | Status | Value |
|-----------|--------|-------|
| WHAT | ✅ Complete | AI assistant for customer support |
| WHO | ✅ Complete | Internal support agents |
| WHY | ⚠️ Partial | Reduce ticket time (no metric) |
| CONSTRAINTS | ✅ Complete | Must integrate with Zendesk |

### Key Insights
- [Insight 1 from signals + user responses]
- [Insight 2]
- [Insight 3]

### Signals Used
| Signal | How It Applied |
|--------|----------------|
| [signal path] | [how it informed understanding] |
```

---

### Step 8: Handle Edge Cases

**User refuses to clarify:**

```markdown
If user explicitly refuses ("just do it", "I don't know"):
  → Document refusal
  → State assumptions explicitly
  → status: proceed_with_assumptions
```

**Contradictions detected:**

```markdown
If user response contradicts earlier statement:
  → Surface contradiction explicitly
  → status: contradiction_detected
  → Do not proceed until resolved
```

**Scope changed:**

```markdown
If user response reveals fundamentally different request:
  → Flag scope_changed = true
  → status: scope_changed
  → Requires re-running full orchestration
```

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `status` | enum | `clarified` \| `needs_reclarification` \| `proceed_with_assumptions` \| `scope_changed` \| `contradiction_detected` |
| `completeness_score` | float | 0.0-1.0 score of how well questions were answered |
| `resolved_understanding` | object | Structured understanding of the request |
| `dimensions_status` | object | Status of each required dimension |
| `assumptions` | array | Assumptions made due to incomplete answers |
| `unknowns` | array | Things we couldn't determine |
| `summary` | string | Markdown summary for reference |
| `signals_used` | array | Signals that informed the evaluation |
| `follow_up_questions` | array | Only if status = needs_reclarification |

**Note**: This skill does NOT output `next_intent` or routing decisions. The orchestrator agent determines routing inline based on the status.

**Output Schema:**

```json
{
  "status": "clarified",
  "completeness_score": 0.85,
  "resolved_understanding": {
    "summary": "User wants to build an AI-powered customer support assistant that helps agents resolve tickets faster",
    "dimensions": {
      "WHAT": "AI assistant for customer support",
      "WHO": "Internal support agents (not customers directly)",
      "WHY": "Reduce ticket resolution time, improve agent efficiency",
      "CONSTRAINTS": "API-first approach, integrate with existing Zendesk"
    }
  },
  "dimensions_status": {
    "WHAT": {"status": "complete", "value": "AI assistant for customer support"},
    "WHO": {"status": "complete", "value": "Internal support agents"},
    "WHY": {"status": "partial", "value": "Reduce ticket time", "gap": "No success metric"},
    "CONSTRAINTS": {"status": "complete", "value": "Must integrate with Zendesk"}
  },
  "assumptions": [
    "Scale: Assumed <100 agents based on 'small team' mention",
    "Timeline: Not specified, assuming standard priority"
  ],
  "unknowns": [
    "Budget constraints",
    "Specific Zendesk plan/limitations"
  ],
  "summary": "## Evaluation Summary\n\n### What We Understood\nYou want to build an AI assistant...",
  "signals_used": [
    {
      "path": "@{user-vault}/signals/ai/augmentation-principle.md",
      "usage": "Framed AI as augmenting agent capabilities, not replacing agents"
    }
  ],
  "follow_up_questions": []
}
```

---

## Reclarification Output (when status = needs_reclarification)

If another round is needed:

```json
{
  "status": "needs_reclarification",
  "completeness_score": 0.4,
  "gaps_remaining": [
    {
      "dimension": "WHO",
      "original_question": "Who are the users?",
      "response_evaluation": "partial",
      "gap": "User said 'support team' but didn't specify size or skill level"
    }
  ],
  "follow_up_questions": [
    {
      "question": "How many support agents will use this? What's their technical skill level?",
      "dimension": "WHO",
      "why_needed": "Affects UX complexity and training requirements"
    }
  ],
  "round": 2,
  "max_rounds": 3
}
```

---

## Success Criteria

- [ ] Completion criteria loaded from intent definition (not hardcoded)
- [ ] All user responses evaluated for completeness
- [ ] Required dimensions checked against intent definition
- [ ] Resolved understanding documented with sources
- [ ] Assumptions explicitly stated
- [ ] Unknowns acknowledged (not hidden)
- [ ] Signals used documented with how they applied
- [ ] Status accurately reflects completeness
- [ ] No routing decision made (orchestrator handles this)

---

## Error Handling

| Error | Action |
|-------|--------|
| STM path not found | Fail with "Cannot evaluate without STM context" |
| No user responses in STM | Return `status: needs_reclarification` with original questions |
| Intent definition not found | Use default dimensions (WHAT, WHO, WHY, CONSTRAINTS) |
| Contradictions unresolvable | Return `status: contradiction_detected`, pause |

---

## Integration Notes

### Updating STM After Evaluation

Write evaluation output to STM:

```
{stm_path}/outputs/evaluation-{timestamp}.json
```

Update `{stm_path}/state.md`:

```markdown
| Timestamp | Step | Status | Notes |
|-----------|------|--------|-------|
| {ts} | Evaluation | complete | Clarified, completeness: 0.85 |
```

### Orchestrator Uses Evaluation for Routing

The orchestrator agent receives evaluation output and determines next action inline:

```
If status == "clarified":
  → Apply intent detection patterns from intent definition
  → Route to appropriate next intent

If status == "needs_reclarification":
  → Re-invoke generate-questions with follow_up_questions

If status == "proceed_with_assumptions":
  → Route forward with documented assumptions

If status == "contradiction_detected":
  → Present contradiction to user for resolution

If status == "scope_changed":
  → Re-run full orchestration from Step 1
```

---

## Clarification Loop Limits

| Round | Action |
|-------|--------|
| 1 | Full clarification (all missing dimensions) |
| 2 | Targeted follow-up (only remaining gaps) |
| 3 | Final attempt (most critical gap only) |
| 4+ | Force proceed with explicit assumptions |

**After max rounds:**

```markdown
⚠️ Proceeding with assumptions

We asked 3 rounds of clarifying questions but the following remains unclear:
- [Unknown 1]
- [Unknown 2]

We're proceeding with these assumptions:
- [Assumption 1]
- [Assumption 2]

These assumptions may need revisiting if they prove incorrect.
```

---

**Version**: 2.0.0
**Last Updated**: 2026-01-06
**Changes**: Renamed from `consult-synthesize-response` to `phoenix-cognition-evaluate-understanding`. Updated to PCAM namespace. Added `intent` and `intent_definition_path` inputs. Completion criteria now come from intent definition (not hardcoded). REMOVED `next_intent` output - routing stays inline in orchestrator agent.
