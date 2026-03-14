import { NextResponse } from "next/server";

import {
  normalizeAskSignal,
  normalizeCaptureSignal,
  normalizeSessionCommandSignal,
  submitSignal,
  normalizeWebActionSignal,
} from "@/lib/engine/signals";

function shouldDispatch(request: Request): boolean {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "enqueue") {
    return false;
  }

  if (mode === "dispatch") {
    return true;
  }

  return (process.env.CHRONOS_SIGNAL_EXECUTION_MODE ?? "inline") !== "queued";
}

export async function POST(request: Request) {
  const dispatch = shouldDispatch(request);
  const body = (await request.json()) as
    | {
        type: "capture";
        text: string;
        author: string;
        session_id?: string;
        topic?: string;
        channel?: "claude_code" | "web" | "discord";
      }
    | {
        type: "ask";
        question: string;
        author: string;
        session_id?: string;
        topic?: string;
        channel?: "claude_code" | "web" | "discord";
      }
    | {
        type: "session_command";
        command: "new" | "load" | "clear" | "sessions";
        author: string;
        session_id?: string;
        topic?: string;
        channel?: "claude_code" | "web" | "discord";
      }
    | {
        type: "web_action";
        capture_id: string;
        action_type:
          | "confidence_update"
          | "disagreement"
          | "question"
          | "approve"
          | "clarification_response";
        value?: string;
      };

  if (body.type === "capture") {
    const outcome = await submitSignal(normalizeCaptureSignal(body), { dispatch });

    return NextResponse.json(outcome);
  }

  if (body.type === "ask") {
    const outcome = await submitSignal(normalizeAskSignal(body), { dispatch });

    return NextResponse.json(outcome);
  }

  if (body.type === "session_command") {
    const outcome = await submitSignal(normalizeSessionCommandSignal(body), {
      dispatch
    });

    return NextResponse.json(outcome);
  }

  const outcome = await submitSignal(
    normalizeWebActionSignal({
      type: "web_action",
      capture_id: body.capture_id,
      action_type: body.action_type,
      value: body.value
    }),
    {
      dispatch
    }
  );

  if ("status" in outcome && outcome.status === "ok" && !outcome.capture) {
    return NextResponse.json(
      {
        error: "Capture not found."
      },
      { status: 404 }
    );
  }

  return NextResponse.json(outcome);
}
