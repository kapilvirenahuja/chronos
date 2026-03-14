import { NextResponse } from "next/server";

import {
  normalizeHeartbeatSignal,
  submitSignal
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

export async function GET(request: Request) {
  const outcome = await submitSignal(normalizeHeartbeatSignal(), {
    dispatch: shouldDispatch(request)
  });
  return NextResponse.json(outcome);
}

export async function POST(request: Request) {
  const outcome = await submitSignal(normalizeHeartbeatSignal(), {
    dispatch: shouldDispatch(request)
  });
  return NextResponse.json(outcome);
}
