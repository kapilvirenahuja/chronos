# Formats

Templates and output shapes for artifacts produced by Chronos.

Agents and skills query this category when they need to know: **"What does the output look like?"**

## Contents

| Path | Description | Consumers |
|------|-------------|-----------|
| `artifacts/structured-artifact.md` | Structured artifact schema: sections, sources, confidence, metadata, training-sourced labels | synthesize skill, artifact store |
| `artifacts/html-artifact.md` | HTML artifact template: layout, confidence badge, source citations, training labels, gap description | render skill, web artifact page |
| `review/capture-review.md` | Capture review surface: signal text, candidate categories, confidence, approve/reject/reclassify actions | web review page |
| `review/consult-review.md` | Consult review surface: artifact display, feedback form, approve action | web review page |
| `notifications/discord-notification.md` | Discord notification format: compact pointer with link, < 280 chars | notify skill |
| `audit/audit-log-entry.md` | Audit log entry schema: all required fields per decision type | audit log, decision viewer |

## When to Add Here

A file belongs in `formats/` if:
- It defines the shape/structure of an output artifact
- It answers "what should this look like?" or "what fields go where?"
- Changing it changes what the user sees
