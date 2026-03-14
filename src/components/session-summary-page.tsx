import { getStore } from "@/lib/store";

interface SessionSummaryPageProps {
  returnTo: string;
  sessionId: string;
}

export async function SessionSummaryPage({
  returnTo,
  sessionId
}: SessionSummaryPageProps) {
  const store = getStore();
  const [session, captures, decisions] = await Promise.all([
    store.getSession(sessionId),
    store.listCaptures({ sessionId, limit: 30 }),
    store.listDecisions(50)
  ]);

  if (!session) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Session not found</h1>
        </section>
      </main>
    );
  }

  const sessionDecisions = decisions.filter((decision) => decision.sessionId === sessionId);

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Session Summary</span>
        <h1>{session.topic}</h1>
        <p>
          Current state for this topic-based session: captures, decisions, and
          follow-up actions.
        </p>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Session</h2>
          <ul className="list">
            <li>Status: {session.status}</li>
            <li>Current: {Boolean(session.metadata?.isCurrent) ? "yes" : "no"}</li>
            <li>Created: {session.createdAt}</li>
            <li>Updated: {session.updatedAt}</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Actions</h2>
          <div className="forms">
            <form className="inline-form" action="/api/session-action" method="post">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="actionType" value="add_context" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label>
                Add context
                <textarea
                  name="value"
                  placeholder="Add context that should stay with this session..."
                  rows={3}
                />
              </label>
              <button type="submit">Save context</button>
            </form>

            <form className="inline-form" action="/api/session-action" method="post">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="actionType" value="request_follow_up" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label>
                Request follow-up
                <textarea
                  name="value"
                  placeholder="What follow-up should Chronos remember?"
                  rows={2}
                />
              </label>
              <button type="submit">Save follow-up</button>
            </form>

            <form className="inline-form" action="/api/session-action" method="post">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="actionType" value="archive_session" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit">Archive session</button>
            </form>
          </div>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
        <article className="panel">
          <h2>STM Context</h2>
          {session.context.length === 0 ? (
            <p className="muted">No relevant memory loaded for this session yet.</p>
          ) : (
            <ul className="list">
              {session.context.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <div className="muted">{item.excerpt}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <h2>History</h2>
          {session.history.length === 0 ? (
            <p className="muted">No conversation history yet.</p>
          ) : (
            <ul className="list">
              {session.history.slice(-10).map((entry) => (
                <li key={`${entry.at}-${entry.text}`}>
                  <strong>{entry.role}</strong>
                  <div>{entry.text}</div>
                  <div className="muted">{entry.at}</div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
        <article className="panel">
          <h2>Captures</h2>
          {captures.length === 0 ? (
            <p className="muted">No captures in this session yet.</p>
          ) : (
            <ul className="list">
              {captures.map((capture) => (
                <li key={capture.id}>
                  <strong>{capture.status}</strong>
                  <div>{capture.message}</div>
                  <div className="muted">{capture.updatedAt}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <h2>Decisions</h2>
          {sessionDecisions.length === 0 ? (
            <p className="muted">No decisions recorded for this session.</p>
          ) : (
            <ul className="list">
              {sessionDecisions.map((decision) => (
                <li key={decision.id}>
                  <strong>{decision.action}</strong>
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
