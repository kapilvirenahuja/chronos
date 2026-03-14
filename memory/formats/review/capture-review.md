# Capture Review Surface Format

The review surface for low-confidence signal classifications.

## Review Queue (`/review`)

Lists all signals with status `review_pending`, ordered by creation date (newest first).

Each item shows:
- Signal raw text (truncated to 200 chars with expand)
- Candidate radar categories with confidence scores
- Classification date
- Actions: Reclassify, Reject, Approve

## Single Review Item (`/review/[id]`)

Full detail view:

```
┌─────────────────────────────────┐
│ Signal Text (full)              │
│                                 │
│ Channel: discord                │
│ Captured: 2026-03-14 10:00      │
│                                 │
│ Suggested Categories:           │
│   ai-intelligence (0.45)        │
│   technology (0.38)             │
│   leadership (0.17)             │
│                                 │
│ [Reclassify ▼] [Reject] [Approve as top suggestion] │
└─────────────────────────────────┘
```

## Actions

| Action | Effect | Audit Log |
|--------|--------|-----------|
| Reclassify | Update signal radar_category, set status = classified | decision_type = review, owner_feedback = new category |
| Reject | Set status = rejected | decision_type = review, owner_feedback = rejected |
| Approve | Accept top suggestion, set status = classified | decision_type = review |

## Rules

- Reclassify dropdown shows all available radar categories
- Next heartbeat respects owner's reclassification (does not re-override)
- All actions log to audit_log
- Token-authenticated access required
