# Structured Artifact Format

The canonical schema for artifacts produced by the synthesize skill.

```json
{
  "title": "string — artifact title",
  "sections": [
    {
      "heading": "string — section heading",
      "content": "string — markdown content"
    }
  ],
  "sources": [
    {
      "claim": "string — the specific claim being sourced",
      "signal_path": "string — vault signal path (e.g., signals/ai/augmentation-principle.md)"
    }
  ],
  "confidence": 0.85,
  "training_sourced": [
    "string — claims that come from model training, not vault signals"
  ],
  "confidence_gaps": [
    "string — specific areas where more signals would increase confidence"
  ],
  "metadata": {
    "recipe": "consult_cto",
    "session_id": "uuid",
    "timestamp": "ISO 8601",
    "role_profile": "cto",
    "radars_matched": ["ai-intelligence", "technology"]
  }
}
```

## Rules

- `sources` MUST reference real vault signal paths (verifiable)
- `confidence` MUST be between 0.0 and 1.0
- `training_sourced` MUST list any claims not grounded in vault signals
- `confidence_gaps` MUST be specific (not "more information" — instead "signals about migration risk patterns")
- `metadata.radars_matched` shows which radars contributed to the cartridge
