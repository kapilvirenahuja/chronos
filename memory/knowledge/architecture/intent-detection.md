# Intent Detection Architecture

Three distinct routing layers. They are NOT the same thing and must not be collapsed.

## Layer 1: Command Routing (Gateway)

Discord slash commands map directly to recipes. No AI, no heuristics.

| Command | Recipe | Notes |
|---------|--------|-------|
| `/capture <text>` | Capture & Classify | Explicit capture — store signal, silent |
| `/ask <question>` | Consult CTO | Explicit consult — start recipe |
| `/session <action>` | Session management | CRUD operations |

Commands are the primary interaction model. They are explicit, unambiguous, and free.

## Layer 2: Intent Detection (Gateway)

When a user sends a **free-form message** (no slash command), the gateway must determine which recipe to route to. This is a keyword heuristic — programmatic, no LLM call.

```python
def detect_intent(text: str) -> str:
    """
    Simple keyword heuristic for free-form messages.
    Returns: 'capture' | 'consult'
    """
    # Consult indicators: questions, explicit ask patterns
    consult_patterns = [
        text.strip().endswith("?"),
        text.lower().startswith(("what ", "how ", "why ", "should ", "compare ", "analyze ")),
        "help me think" in text.lower(),
        "what do i know about" in text.lower(),
    ]

    if any(consult_patterns):
        return "consult"

    # Default: capture (post-office model)
    return "capture"
```

This is cheap, instant, and good enough for v1. The heuristic can be tuned over time. False positives (a thought accidentally triggering consult) are worse than false negatives (a question getting captured silently) because the user can always use `/ask` explicitly.

**Default is always capture.** Consult requires either a command or a clear question pattern.

## Layer 3: Content Classification (Inside Recipe 1)

After a signal is captured, the heartbeat classification recipe determines **what the signal is about** — which radar category it belongs to. This IS an LLM call because it requires semantic understanding:

- "AI agents will replace middleware within 3 years" → ai-intelligence radar
- "We should adopt event sourcing for the order domain" → technology radar
- "The flywheel effect applies to team culture" → ambiguous (leadership? innovation?)

Classification happens asynchronously in Recipe 1's heartbeat, not at the gateway. It uses the domain cartridge (RAG) and the agentic agent loop.

## Key Distinction

| Concern | When | Cost | Intelligence |
|---------|------|------|-------------|
| Command routing | Immediate, at gateway | Free | None needed |
| Intent detection | Immediate, at gateway | Free | Keyword heuristic |
| Content classification | Async, in heartbeat | LLM call | Full agent loop with RAG |

## Anti-Patterns

- Using an LLM call for intent detection → wasteful, every message costs money
- Using a heuristic for content classification → too dumb, misses semantic relationships
- Collapsing intent detection and classification into one step → breaks the capture-first principle (signals must be stored BEFORE processing)
