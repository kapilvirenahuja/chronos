# Split Architecture

Python engine + Next.js web. Two deployment units sharing one database.

## Python Engine (Railway)

- **Long-running process**: Discord bot WebSocket, APScheduler heartbeats
- **Agent loop**: Anthropic SDK `tool_runner` with compaction
- **Internal API**: FastAPI — called by Next.js for review actions, heartbeat triggers
- **Embedding pipeline**: voyage-3 embeddings on signal capture and vault sync

## Next.js Web (Vercel)

- **Artifact pages**: `/artifacts/[id]` — token-authenticated reading surfaces
- **Review surfaces**: `/review` — capture + consult review with action buttons
- **Session UI**: `/sessions` — list, detail, STM state viewer
- **Audit viewer**: `/decisions` — filterable decision log
- **API routes**: Webhook endpoints, Vercel Cron trigger, review action proxy to engine

## Communication

- Next.js reads directly from Neon Postgres (Drizzle ORM)
- Next.js calls Python engine API for: review actions (resume recipe), heartbeat trigger
- Engine API authenticated via shared secret (`ENGINE_API_SECRET`)
- Engine sends Discord notifications; web generates artifact URLs

## Why Split

- Discord bot needs persistent WebSocket → can't run on Vercel
- Agent loop is long-running → can't run as serverless function
- Next.js is best for web surfaces → Vercel is natural fit
- Both share Neon Postgres → no data sync needed
