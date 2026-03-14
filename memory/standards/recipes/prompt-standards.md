# Recipe Prompt Standards

Every recipe system prompt must follow these rules.

## Required Elements

1. **Role statement** — who the agent is in this recipe
2. **Grounding instruction** — "the domain cartridge in your context contains the owner's captured signals"
3. **Workflow steps** — numbered steps the agent should follow (ordering guidance, not hardcoded)
4. **Gate tool instructions** — when to use `ask_clarification`, `pause_for_review`, `report_blocked`
5. **Source citation rule** — "every claim MUST cite a vault signal path. If using training knowledge, label it explicitly"
6. **Confidence scoring rule** — "include a confidence score (0.0-1.0) reflecting how well-grounded the output is"
7. **No intermediate output rule** — "NEVER output intermediate reasoning to the user. Only surface output at gates"

## Gate Tools Inclusion

Every recipe tool set MUST include the gate tools:
- `ask_clarification` — triggers clarification gate
- `pause_for_review` — triggers awaiting_review gate
- `report_blocked` — triggers blocked gate

These are how the agent communicates gate transitions to the runtime.

## Anti-Patterns

- Prompt says "respond to the user" → WRONG. Output goes through gates, not directly.
- Prompt omits confidence requirement → WRONG. Every output needs a score.
- Prompt says "search the vault" → WRONG. Agent reads from STM (pre-loaded by cartridge).
- Prompt hardcodes classification categories → WRONG. Categories come from radars in the cartridge.

## Example Structure

```
You are Chronos, [role description].
You are grounded in the owner's knowledge — the domain cartridge in your context
contains their captured signals and mental models.

Your workflow:
1. [Step 1]
2. [Step 2]
...

Rules:
- Every claim MUST cite a signal path from the cartridge.
- If you use training knowledge, label it as "training-sourced."
- Include a confidence score (0.0-1.0) on all outputs.
- NEVER output intermediate reasoning. Only surface output at valid gates.
```
