---
name: phoenix-engine-stm-update
description: Update Short-Term Memory after user response. Evaluates new input for context changes, extracts facts, and maintains interaction log. Triggered after every user response during recipe execution.
user-invocable: false
---

# Update STM

Evaluate user response and update STM workspace to maintain accurate context for agents.

## When to Use

- **Always**: After every user response during recipe execution
- **Trigger**: Automatic, part of orchestration loop
- **By**: Recipe (before re-invoking orchestrator)

## PCAM Domain

**Engine** - System infrastructure that supports the PCAM layers.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `stm_path` | Yes | Path to current STM workspace |
| `user_response` | Yes | The user's latest input (verbatim) |
| `current_state` | Yes | Current execution state from `state.md` |
| `pending_question` | No | What was asked that prompted this response |

## Instructions

### Step 1: Classify Response Impact

Evaluate the user response against these criteria:

| Impact Type | Detection Pattern | Priority |
|-------------|-------------------|----------|
| `clarification` | Answers a pending question, resolves ambiguity | High |
| `new_info` | Provides facts not previously known | High |
| `decision` | Makes a choice between options | High |
| `scope_change` | Expands, narrows, or redirects the request | High |
| `contradiction` | Conflicts with previously stated information | Critical |
| `confirmation` | Affirms existing understanding | Low |
| `tangent` | Unrelated to current context | Flag |
| `none` | No actionable content | Skip update |

### Step 2: Extract Facts

Parse the response for discrete, referenceable facts:

```markdown
**Extracted Facts**:
- [DOMAIN]: {fact} (e.g., [SCALE]: "expecting 10k users")
- [CONSTRAINT]: {fact} (e.g., [CONSTRAINT]: "must use existing Postgres")
- [PREFERENCE]: {fact} (e.g., [PREFERENCE]: "team prefers TypeScript")
- [DECISION]: {fact} (e.g., [DECISION]: "will use microservices")
```

### Step 3: Update context.md

Append to `{stm_path}/context.md`:

```markdown
---

### User Response [{ISO timestamp}]

**In response to**: {pending_question or "unprompted"}
**Raw content**: {verbatim user response}
**Impact**: {impact_type}

**Extracted facts**:
- {fact 1}
- {fact 2}

**Context changes**:
- {what this changes about our understanding}
```

### Step 4: Update intents.md (if applicable)

If impact is `clarification` or `scope_change`:

```markdown
## Intent State Update [{timestamp}]

**Previous**: {intent} (confidence: {old_confidence})
**Updated**: {intent} (confidence: {new_confidence})
**Reason**: {why confidence changed}
**Clarified aspects**:
- {what was clarified}
```

### Step 5: Update state.md

Always append to interaction log:

```markdown
## Interaction Log

| Timestamp | Type | Impact | Summary |
|-----------|------|--------|---------|
| {ts} | user_response | {impact_type} | {1-line summary} |
```

If `scope_change` detected:

```markdown
## Scope Change [{timestamp}]

**Previous scope**: {what we thought we were doing}
**New scope**: {what we're now doing}
**Trigger**: {user response excerpt}
**Action required**: Re-route via orchestrator
```

### Step 6: Handle Contradictions

If `contradiction` detected:

1. Do NOT silently overwrite previous facts
2. Flag in `context.md`:

```markdown
## CONTRADICTION DETECTED [{timestamp}]

**Previous**: {what was said before}
**Now**: {what user just said}
**Source timestamps**: {when each was stated}

**Resolution required**: Surface to agent for clarification
```

3. Set output `needs_resolution: true`

## Outputs

| Output | Description |
|--------|-------------|
| `updated` | Boolean - whether STM was modified |
| `impact_type` | Primary impact classification |
| `extracted_facts` | List of facts extracted |
| `changes` | Summary of what changed |
| `needs_resolution` | Boolean - contradiction requires attention |
| `scope_changed` | Boolean - triggers re-routing |

## Success Criteria

- [ ] Response classified by impact type
- [ ] Facts extracted and categorized
- [ ] context.md updated with response block
- [ ] state.md interaction log updated
- [ ] intents.md updated if confidence changed
- [ ] Contradictions flagged, not silently overwritten

## Error Handling

| Error | Action |
|-------|--------|
| STM path not found | Fail - STM was not initialized |
| Cannot parse response | Log raw response, mark as `unstructured` |
| state.md corrupted | Attempt recovery from last valid state |

---

**Version**: 2.0.0
**Last Updated**: 2026-01-06
**Changes**: Renamed from `phoenix-context-update-stm` to `phoenix-engine-stm-update`. Updated to Engine namespace.
