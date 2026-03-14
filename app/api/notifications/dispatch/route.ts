import { NextResponse } from "next/server";

import { dispatchQueuedNotifications } from "@/lib/engine/notifications";

export async function GET() {
  const result = await dispatchQueuedNotifications();
  return NextResponse.json(result);
}
