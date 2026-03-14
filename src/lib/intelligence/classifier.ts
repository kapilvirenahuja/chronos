import slugify from "slugify";

import type { CaptureClassification, ContentQuality, MemorySearchResult } from "@/lib/types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with"
]);

export const CATEGORY_RULES = [
  {
    category: "ai-intelligence",
    keywords: [
      "ai",
      "agent",
      "agents",
      "augmentation",
      "automation",
      "copilot",
      "intent",
      "alignment",
      "agency",
      "model",
      "llm",
      "prompt"
    ]
  },
  {
    category: "leadership",
    keywords: [
      "leadership",
      "leader",
      "leaders",
      "team",
      "org",
      "people",
      "person",
      "board",
      "communication",
      "trust",
      "reads",
      "reading"
    ]
  },
  {
    category: "architecture",
    keywords: [
      "architecture",
      "api",
      "microservice",
      "microservices",
      "monolith",
      "tech",
      "debt",
      "system",
      "systems",
      "platform"
    ]
  },
  {
    category: "innovation",
    keywords: [
      "innovation",
      "startup",
      "founder",
      "market",
      "experiment",
      "moat",
      "bet",
      "bets",
      "opportunity"
    ]
  },
  {
    category: "digital-experience",
    keywords: [
      "ux",
      "design",
      "experience",
      "interface",
      "interaction",
      "page",
      "web"
    ]
  },
  {
    category: "technology",
    keywords: [
      "cloud",
      "infra",
      "infrastructure",
      "database",
      "runtime",
      "deployment",
      "typescript",
      "vercel"
    ]
  },
  {
    category: "purpose",
    keywords: ["purpose", "meaning", "mission", "principle", "values"]
  }
] as const;

const AMBIGUOUS_PATTERN =
  /\b(that thing|this thing|it|that|we discussed|same as before|you know)\b/i;

const OPERATIONAL_TEST_PATTERN =
  /\b(smoke test|test capture|preview smoke|preview test|deployment test|after anthropic switch|from codex)\b/i;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function quickClassify(message: string): CaptureClassification {
  const tokens = tokenize(message);
  const ambiguous =
    message.trim().length < 18 ||
    tokens.length <= 3 ||
    AMBIGUOUS_PATTERN.test(message);

  let winner: { category: string; score: number; hits: string[] } | null = null;

  for (const rule of CATEGORY_RULES) {
    const hits = rule.keywords.filter((keyword) => tokens.includes(keyword));
    const score = hits.length / Math.max(tokens.length, 3);

    if (!winner || score > winner.score) {
      winner = {
        category: rule.category,
        score,
        hits
      };
    }
  }

  if (!winner || winner.score === 0) {
    return {
      category: null,
      confidence: null,
      keywords: tokens.slice(0, 6),
      reasoning: ambiguous
        ? "Message lacks enough concrete context for reliable classification."
        : "No category received a meaningful keyword match.",
      ambiguous,
      clarificationQuestion: ambiguous
        ? "What specific idea or decision should this capture refer to?"
        : undefined
    };
  }

  const confidence = Number(
    Math.min(0.95, 0.38 + winner.hits.length * 0.16 + winner.score * 0.45).toFixed(2)
  );

  return {
    category: winner.category,
    confidence,
    keywords: winner.hits.length ? winner.hits : tokens.slice(0, 6),
    reasoning: winner.hits.length
      ? `Matched keywords: ${winner.hits.join(", ")}.`
      : "Weak semantic proxy match from the current heuristic rule set.",
    ambiguous,
    clarificationQuestion: ambiguous
      ? "Can you add the missing subject or decision so I can store this more accurately?"
      : undefined
  };
}

export function evaluateContentQuality(
  message: string,
  related: MemorySearchResult[]
): { result: ContentQuality; reason: string } {
  const tokens = tokenize(message);

  if (OPERATIONAL_TEST_PATTERN.test(message)) {
    return {
      result: "noise",
      reason: "Operational or smoke-test content should not be promoted into long-term memory."
    };
  }

  if (tokens.length < 3 || message.trim().length < 20) {
    return {
      result: "noise",
      reason: "Too little substance to promote into long-term memory."
    };
  }

  const nearest = related[0];
  if (nearest && similarityScore(message, nearest.excerpt) > 0.92) {
    return {
      result: "duplicate",
      reason: `Very similar to existing signal ${nearest.id}.`
    };
  }

  if (
    /\b(today|yesterday|tomorrow|this week|this month|weather|price|pricing|stock|stocks|president|ceo|earnings)\b/i.test(
      message
    )
  ) {
    return {
      result: "needs_research",
      reason: "Time-sensitive or external-fact content needs verification before promotion."
    };
  }

  if (/\b(not|wrong|instead|however|but)\b/i.test(message) && nearest) {
    return {
      result: "signal",
      reason: `Contrarian signal relative to existing memory ${nearest.id}.`
    };
  }

  return {
    result: "signal",
    reason: "Sufficiently specific and non-duplicative."
  };
}

export function similarityScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

export function makeSignalTitle(message: string): string {
  const base = message
    .replace(/[.?!].*$/, "")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");

  const cleaned = base || message.slice(0, 60);
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function makeSignalSlug(message: string): string {
  return slugify(makeSignalTitle(message), {
    lower: true,
    strict: true,
    trim: true
  });
}
