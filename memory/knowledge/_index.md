# Knowledge

Searchable reference material for design decisions, domain expertise, and architectural guidance specific to Chronos.

Agents and skills query this category when they need to know: **"What should I consider?"**

## Contents

| Path | Description | Search Patterns |
|------|-------------|-----------------|
| `architecture/pcam-mapping.md` | How PCAM maps to Chronos components | PCAM, perception, cognition, agency, manifestation |
| `architecture/phoenix-chain.md` | Signal → Recipe → Agent → Skill → Memory chain contract | phoenix, recipe, agent, skill, signal |
| `architecture/split-architecture.md` | Python engine + Next.js web split, API contract, deployment topology | deployment, architecture, engine, web, vercel, railway |
| `architecture/rag-pipeline.md` | Embedding pipeline, vector search, cartridge loading, token budgeting | rag, embeddings, vector, pgvector, cartridge, vault |
| `architecture/memory-layers.md` | Signal store vs STM vs vault distinction, promotion pipeline | memory, signal store, stm, vault, promotion |
| `recipes/capture-classify.md` | Recipe 1 contract: fast loop, heartbeat, classification, confidence policy | capture, classify, heartbeat, radar |
| `recipes/consult-cto.md` | Recipe 2 contract: consult flow, clarify/synthesize, response gates | consult, synthesize, retrieve, clarification |
| `recipes/memory-promotion.md` | Recipe 3 contract: long cadence, pattern detection, contradiction surfacing | promotion, patterns, contradictions, connections |

## When to Add Here

A file belongs in `knowledge/` if:
- It provides reference material for implementation decisions
- It has search patterns that help identify when it applies
- It answers "what approach should I take?" or "how does this component work?"
