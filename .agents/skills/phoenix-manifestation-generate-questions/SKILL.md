---
name: phoenix-manifestation-generate-questions
description: Generate signal-grounded clarifying questions based on request analysis. Manifestation domain skill that produces questions derived from intent-defined shapes and STM signals.
user-invocable: false
---

# Generate Questions

Generate focused, signal-grounded clarifying questions that resolve ambiguity and unblock progress. This is a **Manifestation** domain skill - producing outputs based on perception and cognition.

## When to Use

- **After**: `phoenix-perception-analyze-request` (requires analysis output as input)
- **Before**: User response → `phoenix-cognition-evaluate-understanding`
- **Trigger**: Analysis indicates `recommended_action: clarify` or `clarify_light`
- **By**: Any agent that needs to generate clarifying questions

## PCAM Domain

**Manifestation** - Producing artifacts, outputs, deliverables.

## Position in Chain

```
┌─────────────────────────────────┐
│  phoenix-perception-            │
│  analyze-request                │
│  Output: analysis object        │
└─────────────────────────────────┘
      │
      ▼ analysis
┌─────────────────────────────────┐
│  phoenix-manifestation-         │  ◄── YOU ARE HERE
│  generate-questions             │
│  (Generation: What questions    │
│   should we ask?)               │
└─────────────────────────────────┘
      │
      ▼ questions
┌─────────────────────────────────┐
│  Present to user                │
│  User responds                  │
└─────────────────────────────────┘
      │
      ▼ user_response
┌─────────────────────────────────┐
│  phoenix-cognition-             │
│  evaluate-understanding         │
│  (or re-analyze if still vague) │
└─────────────────────────────────┘
```

---

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `analysis` | Yes | Output from `phoenix-perception-analyze-request` |
| `stm_path` | Yes | Path to STM workspace (for context.md signals) |
| `intent` | Yes | Current intent (`clarify`, `consult`, `decide`, etc.) |
| `intent_definition_path` | Yes | Path to intent definition (e.g., `@memory/engine/intents/cto-intents.md`) |
| `max_questions` | No | Maximum questions to generate (default: 4) |

---

## Instructions

### Step 1: Read Intent Definition for Question Shapes

Load the question framing structure from the intent definition file at `intent_definition_path`.

**Locate the Framing Structure section for the current intent:**

```markdown
### Framing Structure

**Goal**: [Intent-specific goal]

**Question shapes** (used to gather information):
- "What specifically...?" — narrow scope
- "Who/what/when/where...?" — fill gaps
- "What does [term] mean to you?" — define terms
- "What would success look like?" — clarify outcomes

**Input complete when**: [Completion criteria]
```

**Store the shapes for the current intent.**

**Example shapes by intent:**

| Intent | Question Shapes |
|--------|-----------------|
| `clarify` | "What specifically...?", "Who/what/when/where...?", "What does [term] mean to you?", "What would success look like?" |
| `consult` | "What have you tried so far?", "What specifically is blocking you?", "What constraints are you working within?", "What would 'solved' look like?" |
| `decide` | "What criteria matter most?", "What are the constraints?", "What happens if you choose wrong?", "Who else is affected?" |
| `validate` | "What assumptions are you making?", "What could cause this to fail?", "What are you NOT doing?", "What's your fallback?" |

---

### Step 2: Read Required Dimensions from Intent Definition

Load the completion criteria to understand which dimensions MUST be covered:

```markdown
**Input complete when**: User provides concrete specifics for WHAT, WHO, WHY, and CONSTRAINTS
```

Extract required dimensions: `[WHAT, WHO, WHY, CONSTRAINTS]`

---

### Step 3: Read STM Signals

Load signals from `{stm_path}/context.md`:

```markdown
For each signal in STM:
  - Extract: title, path, content, implications
  - Index by: keywords, radar source
```

Build a signal lookup that can be queried by topic/keyword.

---

### Step 4: Group by Signal Lens (Signal-First Format)

Instead of generating individual questions, group questions by the **signal** that grounds them. This teaches the user the mental model while gathering information.

**4a: Identify unique signals from analysis**

```
From analysis.signal_mapping, extract unique signals:
  - augmentation-principle.md → covers: AI-powered buzzword, WHY dimension
  - pcam-framework.md → covers: WHAT dimension (type of system)
  - build-vs-buy.md → covers: HOW/CONSTRAINTS dimension
```

**4b: For each signal, build a question block**

A question block contains:
1. **Signal reference** — path to the signal
2. **Core insight** — the key message from the signal (1-2 sentences)
3. **Questions** — multiple questions derived from this signal's framework, using shapes from Step 1
4. **Examples** — concrete options for each question

```json
{
  "signal_path": "@{user-vault}/signals/ai/augmentation-principle.md",
  "radar": "AI / Intelligence",
  "core_insight": "AI should augment human capabilities, not replace judgment. Success = humans become more effective, not obsolete.",
  "questions": [
    {
      "id": "q1",
      "question": "What human capability should AI augment?",
      "dimension": "WHY",
      "examples": [
        "Research speed (help find answers faster)",
        "Attention/review (help catch errors)",
        "Pattern recognition (help spot trends)",
        "Creative throughput (help produce drafts)"
      ]
    },
    {
      "id": "q2",
      "question": "What does success look like?",
      "dimension": "WHY",
      "examples": [
        "Reduce task time from X to Y",
        "Enable non-experts to do Z",
        "Catch N% of issues before production"
      ]
    }
  ]
}
```

**4c: Create block for questions without signal grounding**

For dimensions with no relevant signal in STM:

```json
{
  "signal_path": null,
  "radar": null,
  "core_insight": "Context needed (no signal found — using logical reasoning)",
  "questions": [
    {
      "id": "q5",
      "question": "Who are the users or customers?",
      "dimension": "WHO",
      "examples": [
        "Internal team (developers, ops, support)",
        "Business customers (enterprise, SMB)",
        "Consumers (end users)",
        "Developers (API consumers)"
      ]
    }
  ]
}
```

---

### Step 5: Ensure Required Dimensions Coverage

Check that all required dimensions (from Step 2) are covered across question blocks:

| Dimension | Required | Covered By |
|-----------|----------|------------|
| WHAT | ✓ | Signal block or context block |
| WHO | ✓ | Signal block or context block |
| WHY | ✓ | Signal block or context block |
| CONSTRAINTS | ✓ | Signal block or context block |
| WHEN | Optional | Include if relevant |
| WHERE | Optional | Include if relevant |

**If a required dimension is missing:**
- Add it to the "Context needed" block
- Use logical reasoning for why it matters

---

### Step 6: Order Question Blocks

Order blocks by signal relevance:

1. **Primary signal blocks** — Signals that directly address buzzwords or critical dimensions
2. **Supporting signal blocks** — Signals that provide additional frameworks
3. **Context block** — Questions without signal grounding (always last)

Within each block, questions are already ordered by the signal's logical flow.

---

### Step 7: Format Output (Signal-First Presentation)

Structure for user presentation:

```markdown
## From: AI Augmentation Principle
**Source**: @{user-vault}/signals/ai/augmentation-principle.md
**Radar**: AI / Intelligence

AI should augment human capabilities, not replace judgment.
Success = humans become more effective, not obsolete.

**Questions**:

1. **What human capability should AI augment?**
   - Research speed (help find answers faster)
   - Attention/review (help catch errors)
   - Pattern recognition (help spot trends)
   - Creative throughput (help produce drafts)

2. **What does success look like?**
   - Reduce task time from X to Y
   - Enable non-experts to do Z
   - Catch N% of issues before production

---

## From: PCAM Framework
**Source**: @{user-vault}/signals/ai/pcam-framework.md
**Radar**: AI / Intelligence

Four dimensions define AI systems: Perception, Cognition, Agency, Manifestation.
Most "AI features" are perception-only with no real agency.

**Questions**:

3. **What type of thing are you building?**
   - A product feature (e.g., AI-powered search)
   - A standalone tool (e.g., internal assistant)
   - A platform/API (e.g., AI service for other apps)
   - An agentic system (e.g., autonomous workflow)

---

## Context Needed
**Source**: No signal found — using logical reasoning

**Questions**:

4. **Who are the users or customers?**
   - Internal team (developers, ops, support)
   - Business customers (enterprise, SMB)
   - Consumers (end users)
   - Developers (API consumers)

5. **What constraints exist?**
   - Timeline (MVP in weeks vs production in months)
   - Budget ($0 free tier vs $50K/month inference)
   - Team (solo dev vs ML engineers)
   - Data (public only vs proprietary)
```

**Benefits of this format:**
- Shows user HOW questions derive from frameworks
- Educational — user learns the mental model
- Groups related questions logically
- Less repetitive than per-question citations

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `question_blocks` | array | Ordered list of signal-grouped question blocks |
| `total_questions` | int | Total number of questions across all blocks |
| `signal_coverage` | float | Percentage of questions with signal grounding |
| `dimensions_covered` | object | Which required dimensions are covered |
| `status` | enum | `needs_clarification` |

**Output Schema:**

```json
{
  "question_blocks": [
    {
      "id": "block-1",
      "signal_path": "@{user-vault}/signals/ai/augmentation-principle.md",
      "radar": "AI / Intelligence",
      "core_insight": "AI should augment human capabilities, not replace judgment. Success = humans become more effective, not obsolete.",
      "questions": [
        {
          "id": "q1",
          "question": "What human capability should AI augment?",
          "dimension": "WHY",
          "examples": ["Research speed", "Attention/review", "Pattern recognition", "Creative throughput"]
        },
        {
          "id": "q2",
          "question": "What does success look like?",
          "dimension": "WHY",
          "examples": ["Reduce time from X to Y", "Enable non-experts to Z", "Catch N% of issues"]
        }
      ]
    },
    {
      "id": "block-2",
      "signal_path": "@{user-vault}/signals/ai/pcam-framework.md",
      "radar": "AI / Intelligence",
      "core_insight": "Four dimensions: Perception, Cognition, Agency, Manifestation. Most AI features are perception-only.",
      "questions": [
        {
          "id": "q3",
          "question": "What type of thing are you building?",
          "dimension": "WHAT",
          "examples": ["Product feature", "Standalone tool", "Platform/API", "Agentic system"]
        }
      ]
    },
    {
      "id": "block-context",
      "signal_path": null,
      "radar": null,
      "core_insight": "Context needed — using logical reasoning",
      "questions": [
        {
          "id": "q4",
          "question": "Who are the users or customers?",
          "dimension": "WHO",
          "examples": ["Internal team", "Business customers", "Consumers", "Developers"]
        },
        {
          "id": "q5",
          "question": "What constraints exist?",
          "dimension": "CONSTRAINTS",
          "examples": ["Timeline", "Budget", "Team", "Data"]
        }
      ]
    }
  ],
  "total_questions": 5,
  "signal_coverage": 0.6,
  "dimensions_covered": {
    "WHAT": true,
    "WHO": true,
    "WHY": true,
    "CONSTRAINTS": true
  },
  "dimensions_missing": [],
  "status": "needs_clarification"
}
```

---

## Question Quality Checklist

Before finalizing each question, verify:

- [ ] **Focused**: Asks one thing, not multiple things
- [ ] **Actionable**: User can answer it concretely
- [ ] **Unblocking**: Answering it enables progress
- [ ] **Grounded**: Either cites signal or explains logical reasoning
- [ ] **Exampled**: Provides concrete options to help user respond
- [ ] **Non-leading**: Doesn't push toward a specific answer

**Anti-patterns to avoid:**

| Anti-pattern | Example | Problem |
|--------------|---------|---------|
| Compound question | "What users and what scale?" | Two questions in one |
| Yes/no question | "Do you need AI?" | Doesn't gather information |
| Leading question | "Don't you think microservices would be better?" | Biases response |
| Vague question | "Tell me more about the project" | Too open-ended |
| Jargon-heavy | "What's your CQRS strategy?" | May confuse user |

---

## Success Criteria

- [ ] Question shapes loaded from intent definition (not hardcoded)
- [ ] Required dimensions loaded from intent definition
- [ ] All required dimensions covered (per intent definition)
- [ ] Questions grouped by signal lens (not individual citations)
- [ ] Each signal block has: path, core insight, derived questions
- [ ] Context block exists for questions without signal grounding
- [ ] Examples provided for each question
- [ ] Signal-first format used in presentation
- [ ] No forced/weak citations — logical reasoning is acceptable

---

## Error Handling

| Error | Action |
|-------|--------|
| No analysis provided | Fail with "Requires analyze-request output" |
| STM path not found | Generate questions without signal grounding |
| Intent definition not found | Use default question shapes |
| No buzzwords AND no missing dimensions | Return `status: proceed` (nothing to clarify) |

---

## Integration Notes

### Receiving from phoenix-perception-analyze-request

```python
# Pseudo-code
analysis = phoenix_perception_analyze_request(query, stm_path, intent)

if analysis.recommended_action in ["clarify", "clarify_light"]:
    questions = phoenix_manifestation_generate_questions(
        analysis=analysis,
        stm_path=stm_path,
        intent=intent,
        intent_definition_path="@memory/engine/intents/cto-intents.md",
        max_questions=4
    )
```

### Passing to Agent for Presentation

The agent receives `question_blocks` and formats using the **signal-first** presentation template (see Step 7).

### After User Response

User response flows to:
1. `phoenix-engine-stm-update` (update STM with response)
2. Either:
   - `phoenix-perception-analyze-request` again (if response still vague)
   - `phoenix-cognition-evaluate-understanding` (if clarified enough to proceed)

---

**Version**: 2.0.0
**Last Updated**: 2026-01-06
**Changes**: Renamed from `consult-clarify-requirements` to `phoenix-manifestation-generate-questions`. Updated to PCAM namespace. Added `intent` and `intent_definition_path` inputs. Question shapes and required dimensions now come from intent definition (not hardcoded).
