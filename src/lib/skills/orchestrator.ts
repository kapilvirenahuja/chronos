import { similarityScore, tokenize } from "@/lib/intelligence/classifier";
import {
  loadConsultCtoRecipe,
  loadCtoIntent,
  loadIntentPriority
} from "@/lib/recipes";
import { readStmState } from "@/lib/stm";

import type { RoutingPlan } from "@/lib/types";

interface PlanAssignment {
  intent: string;
  confidence: number;
  agent: string;
  requiresFirst: string[];
  conflictsWith: string[];
  inputs: {
    user_needs: string;
    probe_for: string[];
    recipe: string;
    active_skills: string[];
  };
}

function queryDimensionCompleteness(query: string): number {
  let score = 0;
  if (/\bbuild(ing)?\b|\bdesign\b|\bsystem\b|\bworkflow\b|\bplatform\b/i.test(query)) {
    score += 1;
  }
  if (/\bfor\b|\busers?\b|\bcustomers?\b|\bteam\b|\banalysts?\b/i.test(query)) {
    score += 1;
  }
  if (/\bbecause\b|\bso that\b|\boutcome\b|\breduce\b|\bincrease\b|\bimprove\b/i.test(query)) {
    score += 1;
  }
  if (/\bmust\b|\bconstraint\b|\brequire\b|\baudit\b|\bdeadline\b|\bvercel\b/i.test(query)) {
    score += 1;
  }

  return score / 4;
}

function patternScore(query: string, pattern: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  if (lowerQuery.includes(lowerPattern)) {
    return 0.9;
  }

  const queryTokens = new Set(tokenize(query));
  const patternTokens = tokenize(pattern);
  const overlap = patternTokens.filter((token) => queryTokens.has(token)).length;
  const overlapScore = overlap / Math.max(patternTokens.length, 1);
  return Number(
    Math.max(similarityScore(query, pattern), overlapScore * 0.8).toFixed(2)
  );
}

function contextSignalBoost(query: string, signal: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerSignal = signal.toLowerCase();

  if (
    (lowerSignal.includes("alternatives") && /\bor\b|\bvs\b|\bbetween\b/i.test(lowerQuery)) ||
    (lowerSignal.includes("comparative") && /\btrade[- ]?off\b|\bpros and cons\b/i.test(lowerQuery)) ||
    (lowerSignal.includes("specificity") && query.length > 80) ||
    (lowerSignal.includes("uncertain") && /\bnot sure\b|\bunsure\b|\bfigure out\b/i.test(lowerQuery)) ||
    (lowerSignal.includes("plan") && /\bplan\b|\bapproach\b|\bproposal\b/i.test(lowerQuery)) ||
    (lowerSignal.includes("problem") && /\bstuck\b|\bblocking\b|\btrouble\b/i.test(lowerQuery))
  ) {
    return 0.08;
  }

  return similarityScore(query, signal) > 0.35 ? 0.04 : 0;
}

function deriveGoal(intent: string, query: string): string {
  switch (intent) {
    case "clarify":
      return `Resolve ambiguity in: ${query}`;
    case "decide":
      return `Help the user make a concrete decision about: ${query}`;
    case "validate":
      return `Stress-test the user's current approach: ${query}`;
    case "consult":
      return `Unblock the user with strategic guidance on: ${query}`;
    case "advise":
      return `Provide a strategic perspective on: ${query}`;
    case "design":
      return `Shape a grounded design direction for: ${query}`;
    default:
      return `Respond to the user's request: ${query}`;
  }
}

export async function phoenixEngineIdentifyIntents(input: {
  query: string;
  stmPath: string;
  intentBindings?: Array<{
    intent: string;
    domain?: string;
    agent: string;
    status: "active" | "planned";
  }>;
  mode?: "initial" | "re-evaluate";
  priorIntents?: string[];
  hint?: string;
}): Promise<
  Array<{
    intent: string;
    confidence: number;
    status: "active" | "planned" | "blocked";
    matchedPatterns: string[];
    signalsMatched: string[];
  }>
> {
  const recipe = loadConsultCtoRecipe();
  const stm = await readStmState(input.stmPath);
  const bindings = input.intentBindings ?? recipe.bindings;
  const priority = loadIntentPriority();
  const completeness = queryDimensionCompleteness(input.query);
  const obviouslyVague =
    /\bhelp me\b|\bmy system\b|\bthat thing\b|\bmodern\b|\bscalable\b|\bai-powered\b/i.test(
      input.query
    );

  if (stm.noRadarMatch) {
    return [
      {
        intent: "clarify",
        confidence: 0.96,
        status: "active",
        matchedPatterns: ["No radar matches (triggers clarify automatically)"],
        signalsMatched: ["no_radar_match"]
      }
    ];
  }

  const candidates = bindings
    .map((binding) => {
      const definition = loadCtoIntent(binding.intent);
      if (!definition) {
        return null;
      }

      const scoredPatterns = definition.patterns
        .map((pattern) => ({
          pattern,
          score: patternScore(input.query, pattern)
        }))
        .filter((item) => item.score > 0.25)
        .sort((left, right) => right.score - left.score);

      const initialScore = scoredPatterns[0]?.score ?? 0;
      const signalBoosts = definition.contextSignals
        .map((signal) => ({
          signal,
          boost: contextSignalBoost(input.query, signal)
        }))
        .filter((item) => item.boost > 0);
      const boostedScore = Number(
        Math.min(
          1,
          initialScore + signalBoosts.reduce((total, item) => total + item.boost, 0)
        ).toFixed(2)
      );

      if (
        binding.intent === "clarify" &&
        !stm.noRadarMatch &&
        !obviouslyVague &&
        completeness >= 0.75
      ) {
        return null;
      }

      return {
        intent: binding.intent,
        confidence: boostedScore,
        status: binding.status,
        matchedPatterns: scoredPatterns.slice(0, 3).map((item) => item.pattern),
        signalsMatched: signalBoosts.map((item) => item.signal)
      };
    })
    .filter(
      (
        candidate
      ): candidate is {
        intent: string;
        confidence: number;
        status: "active" | "planned";
        matchedPatterns: string[];
        signalsMatched: string[];
      } => candidate !== null
    )
    .filter((candidate) => candidate.confidence >= 0.3);

  const selected = candidates
    .filter((candidate) => candidate.confidence >= 0.5)
    .sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return priority.indexOf(left.intent) - priority.indexOf(right.intent);
    })
    .slice(0, 4);

  if (selected.length === 0) {
    return [
      {
        intent: "clarify",
        confidence: 0.84,
        status: "active",
        matchedPatterns: ["Fallback to clarify when no stronger intent is selected"],
        signalsMatched: []
      }
    ];
  }

  const resolved = new Map(
    selected.map((candidate) => [candidate.intent, candidate] as const)
  );

  for (const candidate of [...resolved.values()]) {
    const definition = loadCtoIntent(candidate.intent);
    if (!definition) {
      continue;
    }

    for (const required of definition.related.requiresFirst) {
      const dependency = bindings.find((binding) => binding.intent === required);
      if (dependency && !resolved.has(required)) {
        resolved.set(required, {
          intent: required,
          confidence: Math.max(0.8, candidate.confidence),
          status: dependency.status,
          matchedPatterns: [`Required before ${candidate.intent}`],
          signalsMatched: []
        });
      }
    }
  }

  return [...resolved.values()].sort((left, right) => {
    const priorityDiff = priority.indexOf(left.intent) - priority.indexOf(right.intent);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return right.confidence - left.confidence;
  });
}

export async function phoenixEngineBuildPlan(input: {
  query: string;
  selectedIntents: Array<{
    intent: string;
    confidence: number;
    status: "active" | "planned" | "blocked";
  }>;
  replanCount?: number;
}): Promise<
  | {
      blockedMessage: string;
      plan: null;
    }
  | {
      blockedMessage?: undefined;
      plan: RoutingPlan;
    }
> {
  const recipe = loadConsultCtoRecipe();
  const primary = input.selectedIntents[0];
  if (primary && primary.status !== "active") {
    const available = recipe.activeBindings.map((binding) => `- \`${binding.intent}\``).join("\n");
    const planned = recipe.bindings
      .filter((binding) => binding.status === "planned")
      .map((binding) => `- \`${binding.intent}\``)
      .join("\n");

    return {
      blockedMessage: `**Status**: blocked\n**Reason**: Intent \`${primary.intent}\` is not available in this recipe.\n\n**Available intents**:\n${available || "- None"}\n\n**Planned intents**:\n${planned || "- None"}`,
      plan: null
    };
  }

  const activeSelections = input.selectedIntents.filter(
    (selected) => selected.status === "active"
  );

  if (activeSelections.length === 0) {
    const intent = input.selectedIntents[0]?.intent ?? "unknown";
    const available = recipe.activeBindings.map((binding) => `- \`${binding.intent}\``).join("\n");
    const planned = recipe.bindings
      .filter((binding) => binding.status === "planned")
      .map((binding) => `- \`${binding.intent}\``)
      .join("\n");

    return {
      blockedMessage: `**Status**: blocked\n**Reason**: Intent \`${intent}\` is not available in this recipe.\n\n**Available intents**:\n${available || "- None"}\n\n**Planned intents**:\n${planned || "- None"}`,
      plan: null
    };
  }

  const nodes: Array<PlanAssignment | null> = activeSelections.map((selection) => {
    const binding = recipe.activeBindings.find(
      (item) => item.intent === selection.intent
    );
    const definition = loadCtoIntent(selection.intent);
    if (!binding || !definition) {
      return null;
    }

    return {
      intent: selection.intent,
      confidence: selection.confidence,
      agent: binding.agent,
      requiresFirst: definition.related.requiresFirst.filter((required) =>
        activeSelections.some((item) => item.intent === required)
      ),
      conflictsWith: definition.related.conflictsWith,
      inputs: {
        user_needs: definition.description,
        probe_for: definition.questionShapes,
        recipe: ".claude/commands/consult-cto.md",
        active_skills:
          selection.intent === "clarify"
            ? [
                "phoenix-perception-analyze-request",
                "phoenix-manifestation-generate-questions",
                "phoenix-cognition-evaluate-understanding"
              ]
            : []
      }
    };
  });

  const assignments: PlanAssignment[] = nodes.filter(
    (node): node is PlanAssignment => node !== null
  );

  const remaining = new Map(assignments.map((assignment) => [assignment.intent, assignment]));
  const completed = new Set<string>();
  const steps: RoutingPlan["steps"] = [];
  let order = 1;

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((assignment) =>
      assignment.requiresFirst.every((required) => completed.has(required))
    );

    if (ready.length === 0) {
      break;
    }

    const parallel: typeof ready = [];
    for (const assignment of ready) {
      const conflicts = assignment.conflictsWith.includes("*")
        ? true
        : parallel.some(
            (other) =>
              assignment.conflictsWith.includes(other.intent) ||
              other.conflictsWith.includes(assignment.intent)
          );
      if (!conflicts && parallel.length < 3) {
        parallel.push(assignment);
      }
    }

    const stepAgents = parallel.length > 0 ? parallel : [ready[0]];
    steps.push({
      order,
      mode: stepAgents.length > 1 ? "parallel" : "sequential",
      depends_on:
        order === 1
          ? []
          : stepAgents.flatMap((assignment) =>
              assignment.requiresFirst
                .map((requiredIntent) =>
                  steps.find((step) =>
                    step.agents.some((agent) => agent.intent === requiredIntent)
                  )?.order
                )
                .filter((value): value is number => typeof value === "number")
            ),
      agents: stepAgents.map((assignment) => ({
        agent: assignment.agent,
        intent: assignment.intent,
        goal: deriveGoal(assignment.intent, input.query),
        inputs: assignment.inputs
      }))
    });

    for (const assignment of stepAgents) {
      remaining.delete(assignment.intent);
      completed.add(assignment.intent);
    }

    order += 1;
  }

  return {
    plan: {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      query: input.query,
      confidence: Number(
        (
          activeSelections.reduce((total, item) => total + item.confidence, 0) /
          activeSelections.length
        ).toFixed(2)
      ),
      steps,
      synthesizer: {
        agent: recipe.synthesizer,
        inputs: {}
      },
      metadata: {
        intent_domain: recipe.intentDomainPath,
        sequencing_rules: "@memory/engine/intents/sequencing-rules.md",
        replan_count: input.replanCount ?? 0
      }
    }
  };
}
