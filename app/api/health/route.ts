import { NextResponse } from "next/server";

import { getRuntimeStatus } from "@/lib/runtime-status";

export async function GET() {
  return NextResponse.json(getRuntimeStatus());
}
