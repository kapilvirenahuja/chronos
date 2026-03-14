import { notFound } from "next/navigation";

import { CaptureReviewPage } from "@/components/capture-review-page";
import { validatePageToken } from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function SignedCaptureReviewPage({
  params
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const payload = validatePageToken(accessToken, {
    pageType: "capture_review"
  });

  if (!payload) {
    notFound();
  }

  return <CaptureReviewPage returnTo={`/review/captures/${accessToken}`} />;
}
