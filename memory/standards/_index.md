# Standards

Rules, conventions, and quality criteria that define how Chronos is built.

Agents and skills query this category when they need to know: **"What are the rules?"**

## Contents

| Path | Description | Consumers |
|------|-------------|-----------|
| `coding/python-engine.md` | Python engine conventions: async patterns, Anthropic SDK usage, @beta_tool, @observe | All engine code |
| `coding/nextjs-web.md` | Next.js conventions: App Router patterns, server components, Drizzle/Prisma usage | All web code |
| `database/schema-rules.md` | Postgres schema conventions: naming, enums, audit log append-only, pgvector indexes | DB migrations |
| `testing/scenario-mapping.md` | Every feature maps to SC-* scenario IDs, test structure mirrors scenario groups | All tests |
| `skills/tool-contract.md` | @beta_tool function contract: audit logging, structured return, error handling via ToolError | All skills |
| `recipes/prompt-standards.md` | Recipe prompt requirements: gate tool inclusion, grounding instructions, no intermediate output | All recipes |
| `security/trust-model.md` | Owner-only auth, token-authenticated URLs, engine API shared secret | Auth code |

## When to Add Here

A file belongs in `standards/` if:
- It defines rules that must be followed during implementation
- It answers "what's allowed?" or "what's the convention?"
- Violating it would produce incorrect or inconsistent output
