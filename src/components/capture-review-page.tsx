import { getStore } from "@/lib/store";

interface CaptureReviewPageProps {
  returnTo: string;
}

function renderConfidence(value?: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "n/a";
}

export async function CaptureReviewPage({
  returnTo
}: CaptureReviewPageProps) {
  const captures = await getStore().listCaptures({ limit: 30 });

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Capture Review</span>
        <h1>Inspect raw captures before they harden into memory.</h1>
        <p>
          This page is the MVP web surface from the Chronos spec: it shows
          recent captures, current classification, and review actions for items
          that need owner input.
        </p>
      </section>

      <section className="panel">
        <h2>Recent Captures</h2>
        {captures.length === 0 ? (
          <p className="muted">
            No captures yet. Send a capture through <code>/api/signal</code> or{" "}
            <code>/api/discord</code>.
          </p>
        ) : (
          <div className="list">
            {captures.map((capture) => (
              <article className="capture-card" key={capture.id}>
                <div className="meta-row">
                  <span className="chip">{capture.status}</span>
                  <span className="chip">
                    {capture.deepClassification?.category ??
                      capture.quickClassification?.category ??
                      "unclassified"}
                  </span>
                  <span className="chip">
                    confidence{" "}
                    {renderConfidence(
                      capture.reviewNotes?.adjustedConfidence ??
                        capture.deepClassification?.confidence ??
                        capture.quickClassification?.confidence
                    )}
                  </span>
                  <span className="chip">{capture.createdAt}</span>
                </div>

                <blockquote>{capture.message}</blockquote>

                <div className="muted">
                  {capture.rejectedReason ??
                    capture.contentQuality?.reason ??
                    capture.deepClassification?.reasoning ??
                    capture.quickClassification?.reasoning}
                </div>

                {capture.clarification?.question ? (
                  <div className="chip">{capture.clarification.question}</div>
                ) : null}

                <div className="forms">
                  <form className="inline-form" action="/api/web-action" method="post">
                    <input type="hidden" name="captureId" value={capture.id} />
                    <input type="hidden" name="actionType" value="confidence_update" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>
                      Adjust confidence
                      <input
                        max="1"
                        min="0"
                        name="value"
                        placeholder="0.72"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <button type="submit">Save confidence</button>
                  </form>

                  <form className="inline-form" action="/api/web-action" method="post">
                    <input type="hidden" name="captureId" value={capture.id} />
                    <input type="hidden" name="actionType" value="disagreement" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>
                      Why do you disagree?
                      <textarea
                        name="value"
                        placeholder="Classification is off because..."
                        rows={3}
                      />
                    </label>
                    <button type="submit">Record disagreement</button>
                  </form>

                  <form className="inline-form" action="/api/web-action" method="post">
                    <input type="hidden" name="captureId" value={capture.id} />
                    <input type="hidden" name="actionType" value="question" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>
                      Ask a follow-up
                      <textarea
                        name="value"
                        placeholder="What should heartbeat verify next?"
                        rows={2}
                      />
                    </label>
                    <button type="submit">Save question</button>
                  </form>

                  {capture.clarification?.question && !capture.clarification.response ? (
                    <form className="inline-form" action="/api/web-action" method="post">
                      <input type="hidden" name="captureId" value={capture.id} />
                      <input
                        type="hidden"
                        name="actionType"
                        value="clarification_response"
                      />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <label>
                        Answer clarification
                        <textarea
                          name="value"
                          placeholder="Add the missing context here..."
                          rows={2}
                        />
                      </label>
                      <button type="submit">Send clarification</button>
                    </form>
                  ) : null}

                  <form className="inline-form" action="/api/web-action" method="post">
                    <input type="hidden" name="captureId" value={capture.id} />
                    <input type="hidden" name="actionType" value="approve" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit">Approve for reprocessing</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
