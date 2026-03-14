import { NextResponse } from "next/server";
import nacl from "tweetnacl";

import { handleCommand } from "@/lib/engine/commands";

interface DiscordInteractionBody {
  type: number;
  data?: {
    name?: string;
    options?: Array<{
      name: string;
      value: string;
    }>;
  };
  member?: {
    user?: {
      id?: string;
    };
  };
  user?: {
    id?: string;
  };
}

function optionMap(
  options?: Array<{
    name: string;
    value: string;
  }>
): Record<string, string | undefined> {
  return Object.fromEntries(
    (options ?? []).map((option) => [option.name, option.value])
  );
}

export async function POST(request: Request) {
  const rawBodyBuffer = await request.arrayBuffer();
  const rawBodyBytes = new Uint8Array(rawBodyBuffer);
  const rawBody = new TextDecoder().decode(rawBodyBytes);
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (publicKey) {
    const timestampBytes = new TextEncoder().encode(timestamp ?? "");
    const message = new Uint8Array(timestampBytes.length + rawBodyBytes.length);
    message.set(timestampBytes, 0);
    message.set(rawBodyBytes, timestampBytes.length);

    const isValid =
      Boolean(signature) &&
      Boolean(timestamp) &&
      nacl.sign.detached.verify(
        message,
        Buffer.from(signature!, "hex"),
        Buffer.from(publicKey, "hex")
      );

    if (!isValid) {
      return NextResponse.json(
        {
          error: "Invalid request signature."
        },
        { status: 401 }
      );
    }
  }

  const body = JSON.parse(rawBody) as DiscordInteractionBody;

  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const name = body.data?.name;
  const authorId = body.member?.user?.id ?? body.user?.id ?? "";

  if (!name) {
    return NextResponse.json(
      {
        type: 4,
        data: {
          content: "Missing slash command name."
        }
      },
      { status: 400 }
    );
  }

  const outcome = await handleCommand({
    name,
    authorId,
    options: optionMap(body.data?.options)
  });

  if (outcome.kind === "silent" || outcome.kind === "ignored") {
    return NextResponse.json({
      type: 4,
      data: {
        content:
          outcome.kind === "silent"
            ? "Captured."
            : "Nothing to process.",
        flags: 64
      }
    });
  }

  return NextResponse.json({
    type: 4,
    data: {
      content: outcome.message
    }
  });
}
