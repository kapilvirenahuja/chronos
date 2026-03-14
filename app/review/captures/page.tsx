import type { Route } from "next";
import { redirect } from "next/navigation";

import { issueCaptureReviewPath } from "@/lib/web-pages";

export const dynamic = "force-dynamic";

export default async function CaptureReviewPage() {
  redirect(issueCaptureReviewPath().path as Route);
}
