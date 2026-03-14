# Memory Layers

Chronos has four distinct memory layers. They must never be collapsed.

## Signal Store (Inbox)

- **What**: Raw captures before classification
- **Storage**: `signals` table in Postgres
- **Lifecycle**: unclassified → classified/review_pending → promoted/archived/rejected
- **Key rule**: Signals are stored BEFORE processing. Always.

## Short-Term Memory (STM)

- **What**: Active session reasoning workspace
- **Storage**: `sessions.stm_state` JSONB in Postgres
- **Contains**: Domain cartridge (role profile + matched vault signals), active intents, intermediate artifacts
- **Scope**: Per-session, created on recipe init, restored on session load
- **Key rule**: Agents read from STM, never from vault directly

## Vault (Long-Term Memory)

- **What**: Durable knowledge — radars and signals
- **Storage**: `vault_signals` table (with embeddings) + `vault/` filesystem mirror
- **Radars**: Classification lenses with keyword sets (`radars` table)
- **Signals**: Knowledge artifacts organized by radar category
- **Key rule**: Vault is populated by promotion (Recipe 3), not by direct capture

## Decision Audit Log

- **What**: Append-only record of every decision
- **Storage**: `audit_log` table in Postgres
- **Key rule**: No UPDATE/DELETE. Every classification, synthesis, promotion, review action is logged.

## Flow Between Layers

```
Capture → Signal Store (unclassified)
Heartbeat → Signal Store (classified/review_pending)
Cartridge Loading → Vault → STM (via RAG)
Consult → STM (reasoning) → Artifacts
Promotion → Signal Store patterns → Vault
All decisions → Audit Log
```
