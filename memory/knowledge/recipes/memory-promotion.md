# Recipe 3: Memory Promotion

## Identity

- **Tempo**: Long (monthly/quarterly)
- **PCAM flow**: Cognition (pattern detection) → Agency (promote/archive/surface) → Manifestation (vault + audit)
- **Intents served**: (system-initiated, not user-initiated)

## Flow

1. Load all classified signals from the period
2. Discover relationships between signals (reinforces, contradicts, extends, supersedes)
3. Store relationships in `signal_relationships` table
4. Identify reinforcing clusters (3+ signals on same theme)
5. For each cluster: promote to vault OR flag for review OR archive as noise
6. Scan for contradictions between vault signals and new patterns → surface
7. Scan for novel connections across radar categories → surface
8. Publish promotion summary to web
9. Notify owner via Discord (< 280 chars)
10. Await review for ambiguous items (human pause)
11. Incorporate feedback, finalize promotions

## Gate Conditions

- `pause_for_review` → awaiting_review gate
- `report_blocked` → blocked gate

## Key Rules

- Promoted signals get embedded and inserted into `vault_signals` table
- Promoted signals also written to `vault/signals/` filesystem mirror
- Archived signals marked as `archived` in signal store (not deleted)
- All relationship discoveries logged to audit_log
- All promotion/archive decisions logged to audit_log
- Proactive synthesis (novel connections) is the key differentiator — this is not just cleanup

## Scenarios

SC-MEM-001 through SC-MEM-004, SC-AUD-004
