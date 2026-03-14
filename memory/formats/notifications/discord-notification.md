# Discord Notification Format

Notifications sent to the owner via Discord messaging channel.

## Rules

- Maximum 280 characters (compact pointer, not full content)
- Always include a web URL when pointing to an artifact or review surface
- No markdown formatting in Discord messages (plain text)

## Templates

### Artifact Ready

```
Your brief is ready: {web_base_url}/artifacts/{artifact_id}?token={access_token}
```

### Review Items Pending

```
{count} items need your review: {web_base_url}/review?token={owner_token}
```

### Promotion Summary

```
Monthly review: {promoted} signals promoted, {connections} connections found. Review: {web_base_url}/review?token={owner_token}
```

### Revision Complete

```
Revised based on your feedback: {web_base_url}/artifacts/{artifact_id}?token={access_token}
```
