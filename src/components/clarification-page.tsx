import { getStore } from "@/lib/store";

interface ClarificationPageProps {
  sessionId: string;
}

export async function ClarificationPage({
  sessionId
}: ClarificationPageProps) {
  const session = await getStore().getSession(sessionId);
  const clarification = session?.metadata?.lastClarification as
    | {
        title?: string;
        content?: string;
        createdAt?: string;
      }
    | undefined;

  if (!session || !clarification?.content) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Clarification not found</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Clarification</span>
        <h1>{clarification.title ?? session.topic}</h1>
        <p>{clarification.createdAt ?? session.updatedAt}</p>
      </section>

      <section className="panel">
        <pre className="brief-markdown">{clarification.content}</pre>
      </section>
    </main>
  );
}
