# Output Routing

Chronos selects the output channel based on task shape. The user does not choose.

## Routing Rules

| Output Type | Channel | Format |
|-------------|---------|--------|
| Capture acknowledgment | None | Silent — no response |
| Clarification questions | Discord (inline) | Text, < 2000 chars |
| Blocked explanation | Discord (inline) | Text with suggested action |
| Error message | Discord (inline) | Text with recovery suggestion |
| Synthesis artifact | Web + Discord pointer | HTML artifact on web, link in Discord (< 280 chars) |
| Review notification | Discord + Web | Link to review surface in Discord |
| Promotion summary | Web + Discord pointer | HTML summary on web, link in Discord |

## Implementation

The output router sits in `channels/router.py`. It receives a `GateResult` from the agent loop and dispatches:

```python
if gate_type == "clarification":
    # Inline Discord — short enough
    await envelope.reply(format_questions(output))
elif gate_type in ("synthesis", "awaiting_review"):
    # Web artifact + Discord pointer
    url = generate_artifact_url(artifact_id)
    await envelope.reply(f"Ready: {url}")
elif gate_type == "blocked":
    await envelope.reply(format_blocked(output))
elif gate_type == "error":
    await envelope.reply("Something went wrong. Try again or rephrase.")
```

## Key Rules

- Capture is ALWAYS silent
- Clarification stays inline (short, conversational)
- Artifacts ALWAYS go to web (rich content deserves a reading surface)
- Discord pointers are compact (< 280 chars, just a link + one-liner)
