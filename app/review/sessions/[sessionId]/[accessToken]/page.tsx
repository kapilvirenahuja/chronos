import { notFound } from "next/navigation";

import { SessionSummaryPage } from "@/components/session-summary-page";
import { validatePageToken } from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function SignedSessionSummaryPage({
  params
}: {
  params: Promise<{ sessionId: string; accessToken: string }>;
}) {
  const { sessionId, accessToken } = await params;
  const payload = validatePageToken(accessToken, {
    pageType: "session_summary",
    sessionId
  });

  if (!payload) {
    notFound();
  }

  return (
    <SessionSummaryPage
      returnTo={`/review/sessions/${sessionId}/${accessToken}`}
      sessionId={sessionId}
    />
  );
}
