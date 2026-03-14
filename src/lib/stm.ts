import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { getMemoryAdapter } from "@/lib/memory";
import { nowIso, resolveFromRoot, toTitleCase } from "@/lib/utils";

import type { Channel } from "@/lib/types";

export interface StmSignal {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  category: string | null;
  score: number;
}

interface StmInteraction {
  at: string;
  type: "initial_query" | "user_response" | "system_output";
  impact?: string;
  summary: string;
}

interface StmUserResponse {
  at: string;
  pendingQuestion: string | null;
  rawContent: string;
  impact: string;
  extractedFacts: string[];
  needsResolution: boolean;
  scopeChanged: boolean;
}

export interface StmRuntimeState {
  recipeId: string;
  createdAt: string;
  originalQuery: string;
  currentQuery: string;
  signal: {
    author: string;
    channel: Channel;
    sessionId?: string;
  };
  radarMatches: Array<{
    radar: string;
    score: number;
    signalIds: string[];
  }>;
  signals: StmSignal[];
  noRadarMatch: boolean;
  currentIntent: string;
  completedIntents: string[];
  pendingIntents: string[];
  replanCount: number;
  outputs: Record<string, string>;
  interactions: StmInteraction[];
  userResponses: StmUserResponse[];
  questionsAsked: string[];
}

export interface StmUpdateResult {
  updated: boolean;
  impactType: string;
  extractedFacts: string[];
  changes: string[];
  needsResolution: boolean;
  scopeChanged: boolean;
}

function workspaceRoot(): string {
  return resolveFromRoot(".phoenix-os/stm");
}

function summarize(text: string, limit = 88): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit - 3)}...`;
}

function signalRadar(category: string | null): string {
  return category ? toTitleCase(category.replace(/-/g, " ")) : "Unknown";
}

function groupRadarMatches(signals: StmSignal[]) {
  const grouped = new Map<
    string,
    {
      total: number;
      count: number;
      signalIds: string[];
    }
  >();

  for (const signal of signals) {
    const radar = signalRadar(signal.category);
    const current = grouped.get(radar) ?? {
      total: 0,
      count: 0,
      signalIds: []
    };
    current.total += signal.score;
    current.count += 1;
    current.signalIds.push(signal.id);
    grouped.set(radar, current);
  }

  return [...grouped.entries()]
    .map(([radar, value]) => ({
      radar,
      score: Number((value.total / Math.max(value.count, 1)).toFixed(2)),
      signalIds: value.signalIds
    }))
    .sort((left, right) => right.score - left.score);
}

function stateMarkdown(state: StmRuntimeState): string {
  const interactionRows = state.interactions
    .map(
      (item) =>
        `| ${item.at} | ${item.type} | ${item.impact ?? "-"} | ${item.summary} |`
    )
    .join("\n");

  return `# STM State

## Recipe

- Recipe: ${state.recipeId}
- Created: ${state.createdAt}
- Original query: ${state.originalQuery}
- Current query: ${state.currentQuery}
- Signal author: ${state.signal.author}
- Signal channel: ${state.signal.channel}
- Session: ${state.signal.sessionId ?? "n/a"}

## Intent Execution State

- current_intent: ${state.currentIntent}
- completed_intents: ${state.completedIntents.length ? state.completedIntents.join(", ") : "(none)"}
- pending_intents: ${state.pendingIntents.length ? state.pendingIntents.join(", ") : "(none)"}
- replan_count: ${state.replanCount}

## Interaction Log

| Timestamp | Type | Impact | Summary |
|-----------|------|--------|---------|
${interactionRows || "| - | - | - | - |"}
`;
}

function contextMarkdown(state: StmRuntimeState): string {
  const radarSection = state.radarMatches.length
    ? state.radarMatches
        .map(
          (match) =>
            `- ${match.radar} (score: ${match.score}, signals: ${match.signalIds.length})`
        )
        .join("\n")
    : "- No radar matches found";

  const signalSection = state.signals.length
    ? state.signals
        .map(
          (signal) => `## Signal: ${signal.title}

**Source**: ${signal.path}
**Radar**: ${signalRadar(signal.category)}
**Similarity**: ${signal.score.toFixed(2)}

${signal.excerpt}
`
        )
        .join("\n")
    : "No signals loaded.";

  const responseBlocks = state.userResponses
    .map(
      (response) => `---

### User Response [${response.at}]

**In response to**: ${response.pendingQuestion ?? "unprompted"}
**Raw content**: ${response.rawContent}
**Impact**: ${response.impact}

**Extracted facts**:
${response.extractedFacts.length ? response.extractedFacts.map((fact) => `- ${fact}`).join("\n") : "- None"}

**Context changes**:
- ${response.needsResolution ? "Potential contradiction needs resolution." : "No contradiction detected."}
- ${response.scopeChanged ? "Scope appears to have shifted." : "Scope remained stable."}
`
    )
    .join("\n");

  return `# STM Context

## Radar Matches

${radarSection}

## Loaded Signals

${signalSection}
${responseBlocks ? `\n${responseBlocks}` : ""}
`;
}

function intentsMarkdown(state: StmRuntimeState): string {
  const questions = state.questionsAsked.length
    ? state.questionsAsked.map((question) => `- ${question}`).join("\n")
    : "- None";

  return `# Intent State

## Current

- intent: ${state.currentIntent}
- pending: ${state.pendingIntents.length ? state.pendingIntents.join(", ") : "(none)"}
- completed: ${state.completedIntents.length ? state.completedIntents.join(", ") : "(none)"}
- replan_count: ${state.replanCount}

## Questions Asked

${questions}
`;
}

async function persistState(stmPath: string, state: StmRuntimeState): Promise<void> {
  await fs.mkdir(path.join(stmPath, "outputs"), { recursive: true });
  await fs.mkdir(path.join(stmPath, "evidence"), { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(stmPath, "state.md"), stateMarkdown(state), "utf8"),
    fs.writeFile(path.join(stmPath, "context.md"), contextMarkdown(state), "utf8"),
    fs.writeFile(path.join(stmPath, "intents.md"), intentsMarkdown(state), "utf8"),
    fs.writeFile(
      path.join(stmPath, "evidence/runtime-state.json"),
      JSON.stringify(state, null, 2),
      "utf8"
    )
  ]);
}

export async function readStmState(stmPath: string): Promise<StmRuntimeState> {
  const raw = await fs.readFile(
    path.join(stmPath, "evidence/runtime-state.json"),
    "utf8"
  );
  return JSON.parse(raw) as StmRuntimeState;
}

export async function initializeStmWorkspace(input: {
  recipeId: string;
  query: string;
  author: string;
  channel: Channel;
  sessionId?: string;
}): Promise<{
  stmPath: string;
  radarMatches: StmRuntimeState["radarMatches"];
  signalsLoaded: StmSignal[];
  noRadarMatch: boolean;
}> {
  const createdAt = nowIso();
  const workspaceId = `${input.recipeId}-${createdAt.replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
  const stmPath = path.join(workspaceRoot(), workspaceId);
  await fs.mkdir(path.join(stmPath, "outputs"), { recursive: true });
  await fs.mkdir(path.join(stmPath, "evidence"), { recursive: true });

  const adapter = getMemoryAdapter();
  const signals = (await adapter.search(input.query, 8)).map((signal) => ({
    id: signal.id,
    title: signal.title,
    path: signal.path,
    excerpt: signal.excerpt,
    category: signal.category,
    score: signal.score
  }));
  const radarMatches = groupRadarMatches(signals);

  const state: StmRuntimeState = {
    recipeId: input.recipeId,
    createdAt,
    originalQuery: input.query,
    currentQuery: input.query,
    signal: {
      author: input.author,
      channel: input.channel,
      sessionId: input.sessionId
    },
    radarMatches,
    signals,
    noRadarMatch: signals.length === 0,
    currentIntent: "pending_identification",
    completedIntents: [],
    pendingIntents: [],
    replanCount: 0,
    outputs: {},
    interactions: [
      {
        at: createdAt,
        type: "initial_query",
        impact: "new_request",
        summary: summarize(input.query)
      }
    ],
    userResponses: [],
    questionsAsked: []
  };

  await persistState(stmPath, state);

  return {
    stmPath,
    radarMatches,
    signalsLoaded: signals,
    noRadarMatch: state.noRadarMatch
  };
}

function detectImpact(
  response: string,
  pendingQuestion?: string
): {
  impactType: string;
  needsResolution: boolean;
  scopeChanged: boolean;
} {
  const lowered = response.toLowerCase();
  const needsResolution =
    /\bactually\b|\binstead\b|\bnot anymore\b|\bcontradict/i.test(lowered);
  const scopeChanged =
    /\binstead\b|\bchange\b|\bshift\b|\bdifferent\b|\bnew direction\b/i.test(lowered);

  if (needsResolution) {
    return {
      impactType: "contradiction",
      needsResolution,
      scopeChanged
    };
  }

  if (scopeChanged) {
    return {
      impactType: "scope_change",
      needsResolution,
      scopeChanged
    };
  }

  if (pendingQuestion) {
    return {
      impactType: "clarification",
      needsResolution: false,
      scopeChanged: false
    };
  }

  if (/\byes\b|\bcorrect\b|\bexactly\b/i.test(lowered)) {
    return {
      impactType: "confirmation",
      needsResolution: false,
      scopeChanged: false
    };
  }

  if (response.trim().length < 6) {
    return {
      impactType: "none",
      needsResolution: false,
      scopeChanged: false
    };
  }

  return {
    impactType: "new_info",
    needsResolution: false,
    scopeChanged: false
  };
}

function extractFacts(response: string): string[] {
  return response
    .split(/[.\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => {
      if (/\bmust\b|\bneed to\b|\brequire\b/i.test(part)) {
        return `[CONSTRAINT] ${part}`;
      }
      if (/\bfor\b/i.test(part)) {
        return `[WHO] ${part}`;
      }
      if (/\bbecause\b|\bso that\b|\bto\b/i.test(part)) {
        return `[WHY] ${part}`;
      }
      if (/\bdecide\b|\bchoose\b|\bwill\b/i.test(part)) {
        return `[DECISION] ${part}`;
      }
      return `[FACT] ${part}`;
    });
}

export async function appendStmUserResponse(input: {
  stmPath: string;
  userResponse: string;
  pendingQuestion?: string;
}): Promise<StmUpdateResult> {
  const state = await readStmState(input.stmPath);
  const at = nowIso();
  const impact = detectImpact(input.userResponse, input.pendingQuestion);
  const extractedFacts = extractFacts(input.userResponse);

  state.currentQuery = `${state.originalQuery}\n\nClarification:\n${input.userResponse}`;
  state.userResponses.push({
    at,
    pendingQuestion: input.pendingQuestion ?? null,
    rawContent: input.userResponse,
    impact: impact.impactType,
    extractedFacts,
    needsResolution: impact.needsResolution,
    scopeChanged: impact.scopeChanged
  });
  state.interactions.push({
    at,
    type: "user_response",
    impact: impact.impactType,
    summary: summarize(input.userResponse)
  });

  await persistState(input.stmPath, state);

  return {
    updated: true,
    impactType: impact.impactType,
    extractedFacts,
    changes: extractedFacts,
    needsResolution: impact.needsResolution,
    scopeChanged: impact.scopeChanged
  };
}

export async function writeStmOutput(input: {
  stmPath: string;
  name: string;
  content: string;
}): Promise<void> {
  const state = await readStmState(input.stmPath);
  state.outputs[input.name] = input.content;
  state.interactions.push({
    at: nowIso(),
    type: "system_output",
    impact: "artifact",
    summary: `Wrote ${input.name}`
  });

  await fs.writeFile(
    path.join(input.stmPath, "outputs", `${input.name}.md`),
    input.content,
    "utf8"
  );
  await persistState(input.stmPath, state);
}

export async function updateStmIntentState(input: {
  stmPath: string;
  currentIntent: string;
  pendingIntents?: string[];
  completedIntents?: string[];
  replanCount?: number;
  questionsAsked?: string[];
}): Promise<void> {
  const state = await readStmState(input.stmPath);
  state.currentIntent = input.currentIntent;
  if (input.pendingIntents) {
    state.pendingIntents = input.pendingIntents;
  }
  if (input.completedIntents) {
    state.completedIntents = input.completedIntents;
  }
  if (typeof input.replanCount === "number") {
    state.replanCount = input.replanCount;
  }
  if (input.questionsAsked) {
    state.questionsAsked = input.questionsAsked;
  }

  await persistState(input.stmPath, state);
}
