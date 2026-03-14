import crypto from "node:crypto";

import { loadConfig } from "@/lib/config";
import { makeId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";

import type { ArtifactRecord } from "@/lib/types";

type PageType =
  | "capture_review"
  | "session_summary"
  | "decision_log"
  | "strategy_brief"
  | "clarification";

interface PageTokenPayload {
  pageType: PageType;
  sessionId?: string;
  expiresAt: string;
  issuedAt: string;
  nonce: string;
}

function secret(): string {
  return process.env.CHRONOS_WEB_SECRET ?? "chronos-dev-secret";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodePayload(payload: PageTokenPayload): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodePayload(token: string): PageTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  if (sign(encoded) !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PageTokenPayload;
  } catch {
    return null;
  }
}

function expiryIso(hours: number): string {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return now.toISOString();
}

export function issueCaptureReviewPath(): { path: string; expiresAt: string } {
  const expiresAt = expiryIso(loadConfig().channels.channel.web.page_ttl_hours);
  const token = encodePayload({
    pageType: "capture_review",
    expiresAt,
    issuedAt: nowIso(),
    nonce: crypto.randomUUID()
  });

  return {
    path: `/review/captures/${token}`,
    expiresAt
  };
}

export function issueSessionSummaryPath(
  sessionId: string
): { path: string; expiresAt: string } {
  const expiresAt = expiryIso(loadConfig().channels.channel.web.page_ttl_hours);
  const token = encodePayload({
    pageType: "session_summary",
    sessionId,
    expiresAt,
    issuedAt: nowIso(),
    nonce: crypto.randomUUID()
  });

  return {
    path: `/review/sessions/${sessionId}/${token}`,
    expiresAt
  };
}

export function issueDecisionLogPath(): { path: string; expiresAt: string } {
  const expiresAt = expiryIso(loadConfig().channels.channel.web.page_ttl_hours);
  const token = encodePayload({
    pageType: "decision_log",
    expiresAt,
    issuedAt: nowIso(),
    nonce: crypto.randomUUID()
  });

  return {
    path: `/review/decisions/${token}`,
    expiresAt
  };
}

export function issueStrategyBriefPath(
  sessionId: string
): { path: string; expiresAt: string } {
  const expiresAt = expiryIso(loadConfig().channels.channel.web.page_ttl_hours);
  const token = encodePayload({
    pageType: "strategy_brief",
    sessionId,
    expiresAt,
    issuedAt: nowIso(),
    nonce: crypto.randomUUID()
  });

  return {
    path: `/review/briefs/${sessionId}/${token}`,
    expiresAt
  };
}

export function issueClarificationPath(
  sessionId: string
): { path: string; expiresAt: string } {
  const expiresAt = expiryIso(loadConfig().channels.channel.web.page_ttl_hours);
  const token = encodePayload({
    pageType: "clarification",
    sessionId,
    expiresAt,
    issuedAt: nowIso(),
    nonce: crypto.randomUUID()
  });

  return {
    path: `/review/clarifications/${sessionId}/${token}`,
    expiresAt
  };
}

export function validatePageToken(
  token: string,
  expected: {
    pageType: PageType;
    sessionId?: string;
  }
): PageTokenPayload | null {
  const payload = decodePayload(token);
  if (!payload || payload.pageType !== expected.pageType) {
    return null;
  }

  if (expected.sessionId && payload.sessionId !== expected.sessionId) {
    return null;
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return payload;
}

function tokenFromPath(path: string): string {
  const parts = path.split("/");
  return parts.at(-1) ?? "";
}

async function persistArtifact(input: {
  runId?: string;
  artifactType: ArtifactRecord["artifactType"];
  channel?: ArtifactRecord["channel"];
  sessionId?: string;
  path: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  await getStore().saveArtifact({
    id: makeId("artifact"),
    runId: input.runId,
    artifactType: input.artifactType,
    channel: input.channel ?? "web",
    path: input.path,
    accessToken: tokenFromPath(input.path),
    createdAt: nowIso(),
    expiresAt: input.expiresAt,
    sessionId: input.sessionId,
    metadata: input.metadata ?? {}
  });

  return {
    path: input.path,
    expiresAt: input.expiresAt
  };
}

export async function issueTrackedCaptureReviewPath(input?: {
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const issued = issueCaptureReviewPath();
  return persistArtifact({
    runId: input?.runId,
    artifactType: "capture_review",
    path: issued.path,
    expiresAt: issued.expiresAt,
    metadata: input?.metadata
  });
}

export async function issueTrackedSessionSummaryPath(input: {
  sessionId: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const issued = issueSessionSummaryPath(input.sessionId);
  return persistArtifact({
    runId: input.runId,
    artifactType: "session_summary",
    sessionId: input.sessionId,
    path: issued.path,
    expiresAt: issued.expiresAt,
    metadata: input.metadata
  });
}

export async function issueTrackedDecisionLogPath(input?: {
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const issued = issueDecisionLogPath();
  return persistArtifact({
    runId: input?.runId,
    artifactType: "decision_review",
    path: issued.path,
    expiresAt: issued.expiresAt,
    metadata: input?.metadata
  });
}

export async function issueTrackedStrategyBriefPath(input: {
  sessionId: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const issued = issueStrategyBriefPath(input.sessionId);
  return persistArtifact({
    runId: input.runId,
    artifactType: "strategy_brief",
    sessionId: input.sessionId,
    path: issued.path,
    expiresAt: issued.expiresAt,
    metadata: input.metadata
  });
}

export async function issueTrackedClarificationPath(input: {
  sessionId: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const issued = issueClarificationPath(input.sessionId);
  return persistArtifact({
    runId: input.runId,
    artifactType: "clarification_page",
    sessionId: input.sessionId,
    path: issued.path,
    expiresAt: issued.expiresAt,
    metadata: input.metadata
  });
}
