# Audit Log Entry Format

Every decision logged to `audit_log` must contain these fields.

## Required Fields (all decision types)

| Field | Type | Description |
|-------|------|-------------|
| timestamp | TIMESTAMPTZ | When the decision was made |
| recipe | VARCHAR(100) | Which recipe (capture_classify, consult_cto, promotion) |
| session_id | UUID | Session context (nullable for heartbeat) |
| decision_type | VARCHAR(50) | classification, synthesis, promotion, revision, review |
| input | JSONB | What was being decided on |
| output | JSONB | What the decision was |
| confidence | FLOAT | Score at decision point (nullable) |
| sources | JSONB | Array of vault signal paths that informed the decision |
| trace_id | VARCHAR(100) | Langfuse trace ID |

## Optional Fields (populated on review)

| Field | Type | Description |
|-------|------|-------------|
| owner_feedback | TEXT | What the owner said (review actions) |
| changes_made | TEXT | What changed as a result of feedback |

## Decision Types

| Type | When | Required Sources |
|------|------|-----------------|
| classification | Heartbeat classifies a signal | Radar-matched vault signals |
| synthesis | Consult produces an artifact | All vault signals cited |
| promotion | Signal promoted to vault | Source signals that formed the pattern |
| revision | Artifact revised after feedback | Original sources + feedback |
| review | Owner reviews an item | Original classification sources |
