# HEARTBEAT.md — Proactive Checks

## Purpose
Heartbeat closes the loop between raw capture and useful memory.

## MVP Intents
- classify

## Behavior
- Run daily.
- Process a bounded batch of unprocessed captures.
- Promote strong signals.
- Queue ambiguous or duplicate items for owner review.
- Stay quiet unless owner action is required.
