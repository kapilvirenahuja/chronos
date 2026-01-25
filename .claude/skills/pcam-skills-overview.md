# PCAM Skills Overview

> Skill architecture organized by PCAM domains

---

## Overview

Phoenix OS skills are namespaced by their PCAM (Perception, Cognition, Agency, Manifestation) domain. This ensures clear separation of concerns and makes skills discoverable based on their purpose.

---

## Naming Convention

```
phoenix-{pcam-domain}-{action}[-{target}]

Examples:
  phoenix-perception-analyze-request
  phoenix-cognition-evaluate-understanding
  phoenix-manifestation-generate-questions
  phoenix-engine-stm-initialize
```

---

## Domain Mapping

| PCAM Domain | Namespace | Purpose | Skills |
|-------------|-----------|---------|--------|
| Perception | `phoenix-perception-*` | Understanding inputs | `analyze-request` |
| Cognition | `phoenix-cognition-*` | Reasoning and evaluation | `evaluate-understanding` |
| Manifestation | `phoenix-manifestation-*` | Producing outputs | `generate-questions` |
| Engine | `phoenix-engine-*` | System infrastructure | `stm-initialize`, `stm-update`, `identify-intents`, `build-plan` |

---

## Skill Inventory

### Perception Domain

| Skill | Description | Status |
|-------|-------------|--------|
| `phoenix-perception-analyze-request` | Analyze request for complexity, vagueness, missing dimensions | ✓ Complete |

### Cognition Domain

| Skill | Description | Status |
|-------|-------------|--------|
| `phoenix-cognition-evaluate-understanding` | Evaluate response completeness against intent requirements | ✓ Complete |

### Manifestation Domain

| Skill | Description | Status |
|-------|-------------|--------|
| `phoenix-manifestation-generate-questions` | Generate signal-grounded clarifying questions | ✓ Complete |

### Engine Domain

| Skill | Description | Status |
|-------|-------------|--------|
| `phoenix-engine-stm-initialize` | Initialize STM workspace, scan radars, load signals | ✓ Complete |
| `phoenix-engine-stm-update` | Update STM after user response | ✓ Complete |
| `phoenix-engine-identify-intents` | Pattern match, boost confidence, select intents | ✓ Complete |
| `phoenix-engine-build-plan` | Map to agents, construct routing plan | ✓ Complete |

---

## Skill Chains

### Strategy-Guardian (Clarify Intent)

```
phoenix-perception-analyze-request
        │
        ▼
phoenix-manifestation-generate-questions
        │
        ▼
[user responds]
        │
        ▼
phoenix-cognition-evaluate-understanding
```

**Input/Output Flow:**

| Step | Skill | Input | Output |
|------|-------|-------|--------|
| 1 | `phoenix-perception-analyze-request` | query, stm_path | vagueness_score, missing_dimensions, complexity |
| 2 | `phoenix-manifestation-generate-questions` | analysis, intent, intent_definition_path | question_blocks[], status |
| 3 | `phoenix-cognition-evaluate-understanding` | responses, intent, intent_definition_path | completeness_score, resolved_understanding |

### Orchestrator (Routing)

```
phoenix-engine-identify-intents
        │
        ▼
phoenix-engine-build-plan
```

**Input/Output Flow:**

| Step | Skill | Input | Output |
|------|-------|-------|--------|
| 1 | `phoenix-engine-identify-intents` | query, intent_domain_path, enabled_intents, stm_path | selected_intents[] |
| 2 | `phoenix-engine-build-plan` | selected_intents, available_agents, sequencing_rules_path | routing_plan |

---

## Intent-Driven Configuration

Skills receive `intent` and `intent_definition_path` to read their configuration at runtime:

```
intent: "clarify"
intent_definition_path: "@memory/engine/intents/cto-intents.md"
```

From the intent definition, skills extract:
- **Framing Structure** → Question shapes
- **Completion Criteria** → Required dimensions
- **Output Schema** → Output format

This design keeps skills generic and reusable across different intent domains.

---

## Key Design Principles

1. **Intent-driven, not hardcoded** — Skills read dimensions from intent definitions
2. **Signal-grounded** — Skills cite sources from STM context.md
3. **Routing stays with orchestrator** — Cognition skill does NOT determine next intent
4. **Stateless** — Skills don't maintain state; STM provides persistence
5. **Composable** — Skills chain together to form workflows

---

## Migration from Previous Structure

| Old Skill | New Skill |
|-----------|-----------|
| `consult-analyze-request` | `phoenix-perception-analyze-request` |
| `consult-clarify-requirements` | `phoenix-manifestation-generate-questions` |
| `consult-synthesize-response` | `phoenix-cognition-evaluate-understanding` |
| `phoenix-context-initialize-stm` | `phoenix-engine-stm-initialize` |
| `phoenix-context-update-stm` | `phoenix-engine-stm-update` |
| `phoenix-orchestrator-pattern-match` | Merged into `phoenix-engine-identify-intents` |
| `phoenix-orchestrator-boost-confidence` | Merged into `phoenix-engine-identify-intents` |
| `phoenix-orchestrator-select-intents` | Merged into `phoenix-engine-identify-intents` |
| `phoenix-context-identify-intent` | Merged into `phoenix-engine-identify-intents` (re-evaluate mode) |
| `phoenix-orchestrator-match-agents` | Merged into `phoenix-engine-build-plan` |
| `phoenix-orchestrator-build-plan` | Merged into `phoenix-engine-build-plan` |

---

**Version**: 1.0.0
**Last Updated**: 2026-01-06
