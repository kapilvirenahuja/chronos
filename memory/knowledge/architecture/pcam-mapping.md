# PCAM Mapping in Chronos

How the PCAM model maps to concrete Chronos components.

| PCAM Layer | Role | Chronos Components |
|-----------|------|-------------------|
| **Perception** | Signals in | `channels/` — Discord adapter, gateway, envelope normalization |
| **Cognition** | Reasoning + orchestration | `engine/` — agent loop (`tool_runner`), recipe loader, gates, cartridge (RAG) |
| **Agency** | Tools out | `skills/` — `@beta_tool` functions (classify, research, synthesize, publish, notify, promote) |
| **Manifestation** | Memory + artifacts | `memory/` — signal store, STM, vault, audit log, artifacts, embeddings |

## Rules

- Every component must map to exactly one PCAM layer
- Perception never reasons — it normalizes and dispatches
- Cognition never persists directly — it delegates to Manifestation via skills
- Agency tools are stateless functions — state lives in Manifestation
- Skills in Agency always log to the audit log (Manifestation) after acting
