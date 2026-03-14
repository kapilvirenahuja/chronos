# Recipe 2: Consult CTO Research Pipeline

## Identity

- **Tempo**: Slow (on-demand)
- **PCAM flow**: Perception → Cognition (clarify/synthesize) → Agency (research/render) → Manifestation (artifact + audit)
- **Intents served**: retrieve, synthesize

## Flow

1. Receive consult request (Discord `/ask` or message)
2. Create/load session, initialize STM with domain cartridge (RAG)
3. Resolve scope: retrieve vs synthesize
4. If underspecified → `ask_clarification` tool (Clarification gate)
5. If retrieve → `search_vault` (vector search) → return with citations
6. If synthesize → research → `create_artifact` with confidence + citations → `render_html` → `publish_and_notify` → `pause_for_review` (Awaiting Review gate)
7. Owner reviews on web → approve or feedback
8. Feedback → `revise_artifact` (in-place) → re-publish

## States

queued → running → publishing → awaiting_review → revising → completed → blocked

## Gate Conditions

- `ask_clarification` → clarification gate
- `pause_for_review` → awaiting_review gate
- `report_blocked` → blocked gate

## Key Rules

- Every clarification question MUST cite a vault signal path
- Every synthesis claim MUST have a source (vault signal or labeled as training-sourced)
- Confidence score on all artifacts (0.0-1.0)
- Low-confidence outputs describe what would increase confidence (specific gaps)
- NO intermediate output — only valid gate output reaches the user
- Artifact revision is in-place (same ID), audit log records feedback + changes

## Scenarios

SC-CON-001 through SC-CON-007, SC-GAT-001 through SC-GAT-004, SC-CNF-001 through SC-CNF-003
