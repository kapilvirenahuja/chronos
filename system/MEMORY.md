# MEMORY.md — How Chronos Remembers

## Model
- STM lives in the session store.
- LTM has two layers: source-of-truth documents and a searchable index.

## MVP Flow
1. Capture appends raw thoughts to `capture_log`.
2. Heartbeat classifies unprocessed entries.
3. Strong signals are promoted to the library.
4. Low-confidence or duplicate entries move to owner review.

## Guardrails
- Capture is append-only.
- Promotion requires both classification confidence and content quality.
- Every autonomous decision is written to `decision_log`.
