# Testing: Scenario Mapping

## Rule

Every implemented feature MUST trace to one or more `SC-*` scenario IDs from `chronos-scenarios.md`.

## Test File Structure

Test files mirror scenario groups:

| File | Scenarios |
|------|-----------|
| `test_capture.py` | SC-CAP-001 through SC-CAP-004 |
| `test_classify.py` | SC-CLS-001 through SC-CLS-005 |
| `test_consult.py` | SC-CON-001 through SC-CON-007 |
| `test_promotion.py` | SC-MEM-001 through SC-MEM-004 |
| `test_review.py` | SC-REV-001 through SC-REV-005 |
| `test_sessions.py` | SC-SES-001 through SC-SES-005 |
| `test_channels.py` | SC-CHN-001 through SC-CHN-004 |
| `test_confidence.py` | SC-CNF-001 through SC-CNF-003 |
| `test_audit.py` | SC-AUD-001 through SC-AUD-005 |
| `test_trust.py` | SC-TRU-001 through SC-TRU-003 |
| `test_gates.py` | SC-GAT-001 through SC-GAT-004 |
| `test_observability.py` | SC-OBS-001, SC-OBS-002 |
| `test_integration.py` | SC-PHX-001, SC-PHX-002, SC-DOM-001 |

## Test Naming

Each test function references its scenario ID:

```python
async def test_sc_cap_001_silent_single_capture():
    """SC-CAP-001: Owner sends a single thought, stored silently."""
```

## Automation Types

- **Automated**: Full assertion, no human needed
- **Hybrid**: Automated setup + structural assertions, human element documented in scenario
