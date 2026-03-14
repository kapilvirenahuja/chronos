import { notFound } from "next/navigation";

import { StrategyBriefPage } from "@/components/strategy-brief-page";
import { validatePageToken } from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function SignedStrategyBriefPage({
  params
}: {
  params: Promise<{ sessionId: string; accessToken: string }>;
}) {
  const { sessionId, accessToken } = await params;
  const payload = validatePageToken(accessToken, {
    pageType: "strategy_brief",
    sessionId
  });

  if (!payload) {
    notFound();
  }

  return <StrategyBriefPage sessionId={sessionId} />;
}
