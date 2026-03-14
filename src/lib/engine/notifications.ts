import { loadConfig } from "@/lib/config";
import { makeId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { HeartbeatOutcome, NotificationRecord } from "@/lib/types";

function localParts(timezone: string, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timezone
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second"))
  };
}

function parseTime(input: string): { hour: number; minute: number } {
  const [hour, minute] = input.split(":");
  return {
    hour: Number(hour ?? "0"),
    minute: Number(minute ?? "0")
  };
}

function localHourInTimezone(timezone: string, date = new Date()): number {
  return localParts(timezone, date).hour;
}

function isWithinQuietHours(date = new Date()): boolean {
  const config = loadConfig().heartbeat.heartbeat;
  const start = parseTime(config.quiet_hours.start).hour;
  const end = parseTime(config.quiet_hours.end).hour;
  const hour = localHourInTimezone(config.quiet_hours.timezone, date);

  if (start === end) {
    return false;
  }

  if (start > end) {
    return hour >= start || hour < end;
  }

  return hour >= start && hour < end;
}

function notificationChannelId(): string | null {
  const configured =
    process.env.DISCORD_NOTIFICATION_CHANNEL_ID ??
    loadConfig().channels.channel.messaging.discord.channel_id;

  return /^\d+$/.test(configured) ? configured : null;
}

function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function trimToWordLimit(input: string, limit: number): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return input;
  }

  return `${words.slice(0, limit - 1).join(" ")}...`;
}

function notificationsEnabled(kind: NotificationRecord["kind"]): boolean {
  const enabled = loadConfig().heartbeat.heartbeat.notification.enabled_types;
  if (enabled === "all") {
    return true;
  }

  return enabled
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(kind);
}

function buildHeartbeatMessage(outcome: HeartbeatOutcome): string | null {
  if (outcome.pendingOwner.length === 0) {
    return null;
  }

  const maxWords = loadConfig().heartbeat.heartbeat.notification.max_words;
  const first = outcome.pendingOwner[0];
  const more =
    outcome.pendingOwner.length > 1
      ? ` and ${outcome.pendingOwner.length - 1} more`
      : "";
  const base = `Chronos heartbeat needs review: ${first.message.slice(0, 40)}${more}. Open the review page to resolve it.`;

  return trimToWordLimit(base, maxWords);
}

function timeZoneOffsetMs(timezone: string, date: Date): number {
  const parts = localParts(timezone, date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc(input: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): Date {
  const guess = new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0)
  );
  const offset = timeZoneOffsetMs(input.timezone, guess);
  return new Date(guess.getTime() - offset);
}

function nextDeliveryTime(date = new Date()): string {
  const config = loadConfig().heartbeat.heartbeat;
  const timezone = config.quiet_hours.timezone;
  const delivery = parseTime(config.notification.delivery_time);
  const localNow = localParts(timezone, date);

  const nowTarget = zonedTimeToUtc({
    timezone,
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
    hour: localNow.hour,
    minute: localNow.minute
  });

  let target = zonedTimeToUtc({
    timezone,
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
    hour: delivery.hour,
    minute: delivery.minute
  });

  if (target.getTime() <= nowTarget.getTime() || isWithinQuietHours(date)) {
    const tomorrow = new Date(nowTarget);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const localTomorrow = localParts(timezone, tomorrow);
    target = zonedTimeToUtc({
      timezone,
      year: localTomorrow.year,
      month: localTomorrow.month,
      day: localTomorrow.day,
      hour: delivery.hour,
      minute: delivery.minute
    });
  }

  return target.toISOString();
}

async function hasActiveConversation(): Promise<boolean> {
  const sessions = await getStore().listSessions();
  const cutoff = Date.now() - 20 * 60 * 1000;
  return sessions.some(
    (session) =>
      session.status === "active" &&
      new Date(session.lastSignalAt).getTime() >= cutoff
  );
}

async function postDiscordMessage(content: string): Promise<boolean> {
  const channelId = notificationChannelId();
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) {
    return false;
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    }
  );

  return response.ok;
}

export async function queueHeartbeatNotification(
  outcome: HeartbeatOutcome
): Promise<NotificationRecord | null> {
  const content = buildHeartbeatMessage(outcome);
  if (!content || !notificationsEnabled("heartbeat_review")) {
    return null;
  }

  const record: NotificationRecord = {
    id: makeId("notification"),
    kind: "heartbeat_review",
    channel: "discord",
    status: "queued",
    content,
    deliverAt: nextDeliveryTime(),
    createdAt: nowIso(),
    metadata: {
      pendingCaptureIds: outcome.pendingOwner.map((capture) => capture.id),
      wordCount: countWords(content)
    }
  };

  await getStore().saveNotification(record);
  return record;
}

export async function dispatchQueuedNotifications(options?: {
  now?: Date;
  ignoreConversation?: boolean;
}): Promise<{
  sent: number;
  failed: number;
  queued: number;
}> {
  const now = options?.now ?? new Date();
  const store = getStore();
  const queued = await store.listNotifications({
    statuses: ["queued"],
    dueBefore: now.toISOString(),
    limit: 25
  });

  if (
    queued.length === 0 ||
    isWithinQuietHours(now) ||
    (!options?.ignoreConversation && (await hasActiveConversation()))
  ) {
    return {
      sent: 0,
      failed: 0,
      queued: queued.length
    };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of queued) {
    const ok = await postDiscordMessage(notification.content);
    await store.saveNotification({
      ...notification,
      status: ok ? "sent" : "failed",
      sentAt: ok ? now.toISOString() : undefined,
      metadata: {
        ...(notification.metadata ?? {}),
        deliveryAttemptedAt: now.toISOString()
      }
    });

    if (ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return {
    sent,
    failed,
    queued: 0
  };
}
