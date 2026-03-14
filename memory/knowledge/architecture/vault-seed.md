# Vault Seed Workflow

How the CTO domain cartridge seed data gets from markdown files into Postgres.

## Filesystem Structure

```
vault/
├── radars/
│   ├── ai-intelligence.md
│   ├── technology.md
│   ├── leadership.md
│   ├── innovation.md
│   ├── evolutionary-architecture.md
│   ├── product.md
│   └── strategy.md
└── signals/
    ├── ai/
    │   ├── augmentation-principle.md
    │   └── intent-alignment.md
    ├── technology/
    │   └── composable-architecture.md
    └── leadership/
        └── team-autonomy.md
```

## File Format

### Radar

```markdown
---
name: ai-intelligence
keywords: [ai, agents, llm, machine learning, augmentation, intelligence]
---

# AI & Intelligence

Description of what this radar covers.
```

### Signal

```markdown
---
title: The Augmentation Principle
radar: ai-intelligence
---

Signal content here. This is the actual knowledge.
```

## Seed Script

`engine/chronos/scripts/seed.py`:

1. Read all `vault/radars/*.md` → parse frontmatter → upsert to `radars` table
2. Read all `vault/signals/**/*.md` → parse frontmatter → embed content (voyage-3) → upsert to `vault_signals` table with embedding
3. Report: N radars loaded, N signals embedded

## When to Run

- Once on initial setup (Phase 2)
- Whenever vault files change (manual re-run)
- After promotion recipe adds new signals to vault (automatic — promotion writes to both Postgres and filesystem)

## Key Rules

- Radars are the classification lens — keywords determine matching
- Signals are the actual knowledge — content gets embedded
- Both Postgres and filesystem stay in sync (Postgres is the query source, filesystem is the human-readable mirror)
- Embedding dimension: 1024 (voyage-3)
