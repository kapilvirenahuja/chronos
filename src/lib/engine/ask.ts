import { runConsultCtoRecipe } from "@/lib/engine/consult-cto";

import type { CaptureOutcome } from "@/lib/types";

export async function askChronos(input: {
  question: string;
  authorId: string;
  channel: "discord" | "claude_code" | "web";
  sessionId?: string;
  topic?: string;
  runId?: string;
}): Promise<CaptureOutcome> {
  return runConsultCtoRecipe(input);
}
