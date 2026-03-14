import type { Route } from "next";
import { redirect } from "next/navigation";

import { loadConfig } from "@/lib/config";
import { captureThought } from "@/lib/engine/capture";
import { archiveSession } from "@/lib/engine/sessions";

function ownerFallback(): string {
  return loadConfig().trust.trust.owner_ids[0] ?? "owner-dev";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "");
  const actionType = String(formData.get("actionType") ?? "") as
    | "add_context"
    | "request_follow_up"
    | "archive_session";
  const value = String(formData.get("value") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/");

  if (sessionId && actionType === "archive_session") {
    await archiveSession(sessionId);
  } else if (sessionId && value) {
    const prefix = actionType === "request_follow_up" ? "Follow-up: " : "Context: ";
    await captureThought({
      message: `${prefix}${value}`,
      authorId: ownerFallback(),
      channel: "web",
      sessionId
    });
  }

  redirect(returnTo as Route);
}
