import { notFound } from "next/navigation";

import { ClarificationPage } from "@/components/clarification-page";
import { validatePageToken } from "@/lib/web-pages";

export default async function ClarificationReviewPage({
  params
}: {
  params: Promise<{
    sessionId: string;
    accessToken: string;
  }>;
}) {
  const { sessionId, accessToken } = await params;
  const payload = validatePageToken(accessToken, {
    pageType: "clarification",
    sessionId
  });

  if (!payload) {
    notFound();
  }

  return <ClarificationPage sessionId={sessionId} />;
}
