# Skill / Tool Contract

Every `@beta_tool` function in `skills/` must follow these rules.

## Structure

```python
@beta_tool
async def skill_name(param1: type, param2: type) -> str:
    """One-line description of what this tool does.

    Args:
        param1: Description of param1
        param2: Description of param2
    """
    # 1. Execute the action
    result = await do_the_thing(param1, param2)

    # 2. Log to audit (MANDATORY)
    await log_decision(
        decision_type="...",
        input={...},
        output={...},
        confidence=...,
        sources=[...],
    )

    # 3. Return structured string
    return f"Action completed: {result.summary}"
```

## Rules

1. **Always async** — database and API calls are async
2. **Always audit log** — every skill invocation that makes a decision must log
3. **Return string** — `tool_runner` expects string returns
4. **Use ToolError for expected failures** — gives the model actionable error context
5. **Stateless** — read/write state through memory layer, not local variables
6. **Docstring required** — the decorator uses it to generate the tool schema for Claude

## Gate Tools

Gate tools (`ask_clarification`, `pause_for_review`, `report_blocked`) are special:
- They don't execute domain logic
- They signal the agent loop to reach a response gate
- The agent loop runtime detects these tool calls and handles the gate transition
