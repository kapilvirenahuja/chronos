import { notFound } from "next/navigation";

import { DecisionLogPage } from "@/components/decision-log-page";
import { validatePageToken } from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function SignedDecisionLogPage({
  params,
  searchParams
}: {
  params: Promise<{ accessToken: string }>;
  searchParams: Promise<{
    mode?: "all" | "overrides" | "writes" | "false_positives";
  }>;
}) {
  const { accessToken } = await params;
  const { mode } = await searchParams;
  const payload = validatePageToken(accessToken, {
    pageType: "decision_log"
  });

  if (!payload) {
    notFound();
  }

  return <DecisionLogPage mode={mode ?? "all"} />;
}
