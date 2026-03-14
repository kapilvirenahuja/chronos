# Python Engine Standards

## General

- Python 3.12+, fully async (`async/await`)
- Type hints on all function signatures
- pydantic-settings for configuration
- No LangChain/LangGraph imports — ever

## Anthropic SDK

- Tools defined with `@beta_tool` decorator
- Agent loop via `client.beta.messages.tool_runner()` with compaction enabled
- Compaction threshold: 100k tokens
- Use `ToolError` for tool errors (not raw exceptions)

## Langfuse

- `AnthropicInstrumentor().instrument()` at startup — auto-traces all Anthropic calls
- `@observe(name="...")` decorator on recipe functions and skill functions
- Every recipe run creates a Langfuse trace with `session_id` and `user_id`

## Skills (@beta_tool)

- Every skill MUST log to audit_log after acting
- Return structured string (not JSON) — the tool_runner expects string returns
- Keep skills stateless — read/write state via memory layer functions
- Use `ToolError` for expected failures, let unexpected errors propagate

## Database

- Use `asyncpg` for Postgres connections
- Connection pool shared across the engine
- All queries parameterized (no f-strings in SQL)
