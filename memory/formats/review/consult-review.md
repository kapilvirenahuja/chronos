# Consult Review Surface Format

The review surface for consult artifacts awaiting owner review.

## Layout

```
┌─────────────────────────────────┐
│ Artifact Title                  │
│ Confidence: [badge]             │
│                                 │
│ [Full artifact content]         │
│ [Sections, sources, citations]  │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ Feedback:                       │
│ ┌─────────────────────────────┐ │
│ │ [Text area for feedback]    │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Submit Feedback]  [Approve]    │
└─────────────────────────────────┘
```

## Actions

| Action | Effect | Audit Log |
|--------|--------|-----------|
| Submit Feedback | Recipe transitions to `revising`, artifact updated in-place | decision_type = review, owner_feedback = text, changes_made = diff |
| Approve | Recipe transitions to `completed` | decision_type = review, owner_feedback = approved |

## Rules

- Artifact is displayed using the same ArtifactViewer component as the reading surface
- Feedback text area is required before Submit (cannot submit empty)
- Approve requires no text
- After feedback submission, the page shows a "Revising..." state until the recipe completes
- Revised artifact replaces the original (same URL, same ID)
- All actions call the engine API: `POST /api/v1/review/{id}/action`
