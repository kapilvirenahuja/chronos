import { generateWithAnthropic } from "@/lib/intelligence/anthropic";
import { loadCtoIntent } from "@/lib/recipes";
import { readStmState } from "@/lib/stm";

function responseHasWhy(text: string): boolean {
  return /\bbecause\b|\bso that\b|\boutcome\b|\bsuccess\b|\breduce\b|\bincrease\b/i.test(
    text
  );
}

function responseHasWho(text: string): boolean {
  return /\bfor\b|\busers?\b|\bcustomers?\b|\bteam\b|\banalysts?\b|\bengineers?\b/i.test(
    text
  );
}

function responseHasConstraints(text: string): boolean {
  return /\bmust\b|\bconstraint\b|\brequire\b|\bdeadline\b|\bvercel\b|\baudit\b|\bwithin\b/i.test(
    text
  );
}

function responseHasWhat(text: string): boolean {
  return /\bbuild(ing)?\b|\bdesign\b|\bworkflow\b|\bassistant\b|\bsystem\b|\bplatform\b/i.test(
    text
  );
}

function scoreDimensions(text: string) {
  return {
    WHAT: responseHasWhat(text),
    WHO: responseHasWho(text),
    WHY: responseHasWhy(text),
    CONSTRAINTS: responseHasConstraints(text)
  };
}

function citationBlock(signal: {
  path: string;
  category: string | null;
  excerpt: string;
}) {
  return `**LTM source**: ${signal.path}\n**Radar**: ${
    signal.category ?? "unknown"
  }\n**Why it matters**: ${signal.excerpt.slice(0, 140)}`;
}

export async function phoenixPerceptionAnalyzeRequest(input: {
  query: string;
  stmPath: string;
  intent: string;
}): Promise<{
  vaguenessScore: number;
  complexity: "low" | "medium" | "high";
  missingDimensions: string[];
  recommendedAction: "clarify" | "proceed";
}> {
  const stm = await readStmState(input.stmPath);
  const tokens = input.query.split(/\s+/).filter(Boolean);
  const dimensions = scoreDimensions(input.query);
  const missingDimensions = Object.entries(dimensions)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  const vaguenessScore = Number(
    Math.min(
      0.96,
      (missingDimensions.length / 4) * 0.62 +
        (stm.noRadarMatch ? 0.22 : 0) +
        (tokens.length < 12 ? 0.16 : 0)
    ).toFixed(2)
  );

  return {
    vaguenessScore,
    complexity: tokens.length > 28 ? "high" : tokens.length > 12 ? "medium" : "low",
    missingDimensions,
    recommendedAction: vaguenessScore >= 0.5 ? "clarify" : "proceed"
  };
}

export async function phoenixManifestationGenerateQuestions(input: {
  analysis: {
    vaguenessScore: number;
    missingDimensions: string[];
    recommendedAction: "clarify" | "proceed";
  };
  stmPath: string;
  intent: string;
  maxQuestions?: number;
}): Promise<{
  status: "needs_clarification" | "complete";
  message: string;
  questions: string[];
}> {
  if (input.analysis.recommendedAction !== "clarify") {
    return {
      status: "complete",
      message: "",
      questions: []
    };
  }

  const stm = await readStmState(input.stmPath);
  const intent = loadCtoIntent(input.intent);
  const source = stm.signals[0];
  const maxQuestions = input.maxQuestions ?? 3;
  const shape = intent?.questionShapes ?? [
    "What specifically...?",
    "Who/what/when/where...?",
    "What would success look like?"
  ];

  const candidates = [
    {
      dimension: "WHAT",
      question: "What specifically are you trying to build or change?",
      examples:
        "Examples: an internal AI copilot for sales, a session-summary workflow, a new pricing engine"
    },
    {
      dimension: "WHO",
      question: "Who is this for, and who will use it first?",
      examples:
        "Examples: finance analysts, support agents, engineering managers, external customers"
    },
    {
      dimension: "WHY",
      question: "What outcome matters most if this works?",
      examples:
        "Examples: reduce cycle time, improve review quality, create a reusable process, improve adoption"
    },
    {
      dimension: "CONSTRAINTS",
      question: "What constraints are non-negotiable?",
      examples:
        "Examples: must run on Vercel, must use existing Postgres, must ship in 2 weeks, must satisfy audit needs"
    }
  ].filter((item) => input.analysis.missingDimensions.includes(item.dimension));

  const selected = candidates.slice(0, maxQuestions);
  const questions = selected.map((candidate, index) => {
    const grounding = source
      ? citationBlock(source)
      : `**LTM source**: none\n**Radar**: none\n**Why it matters**: There was not enough matched memory to infer this safely.`;

    return `${index + 1}. ${candidate.question}\n${grounding}\n**Question shape**: ${
      shape[index] ?? shape[0]
    }\n**Examples**: ${candidate.examples.replace(/^Examples:\s*/i, "")}`;
  });

  return {
    status: "needs_clarification",
    message: questions.join("\n\n"),
    questions: selected.map((candidate) => candidate.question)
  };
}

function heuristicStrategicBrief(input: {
  title: string;
  what: string;
  who: string;
  why: string;
  constraints: string;
  citations: Array<{ title: string; path: string }>;
}): string {
  const citationLines = input.citations.length
    ? input.citations.map((citation) => `- ${citation.title} (${citation.path})`).join("\n")
    : "- No matched signals";

  return `## Strategic Brief: ${input.title}

### What You're Building

| Dimension | Value |
|-----------|-------|
| WHAT | ${input.what} |
| WHO | ${input.who} |
| WHY | ${input.why} |
| CONSTRAINTS | ${input.constraints} |

### Strategic Framing

The request is now concrete enough to move from abstraction into decision quality. The next move is to optimize for the real constraint, not the most attractive implementation detail.

### Key Decisions Ahead

1. **Scope vs speed**: Decide what must be true in version one versus what can wait.
2. **Architecture vs operability**: Choose the simplest architecture that still satisfies the non-negotiable constraints.

### Recommended First Action

Write the version-one success metric, the first user cohort, and the one hard constraint into a single brief before making implementation choices.

### Sources

${citationLines}

### What's Next?

- **[Done]** — I have what I need`;
}

export async function phoenixCognitionEvaluateUnderstanding(input: {
  originalQuery: string;
  stmPath: string;
  clarificationRound: number;
  maxRounds?: number;
}): Promise<{
  status:
    | "clarified"
    | "proceed_with_assumptions"
    | "needs_reclarification"
    | "contradiction_detected";
  completenessScore: number;
  resolvedUnderstanding: string;
  missingDimensions: string[];
  assumptions: string[];
  brief: string;
}> {
  const stm = await readStmState(input.stmPath);
  const combined = [
    input.originalQuery,
    ...stm.userResponses.map((response) => response.rawContent)
  ].join("\n");
  const dimensions = scoreDimensions(combined);
  const missingDimensions = Object.entries(dimensions)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  const completenessScore = Number(
    ((4 - missingDimensions.length) / 4).toFixed(2)
  );
  const assumptions = missingDimensions.map(
    (dimension) => `Proceeding with an inferred ${dimension.toLowerCase()} because the user did not state it explicitly.`
  );

  const latestResponse = stm.userResponses.at(-1)?.rawContent ?? input.originalQuery;
  const what = /(?:building|build|design(?:ing)?|create(?:ing)?)\s+([^.,\n]+)/i.exec(combined)?.[1] ??
    latestResponse;
  const who = /for\s+([^.,\n]+)/i.exec(combined)?.[1] ?? "Not explicit";
  const why =
    /(?:because|so that|to)\s+([^.,\n]+)/i.exec(combined)?.[1] ??
    "Not explicit";
  const constraints =
    /(?:must|require|within|on)\s+([^.,\n]+)/i.exec(combined)?.[1] ??
    "Not explicit";

  const prompt = [
    `Original query: ${input.originalQuery}`,
    `Clarified context:\n${combined}`,
    `Signals:\n${stm.signals
      .slice(0, 3)
      .map((signal) => `- ${signal.title} (${signal.path})`)
      .join("\n") || "- None"}`,
    "Return a markdown strategic brief following the required sections: What You're Building, Strategic Framing, Key Decisions Ahead, Recommended First Action, Sources, What's Next."
  ].join("\n\n");

  const brief =
    (await generateWithAnthropic({
      system:
        "You are Chronos. Produce a grounded strategic brief from clarified user input and cited signals.",
      prompt,
      maxTokens: 700
    })) ??
    heuristicStrategicBrief({
      title: input.originalQuery,
      what,
      who,
      why,
      constraints,
      citations: stm.signals.slice(0, 3).map((signal) => ({
        title: signal.title,
        path: signal.path
      }))
    });

  if (stm.userResponses.some((response) => response.needsResolution)) {
    return {
      status: "contradiction_detected",
      completenessScore,
      resolvedUnderstanding: latestResponse,
      missingDimensions,
      assumptions,
      brief
    };
  }

  if (completenessScore >= 0.8 && missingDimensions.length === 0) {
    return {
      status: "clarified",
      completenessScore,
      resolvedUnderstanding: latestResponse,
      missingDimensions,
      assumptions,
      brief
    };
  }

  if (
    completenessScore >= 0.5 ||
    input.clarificationRound >= (input.maxRounds ?? 3)
  ) {
    return {
      status: "proceed_with_assumptions",
      completenessScore,
      resolvedUnderstanding: latestResponse,
      missingDimensions,
      assumptions,
      brief
    };
  }

  return {
    status: "needs_reclarification",
    completenessScore,
    resolvedUnderstanding: latestResponse,
    missingDimensions,
    assumptions,
    brief
  };
}
