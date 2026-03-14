import Anthropic from "@anthropic-ai/sdk";

import { loadConfig } from "@/lib/config";
import { CATEGORY_RULES } from "@/lib/intelligence/classifier";
import { loadSystemLayer } from "@/lib/system";

import type { CaptureClassification } from "@/lib/types";

let clientCache: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!clientCache) {
    clientCache = new Anthropic({ apiKey });
  }

  return clientCache;
}

function isTextBlock(
  block: Anthropic.Messages.ContentBlock
): block is Anthropic.Messages.TextBlock {
  return block.type === "text";
}

export async function generateWithAnthropic(input: {
  prompt: string;
  system: string;
  model?: string;
  maxTokens?: number;
  includeHeartbeat?: boolean;
}): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) {
    return null;
  }
  const systemLayer = loadSystemLayer();
  const composedSystem = [
    systemLayer.soul,
    systemLayer.rules,
    systemLayer.user,
    systemLayer.memory,
    ...(input.includeHeartbeat ? [systemLayer.heartbeat] : []),
    input.system
  ].join("\n\n");

  const response = await client.messages.create({
    model: input.model ?? loadConfig().engine.engine.model,
    system: composedSystem,
    max_tokens: input.maxTokens ?? 600,
    messages: [
      {
        role: "user",
        content: input.prompt
      }
    ]
  });

  const text = response.content
    ?.filter(isTextBlock)
    .map((item) => item.text)
    .join("\n")
    .trim();

  return text || null;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function classifyWithAnthropic(
  message: string,
  options?: {
    includeHeartbeat?: boolean;
  }
): Promise<CaptureClassification | null> {
  const categories = CATEGORY_RULES.map((rule) => rule.category).join(", ");
  const raw = await generateWithAnthropic({
    system:
      "You classify captured thoughts for Chronos. Return JSON only. Do not wrap it in markdown.",
    prompt: [
      `Message: ${message}`,
      `Allowed categories: ${categories}`,
      "Return JSON with keys: category (string|null), confidence (0-1 number|null), keywords (string[]), reasoning (string), ambiguous (boolean), clarificationQuestion (string|null)."
    ].join("\n\n"),
    maxTokens: 250,
    includeHeartbeat: options?.includeHeartbeat
  });

  if (!raw) {
    return null;
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    return null;
  }

  return {
    category:
      typeof parsed.category === "string" ? parsed.category : null,
    confidence:
      typeof parsed.confidence === "number"
        ? Number(parsed.confidence.toFixed(2))
        : null,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((value): value is string => typeof value === "string")
      : [],
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "Anthropic classification response.",
    ambiguous: Boolean(parsed.ambiguous),
    clarificationQuestion:
      typeof parsed.clarificationQuestion === "string"
        ? parsed.clarificationQuestion
        : undefined
  };
}

export async function scoreClassificationConfidence(input: {
  message: string;
  category: string | null;
  relatedCount: number;
}): Promise<number | null> {
  const raw = await generateWithAnthropic({
    system:
      "You are Chronos' eval agent. Score confidence only. Return JSON only with {\"confidence\": number}.",
    prompt: [
      `Message: ${input.message}`,
      `Category: ${input.category ?? "null"}`,
      `Related memory matches: ${input.relatedCount}`
    ].join("\n\n"),
    model: loadConfig().engine.engine.model_for_eval_agent,
    maxTokens: 120,
    includeHeartbeat: true
  });

  if (!raw) {
    return null;
  }

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed.confidence !== "number") {
    return null;
  }

  return Number(Math.max(0, Math.min(1, parsed.confidence)).toFixed(2));
}
