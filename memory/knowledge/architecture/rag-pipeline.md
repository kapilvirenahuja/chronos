# RAG Pipeline

How Chronos uses embeddings and vector search for knowledge retrieval.

## Embedding Model

`voyage-3` (1024 dimensions) via VoyageAI API. Part of the Anthropic ecosystem — no OpenAI dependency.

## When Embeddings Are Created

1. **Signal capture**: raw_text embedded immediately on store → `signals.embedding`
2. **Vault sync**: vault signal content embedded on import/update → `vault_signals.embedding`
3. **Query time**: query text embedded for cartridge loading → used for vector search

## Cartridge Loading (Domain Cartridge via RAG)

```
Query arrives
  → Embed query (voyage-3)
  → Vector search vault_signals: top-K by cosine similarity (pgvector <=> operator)
  → Keyword boost: radar keyword overlap increases ranking
  → Token budget: cap at ~50k tokens
  → Write matched signals into STM
```

## Classification with RAG

During heartbeat, unclassified signals are matched semantically against vault signals:
- Find top-5 most similar vault signals
- Most common radar category among matches = suggested classification
- Confidence = agreement ratio among matches

## pgvector Indexes

`ivfflat` index with `vector_cosine_ops` on both `signals.embedding` and `vault_signals.embedding`. Lists = 100 (sufficient for < 100k vectors).

## Token Budgeting

- Cartridge: 50k tokens of vault context
- Recipe prompt: ~5-10k tokens
- Conversation history: remaining window up to 100k (then compaction kicks in)
- Total context window: 200k tokens standard
