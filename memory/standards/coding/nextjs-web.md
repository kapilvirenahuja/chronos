# Next.js Web Standards

## General

- Next.js 15, App Router (no Pages Router)
- TypeScript strict mode
- Tailwind CSS for styling
- Server Components by default, Client Components only when needed (interactivity)

## Database

- Drizzle ORM or Prisma for type-safe Postgres queries
- Read directly from Neon Postgres (no API proxy for reads)
- Write operations that affect recipe state → call Python engine API

## API Routes

- `/api/` routes for: webhook ingestion, review actions (proxy to engine), cron triggers
- Engine API calls authenticated with `ENGINE_API_SECRET`
- Owner-facing routes authenticated with token in URL or cookie

## Components

- Reusable components in `src/components/`
- `ConfidenceBadge` — renders confidence score with color coding
- `SourceCitation` — renders vault signal path with link
- `ReviewCard` — renders review item with action buttons

## Security

- Token-authenticated artifact URLs (token in query param)
- All review actions verify owner token before processing
- No public-facing write endpoints without auth
