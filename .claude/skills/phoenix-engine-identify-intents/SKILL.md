---
name: phoenix-engine-identify-intents
description: Identify user intent from query using pattern matching, context boosting, and threshold selection. Consolidates the intent identification pipeline. Supports both initial identification and mid-execution re-evaluation.
user-invocable: false
---

# Identify Intents

Match user query against intent patterns, boost confidence with context signals, and select final intents. This skill consolidates the three-phase intent identification process into a single invocation.

## When to Use

- **Step 1** of orchestrator workflow (initial identification)
- **Mid-execution**: When agents detect intent may have shifted
- **By**: Orchestrator agent only

## PCAM Domain

**Engine** - System infrastructure that supports the PCAM layers.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `query` | Yes | User's raw query (or resolved_understanding for re-evaluation) |
| `intent_bindings` | Yes | Array of intent bindings from recipe (see structure below) |
| `stm_path` | Yes | Path to STM workspace |
| `mode` | No | `initial` (default) or `re-evaluate` |
| `prior_intents` | No | For re-evaluate mode: previously identified intents |
| `context` | No | Additional context (conversation history, user info) |
| `hint` | No | Agent's hypothesis about intent (for re-evaluation) |

### Intent Bindings Structure

The recipe provides `intent_bindings` as an array, supporting intents from multiple domains:

```json
{
  "intent_bindings": [
    {
      "intent": "clarify",
      "domain": "@memory/engine/intents/cto-intents.md",
      "agent": "phoenix:strategy-guardian",
      "status": "active"
    },
    {
      "intent": "code-review",
      "domain": "@memory/engine/intents/developer-intents.md",
      "agent": "phoenix:code-reviewer",
      "status": "active"
    }
  ]
}
```

**This replaces the old structure:**
```
# OLD (single domain):
intent_domain_path: cto-intents.md
enabled_intents: [clarify, decide]

# NEW (multi-domain):
intent_bindings: [
  { intent: clarify, domain: cto-intents.md, agent: ... },
  { intent: decide, domain: cto-intents.md, agent: ... },
  { intent: code-review, domain: developer-intents.md, agent: ... }
]
```

## Instructions

### Phase 1: Pattern Matching

#### Step 1.1: Load Intent Patterns

For each binding in `intent_bindings`, load patterns from the specified domain:

```
domains_cache = {}  # Cache to avoid re-reading same domain file

For each binding in intent_bindings:
  If binding.status != "active":
    Skip (only scan active intents)

  If binding.domain not in domains_cache:
    domains_cache[binding.domain] = read_file(binding.domain)

  domain = domains_cache[binding.domain]
  intent_def = domain.get_intent(binding.intent)

  Store:
    - intent_def.patterns
    - intent_def.context_signals
    - binding.agent (for routing later)
```

**Multi-domain example:**

```
intent_bindings = [
  { intent: "clarify", domain: "cto-intents.md", agent: "strategy-guardian" },
  { intent: "code-review", domain: "developer-intents.md", agent: "code-reviewer" }
]

→ Reads cto-intents.md, extracts clarify patterns
→ Reads developer-intents.md, extracts code-review patterns
→ Both are scanned against the query
```

**Example patterns by domain:**

| Domain | Intent | Patterns |
|--------|--------|----------|
| cto-intents | `clarify` | Vague queries, buzzwords, missing context |
| cto-intents | `decide` | "Should I use X or Y", "Trade-offs between" |
| developer-intents | `code-review` | "Review my code", "PR feedback", "Is this good?" |
| devops-intents | `deploy-check` | "Ready to deploy?", "Pre-release checklist" |

#### Step 1.2: Scan Query

For each pattern in each intent:

1. Check if pattern matches query (exact, partial, semantic)
2. Calculate match strength (0.0 - 1.0)

**Match Types:**

| Type | Example | Weight |
|------|---------|--------|
| Exact phrase | "Should I use X or Y" | 0.9 |
| Partial match | Contains "should I" | 0.6 |
| Semantic similarity | Similar meaning | 0.4 |

#### Step 1.3: Calculate Initial Score

```
For each intent:
  matched_patterns = count of patterns that matched
  total_patterns = total patterns for intent

  initial_score = (matched_patterns / total_patterns) * max_match_weight
```

#### Step 1.4: Filter Candidates

Only include intents with score > 0.3 as candidates.

**Phase 1 Output:**

```json
{
  "candidates": [
    { "intent": "decide", "score": 0.7, "matched_patterns": ["Should I use X or Y"] },
    { "intent": "consult", "score": 0.35, "matched_patterns": ["Help me with"] }
  ]
}
```

---

### Phase 2: Confidence Boosting

#### Step 2.1: Load Context Signals

For each candidate intent, load its context signals from intent domain:

```
intent.context_signals = [
  "User presents alternatives",
  "Comparative language",
  "Decision framing explicit",
  ...
]
```

#### Step 2.2: Evaluate Signals

For each signal, check if it applies to the query/context:

| Signal | How to Detect |
|--------|---------------|
| "User presents alternatives" | Query contains "or", "vs", "between" |
| "Comparative language" | Query contains comparison words |
| "Decision framing explicit" | Query starts with "Should I", "Which" |
| "Time pressure" | Query mentions deadline, urgency |
| "User has existing plan" | Query references "my plan", "I decided" |

#### Step 2.3: Apply Boost

For each matching signal:
- Boost confidence by 0.05 - 0.1
- Cap total confidence at 1.0

```
For each candidate:
  For each signal that matches:
    candidate.score += 0.05
  candidate.score = min(candidate.score, 1.0)
```

#### Step 2.4: Re-rank Candidates

Sort candidates by updated score descending.

**Phase 2 Output:**

```json
{
  "scored_intents": [
    {
      "intent": "decide",
      "score": 0.85,
      "signals_matched": ["User presents alternatives", "Comparative language"]
    }
  ]
}
```

---

### Phase 3: Intent Selection

#### Step 3.1: Apply Confidence Thresholds

| Confidence | Action |
|------------|--------|
| > 0.8 | Select intent |
| 0.5 - 0.8 | Select with `needs_confirmation: true` |
| < 0.5 | Discard |

If all intents discarded, select `clarify` as default.

#### Step 3.2: Check Dependencies

For each selected intent, load Related Intents:

```
intent.related_intents = {
  requires_first: ["clarify"],
  evolves_to: ["design", "validate"],
  conflicts_with: []
}
```

**Dependency Rules:**
- If `requires_first` is not in selected intents, add it
- If `conflicts_with` is in selected intents, resolve by priority

#### Step 3.3: Handle Multi-Intent

If multiple intents selected:

1. Check for composite query ("decide X and then design Y")
2. Apply Intent Detection Priority from intent domain
3. Sequence using `evolves_to` relationships

**Priority Order** (from cto-intents):
1. clarify
2. decide
3. validate
4. consult
5. advise
6. design

#### Step 3.4: Validate Selection

- Max 4 intents per query
- If more, flag for user to narrow scope

---

### Phase 4: Re-Evaluation Mode (if mode == "re-evaluate")

When invoked with `mode: "re-evaluate"`:

#### Step 4.1: Compare Against Prior Intents

```
For each newly selected intent:
  If intent NOT IN prior_intents:
    intent_shifted = true
    shift_reason = "New intent detected: {intent}"

For each prior_intent:
  If prior_intent NOT IN newly_selected:
    intent_shifted = true
    shift_reason = "Prior intent no longer detected: {prior_intent}"
```

#### Step 4.2: Weight Agent Hint

If `hint` is provided, boost confidence for the hinted intent:

```
If hint.intent IN candidates:
  hint.intent.score += 0.1
  hint.intent.hint_applied = true
```

#### Step 4.3: Flag Shift Detection

```json
{
  "intent_shifted": true,
  "shift_reason": "User's response suggests 'validate' rather than 'design'",
  "prior_intents": ["design"],
  "new_intents": ["validate"]
}
```

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `selected_intents` | array | Final intent selection with confidence and rationale |
| `intent_shifted` | boolean | True if re-evaluation detected change (re-evaluate mode only) |
| `shift_reason` | string | Explains why intent changed (if shifted) |
| `pattern_matches` | array | Debug: pattern matching results |
| `confidence_boosts` | array | Debug: confidence boosting results |

**Output Schema:**

```json
{
  "selected_intents": [
    {
      "intent": "decide",
      "confidence": 0.85,
      "needs_confirmation": false,
      "added_by": "detection",
      "matched_patterns": ["Should I use X or Y", "Trade-offs between"],
      "signals_matched": ["User presents alternatives", "Comparative language"],
      "rationale": "Query explicitly asks to choose between options with trade-off analysis"
    }
  ],
  "intent_shifted": false,
  "shift_reason": null,
  "debug": {
    "pattern_matches": [
      { "intent": "decide", "initial_score": 0.7 },
      { "intent": "consult", "initial_score": 0.35 }
    ],
    "confidence_boosts": [
      { "intent": "decide", "boost": 0.15, "signals": ["User presents alternatives", "Comparative language"] }
    ],
    "discarded_intents": [
      { "intent": "consult", "reason": "score below 0.5 threshold" }
    ]
  }
}
```

---

## Re-Evaluation Output (when mode = "re-evaluate")

```json
{
  "selected_intents": [
    {
      "intent": "validate",
      "confidence": 0.82,
      "needs_confirmation": false,
      "added_by": "detection",
      "rationale": "User's response revealed they have an existing plan to validate"
    }
  ],
  "intent_shifted": true,
  "shift_reason": "User's clarification revealed validation need rather than design. They said 'I already have a plan' which triggers validate patterns.",
  "prior_intents": [
    { "intent": "design", "confidence": 0.75 }
  ]
}
```

---

## Success Criteria

- [ ] All enabled intents scanned
- [ ] Pattern matching completed with scores
- [ ] Context signals evaluated and boosts applied
- [ ] Thresholds applied correctly
- [ ] Dependencies resolved
- [ ] Max 4 intents enforced
- [ ] Selection explained (detection vs dependency)
- [ ] Re-evaluation mode: shift detection working
- [ ] Debug outputs available for audit trail

---

## Error Handling

| Error | Action |
|-------|--------|
| Intent domain not found | Fail with "Cannot identify intents without intent definitions" |
| No patterns match at all | Return `clarify` as default intent |
| All intents below threshold | Return `clarify` with `needs_confirmation: true` |
| More than 4 intents | Flag for user to narrow scope |
| STM path not found | Warn, proceed without context signals |

---

## Integration Notes

### Replacing 3 Orchestrator Skills

This skill replaces:
- `phoenix-orchestrator-pattern-match` (Phase 1)
- `phoenix-orchestrator-boost-confidence` (Phase 2)
- `phoenix-orchestrator-select-intents` (Phase 3)

And absorbs re-evaluation logic from:
- `phoenix-context-identify-intent` (Phase 4)

### Orchestrator Invocation

```python
# Initial identification
result = phoenix_engine_identify_intents(
    query=user_query,
    intent_domain_path="@memory/engine/intents/cto-intents.md",
    enabled_intents=["clarify", "decide", "validate", "consult", "advise", "design"],
    stm_path=stm_path,
    mode="initial"
)

# Mid-execution re-evaluation
result = phoenix_engine_identify_intents(
    query=resolved_understanding,
    intent_domain_path="@memory/engine/intents/cto-intents.md",
    enabled_intents=["clarify", "decide", "validate", "consult", "advise", "design"],
    stm_path=stm_path,
    mode="re-evaluate",
    prior_intents=current_intents,
    hint={"intent": "validate", "reason": "User mentioned existing plan"}
)
```

### Passing to phoenix-engine-build-plan

```
identify-intents output
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ build-plan receives:                                       │
│                                                           │
│ - selected_intents → Map to agents                        │
│ - confidence scores → Include in plan metadata            │
│ - rationales → Document in routing plan                   │
└───────────────────────────────────────────────────────────┘
```

---

**Version**: 1.0.0
**Last Updated**: 2026-01-06
**Changes**: New skill consolidating `phoenix-orchestrator-pattern-match`, `phoenix-orchestrator-boost-confidence`, `phoenix-orchestrator-select-intents`, and `phoenix-context-identify-intent` into single skill with initial and re-evaluate modes.
