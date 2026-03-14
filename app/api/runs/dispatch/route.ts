import { NextResponse } from "next/server";

import { dispatchQueuedRuns } from "@/lib/engine/signals";

function parseLimit(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("limit");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;
}

async function dispatch(request: Request) {
  const limit = parseLimit(request);
  const result = await dispatchQueuedRuns(limit);

  return NextResponse.json({
    processed: result.runs.length,
    runIds: result.runs.map((run) => run.id)
  });
}

export async function GET(request: Request) {
  return dispatch(request);
}

export async function POST(request: Request) {
  return dispatch(request);
}
