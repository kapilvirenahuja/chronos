# Recipe 1: Capture & Classify

## Identity

- **Tempo**: Fast (30-min heartbeat)
- **PCAM flow**: Perception (gateway) → Cognition (classify) → Manifestation (signal store + audit)
- **Intents served**: capture

## Capture Flow

```
Discord message → Gateway → Trust check → Signal Store (unclassified) → Silent (no response)
```

Signal is embedded (voyage-3) immediately on store.

## Heartbeat Classification

Triggered every 30 minutes. Agentic — Claude decides classification via tool_runner.

1. Load unclassified signals
2. Load domain cartridge (RAG: embed batch query → vector search vault → keyword boost)
3. For each signal: classify or flag for review
4. High confidence (≥ 0.7): `classify_signal` tool → status = classified
5. Low confidence (< 0.7): `flag_for_review` tool → status = review_pending, web notification
6. All decisions logged to audit_log

## Gate Conditions

- `complete_batch` → synthesis gate (batch done, exit)

## Key Rules

- Capture is SILENT. No acknowledgment message.
- Signals stored BEFORE processing. Always.
- Owner corrections persist — next heartbeat does not re-override reclassified signals.
- Every classification decision logged to audit_log.

## Scenarios

SC-CAP-001 through SC-CAP-004, SC-CLS-001 through SC-CLS-005
