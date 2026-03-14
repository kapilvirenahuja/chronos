# Phoenix Chain Contract

Signal → Recipe → Agent → Skill → Memory

## What Each Element Is

| Element | In Chronos | Contract |
|---------|-----------|----------|
| **Signal** | Normalized `MessageEnvelope` from gateway | Must have: channel, sender_id, text, timestamp, reply callable |
| **Recipe** | Python module: system prompt + tool set + gate conditions | Must define: `PROMPT`, `TOOLS`, `GATE_CONDITIONS` |
| **Agent** | Claude operating within `tool_runner` loop | Reads recipe prompt, picks tools, respects gates |
| **Skill** | `@beta_tool` function in `skills/` | Must: audit log every decision, return structured string |
| **Memory** | Postgres tables + vault filesystem | Signal store, STM, vault, audit log, artifacts |

## Anti-Patterns (Chain Collapse)

These violate the Phoenix chain and must never occur:

- `Signal → model call → answer` (no recipe, no skills, no memory)
- `Signal → hardcoded workflow → answer` (no agent reasoning)
- `Signal → "agent persona" → answer` (no explicit skills or memory grounding)

## Verification

Langfuse traces must show: recipe initialization → skill invocations → memory operations. A single model call with no tool use is a chain collapse (SC-PHX-002).
