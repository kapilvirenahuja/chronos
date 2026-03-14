# Engine API Contract

The Python engine exposes a headless REST API consumed by the Next.js web app. Both sides develop against this contract independently — mock-first, integrate later.

## Authentication

All endpoints (except `/api/v1/status`) require the `Authorization` header:

```
Authorization: Bearer {ENGINE_API_SECRET}
```

Requests without valid auth receive `403 Forbidden`.

---

## Endpoints

### POST `/api/v1/review/{id}/action`

Execute a review action on a signal or artifact.

**Request:**
```json
{
  "action": "reclassify | reject | approve | feedback",
  "new_category": "string (required for reclassify, null otherwise)",
  "feedback": "string (required for feedback, null otherwise)"
}
```

**Response (200):**
```json
{
  "status": "ok",
  "item_id": "uuid",
  "action": "string",
  "recipe_run_id": "uuid | null (populated if recipe was resumed)"
}
```

**Response (404):**
```json
{
  "status": "error",
  "error": "Item not found"
}
```

**Response (400):**
```json
{
  "status": "error",
  "error": "Invalid action | Missing required field"
}
```

---

### POST `/api/v1/recipe/{id}/resume`

Resume a paused recipe with human input.

**Request:**
```json
{
  "action": "revise | approve",
  "feedback": "string (required for revise, null for approve)"
}
```

**Response (200):**
```json
{
  "status": "ok",
  "recipe_run_id": "uuid",
  "new_state": "revising | completed"
}
```

**Response (409):**
```json
{
  "status": "error",
  "error": "Recipe is not in awaiting_review state"
}
```

---

### POST `/api/v1/heartbeat/classify`

Trigger classification heartbeat. Called by Vercel Cron.

**Request:** Empty body.

**Response (200):**
```json
{
  "status": "ok",
  "signals_processed": 5,
  "classified": 3,
  "flagged_for_review": 2
}
```

**Response (200, no work):**
```json
{
  "status": "ok",
  "signals_processed": 0
}
```

---

### POST `/api/v1/heartbeat/promote`

Trigger memory promotion. Called manually or by long-cadence cron.

**Request:** Empty body.

**Response (200):**
```json
{
  "status": "ok",
  "patterns_found": 3,
  "promoted": 2,
  "flagged_for_review": 1,
  "contradictions": 1,
  "connections": 2
}
```

---

### Note: Audit Log Reads

The audit log is read directly from Postgres by the Next.js web app (Drizzle ORM) — it does NOT go through the engine API. The `/decisions` page queries the `audit_log` table directly with filters. No engine endpoint needed for reads.

---

### GET `/api/v1/status`

Health check. No auth required.

**Response (200):**
```json
{
  "status": "healthy",
  "discord_connected": true,
  "db_connected": true,
  "version": "0.1.0"
}
```

---

## Error Format

All errors follow:

```json
{
  "status": "error",
  "error": "Human-readable error description"
}
```

HTTP status codes:
- `200` — success
- `400` — bad request (missing fields, invalid action)
- `403` — authentication failed
- `404` — resource not found
- `409` — conflict (wrong state for operation)
- `500` — internal error

---

## Shared Data Shapes

### Artifact `structured` JSONB Schema

Both engine (writes) and web (reads) must agree on this shape:

```typescript
interface ArtifactStructured {
  title: string
  sections: Array<{
    heading: string
    content: string                // markdown
  }>
  sources: Array<{
    claim: string                  // the specific claim being sourced
    signal_path: string            // vault signal path (e.g., "signals/ai/augmentation-principle.md")
  }>
  confidence: number               // 0.0–1.0
  training_sourced: string[]       // claims from model training, not vault
  confidence_gaps: string[]        // specific areas where more signals would increase confidence
  metadata: {
    recipe: string                 // "consult_cto"
    session_id: string             // UUID
    timestamp: string              // ISO 8601
    role_profile: string           // "cto"
    radars_matched: string[]       // radar categories that contributed
  }
}
```

### Audit Log Entry Shape

```typescript
interface AuditLogEntry {
  id: number
  timestamp: string                // ISO 8601
  recipe: string | null            // null for trust_rejection
  session_id: string | null
  decision_type: "classification" | "synthesis" | "promotion" | "revision" | "review" | "trust_rejection"
  input: Record<string, unknown>
  output: Record<string, unknown>
  confidence: number | null
  sources: string[]                // vault signal paths
  owner_feedback: string | null
  changes_made: string | null
  trace_id: string | null          // Langfuse trace ID
}
```

---

## Development Pattern

During development, the Next.js web app should mock this API for independent development:

1. Define TypeScript types matching this contract in `web/src/lib/engine-client.ts`
2. Build UI against mocked responses
3. Swap mock for real HTTP client when integrating

The Python engine should implement these endpoints exactly as specified, with tests validating the contract shapes.
