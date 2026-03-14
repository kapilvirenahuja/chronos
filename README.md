# Chronos

> Your strategic thinking, compounding.

Chronos is a personal AI for strategic leaders — a system that captures your thinking from wherever it happens, synthesizes it into compounding knowledge, and retrieves it when you need it most.

## Architecture

Split-architecture system built on IDD (Intent-Driven Design), Phoenix pattern language, and PCAM (Perception, Cognition, Agency, Manifestation).

- **Python Engine** (Railway) — Discord bot, agent loop (Anthropic SDK `tool_runner`), heartbeat scheduler, embedding pipeline (voyage-3)
- **Next.js Web** (Vercel) — artifact pages, review surfaces, session management, audit log viewer
- **Neon Postgres** (pgvector) — system of record + vector search
- **Langfuse Cloud** — observability

## Three Recipes

| Recipe | What It Does | Tempo |
|--------|-------------|-------|
| **Capture & Classify** | Silent signal intake via Discord, background classification via heartbeat | 30-min |
| **Consult CTO** | Clarify → research → synthesize → artifact with confidence + citations | On-demand |
| **Memory Promotion** | Pattern detection → vault promotion → contradiction/connection surfacing | Monthly |

## Documentation

| Document | Path |
|----------|------|
| Product Vision (locked) | `.meridian/product/vision.md` |
| Product Spec v4.0.0 | `.meridian/product/chronos-features.md` |
| Technical Approach v2.0.0 | `.meridian/product/technical-approach.md` |
| 54 Verification Scenarios | `.meridian/product/chronos-scenarios.md` |
| Low-Level Design v2.0.0 | `.meridian/product/chronos-lld.md` |
| LTM (knowledge, standards, formats) | `memory/` |
| Philosophy (IDD, Phoenix, PCAM) | `philosophy/` |

## License

MIT License — see [LICENSE](LICENSE).
