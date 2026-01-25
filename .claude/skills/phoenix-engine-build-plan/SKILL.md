---
name: phoenix-engine-build-plan
description: Map intents to agents and construct routing plan. Consolidates agent matching and plan construction into single skill. Final step in orchestration.
user-invocable: false
---

# Build Plan

Map selected intents to available agents and construct the routing plan for recipe execution. This skill consolidates agent matching and plan construction.

## When to Use

- **Step 2** of orchestrator workflow (after identify-intents)
- **By**: Orchestrator agent only

## PCAM Domain

**Engine** - System infrastructure that supports the PCAM layers.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `selected_intents` | Yes | Intents from `phoenix-engine-identify-intents` |
| `query` | Yes | Original user query |
| `intent_domain_path` | Yes | Path to intent patterns (for Routes To and context enrichment) |
| `available_agents` | Yes | Agents registered for this recipe |
| `sequencing_rules_path` | Yes | Path to sequencing rules (`@memory/engine/intents/sequencing-rules.md`) |
| `synthesizer` | Yes | Synthesizer agent from recipe |
| `replan_count` | No | Current replan count (default 0) |

## Instructions

### Phase 1: Agent Matching

#### Step 1.1: Load Routing Info

For each selected intent, load from intent domain:

```
intent.routes_to = {
  agent: "phoenix:strategy-guardian",
  skills: ["phoenix-perception-analyze-request", "phoenix-manifestation-generate-questions"]
}

intent.context_enrichment = {
  user_needs: "Clear recommendation with rationale",
  expects: "Decision framework, trade-off analysis",
  probe_for: ["Decision criteria", "constraints", "timeline"]
}
```

#### Step 1.2: Verify Agent Availability

For each intent:

```
If intent.routes_to.agent NOT IN available_agents:
  Mark intent as blocked
  Set blocked_reason = "Agent not available"
  Suggest fallback if exists
```

#### Step 1.3: Extract Context Enrichment

For each available agent assignment:

```
agent_input = {
  intent: intent.name,
  goal: derive_goal_from_query(query, intent),
  user_needs: intent.context_enrichment.user_needs,
  expects: intent.context_enrichment.expects,
  probe_for: intent.context_enrichment.probe_for
}
```

#### Step 1.4: Build Assignments

Create agent assignments for each intent:

```json
{
  "intent": "decide",
  "agent": "phoenix:strategy-guardian",
  "available": true,
  "inputs": {
    "goal": "Help user decide between Postgres and MongoDB",
    "user_needs": "Clear recommendation with rationale",
    "expects": "Decision framework, trade-off analysis",
    "probe_for": ["Decision criteria", "constraints", "timeline"]
  }
}
```

**Phase 1 Output:**

```json
{
  "agent_assignments": [
    {
      "intent": "decide",
      "agent": "phoenix:strategy-guardian",
      "available": true,
      "inputs": {
        "goal": "Help user decide between Postgres and MongoDB",
        "user_needs": "Clear recommendation with rationale",
        "expects": "Decision framework, trade-off analysis",
        "probe_for": ["Decision criteria", "constraints", "timeline"]
      }
    }
  ],
  "blocked": []
}
```

---

### Phase 2: Plan Construction

#### Step 2.1: Build Dependency Graph

From agent assignments and Related Intents:

```
For each assignment:
  Load requires_first, conflicts_with from intent
  Add edges to dependency graph
```

#### Step 2.2: Topological Sort

Order assignments by dependencies:

```
clarify → decide → validate → design
```

#### Step 2.3: Determine Execution Mode

For each step in sorted order:

| Condition | Mode |
|-----------|------|
| Has `requires_first` dependency | `sequential` |
| Has `conflicts_with` in same step | `sequential` |
| Independent, no conflicts | `parallel` |

**Constraints from sequencing rules:**
- Max 3 parallel agents
- Max 4 intents total
- Max 3 replans

#### Step 2.4: Set Dependencies

For each step, set `depends_on`:

```
Step 1: depends_on = []
Step 2: depends_on = [1] (if requires step 1)
Step 3: depends_on = [1, 2] (if requires both)
```

#### Step 2.5: Construct Plan

Build routing plan per schema:

```json
{
  "id": "plan-{timestamp}-{hash}",
  "created_at": "{ISO timestamp}",
  "query": "{original query}",
  "confidence": {average of intent confidences},
  "steps": [...],
  "synthesizer": {...},
  "metadata": {...}
}
```

#### Step 2.6: Validate Plan

- All blocked intents excluded
- Dependencies satisfied
- Within limits

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `routing_plan` | object | Complete execution plan |
| `agent_assignments` | array | Mapped intents to agents |
| `blocked_intents` | array | Intents that couldn't be routed |

**Output Schema:**

```json
{
  "routing_plan": {
    "id": "plan-2026-01-06-abc123",
    "created_at": "2026-01-06T10:00:00Z",
    "query": "Should I use Postgres or MongoDB?",
    "confidence": 0.85,
    "steps": [
      {
        "order": 1,
        "mode": "sequential",
        "depends_on": [],
        "agents": [
          {
            "agent": "phoenix:strategy-guardian",
            "intent": "decide",
            "goal": "Help user decide between Postgres and MongoDB",
            "inputs": {
              "user_needs": "Clear recommendation with rationale",
              "expects": "Decision framework, trade-off analysis",
              "probe_for": ["Decision criteria", "constraints", "timeline"]
            }
          }
        ]
      }
    ],
    "synthesizer": {
      "agent": "phoenix:strategy-guardian",
      "inputs": {}
    },
    "metadata": {
      "intent_domain": "@memory/engine/intents/cto-intents.md",
      "sequencing_rules": "@memory/engine/intents/sequencing-rules.md",
      "replan_count": 0
    }
  },
  "agent_assignments": [
    {
      "intent": "decide",
      "agent": "phoenix:strategy-guardian",
      "available": true,
      "inputs": {
        "goal": "Help user decide between Postgres and MongoDB",
        "user_needs": "Clear recommendation with rationale",
        "expects": "Decision framework, trade-off analysis",
        "probe_for": ["Decision criteria", "constraints", "timeline"]
      }
    }
  ],
  "blocked_intents": []
}
```

---

## Multi-Intent Plan Example

```json
{
  "routing_plan": {
    "id": "plan-2026-01-06-def456",
    "created_at": "2026-01-06T10:00:00Z",
    "query": "Help me design an AI system and validate my approach",
    "confidence": 0.78,
    "steps": [
      {
        "order": 1,
        "mode": "sequential",
        "depends_on": [],
        "agents": [
          {
            "agent": "phoenix:strategy-guardian",
            "intent": "clarify",
            "goal": "Clarify requirements for AI system design",
            "inputs": {
              "user_needs": "Clear understanding of requirements",
              "expects": "Resolved understanding of WHAT, WHO, WHY, CONSTRAINTS",
              "probe_for": ["Type of AI system", "Users", "Problem being solved"]
            }
          }
        ]
      },
      {
        "order": 2,
        "mode": "sequential",
        "depends_on": [1],
        "agents": [
          {
            "agent": "phoenix:architect",
            "intent": "design",
            "goal": "Design AI system architecture",
            "inputs": {
              "user_needs": "Technical architecture guidance",
              "expects": "Architecture design with trade-offs",
              "probe_for": ["Scale", "Integration points", "Constraints"]
            }
          }
        ]
      },
      {
        "order": 3,
        "mode": "sequential",
        "depends_on": [2],
        "agents": [
          {
            "agent": "phoenix:strategy-guardian",
            "intent": "validate",
            "goal": "Validate the proposed AI system design",
            "inputs": {
              "user_needs": "Honest assessment of risks and blind spots",
              "expects": "Validation report with risks identified",
              "probe_for": ["Assumptions", "Failure modes", "Missing considerations"]
            }
          }
        ]
      }
    ],
    "synthesizer": {
      "agent": "phoenix:strategy-guardian",
      "inputs": {
        "combine_outputs": true
      }
    },
    "metadata": {
      "intent_domain": "@memory/engine/intents/cto-intents.md",
      "sequencing_rules": "@memory/engine/intents/sequencing-rules.md",
      "replan_count": 0,
      "added_by_dependency": ["clarify"]
    }
  }
}
```

---

## Success Criteria

- [ ] All intents mapped to agents
- [ ] Unavailable agents flagged as blocked
- [ ] Context enrichment extracted for each assignment
- [ ] Goal derived from query for each agent
- [ ] Plan conforms to routing-plan-schema
- [ ] Dependencies correctly ordered
- [ ] Execution modes appropriate
- [ ] Within constraints (max 4 intents, max 3 parallel)

---

## Error Handling

| Error | Action |
|-------|--------|
| Intent domain not found | Fail with "Cannot build plan without intent definitions" |
| No available agents for intent | Mark as blocked, suggest fallback |
| Circular dependencies detected | Fail with dependency cycle error |
| Exceeds max intents (4) | Flag for user to narrow scope |
| Sequencing rules not found | Use default ordering (by priority) |

---

## Integration Notes

### Replacing 2 Orchestrator Skills

This skill replaces:
- `phoenix-orchestrator-match-agents` (Phase 1)
- `phoenix-orchestrator-build-plan` (Phase 2)

### Orchestrator Invocation

```python
# Build routing plan
result = phoenix_engine_build_plan(
    selected_intents=identify_result.selected_intents,
    query=user_query,
    intent_domain_path="@memory/engine/intents/cto-intents.md",
    available_agents=recipe.available_agents,
    sequencing_rules_path="@memory/engine/intents/sequencing-rules.md",
    synthesizer=recipe.synthesizer,
    replan_count=0
)

# Execute plan
for step in result.routing_plan.steps:
    execute_step(step)
```

### Receiving from phoenix-engine-identify-intents

```
identify-intents output
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ build-plan receives:                                       │
│                                                           │
│ - selected_intents → Map to agents, build steps           │
│ - confidence scores → Include in plan metadata            │
│ - rationales → Document in routing plan                   │
└───────────────────────────────────────────────────────────┘
```

### STM Update

After plan is built, write to STM:

```
{stm_path}/outputs/routing-plan-{timestamp}.json
```

Update `{stm_path}/state.md`:

```markdown
| Timestamp | Step | Status | Notes |
|-----------|------|--------|-------|
| {ts} | 1: Build Routing Plan | complete | {n} intents, {m} steps |
```

---

**Version**: 1.0.0
**Last Updated**: 2026-01-06
**Changes**: New skill consolidating `phoenix-orchestrator-match-agents` and `phoenix-orchestrator-build-plan` into single skill.
