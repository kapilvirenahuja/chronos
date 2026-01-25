---
name: phoenix-perception-analyze-request
description: Analyze incoming request for complexity, vagueness, and missing context. Perception domain skill that provides structured analysis for any intent requiring request understanding.
user-invocable: false
---

# Analyze Request

Classify the complexity of a request and detect vagueness, buzzwords, and missing context. This is a **Perception** domain skill - understanding what we're dealing with before taking action.

## When to Use

- **Before**: Any skill that needs request analysis (e.g., `phoenix-manifestation-generate-questions`)
- **Trigger**: Agent receives a query that may need clarification or analysis
- **By**: Any agent handling clarify/consult/decide/validate intents

## PCAM Domain

**Perception** - Understanding inputs, extracting meaning, classifying content.

## Position in Chain

```
Query arrives
      │
      ▼
┌─────────────────────────────────┐
│  phoenix-perception-            │  ◄── YOU ARE HERE
│  analyze-request                │
│  (Perception: What are we       │
│   dealing with?)                │
└─────────────────────────────────┘
      │
      ▼ analysis
┌─────────────────────────────────┐
│  phoenix-manifestation-         │
│  generate-questions             │
│  (Generation: What questions    │
│   should we ask?)               │
└─────────────────────────────────┘
      │
      ▼ questions → user responds
┌─────────────────────────────────┐
│  phoenix-cognition-             │
│  evaluate-understanding         │
│  (Evaluation: Is it complete?)  │
└─────────────────────────────────┘
```

---

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `query` | Yes | The user's raw query (verbatim) |
| `stm_path` | Yes | Path to STM workspace (for context.md access) |
| `intent` | Yes | Current intent (`clarify`, `consult`, `decide`, `validate`, `advise`) |

---

## Instructions

### Step 1: Tokenize and Parse Query

Break the query into analyzable components:

```
Input: "Help me build something AI-powered"

Tokenized:
  - verbs: [help, build]
  - nouns: [something]
  - modifiers: [AI-powered]
  - structure: request + undefined_target + buzzword_modifier
```

**Parse for:**

| Component | Detection | Example |
|-----------|-----------|---------|
| Action verbs | What user wants to do | build, create, fix, decide, review |
| Target nouns | What they're acting on | system, API, feature, plan |
| Modifiers | Constraints or qualities | AI-powered, scalable, fast, modern |
| Quantifiers | Scale or scope indicators | 10k users, enterprise, MVP |

---

### Step 2: Detect Vagueness Indicators

Score vagueness (0.0 - 1.0) based on these indicators:

| Indicator | Weight | Detection Pattern | Example |
|-----------|--------|-------------------|---------|
| **Undefined target** | 0.3 | "something", "stuff", "things", "it" | "build something" |
| **Missing specifics** | 0.2 | No quantifiers, no constraints | "make it scalable" (to what?) |
| **Pronoun without referent** | 0.2 | "it", "this", "that" with no antecedent | "improve it" |
| **Abstract goals** | 0.15 | "better", "good", "nice", "modern" | "make it better" |
| **Missing actor** | 0.15 | No user/customer/stakeholder defined | "users will love it" (which users?) |

**Vagueness Score Calculation:**

```
vagueness_score = sum(detected_indicator_weights)
capped at 1.0
```

| Score | Classification |
|-------|----------------|
| 0.0 - 0.2 | Clear |
| 0.2 - 0.5 | Somewhat vague |
| 0.5 - 0.8 | Vague |
| 0.8 - 1.0 | Very vague |

---

### Step 3: Detect Buzzwords

Match against known buzzword patterns. Buzzwords are terms that sound meaningful but lack specificity without context.

**Buzzword Registry:**

| Category | Buzzwords | Why Problematic |
|----------|-----------|-----------------|
| **AI/Tech** | AI-powered, ML-driven, intelligent, smart, automated | What capability? What augmentation? |
| **Scale** | scalable, enterprise-grade, production-ready | Scale to what? What load? |
| **Quality** | modern, cutting-edge, best-in-class, robust | Compared to what? |
| **Speed** | fast, real-time, instant, quick | What latency? What throughput? |
| **User** | user-friendly, intuitive, seamless | For whom? Doing what? |
| **Business** | disruptive, innovative, game-changing | How? What problem? |

**For each buzzword detected:**

```markdown
Buzzword: "AI-powered"
Category: AI/Tech
Challenge question: "What specific capability should AI provide?"
Related signal (if in STM): @{user-vault}/signals/ai/augmentation-principle.md
```

---

### Step 4: Identify Missing Dimensions (5W1H Analysis)

Check which fundamental dimensions are undefined:

| Dimension | Question | Detection | Status |
|-----------|----------|-----------|--------|
| **What** | What specifically is being built/solved? | Target noun defined? | ❌ Missing / ✅ Present |
| **Who** | Who are the users/customers/stakeholders? | Actor mentioned? | ❌ Missing / ✅ Present |
| **Why** | What problem does this solve? | Problem statement present? | ❌ Missing / ✅ Present |
| **When** | What timeline/urgency? | Timeline mentioned? | ❌ Missing / ✅ Present |
| **Where** | What context/environment/platform? | Context provided? | ❌ Missing / ✅ Present |
| **How** | What approach/constraints/resources? | Constraints stated? | ❌ Missing / ✅ Present |

**Missing Dimension Output:**

```markdown
Missing Dimensions:
- WHAT: Target is "something" (undefined)
- WHO: No users/customers specified
- WHY: No problem statement
- HOW: No constraints mentioned

Present Dimensions:
- WHEN: (not mentioned, but not critical for initial clarify)
- WHERE: (not mentioned, but not critical for initial clarify)
```

---

### Step 5: Classify Complexity

Based on the analysis, classify overall complexity:

| Complexity | Criteria | Typical Clarification Rounds |
|------------|----------|------------------------------|
| **Simple** | 1-2 missing dimensions, no buzzwords, vagueness < 0.3 | 0-1 |
| **Moderate** | 2-3 missing dimensions, 1-2 buzzwords, vagueness 0.3-0.6 | 1-2 |
| **Complex** | 4+ missing dimensions, 3+ buzzwords, vagueness > 0.6 | 2-3 |
| **Undefined** | Cannot determine scope at all | Requires fundamental reframe |

---

### Step 6: Map to STM Signals

Read `{stm_path}/context.md` and identify which loaded signals are relevant to the detected buzzwords and missing dimensions:

```markdown
Signal Mapping:

Buzzword: "AI-powered"
  → Signal: @{user-vault}/signals/ai/augmentation-principle.md
  → Relevance: Addresses "what capability should AI augment"
  → Implication: "AI should augment capabilities, not replace judgment"

Missing Dimension: WHAT (undefined target)
  → Signal: @{user-vault}/signals/ai/pcam-framework.md
  → Relevance: Provides framework to evaluate "AI-powered" proposals
  → Implication: "Use PCAM to evaluate any AI-powered proposal"

No signal found for: WHO (users/customers)
  → Note: No user/customer signals loaded; use logical reasoning
```

**If no relevant signal exists in STM:**
- Mark as "No signal found"
- Downstream skills will use logical reasoning instead

---

### Step 7: Determine Recommended Action

Based on analysis, recommend next action:

| Condition | Recommended Action |
|-----------|-------------------|
| vagueness_score > 0.5 OR missing_dimensions >= 3 | `clarify` (generate questions) |
| vagueness_score 0.2-0.5 AND missing_dimensions 1-2 | `clarify_light` (1-2 targeted questions) |
| vagueness_score < 0.2 AND missing_dimensions == 0 | `proceed` (skip to next intent) |
| Contradiction detected | `resolve_conflict` (surface to user) |

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `query_parsed` | object | Tokenized query (verbs, nouns, modifiers, structure) |
| `vagueness_score` | float | 0.0-1.0 score of how vague the query is |
| `vagueness_indicators` | array | List of detected vagueness patterns |
| `buzzwords_detected` | array | List of buzzwords with category and challenge question |
| `missing_dimensions` | array | 5W1H dimensions that are undefined |
| `present_dimensions` | array | 5W1H dimensions that are defined |
| `complexity` | enum | `simple` \| `moderate` \| `complex` \| `undefined` |
| `signal_mapping` | object | Map of buzzwords/dimensions to relevant STM signals |
| `recommended_action` | enum | `clarify` \| `clarify_light` \| `proceed` \| `resolve_conflict` |

**Output Schema:**

```json
{
  "query_parsed": {
    "raw": "Help me build something AI-powered",
    "verbs": ["help", "build"],
    "nouns": ["something"],
    "modifiers": ["AI-powered"],
    "structure": "request + undefined_target + buzzword_modifier"
  },
  "vagueness_score": 0.7,
  "vagueness_indicators": [
    {"indicator": "undefined_target", "weight": 0.3, "trigger": "something"},
    {"indicator": "missing_specifics", "weight": 0.2, "trigger": "no constraints"},
    {"indicator": "missing_actor", "weight": 0.15, "trigger": "no users defined"}
  ],
  "buzzwords_detected": [
    {
      "term": "AI-powered",
      "category": "AI/Tech",
      "challenge_question": "What specific capability should AI provide?",
      "related_signal": "@{user-vault}/signals/ai/augmentation-principle.md"
    }
  ],
  "missing_dimensions": [
    {"dimension": "WHAT", "reason": "Target is 'something' (undefined)"},
    {"dimension": "WHO", "reason": "No users/customers specified"},
    {"dimension": "WHY", "reason": "No problem statement"},
    {"dimension": "HOW", "reason": "No constraints mentioned"}
  ],
  "present_dimensions": [],
  "complexity": "complex",
  "signal_mapping": {
    "AI-powered": {
      "signal": "@{user-vault}/signals/ai/augmentation-principle.md",
      "relevance": "Addresses what capability AI should augment",
      "implication": "AI should augment capabilities, not replace judgment"
    },
    "WHAT": {
      "signal": "@{user-vault}/signals/ai/pcam-framework.md",
      "relevance": "Framework to evaluate AI proposals",
      "implication": "Use PCAM to evaluate any AI-powered proposal"
    },
    "WHO": {
      "signal": null,
      "relevance": "No signal found",
      "implication": "Use logical reasoning"
    }
  },
  "recommended_action": "clarify"
}
```

---

## Success Criteria

- [ ] Query tokenized into verbs, nouns, modifiers
- [ ] Vagueness score calculated with indicator breakdown
- [ ] All buzzwords detected and categorized
- [ ] 5W1H analysis complete (all 6 dimensions evaluated)
- [ ] Complexity classified
- [ ] STM signals mapped to buzzwords/dimensions
- [ ] Recommended action determined

---

## Error Handling

| Error | Action |
|-------|--------|
| Empty query | Return `recommended_action: clarify` with note "No query provided" |
| STM path not found | Warn, proceed without signal mapping |
| Cannot parse query | Return raw query with `complexity: undefined` |

---

## Integration Notes

### Passing to phoenix-manifestation-generate-questions

The output of this skill becomes the primary input for question generation:

```
analyze-request output
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ generate-questions receives:                               │
│                                                           │
│ - buzzwords_detected → Generate signal-grounded questions │
│ - missing_dimensions → Generate dimension questions       │
│ - signal_mapping → Cite sources in questions              │
│ - complexity → Determine how many questions to ask        │
└───────────────────────────────────────────────────────────┘
```

### STM Update

After analysis, optionally write analysis to STM for audit:

```
{stm_path}/evidence/analysis-{timestamp}.json
```

---

**Version**: 2.0.0
**Last Updated**: 2026-01-06
**Changes**: Renamed from `consult-analyze-request` to `phoenix-perception-analyze-request`. Updated to PCAM namespace. Clarified as reusable Perception skill.
