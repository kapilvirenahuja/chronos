import type { Route } from "next";
import Link from "next/link";

import { loadConfig } from "@/lib/config";
import { getRuntimeStatus } from "@/lib/runtime-status";
import { getStore } from "@/lib/store";
import {
  issueCaptureReviewPath,
  issueDecisionLogPath,
  issueSessionSummaryPath
} from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = loadConfig();
  const runtimeStatus = getRuntimeStatus();
  const store = getStore();
  const [captures, sessions, decisions] = await Promise.all([
    store.listCaptures({ limit: 6 }),
    store.listSessions(),
    store.listDecisions(6)
  ]);
  const captureReview = issueCaptureReviewPath();
  const decisionLog = issueDecisionLogPath();
  const currentSession =
    sessions.find((session) => Boolean(session.metadata?.isCurrent)) ??
    sessions[0] ??
    null;
  const sessionSummary = currentSession
    ? issueSessionSummaryPath(currentSession.id)
    : null;

  const mode =
    process.env.CHRONOS_STORE ?? (process.env.POSTGRES_URL ? "postgres" : "file");

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Chronos MVP Port</span>
        <h1>Capture first. Promote later. Stay quiet by default.</h1>
        <p>
          This runtime is a greenfield port of the Chronos feature spec. It
          implements the MVP loop: owner-only capture, decision logging,
          heartbeat classification, and a web review surface for ambiguous
          entries.
        </p>
        <div className="actions">
          <Link className="link-button" href={captureReview.path as Route}>
            Open Capture Review
          </Link>
          {sessionSummary ? (
            <Link className="link-button" href={sessionSummary.path as Route}>
              Open Session Summary
            </Link>
          ) : null}
          <Link className="link-button" href={decisionLog.path as Route}>
            Open Decision Log
          </Link>
          <a className="subtle-link" href="/api/heartbeat">
            Run heartbeat now
          </a>
          <a className="subtle-link" href="/api/notifications/dispatch">
            Dispatch queued notifications
          </a>
        </div>
      </section>

      <section className="grid three">
        <article className="panel">
          <h2>Runtime</h2>
          <p className="muted">Configured for Vercel-style routes with a local dev fallback.</p>
          <strong>{mode}</strong>
        </article>
        <article className="panel">
          <h2>Captures</h2>
          <p className="muted">Current log depth</p>
          <strong>{captures.length}</strong>
        </article>
        <article className="panel">
          <h2>Sessions</h2>
          <p className="muted">Known session records</p>
          <strong>{sessions.length}</strong>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
        <article className="panel">
          <h2>Active Config</h2>
          <ul className="list">
            <li>
              <code>channel.messaging.provider</code>:{" "}
              {config.channels.channel.messaging.provider}
            </li>
            <li>
              <code>channel.web.base_url</code>: {config.channels.channel.web.base_url}
            </li>
            <li>
              <code>heartbeat.batch_size</code>: {config.heartbeat.heartbeat.batch_size}
            </li>
            <li>
              <code>trust.owner_ids</code>: {config.trust.trust.owner_ids.join(", ")}
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Integration Status</h2>
          <ul className="list">
            <li>
              Anthropic:{" "}
              {runtimeStatus.anthropic.configured
                ? "configured"
                : "not configured (heuristic classifier active)"}
            </li>
            <li>
              Anthropic runtime: {runtimeStatus.anthropic.runtime_stage}
            </li>
            <li>
              Anthropic model: <code>{runtimeStatus.anthropic.model}</code>
            </li>
            <li>
              Anthropic eval model: <code>{runtimeStatus.anthropic.eval_model}</code>
            </li>
            <li>
              Discord signing:{" "}
              {runtimeStatus.discord.signature_verification_configured
                ? "configured"
                : "pending"}
            </li>
            <li>
              Discord app credentials:{" "}
              {runtimeStatus.discord.application_id_configured &&
              runtimeStatus.discord.bot_token_configured
                ? "configured"
                : "pending"}
            </li>
            <li>
              Postgres: {runtimeStatus.postgres.configured ? "configured" : "pending"}
            </li>
            <li>
              Search index:{" "}
              {runtimeStatus.search.configured
                ? runtimeStatus.search.provider
                : "pending (local fallback active)"}
            </li>
            <li>
              Health: <a className="subtle-link" href="/api/health">/api/health</a>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Latest Decisions</h2>
          {decisions.length === 0 ? (
            <p className="muted">No decisions yet.</p>
          ) : (
            <ul className="list">
              {decisions.map((decision) => (
                <li key={decision.id}>
                  <strong style={{ fontSize: "1rem" }}>{decision.action}</strong>
                  <div className="muted">{decision.createdAt}</div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
