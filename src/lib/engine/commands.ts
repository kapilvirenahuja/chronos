import { isOwner, unknownUserMessage } from "@/lib/engine/trust";
import {
  normalizeAskSignal,
  normalizeCaptureSignal,
  normalizeHeartbeatSignal,
  normalizeSessionCommandSignal,
  processSignal
} from "@/lib/engine/signals";

import type { CaptureOutcome } from "@/lib/types";

interface CommandInput {
  name: string;
  authorId: string;
  options: Record<string, string | undefined>;
}

export async function handleCommand(input: CommandInput): Promise<CaptureOutcome> {
  if (!isOwner(input.authorId)) {
    return {
      kind: "message",
      message: unknownUserMessage()
    };
  }

  switch (input.name) {
    case "capture":
      return processSignal(
        normalizeCaptureSignal({
          type: "capture",
          text: input.options.text ?? input.options.message ?? "",
          author: input.authorId,
          channel: "discord",
          session_id: input.options.session_id,
          topic: input.options.topic
        })
      );

    case "new": {
      return processSignal(
        normalizeSessionCommandSignal({
          type: "session_command",
          command: "new",
          author: input.authorId,
          channel: "discord",
          topic: input.options.topic ?? "Untitled session"
        })
      );
    }

    case "load": {
      return processSignal(
        normalizeSessionCommandSignal({
          type: "session_command",
          command: "load",
          author: input.authorId,
          channel: "discord",
          session_id: input.options.session_id
        })
      );
    }

    case "clear": {
      return processSignal(
        normalizeSessionCommandSignal({
          type: "session_command",
          command: "clear",
          author: input.authorId,
          channel: "discord",
          session_id: input.options.session_id
        })
      );
    }

    case "sessions": {
      return processSignal(
        normalizeSessionCommandSignal({
          type: "session_command",
          command: "sessions",
          author: input.authorId,
          channel: "discord"
        })
      );
    }

    case "heartbeat": {
      const outcome = await processSignal(normalizeHeartbeatSignal());
      return {
        kind: "message",
        message: `Heartbeat processed ${outcome.processed.length} capture(s): ${outcome.promoted.length} promoted, ${outcome.pendingOwner.length} pending review, ${outcome.ignored.length} ignored.`
      };
    }

    case "ask":
      return processSignal(
        normalizeAskSignal({
          type: "ask",
          question: input.options.question ?? "",
          author: input.authorId,
          channel: "discord",
          session_id: input.options.session_id,
          topic: input.options.topic
        })
      );

    default:
      return {
        kind: "message",
        message:
          `No command matched \`${input.name}\`. Available commands: ` +
          "`capture`, `new`, `load`, `clear`, `sessions`, `heartbeat`, `ask`."
      };
  }
}
