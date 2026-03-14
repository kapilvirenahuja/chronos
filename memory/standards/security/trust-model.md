# Trust Model Standards

## MVP: Owner-Only

- Single owner identified by Discord user ID (`OWNER_DISCORD_ID` env var)
- All non-owner messages silently rejected (no error response)
- Rejections logged internally (trust layer log)

## Web Authentication

- Artifacts accessed via token-authenticated URLs: `/artifacts/[id]?token=xxx`
- Token generated per artifact (64-char random string, stored in `artifacts.access_token`)
- Owner review actions require separate owner token (JWT or similar)
- Engine API calls from Next.js authenticated with shared secret (`ENGINE_API_SECRET`)

## Rules

- Unknown authors NEVER reach the signal store
- Web endpoints ALWAYS verify token before serving content
- Engine API ALWAYS verifies shared secret
- No public-facing write endpoints without authentication
