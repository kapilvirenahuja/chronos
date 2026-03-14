# Session Management

Sessions are topic-based, not channel-based.

## Operations

| Operation | Channel | Effect |
|-----------|---------|--------|
| `/session new <topic>` | Discord | Create session, init STM, confirm |
| `/session load <id>` | Discord | Restore STM from Postgres |
| `/session clear` | Discord | Clear STM, mark session inactive (preserve record) |
| `/session list` | Discord | List sessions with topics and timestamps |
| Session list page | Web (`/sessions`) | Read-only list from Postgres |

## STM Lifecycle

1. **Create**: Session record in Postgres, empty STM state
2. **Initialize**: Recipe loads domain cartridge → writes to `sessions.stm_state` JSONB
3. **Active**: Agent loop reads/writes STM during recipe execution
4. **Persist**: State saved after every tool-use round
5. **Restore**: On `/session load`, STM state restored from Postgres
6. **Clear**: STM emptied, session marked inactive (record preserved for history)

## Key Rules

- One session active at a time per owner (implicit — no multi-session)
- Sessions persist across Discord channels (topic-based, not channel-based)
- Cleared sessions are not deleted — only marked inactive
- STM is a JSONB column, not a separate table — keeps session atomic
