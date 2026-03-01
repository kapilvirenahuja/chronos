# Chronos — Claude Code Instructions

> Project-level instructions for Claude Code when working in this repository

---

## Naming & Branding Hierarchy

| Layer | Name | What It Is |
|-------|------|-----------|
| **Philosophy** | **IDD** — Intent-Driven Design | Mental model for building anything intent-first |
| **Philosophical Models** | **PCAM** — Perception, Cognition, Agency, Manifestation | Structural thinking model — how systems are shaped |
| **Philosophical Models** | **The Four Crafts** | Quality bar — what makes each piece excellent |
| **Methods** | **IDSD** — Intent-Driven Software Development | IDD applied to software development |
| **Methods** | **Life OS** | IDD applied to personal knowledge management |
| **Architecture** | **Phoenix** — Pattern Language | Technical DNA: Signal → Recipe → Agent → Skill → Memory |
| **Products** | **Meridian-OS** | IDSD + Phoenix → software development tool |
| **Products** | **Chronos** | Life OS + Phoenix + PCAM harness → personal AI & knowledge work |

### PCAM Model (Structural Backbone)

Perception → Cognition → Agency → Manifestation

| Layer | Role | In Chronos |
|-------|------|-----------|
| **Perception** | Signals in — how the system receives input | Claude Code, webhooks, chat channels (Telegram/WhatsApp/Discord), heartbeat/cron |
| **Cognition** | The brain — reasoning, intent detection, orchestration | Intent engine, context engine, recipes (prompt craft), spec engine, agents |
| **Agency** | Tools out — how the system acts on the world | Sandboxed execution, shell, browser, filesystem, computer control, self-modification |
| **Manifestation** | Memory — how knowledge is stored and retrieved | LTM (vault: radars + signals), STM (session workspaces), consolidation, search |

### The Four Crafts (Quality Disciplines)

Every recipe must be excellent across all four:

| Craft | What It Means |
|-------|--------------|
| **Prompt Crafting** | What the recipe says and does — exhaustive, high-effectiveness prompts with embedded persona, reasoning frameworks, output shapes |
| **Context Crafting** | What knowledge is available and when — STM built from LTM at recipe start, persisted for session, incrementally updated |
| **Intent Crafting** | What the user wants to achieve — hierarchical intents with goals, constraints, failure conditions, acceptance criteria, auto-decomposition |
| **Spec Crafting** | What the knowledge guarantees — structural contracts for vault/radar/signal, recipe generation from specs, eval generation |

### Key Architectural Principles

- **Recipes define WHAT** (the exhaustive prompt), **Agents determine HOW** (execution autonomy)
- **Memory methods live in the repo**, actual memory data is **external and user-specific**
- **Specs are structural definitions in markdown** — open-ended conventions, not rigid APIs
- **Intents are first-class citizens** — hierarchical, auto-decomposable, with completion criteria
- **Context is built once from LTM at recipe start**, persisted for the session, updated incrementally (add gaps, remove noise)

---

## Critical Requirements

### 1. Procedural Pattern Compliance (MANDATORY)

**When executing recipes that inherit orchestration patterns, you MUST follow the procedural steps in order. Do not optimize for speed.**

This applies to all Level 2+ recipes, including `consult-cto`.

#### Non-Negotiable Rules

1. **Steps MUST execute in order** — Step 0 before Step 1, Step 1 before Step 2, etc.
2. **Step 0 (Initialize STM) is MANDATORY** — Initialize STM before any other work. No exceptions.
3. **Auto-verify completion** — Each step must complete successfully before the next begins (no human verification required).
4. **No skipping "setup" steps** — Infrastructure steps (STM, context loading) are not optional overhead.
5. **Pattern compliance over response speed** — A slow, correct execution beats a fast, broken one.

#### ⛔ Response Gates (MANDATORY)

For Level 2 recipes, you may ONLY output to user when ONE of these conditions is met:

| Gate | Condition | What to Output |
|------|-----------|----------------|
| **Clarification** | Agent returns `needs_clarification` | Present clarifying questions per format |
| **Blocked** | Agent returns `blocked` | Explain blocker, request user action |
| **Synthesis** | Step 4 complete (all agents done) | Present final synthesis |
| **Error** | Unrecoverable error | Explain failure, suggest recovery |

**Steps 0, 1, 2 execute SILENTLY.** No status updates. No confirmations. No "proceeding to Step X".

Violation of response gates = pattern breach.

#### ⛔ DO NOT (Level 2 Recipes)

- DO NOT say "Step 0 complete" or any step completion status
- DO NOT say "Proceeding to Step X" or "Now executing Step X"
- DO NOT output anything between steps until a response gate is reached
- DO NOT treat step completion as a user response point
- DO NOT ask for confirmation to proceed between steps
- DO NOT summarize what you're about to do before doing it

**Execute silently until a response gate is reached.**

#### ⛔ Skill Output Handling (CRITICAL)

When executing skills during Steps 0, 1, 2:

**Skill outputs are INTERNAL ONLY. Never display to user.**

| Output Type | Correct Handling | Wrong Handling |
|-------------|------------------|----------------|
| JSON schemas/outputs | Write to STM `outputs/` folder | Display to user |
| Completeness scores | Keep in working memory | Show evaluation table |
| Semantic analysis | Use internally, write to STM | Show match results |
| Routing plans | Write to STM, use for execution | Display JSON |
| Intermediate processing | Keep in working memory | Narrate steps |

**The user should see NOTHING until a response gate is reached.**

After response gates:
- **Clarification gate**: Show only the clarifying questions (formatted per template)
- **Synthesis gate**: Show only the Strategic Brief (human-readable summary)
- **Blocked gate**: Explain the blocker
- **Error gate**: Explain the failure

Internal artifacts (JSON, scores, analysis) go to STM files, not to user output.

#### Step 0 Completion Criteria (Auto-Verified)

Step 0 completes automatically when all of the following exist:
- STM workspace at `.phoenix-os/stm/{recipe-id}-{timestamp}/`
- `state.md`, `context.md`, `intents.md` files
- LTM patterns loaded
- Initial state captured

**No human verification required.** Proceed directly to Step 1 after initialization.

#### Why This Matters

- **STM is the execution workspace** — Without it, there's no persistent state for re-invocation cycles
- **Agents read/write to STM** — Skipping initialization means agents operate without shared context
- **Debugging requires state** — When things fail, STM provides the audit trail
- **Pattern integrity** — Partial execution breaks the orchestration contract

Reference: `@memory/engine/flows/recipe-orchestration-pattern.md`

---

### 1a. Intent Execution Gate (MANDATORY)

**Before executing ANY intent (including user-selected intents from routing options), you MUST verify availability.**

#### Pre-Execution Checklist

Before executing an intent:

1. **Read recipe's `intent_bindings` table** (in the recipe file or loaded recipe config)
2. **Check: Is the intent listed?** If NO → blocked
3. **Check: Is the intent status "active"?** If NO → blocked
4. **If blocked** → Return blocked status, do NOT execute

#### Blocking Response Format

When an intent is unavailable:

```markdown
**Status**: blocked
**Reason**: Intent `{intent_name}` is not available in this recipe.

**Available intents**:
{For each binding where status == "active":}
- `{intent}` — {description}

**Planned intents** (not yet active):
{For each binding where status == "planned":}
- `{intent}`

Would you like to proceed with one of the available intents?
```

#### What This Gate Prevents

| Scenario | Without Gate | With Gate |
|----------|--------------|-----------|
| User selects unavailable intent | Execute anyway (wrong) | Block and inform |
| Intent exists in domain but not bound | Execute anyway (wrong) | Block and inform |
| Intent bound but status = "planned" | Execute anyway (wrong) | Block and inform |

#### User Requests Do NOT Override

**This is critical.** Even if:
- User explicitly requests the intent
- The intent exists in the domain file (e.g., `cto-intents.md`)
- You "know how" to execute it from training

...you MUST check bindings first. **Recipe bindings are the source of truth for availability, not intent definitions.**

#### Why This Matters

- **Recipe controls scope** — Not all intents are appropriate for all recipes
- **Phased rollout** — Intents can be planned but not active yet
- **Prevents ungrounded execution** — Executing unbound intents bypasses the skill chain and signal grounding
- **Auditability** — Only bound intents have defined agent assignments and outputs

---

### 2. Procedural State Tracking via TodoWrite (MANDATORY)

**Problem**: Instructions alone don't survive context switches. Without external state, execution defaults to conversational patterns (do something → report back).

**Solution**: Use TodoWrite to create external execution state that persists across tool invocations.

#### At Recipe Start

Immediately create todos for all procedural steps:

```
TodoWrite([
  { content: "Step 0: Initialize STM", status: "pending", activeForm: "Initializing STM" },
  { content: "Step 1: Build routing plan", status: "pending", activeForm: "Building routing plan" },
  { content: "Step 2: Execute routing plan", status: "pending", activeForm: "Executing routing plan" },
  { content: "Step 3: Reach response gate", status: "pending", activeForm: "Reaching response gate" }
])
```

#### During Execution

- Mark each step `in_progress` before starting it
- Mark each step `completed` immediately after finishing it
- Only ONE step should be `in_progress` at a time

#### The Rule

> **If any silent step (0, 1, 2) is `in_progress` or `pending`, you are NOT at a response gate. Continue execution silently.**

#### Pre-Output Check (MANDATORY)

Before ANY text output to user during Level 2 recipes:

1. Check TodoWrite state
2. Are Steps 0, 1, 2 all `completed`?
3. Is Step 3 (response gate) `in_progress`?
4. Is a gate condition met (clarify | blocked | synthesis | error)?

If YES to all → output per gate format
If NO to any → continue execution silently

#### Why This Works

- **External state** — Todos persist across tool invocations
- **Visible progress** — User can see execution state
- **Natural continuation** — `in_progress` on a silent step = "not done yet"
- **System reinforcement** — System nudges about TodoWrite become "check your state" prompts

---

## Memory Architecture

Chronos separates memory into distinct layers with different purposes. Memory **methods** (how to create, access, manage) live in the repo. Actual memory **data** is external and user-specific — enabling multiple users to run the same harness with their own knowledge.

### Memory Structure

```
memory/
├── engine/              # Phoenix OS system (ships with Phoenix)
│   ├── intents/         # Intent definitions & classification rules
│   ├── flows/           # Orchestration patterns
│   └── schemas/         # Data schemas
└── vault/               # User's knowledge (accumulated LTM)
    ├── radars/          # 7 classification lenses (keywords + signal mappings)
    └── signals/         # Actual content (organized by category)
        ├── ai/
        ├── evolutionary-architecture/
        ├── innovation/
        ├── leadership/
        └── technology/

.phoenix-os/
└── stm/                 # Short-term memory (runtime, ephemeral)
```

### Engine vs Vault Distinction

| Type | Location | Purpose | Examples |
|------|----------|---------|----------|
| **Engine** | `memory/engine/` | Phoenix Architecture system knowledge — how to orchestrate, classify intents, route | `cto-intents.md`, `sequencing-rules.md`, `recipe-orchestration-pattern.md` |
| **Vault Radars** | `{user-vault}/radars/` | Classification lenses — keywords for matching, signal mappings | `ai-intelligence.md`, `leadership.md` |
| **Vault Signals** | `{user-vault}/signals/` | Actual knowledge — mental models, frameworks, practices | `augmentation-principle.md`, `flywheel.md` |
| **STM** | `.phoenix-os/stm/` | Runtime state — ephemeral, per-session, pre-populated with signals | `state.md`, `context.md`, `intents.md` |

---

## Project Structure

```
chronos/                             # Monorepo
├── .claude/                         # Claude Code harness (primary today)
│   ├── agents/                      # Agent definitions
│   ├── skills/                      # Skill definitions
│   └── commands/                    # Recipe entry points
├── memory/
│   ├── engine/                      # Phoenix Architecture system knowledge
│   │   ├── intents/                 # Intent definitions & classification rules
│   │   ├── flows/                   # Orchestration patterns
│   │   └── schemas/                 # Data schemas
│   └── vault/                       # User knowledge (external, user-specific)
├── philosophy/                      # IDD, Phoenix, PCAM, Four Crafts
├── .phoenix-os/
│   └── stm/                        # Runtime short-term memory (ephemeral)
└── docs/                            # Architecture & guides
```

**Note**: The vault (`memory/vault/`) is user-specific data, not part of the engine. In production, it is mounted externally. The engine (`memory/engine/`) ships with Chronos.

---

## Key Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Vault Architecture** | `memory/engine/vault-architecture.md` | Radar-signal separation, query matching |
| Recipe Orchestration | `memory/engine/flows/recipe-orchestration-pattern.md` | Level 2 recipe execution flow |
| CTO Intents | `memory/engine/intents/cto-intents.md` | Intent classification for CTO domain |
| Strategic Radars | `{user-vault}/signals/leadership/strategic-radars.md` | 7 strategic dimensions overview |

---

## When Executing Recipes

1. **Read the recipe file** to understand specializations
2. **Follow the inherited pattern** step by step
3. **Initialize STM first** — always
4. **Use the orchestrator** for intent routing
5. **Update STM after critical outputs** — routing plans, agent outputs, user responses
6. **Never skip steps** to save time

### STM Update Triggers

Update STM immediately after:
- Routing plan is built (save to `outputs/`, update `state.md`)
- Agent returns output (update `state.md`, `intents.md` if applicable)
- User responds (invoke `phoenix-engine-stm-update` skill)
- Status changes (blocked, needs_clarification, complete)

### Clarification Handling

When an agent returns `status: needs_clarification`:
1. **Present questions directly in text** — do NOT use the `AskUserQuestion` tool
2. For each question, include:
   - The question itself
   - **LTM source** — which file/line the probe came from (with `@memory/engine/` or `@{user-vault}/` path)
   - **Why it matters** — what decision or direction this unblocks
   - **Examples** — concrete options or scenarios to help the user respond
3. Update STM with the questions asked
4. When user responds, invoke `phoenix-engine-stm-update` before re-routing

---

## Signal-Grounded Protocol (CRITICAL)

**Reference**: `@memory/engine/vault-architecture.md`

**Agents read from STM context.md, NOT Vault directly. STM is pre-populated during Step 0.**

### The Architecture

```
Step 0: Initialize STM
    │
    ├── Scan query against radars ({user-vault}/radars/)
    ├── Load mapped signals into STM context.md
    └── Agents receive pre-filtered, session-relevant content
         │
         ▼
Step 1+: Agents read from STM
    │
    ├── Read STM context.md for signals
    ├── Read Engine for intent mechanics
    └── Generate signal-grounded output
```

### Two Parallel Processes

| Process | Handles | Timing |
|---------|---------|--------|
| **Radar Scanning** | WHAT knowledge is relevant (signals) | Step 0: initialize-stm |
| **Intent Detection** | WHAT user wants (clarify, decide, etc.) | Step 1: orchestrator |

These are **independent**. Intents don't reference radars/signals. Radars don't reference intents.

### The Protocol: STM-GROUNDED

```
1. Recipe invokes initialize-stm skill (Step 0)
   - Scans query against radar keywords
   - Loads matched signals into STM context.md
   - Agents never search Vault directly

2. Agent receives task + intent

3. Agent READS STM context.md
   - Contains pre-loaded signals from radar matching
   - Each signal includes source path for citation

4. Agent READS Engine for mechanics
   - @memory/engine/intents/ → Question framing structure
   - @memory/engine/flows/ → Orchestration patterns

5. Agent FRAMES output through STM signals
   - Engine tells you the SHAPE of questions
   - STM signals provide the CONTENT and strategic context

6. Output cites signal source paths from STM
```

### Example: Clarify Intent

**Wrong (searching Vault directly):**
```
Agent action: Search @{user-vault}/mental-models/ ← VIOLATION
```

**Right (STM-grounded):**
```
1. Read STM context.md (pre-populated by initialize-stm):
   Found: AI/Intelligence radar matched (confidence: 0.9)
   Signals loaded:
     - @{user-vault}/signals/ai/augmentation-principle.md
     - @{user-vault}/signals/ai/pcam-framework.md

2. Read Engine for question framing:
   - @memory/engine/intents/cto-intents.md
   - Framing: "What specifically...?", "Who/what/when?"

3. Generate signal-grounded question:
   - Question: "What specific capability should AI augment?"
   - Signal source: @{user-vault}/signals/ai/augmentation-principle.md
   - Why it matters: AI should augment capabilities, not be added for its own sake
```

### Enforcement Checklist

Before generating any output:

- [ ] Read STM context.md for pre-loaded signals?
- [ ] Read Engine for intent mechanics?
- [ ] Output grounded in STM signal content?
- [ ] Signal source paths cited?

**⛔ If agent searches Vault directly, the output is invalid.**

### Anti-Patterns (DO NOT DO)

| Anti-Pattern | Problem |
|--------------|---------|
| Searching Vault directly | Bypasses radar filtering, breaks architecture |
| Engine-only output | No strategic grounding from signals |
| Generic from training | Not grounded in user's knowledge |
| Missing citations | Unverifiable, not traceable |

---

## Agent Skill Invocation (MANDATORY)

**Reference**: Agent definitions in `@agents/`

### The Rule

**Agents MUST invoke their defined skill chains. Agents MUST NOT perform skill work directly.**

This applies to:
- `phoenix:orchestrator` — MUST invoke the 2-step orchestrator skill sequence
- `phoenix:strategy-guardian` — MUST invoke the PCAM skill chain for clarify intent

### Why This Matters

Skills provide:
1. **Testability** — Skills have defined inputs/outputs that can be validated
2. **Auditability** — Skill invocations are traceable
3. **Signal-grounding** — Skills enforce reading from STM, not searching Vault
4. **Consistency** — Skills produce structured output per schema

### Enforcement

When spawning agents via Task tool, the agent MUST read its definition and follow the skill chain:

```
Agent receives task → Reads @agents/{agent-name}.md → Invokes skill chain → Returns structured output
```

Each agent definition contains a "MANDATORY: Invoke Skill Sequence/Chain" section that specifies exactly which skills to invoke and in what order.

### Anti-Pattern Detection

If an agent output shows:
- Questions without `signal_path` citations → skill chain was bypassed
- Routing plans without explicit skill invocation traces → orchestrator skills were bypassed
- Analysis without structured output per skill schema → skill was not invoked

...the agent has violated the skill invocation requirement.

### Correct Pattern

```
# Orchestrator building routing plan:
Skill("phoenix-engine-identify-intents") → selected_intents
Skill("phoenix-engine-build-plan") → routing_plan

# Strategy-guardian handling clarify intent:
Skill("phoenix-perception-analyze-request") → analysis
Skill("phoenix-manifestation-generate-questions") → questions with citations
[user responds]
Skill("phoenix-cognition-evaluate-understanding") → synthesis (orchestrator determines routing inline)
```

---

**Version**: 4.0.0
**Last Updated**: 2026-03-01
**Changes**: Rebranded from Phoenix OS to Chronos. Added naming hierarchy (IDD → Methods → Phoenix Architecture → Products). Added PCAM model and Four Crafts (Prompt, Context, Intent, Spec Crafting) as philosophical foundations. Clarified memory separation (methods in repo, data external). Updated project structure to reflect monorepo.
