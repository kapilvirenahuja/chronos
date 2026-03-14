---
name: phoenix-engine-stm-initialize
description: Initialize Short-Term Memory workspace for recipe execution. Boot the STM workspace, perform semantic radar scanning, and populate context with matched signals. Always Step 0 of Level 2+ recipes.
user-invocable: false
---

# Initialize STM

Boot the Short-Term Memory workspace and populate it with relevant Vault content via semantic radar scanning.

## When to Use

- **Always**: First step of every Level 2+ recipe
- **Once**: Only invoked once per recipe execution
- **By**: Recipe (not agents)

## PCAM Domain

**Engine** - System infrastructure that supports the PCAM layers.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `recipe_id` | Yes | Identifier for the recipe being executed |
| `signal` | Yes | The incoming signal (query, source, metadata) |
| `vault_path` | Yes | Path to the Vault directory (e.g., `{user-vault}/`) |
| `user_context` | No | Known user information (role, history, preferences) |

## Vault Structure (Dynamic Discovery)

The skill discovers Vault structure at runtime. Do NOT hardcode file paths.

**Expected Vault layout:**
```
{vault_path}/
├── radars/           # Classification lenses (*.md files)
│   └── *.md          # Each radar defines: Focus, Questions, Keywords, Signal Mappings
│
└── signals/          # Actual content (organized by category)
    └── {category}/   # Category folders (discovered from radar mappings)
        └── *.md      # Signal files
```

**Discovery algorithm:**
```
1. radars = glob("{vault_path}/radars/*.md")
2. For each radar file:
   - Parse Focus, Questions, Signal Mappings sections
   - signal_paths = extract paths from Signal Mappings table
3. signals = load each signal_path relative to {vault_path}
```

**⚠️ The skill adapts to whatever radars and signals exist in the provided vault_path. Different projects can have different radars (e.g., a fintech project might have `compliance.md`, `risk-management.md` radars that don't exist in other projects).**

## Instructions

### Step 1: Create Workspace Structure

Create the STM workspace at `.phoenix-os/stm/{recipe-id}-{timestamp}/`:

```
.phoenix-os/stm/{recipe-id}-{timestamp}/
├── state.md           # Current execution state
├── context.md         # Matched signals from Vault
├── intents.md         # Active intent(s)
├── outputs/           # Outputs from each step
└── evidence/          # Supporting artifacts
```

---

### Step 2: Semantic Radar Matching (Internal)

Perform semantic analysis to identify which radars are relevant to the query.

#### 2a: Load All Radar Definitions

Read all radar files from `{vault_path}/radars/*.md`:

```
radars = glob("{vault_path}/radars/*.md")
```

For each radar file, extract:
- **Name**: Radar name (from H1 heading or filename)
- **Focus**: Content under `## Focus` section
- **Questions**: Bullet list under `## Questions` section

```json
{
  "name": "{extracted from file}",
  "file": "{filename}.md",
  "focus": "{extracted from ## Focus section}",
  "questions": ["{extracted from ## Questions section}"]
}
```

**⚠️ Do not assume specific radar names exist.** The radar set is defined by whatever `.md` files are in `{vault_path}/radars/`.

#### 2b: Semantic Relevance Analysis

For each radar, evaluate semantic relevance to the query using this algorithm:

**Step 2b.1: Question Relevance Test (Primary)**

For each of the radar's strategic questions, ask:
> "If the user's query were fully answered, would this question also need to be answered?"

| Result | Score Contribution |
|--------|-------------------|
| Question is directly about the query topic | +0.3 |
| Question would naturally arise while addressing query | +0.2 |
| Question is tangentially related | +0.1 |
| Question is unrelated | +0.0 |

**Example:**
```
Query: "Help me build something AI-powered"

Evolutionary Architecture asks: "What technical capabilities do we need for AI-native development?"
→ Building AI-powered things REQUIRES answering this → +0.3

Digital Experience asks: "How do customers expect to interact with AI?"
→ AI-powered products need UX decisions → +0.2
```

**Step 2b.2: Focus Overlap Test (Secondary)**

Check if query topics appear in (or are implied by) the radar's Focus statement:

| Result | Score Contribution |
|--------|-------------------|
| Query term explicitly in Focus | +0.2 |
| Query concept implied by Focus | +0.1 |
| No overlap | +0.0 |

**Example:**
```
Query: "Help me build something AI-powered"

Digital Experience Focus: "AI UX patterns and anti-patterns, AI-powered experiences"
→ "AI-powered" explicitly mentioned → +0.2

Evolutionary Architecture Focus: "agentic system architecture, AI-native development"
→ "AI-powered" implied by "AI-native" → +0.1
```

**Step 2b.3: Calculate Final Score**

```
relevance_score = question_score + focus_score
cap at 1.0
```

**⚠️ DO NOT use keyword matching as primary method.** Keywords in radar files are for human reference, not algorithmic matching. The semantic test is: "Would addressing the user's query benefit from this radar's perspective?"

**Score interpretation:**
- 0.7-1.0 = Strong relevance, direct match
- 0.4-0.6 = Moderate relevance, peripheral context
- 0.2-0.3 = Weak relevance, may discover via graph traversal
- 0.0-0.1 = No relevance

#### 2c: Classify Match Types

| Relevance Score | Match Type | Treatment |
|----------------|------------|-----------|
| >= 0.6 | `direct` | Load all signals from this radar |
| 0.3 - 0.59 | `peripheral` | Include in graph traversal |
| < 0.3 | `none` | Exclude unless reached via graph traversal |

---

### Step 3: Load Signals from Direct Matches

For each radar in `direct_matches`:

1. Read the radar file's `Signal Mappings` table
2. Load each mapped signal file from `{vault_path}/signals/` (paths are relative to vault)
3. Extract full signal content for STM
4. Track which radars each signal belongs to (for graph traversal)

```
loaded_radars = set()
loaded_signals = set()
signal_to_radars = {}  # signal_path → [radar1, radar2, ...]

for radar in direct_matches:
    loaded_radars.add(radar.name)
    for signal_path in radar.signal_mappings:
        signal_content = read_signal(signal_path)
        loaded_signals.add(signal_path)
        signal_to_radars[signal_path] = get_radars_for_signal(signal_path)
```

---

### Step 4: Graph Traversal for Related Signals

**Purpose**: Discover additional relevant context by following signal relationships across radars.

**Algorithm**: Breadth-first traversal with depth limit

```
MAX_DEPTH = 3
current_depth = 1

while current_depth <= MAX_DEPTH:
    new_radars_to_explore = set()

    # For each loaded signal, find other radars that reference it
    for signal_path in loaded_signals:
        for radar_name in signal_to_radars[signal_path]:
            if radar_name not in loaded_radars:
                new_radars_to_explore.add(radar_name)

    # Load signals from newly discovered radars
    for radar_name in new_radars_to_explore:
        radar = read_radar(radar_name)
        loaded_radars.add(radar_name)

        for signal_path in radar.signal_mappings:
            if signal_path not in loaded_signals:
                signal_content = read_signal(signal_path)
                loaded_signals.add(signal_path)
                signal_to_radars[signal_path] = get_radars_for_signal(signal_path)

    # Stop if no new radars discovered
    if len(new_radars_to_explore) == 0:
        break

    current_depth += 1
```

**Example Traversal:**

```
Query: "Help me build something AI-powered"

Depth 0: Semantic analysis
  → Direct: AI/Intelligence (0.9), Innovation (0.7)
  → Peripheral: Purpose (0.5), Technology (0.4)

Depth 1: Load signals from AI/Intelligence, Innovation
  → 18 signals loaded
  → augmentation-principle.md → also in Leadership, Purpose
  → pcam-framework.md → also in Architecture
  → v-bounce-model.md → also in Innovation (already loaded)

Depth 2: Load signals from Leadership, Purpose, Architecture
  → 15 more signals loaded
  → flywheel.md → also in Purpose (already loaded)
  → composability.md → also in Architecture (already loaded)

Depth 3: No new radars discovered
  → Stop traversal

Result: 6 radars explored, 33 signals loaded
```

---

### Step 5: Classify Match Types for Reporting

After graph traversal, classify radars for context.md:

```
For each loaded radar:
  If radar in direct_matches:
    → type: "direct"
    → confidence: semantic_relevance_score
    → trigger: matched_aspects
  Else if radar in peripheral_matches:
    → type: "peripheral"
    → confidence: 0.4
    → trigger: "semantic relevance" + matched_aspects
  Else:
    → type: "graph_traversal"
    → confidence: 0.3
    → trigger: "discovered via signal: {signal_name}"
```

---

### Step 6: Handle No Match

```
If no radars score >= 0.3:
  → Set flag: no_radar_match = true
  → This will trigger clarify intent
  → Skip graph traversal (no starting point)
```

---

### Step 7: Populate context.md

Write matched content to `context.md`:

```markdown
# STM Context

## Query

**Raw**: {verbatim query}
**Analysis**: {brief 1-line semantic interpretation}

---

## Radar Matches

### Direct Matches (Semantic Relevance >= 0.6)

#### {Radar Name} (confidence: {score})

**Match type**: Semantic direct match
**Reasoning**: {1-2 sentence explanation from semantic analysis}
**Matched aspects**: {list of aspects from semantic analysis}
**Source**: {vault_path}/radars/{radar-file}.md

**Radar questions**:
- {question 1}
- {question 2}
- {question 3}

**Signals loaded**:

##### {Signal Title}
**Path**: {vault_path}/signals/{path}

{Full signal content}

---

### Related Radars (Graph Traversal)

#### {Radar Name} (confidence: 0.3)

**Match type**: Discovered via graph traversal
**Discovery path**: Via signal "{signal_name}" from {source_radar}
**Source**: {vault_path}/radars/{radar-file}.md

**Signals loaded**:

##### {Signal Title}
**Path**: {vault_path}/signals/{path}

{Full signal content}

---

### Peripheral Matches (Not Loaded)

These radars had semantic relevance 0.3-0.59 but were not reached via graph traversal:

#### {Radar Name} (confidence: {score})
**Reasoning**: {explanation}

---

### No Matches

These radars had semantic relevance < 0.3:

- {Radar Name} (relevance: {score})

---

## Match Summary

| Radar | Match Type | Confidence | Method |
|-------|------------|------------|--------|
| AI/Intelligence | direct | 0.9 | Semantic: "AI-powered" |
| Innovation | direct | 0.7 | Semantic: "build something" |
| Leadership | graph_traversal | 0.3 | Via augmentation-principle.md |
| Purpose | peripheral | 0.5 | Not reached (semantic only) |
| Technology | none | 0.2 | Below threshold |

---

## Traversal Statistics

**Depth reached**: {max_depth}
**Radars loaded**: {count}
**Signals loaded**: {count}
**Graph traversal stops**: {reason}
```

---

### Step 8: Capture Initial State

Write to `state.md`:

```markdown
# STM State

## Initial State

**Timestamp**: {ISO timestamp}
**Recipe**: {recipe_id}
**Signal Source**: {user_prompt | schedule | webhook}

### Raw Query
{verbatim user input}

### Environment
- Working directory: {path}
- Git branch: {branch}
- Prior session: {session_id or null}

---

## Radar Scan Results

**Semantic analysis**: complete
**Direct matches**: {count} (relevance >= 0.6)
**Graph traversal matches**: {count} (discovered via signals)
**Peripheral matches**: {count} (relevance 0.3-0.59, not loaded)
**No matches**: {count} (relevance < 0.3)
**Signals loaded**: {count}
**No match flag**: {true|false}
**Traversal depth**: {max_depth reached}

---

## Execution State

**Current Step**: 1 (Build Routing Plan)
**Status**: pending

### Step Log

| Timestamp | Step | Status | Notes |
|-----------|------|--------|-------|
| {ts} | 0: Initialize STM | complete | {n} radars matched, {m} signals loaded |
```

---

### Step 9: Initialize Intent State

Write to `intents.md`:

```markdown
# STM Intent State

## Status

**Status**: pending_identification
**Detected**: []
**Confidence**: null
**Sequence**: null

---

## Radar Context for Intent Detection

**Direct matched radars**: {list}
**Peripheral matched radars**: {list}
**No radar match**: {true|false} → triggers clarify if true

---

## Intent History

(Empty - pending initial identification)
```

---

## Outputs

| Output | Description |
|--------|-------------|
| `stm_path` | Path to initialized STM workspace |
| `radar_matches` | Object with direct and peripheral matches |
| `signals_loaded` | List of signal paths loaded into context |
| `no_radar_match` | Boolean - true if no radars matched |

## Success Criteria

- [ ] STM workspace directory created (with outputs/ and evidence/ subdirectories)
- [ ] Semantic query analysis performed
- [ ] All radars analyzed for semantic relevance (0.0-1.0 scores)
- [ ] Direct match signals loaded (relevance >= 0.6)
- [ ] Graph traversal completed (depth <= 3)
- [ ] Related radar signals loaded via graph traversal
- [ ] Signal content extracted to context.md with match types
- [ ] Traversal statistics recorded
- [ ] Initial state captured in state.md
- [ ] Intent state initialized in intents.md

## Error Handling

| Error | Action |
|-------|--------|
| Cannot create workspace | Fail recipe, surface to user |
| Semantic analysis fails | Fall back to keyword matching, log warning |
| Radar file missing | Warn, skip that radar, continue |
| Signal file missing | Warn, note in context, continue |
| No radar matches at all | Set flag, proceed (clarify will handle) |
| Graph traversal depth exceeded | Stop at MAX_DEPTH, log statistics |
| Circular signal references | Detect cycles, skip already-loaded signals |
| Prior session conflict | Prompt user: resume or start fresh |

---

**Version**: 2.0.0
**Last Updated**: 2026-01-06
**Changes**: Renamed from `phoenix-context-initialize-stm`. Absorbed `phoenix-vault-analyze-query-semantics` as internal step (no longer separate skill). Updated to Engine namespace.
