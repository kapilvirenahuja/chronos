# Database Schema Rules

## Naming

- Tables: plural, snake_case (`signals`, `vault_signals`, `recipe_runs`)
- Columns: snake_case (`raw_text`, `created_at`, `radar_category`)
- Enums: snake_case values (`review_pending`, `awaiting_review`)
- Indexes: `idx_{table}_{column}` pattern

## Required Columns

Every table must have:
- `id` — UUID primary key (`gen_random_uuid()`)
- `created_at` — TIMESTAMPTZ with `DEFAULT now()`

Mutable tables also have:
- `updated_at` — TIMESTAMPTZ with `DEFAULT now()`

## Audit Log

- Append-only: no UPDATE/DELETE grants
- Every decision type has required fields (see LLD §1.8)
- `trace_id` links to Langfuse for cross-reference

## pgvector

- Embedding dimension: 1024 (voyage-3)
- Index type: `ivfflat` with `vector_cosine_ops`
- Lists: 100 (sufficient for < 100k vectors)
- Similarity search: `1 - (embedding <=> query_embedding)` for cosine similarity

## Enums

- Define as Postgres ENUMs (not string columns)
- Add new values via ALTER TYPE ... ADD VALUE (Alembic migration)
