import { getStore } from "@/lib/store";

interface DecisionLogPageProps {
  mode?: "all" | "overrides" | "writes" | "false_positives";
}

export async function DecisionLogPage({
  mode = "all"
}: DecisionLogPageProps) {
  const decisions = await getStore().listDecisions(100);
  const filtered = decisions.filter((decision) => {
    if (mode === "overrides") {
      return decision.autoApproved === false;
    }

    if (mode === "false_positives") {
      return decision.autoApproved === false && decision.action === "classification";
    }

    if (mode === "writes") {
      return decision.action === "ltm_write";
    }

    return true;
  });

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Decision Log</span>
        <h1>Inspect autonomous decisions and owner overrides.</h1>
        <p>
          This is the audit surface for classification, promotion, and manual
          corrections.
        </p>
      </section>

      <section className="panel">
        <h2>
          {mode === "all"
            ? "All Decisions"
            : mode === "overrides"
              ? "Overrides"
              : mode === "false_positives"
                ? "False Positives"
                : "LTM Writes"}
        </h2>
        {filtered.length === 0 ? (
          <p className="muted">No decisions recorded for this view.</p>
        ) : (
          <ul className="list">
            {filtered.map((decision) => (
              <li key={decision.id}>
                <strong>{decision.action}</strong>
                <div>{decision.input ?? "No input recorded."}</div>
                <div className="muted">
                  confidence {decision.confidence ?? "n/a"} | threshold{" "}
                  {decision.thresholdUsed ?? "n/a"} | {decision.createdAt}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
