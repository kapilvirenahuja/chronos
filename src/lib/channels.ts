import { loadConfig } from "@/lib/config";

import type { Channel } from "@/lib/types";

type ResponseGate =
  | "clarification"
  | "strategy_brief"
  | "decision_log"
  | "session_summary"
  | "message";

function wordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function selectResponseChannel(input: {
  source: Channel;
  gate: ResponseGate;
  content: string;
}): "inline" | "web" {
  if (input.source !== "discord") {
    return "inline";
  }

  if (input.gate === "decision_log" || input.gate === "session_summary") {
    return "web";
  }

  const thresholds = loadConfig().engine.engine.response_channel;
  const words = wordCount(input.content);

  if (
    input.gate === "clarification" &&
    words > thresholds.clarification_inline_word_limit
  ) {
    return "web";
  }

  if (input.gate === "strategy_brief" && words > thresholds.inline_word_limit) {
    return "web";
  }

  return "inline";
}
