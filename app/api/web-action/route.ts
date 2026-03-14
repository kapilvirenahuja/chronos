import type { Route } from "next";
import { redirect } from "next/navigation";

import {
  normalizeWebActionSignal,
  processSignal
} from "@/lib/engine/signals";

export async function POST(request: Request) {
  const formData = await request.formData();
  const captureId = String(formData.get("captureId") ?? "");
  const actionType = String(formData.get("actionType") ?? "") as
    | "confidence_update"
    | "disagreement"
    | "question"
    | "approve"
    | "clarification_response";
  const value = String(formData.get("value") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/review/captures");

  if (captureId && (value || actionType === "approve")) {
    await processSignal(
      normalizeWebActionSignal({
        type: "web_action",
        capture_id: captureId,
        action_type: actionType,
        value
      })
    );
  }

  redirect(returnTo as Route);
}
