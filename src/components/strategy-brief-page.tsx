import { getStore } from "@/lib/store";

interface StrategyBriefPageProps {
  sessionId: string;
}

export async function StrategyBriefPage({
  sessionId
}: StrategyBriefPageProps) {
  const session = await getStore().getSession(sessionId);
  const brief = session?.metadata?.lastBrief as
    | {
        title?: string;
        content?: string;
        createdAt?: string;
      }
    | undefined;

  if (!session || !brief?.content) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Brief not found</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Strategy Brief</span>
        <h1>{brief.title ?? session.topic}</h1>
        <p>{brief.createdAt ?? session.updatedAt}</p>
      </section>

      <section className="panel">
        <pre className="brief-markdown">{brief.content}</pre>
      </section>
    </main>
  );
}
