import { loadConfig } from "@/lib/config";
import { executeAgent } from "@/lib/agents/runtime";
import { executeTool } from "@/lib/agents/tools";
import { selectResponseChannel } from "@/lib/channels";
import { makeId } from "@/lib/ids";
import {
  appendSessionHistory,
  ensureActiveSession,
  mergeSessionContext
} from "@/lib/engine/sessions";
import {
  loadAgentDefinition,
  loadConsultCtoRecipe
} from "@/lib/recipes";
import { invokeSkill, normalizeSkillName } from "@/lib/skills/registry";
import {
  appendStmUserResponse,
  initializeStmWorkspace,
  readStmState,
  updateStmIntentState,
  writeStmOutput
} from "@/lib/stm";
import { getStore } from "@/lib/store";
import { nowIso } from "@/lib/utils";
import {
  issueTrackedCaptureReviewPath,
  issueTrackedClarificationPath,
  issueTrackedDecisionLogPath,
  issueTrackedSessionSummaryPath,
  issueTrackedStrategyBriefPath
} from "@/lib/web-pages";
import {
  phoenixEngineBuildPlan,
  phoenixEngineIdentifyIntents
} from "@/lib/skills/orchestrator";

import type { CaptureOutcome, DecisionLogEntry, RoutingPlan } from "@/lib/types";

function baseUrl(): string {
  return loadConfig().channels.channel.web.base_url.replace(/\/$/, "");
}

function blockedIntentMessage(intentName: string): string {
  const recipe = loadConsultCtoRecipe();
  const availableLines = recipe.activeBindings
    .map((binding) => `- \`${binding.intent}\` — ${binding.agent}`)
    .join("\n");
  const plannedLines = recipe.bindings
    .filter((binding) => binding.status === "planned")
    .map((binding) => `- \`${binding.intent}\``)
    .join("\n");

  return `**Status**: blocked\n**Reason**: Intent \`${intentName}\` is not available in this recipe.\n\n**Available intents**:\n${availableLines || "- None"}\n\n**Planned intents**:\n${plannedLines || "- None"}\n\nWould you like to proceed with one of the available intents?`;
}

async function saveDecision(
  entry: Omit<DecisionLogEntry, "id" | "createdAt">,
  trace?: {
    runId?: string;
    agentInvocationId?: string;
  }
) {
  const decision: DecisionLogEntry = {
    id: makeId("decision"),
    createdAt: nowIso(),
    ...entry
  };

  if (!trace?.runId) {
    await getStore().saveDecision(decision);
    return decision;
  }

  await executeTool({
    runId: trace.runId,
    agentInvocationId: trace.agentInvocationId,
    toolName: "write_decision_log",
    inputSummary: entry.action,
    metadata: {
      action: entry.action,
      sessionId: entry.sessionId ?? null,
      captureId: entry.captureId ?? null
    },
    execute: () => getStore().saveDecision(decision),
    summarize: () => decision.action
  });

  return decision;
}

async function issueSignedPage(input: {
  kind:
    | "decision_log"
    | "capture_review"
    | "session_summary"
    | "clarification"
    | "strategy_brief";
  sessionId?: string;
  runId?: string;
  agentInvocationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ path: string; expiresAt: string }> {
  const execute = () => {
    switch (input.kind) {
      case "decision_log":
        return issueTrackedDecisionLogPath({
          runId: input.runId,
          metadata: input.metadata
        });
      case "capture_review":
        return issueTrackedCaptureReviewPath({
          runId: input.runId,
          metadata: input.metadata
        });
      case "session_summary":
        if (!input.sessionId) {
          throw new Error("sessionId is required for session summary pages.");
        }
        return issueTrackedSessionSummaryPath({
          sessionId: input.sessionId,
          runId: input.runId,
          metadata: input.metadata
        });
      case "clarification":
        if (!input.sessionId) {
          throw new Error("sessionId is required for clarification pages.");
        }
        return issueTrackedClarificationPath({
          sessionId: input.sessionId,
          runId: input.runId,
          metadata: input.metadata
        });
      case "strategy_brief":
        if (!input.sessionId) {
          throw new Error("sessionId is required for strategy brief pages.");
        }
        return issueTrackedStrategyBriefPath({
          sessionId: input.sessionId,
          runId: input.runId,
          metadata: input.metadata
        });
    }
  };

  if (!input.runId) {
    return execute();
  }

  return executeTool({
    runId: input.runId,
    agentInvocationId: input.agentInvocationId,
    toolName: "issue_signed_page",
    inputSummary: input.kind,
    metadata: {
      pageKind: input.kind,
      sessionId: input.sessionId ?? null,
      ...(input.metadata ?? {})
    },
    execute,
    summarize: (issued) => issued.path
  });
}

async function persistSessionMetadata(input: {
  sessionId: string;
  metadataPatch: Record<string, unknown>;
}) {
  const store = getStore();
  const session = await store.getSession(input.sessionId);
  if (!session) {
    return;
  }

  await store.saveSession({
    ...session,
    updatedAt: nowIso(),
    metadata: {
      ...(session.metadata ?? {}),
      ...input.metadataPatch
    }
  });
}

async function executeStrategyGuardian(input: {
  query: string;
  originalQuery: string;
  stmPath: string;
  clarificationRound: number;
  runId?: string;
  agentInvocationId?: string;
}): Promise<
  | {
      status: "needs_clarification";
      content: string;
      questions: string[];
    }
  | {
      status: "blocked";
      content: string;
    }
  | {
      status: "complete";
      content: string;
      resolvedUnderstanding: string;
      assumptions: string[];
    }
> {
  const agent = loadAgentDefinition("phoenix:strategy-guardian");
  const activeSkills =
    agent?.activeSkills.length
      ? agent.activeSkills
      : ["analyze-request", "generate-questions", "evaluate-understanding"];
  const analysisSkill = activeSkills[0] ?? "analyze-request";
  const analysis = (await executeTool({
    runId: input.runId,
    agentInvocationId: input.agentInvocationId,
    toolName: normalizeSkillName(analysisSkill),
    inputSummary: "Analyze ask request for clarification needs.",
    metadata: {
      stmPath: input.stmPath,
      intent: "clarify",
      clarificationRound: input.clarificationRound
    },
    execute: () =>
      invokeSkill(analysisSkill, {
        query: input.query,
        stmPath: input.stmPath,
        intent: "clarify"
      }) as Promise<
        Awaited<
          ReturnType<
            typeof import("@/lib/skills/clarify").phoenixPerceptionAnalyzeRequest
          >
        >
      >,
    summarize: (result) => result.recommendedAction
  })) as Awaited<
    ReturnType<typeof import("@/lib/skills/clarify").phoenixPerceptionAnalyzeRequest>
  >;

  await writeStmOutput({
    stmPath: input.stmPath,
    name: `analysis-round-${input.clarificationRound + 1}`,
    content: `# Strategy Guardian Analysis

- Agent: ${agent?.name ?? "phoenix:strategy-guardian"}
- Active skills: ${activeSkills.map(normalizeSkillName).join(", ")}
- Vagueness score: ${analysis.vaguenessScore}
- Complexity: ${analysis.complexity}
- Missing dimensions: ${
      analysis.missingDimensions.length ? analysis.missingDimensions.join(", ") : "(none)"
    }
- Recommended action: ${analysis.recommendedAction}
`
  });

  if (analysis.recommendedAction === "clarify") {
    const questionSkill = activeSkills[1] ?? "generate-questions";
    const questions = (await executeTool({
      runId: input.runId,
      agentInvocationId: input.agentInvocationId,
      toolName: normalizeSkillName(questionSkill),
      inputSummary: "Generate clarification questions.",
      metadata: {
        stmPath: input.stmPath,
        intent: "clarify",
        maxQuestions: 3
      },
      execute: () =>
        invokeSkill(questionSkill, {
          analysis,
          stmPath: input.stmPath,
          intent: "clarify",
          maxQuestions: 3
        }) as Promise<
          Awaited<
            ReturnType<
              typeof import("@/lib/skills/clarify").phoenixManifestationGenerateQuestions
            >
          >
        >,
      summarize: (result) => `${result.questions.length} clarification question(s)`
    })) as Awaited<
      ReturnType<typeof import("@/lib/skills/clarify").phoenixManifestationGenerateQuestions>
    >;

    await updateStmIntentState({
      stmPath: input.stmPath,
      currentIntent: "clarify",
      pendingIntents: ["clarify"],
      questionsAsked: questions.questions
    });
    await writeStmOutput({
      stmPath: input.stmPath,
      name: `clarification-round-${input.clarificationRound + 1}`,
      content: `# Clarification Questions

${questions.message}
`
    });

    return {
      status: "needs_clarification",
      content: questions.message,
      questions: questions.questions
    };
  }

  const evaluationSkill = activeSkills[2] ?? "evaluate-understanding";
  const understanding = (await executeTool({
    runId: input.runId,
    agentInvocationId: input.agentInvocationId,
    toolName: normalizeSkillName(evaluationSkill),
    inputSummary: "Evaluate understanding and generate a strategic brief.",
    metadata: {
      stmPath: input.stmPath,
      clarificationRound: input.clarificationRound
    },
    execute: () =>
      invokeSkill(evaluationSkill, {
        originalQuery: input.originalQuery,
        stmPath: input.stmPath,
        clarificationRound: input.clarificationRound
      }) as Promise<
        Awaited<
          ReturnType<
            typeof import("@/lib/skills/clarify").phoenixCognitionEvaluateUnderstanding
          >
        >
      >,
    summarize: (result) => result.status
  })) as Awaited<
    ReturnType<typeof import("@/lib/skills/clarify").phoenixCognitionEvaluateUnderstanding>
  >;

  await writeStmOutput({
    stmPath: input.stmPath,
    name: `evaluation-round-${input.clarificationRound + 1}`,
    content: `# Evaluation Summary

- Status: ${understanding.status}
- Completeness score: ${understanding.completenessScore}
- Resolved understanding: ${understanding.resolvedUnderstanding}
- Missing dimensions: ${
      understanding.missingDimensions.length
        ? understanding.missingDimensions.join(", ")
        : "(none)"
    }

## Assumptions

${understanding.assumptions.length
    ? understanding.assumptions.map((item) => `- ${item}`).join("\n")
    : "- None"}

## Brief

${understanding.brief}
`
  });

  if (understanding.status === "contradiction_detected") {
    return {
      status: "blocked",
      content:
        "Chronos found contradictory information in the clarification responses. Resolve the contradiction before continuing."
    };
  }

  if (understanding.status === "needs_reclarification") {
    const questionSkill = activeSkills[1] ?? "generate-questions";
    const questions = (await executeTool({
      runId: input.runId,
      agentInvocationId: input.agentInvocationId,
      toolName: normalizeSkillName(questionSkill),
      inputSummary: "Generate re-clarification questions.",
      metadata: {
        stmPath: input.stmPath,
        intent: "clarify",
        maxQuestions: 2
      },
      execute: () =>
        invokeSkill(questionSkill, {
          analysis: {
            vaguenessScore: 0.82,
            missingDimensions: understanding.missingDimensions,
            recommendedAction: "clarify"
          },
          stmPath: input.stmPath,
          intent: "clarify",
          maxQuestions: 2
        }) as Promise<
          Awaited<
            ReturnType<
              typeof import("@/lib/skills/clarify").phoenixManifestationGenerateQuestions
            >
          >
        >,
      summarize: (result) => `${result.questions.length} re-clarification question(s)`
    })) as Awaited<
      ReturnType<typeof import("@/lib/skills/clarify").phoenixManifestationGenerateQuestions>
    >;

    await updateStmIntentState({
      stmPath: input.stmPath,
      currentIntent: "clarify",
      pendingIntents: ["clarify"],
      questionsAsked: questions.questions
    });

    return {
      status: "needs_clarification",
      content: questions.message,
      questions: questions.questions
    };
  }

  await updateStmIntentState({
    stmPath: input.stmPath,
    currentIntent: "clarify",
    pendingIntents: [],
    completedIntents: ["clarify"]
  });

  return {
    status: "complete",
    content: understanding.brief,
    resolvedUnderstanding: understanding.resolvedUnderstanding,
    assumptions: understanding.assumptions
  };
}

export async function runConsultCtoRecipe(input: {
  question: string;
  authorId: string;
  channel: "discord" | "claude_code" | "web";
  sessionId?: string;
  topic?: string;
  runId?: string;
}): Promise<CaptureOutcome> {
  const lowered = input.question.toLowerCase();
  if (lowered.includes("show me decisions")) {
    const decisionLog = await issueSignedPage({
      kind: "decision_log",
      runId: input.runId,
      metadata: {
        query: input.question
      }
    });
    return {
      kind: "message",
      message: `Decision log: ${baseUrl()}${decisionLog.path}`
    };
  }

  if (lowered.includes("show me overrides")) {
    const decisionLog = await issueSignedPage({
      kind: "decision_log",
      runId: input.runId,
      metadata: {
        query: input.question,
        mode: "overrides"
      }
    });
    return {
      kind: "message",
      message: `Overrides: ${baseUrl()}${decisionLog.path}?mode=overrides`
    };
  }

  if (lowered.includes("show me false positives")) {
    const decisionLog = await issueSignedPage({
      kind: "decision_log",
      runId: input.runId,
      metadata: {
        query: input.question,
        mode: "false_positives"
      }
    });
    return {
      kind: "message",
      message: `False positives: ${baseUrl()}${decisionLog.path}?mode=false_positives`
    };
  }

  if (lowered.includes("classification accuracy")) {
    const captures = await getStore().listCaptures();
    const comparable = captures.filter(
      (capture) =>
        capture.quickClassification?.category &&
        capture.deepClassification?.category
    );
    if (comparable.length === 0) {
      return {
        kind: "message",
        message: "Classification accuracy: not enough heartbeat-reviewed captures yet."
      };
    }

    const matched = comparable.filter(
      (capture) =>
        capture.quickClassification?.category === capture.deepClassification?.category
    ).length;
    const accuracy = Number(((matched / comparable.length) * 100).toFixed(1));

    return {
      kind: "message",
      message: `Classification accuracy: ${accuracy}% (${matched}/${comparable.length} heartbeat-reviewed captures matched their quick classification).`
    };
  }

  if (lowered.includes("show me captures") || lowered.includes("show me my captures")) {
    const captures = await issueSignedPage({
      kind: "capture_review",
      runId: input.runId,
      metadata: {
        query: input.question
      }
    });
    return {
      kind: "message",
      message: `Capture review: ${baseUrl()}${captures.path}`
    };
  }

  const recipe = loadConsultCtoRecipe();
  const session = await ensureActiveSession({
    authorId: input.authorId,
    channel: input.channel,
    requestedSessionId: input.sessionId,
    requestedTopic: input.topic
  });

  if (lowered.includes("show me session history") || lowered.includes("show my session")) {
    const sessionSummary = await issueSignedPage({
      kind: "session_summary",
      sessionId: session.id,
      runId: input.runId,
      metadata: {
        query: input.question
      }
    });
    return {
      kind: "message",
      message: `Session summary: ${baseUrl()}${sessionSummary.path}`
    };
  }

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const isClarificationResponse =
    metadata.activeRecipe === recipe.id &&
    metadata.pendingClarification === true &&
    typeof metadata.stmPath === "string";

  await appendSessionHistory({
    sessionId: session.id,
    role: "user",
    text: input.question,
    source: input.channel
  });

  let stmPath: string;
  let originalQuery: string;
  let clarificationRound = Number(metadata.clarificationRound ?? 0);

  if (isClarificationResponse) {
    stmPath = String(metadata.stmPath);
    originalQuery = String(metadata.originalQuery ?? session.topic);
    await appendStmUserResponse({
      stmPath,
      userResponse: input.question,
      pendingQuestion:
        typeof metadata.pendingQuestion === "string"
          ? metadata.pendingQuestion
          : undefined
    });
    clarificationRound += 1;
  } else {
    const initialized = await initializeStmWorkspace({
      recipeId: recipe.id,
      query: input.question,
      author: input.authorId,
      channel: input.channel,
      sessionId: session.id
    });
    stmPath = initialized.stmPath;
    originalQuery = input.question;
    clarificationRound = 0;
    await mergeSessionContext({
      sessionId: session.id,
      entries: initialized.signalsLoaded.map((signal) => ({
        id: signal.id,
        title: signal.title,
        excerpt: signal.excerpt,
        category: signal.category,
        score: signal.score
      }))
    });
  }

  const stm = await readStmState(stmPath);
  const selectedIntents = await executeTool({
    runId: input.runId,
    toolName: "identify_intents",
    inputSummary: stm.currentQuery,
    metadata: {
      stmPath,
      mode: isClarificationResponse ? "re-evaluate" : "initial"
    },
    execute: () =>
      phoenixEngineIdentifyIntents({
        query: stm.currentQuery,
        stmPath,
        intentBindings: recipe.bindings,
        mode: isClarificationResponse ? "re-evaluate" : "initial",
        priorIntents:
          Array.isArray(metadata.lastSelectedIntents) &&
          metadata.lastSelectedIntents.every((item) => typeof item === "string")
            ? (metadata.lastSelectedIntents as string[])
            : undefined
      }),
    summarize: (result) => result.map((intent) => intent.intent).join(", ")
  });
  const routing = await executeTool({
    runId: input.runId,
    toolName: "build_routing_plan",
    inputSummary: stm.currentQuery,
    metadata: {
      replanCount: clarificationRound
    },
    execute: () =>
      phoenixEngineBuildPlan({
        query: stm.currentQuery,
        selectedIntents,
        replanCount: clarificationRound
      }),
    summarize: (result) => (result.plan ? result.plan.id : "blocked")
  });

  if (!routing.plan) {
    const blockedMessage =
      routing.blockedMessage ??
      blockedIntentMessage(selectedIntents[0]?.intent ?? "unknown");
    await saveDecision(
      {
      action: "intent_detection",
      input: stm.currentQuery,
      sessionId: session.id,
      confidence: selectedIntents[0]?.confidence ?? null,
      thresholdUsed: "ask",
      autoApproved: false,
      evalAgentModel: process.env.ANTHROPIC_API_KEY
        ? loadConfig().engine.engine.model
        : "heuristic",
      decision: {
        status: "blocked",
        intents: selectedIntents
      },
      metadata: {
        recipe: ".claude/commands/consult-cto.md"
      }
      },
      {
        runId: input.runId
      }
    );
    await appendSessionHistory({
      sessionId: session.id,
      role: "system",
      text: blockedMessage,
      source: "system"
    });
    return {
      kind: "message",
      message: blockedMessage
    };
  }

  const plan: RoutingPlan = routing.plan;
  await writeStmOutput({
    stmPath,
    name: `routing-plan-${plan.metadata.replan_count}`,
    content: `# Routing Plan

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`
`
  });
  await updateStmIntentState({
    stmPath,
    currentIntent: plan.steps[0]?.agents[0]?.intent ?? "clarify",
    pendingIntents: plan.steps.flatMap((step) => step.agents.map((agent) => agent.intent)),
    replanCount: plan.metadata.replan_count
  });

  await persistSessionMetadata({
    sessionId: session.id,
    metadataPatch: {
      activeRecipe: recipe.id,
      stmPath,
      originalQuery,
      lastRoutingPlan: plan,
      lastSelectedIntents: selectedIntents.map((intent) => intent.intent),
      clarificationRound
    }
  });

  await saveDecision(
    {
    action: "intent_detection",
    input: stm.currentQuery,
    sessionId: session.id,
    confidence: plan.confidence,
    thresholdUsed: "auto",
    autoApproved: true,
    evalAgentModel: process.env.ANTHROPIC_API_KEY
      ? loadConfig().engine.engine.model
      : "heuristic",
    decision: {
      planId: plan.id,
      selectedIntents
    },
    metadata: {
      stmPath,
      recipe: ".claude/commands/consult-cto.md"
    }
    },
    {
      runId: input.runId
    }
  );

  const firstAgent = plan.steps[0]?.agents[0];
  if (!firstAgent || firstAgent.agent !== "phoenix:strategy-guardian") {
    const blockedMessage = blockedIntentMessage(firstAgent?.intent ?? "unknown");
    return {
      kind: "message",
      message: blockedMessage
    };
  }

  const result = await executeAgent({
    runId: input.runId,
    recipeId: recipe.id,
    agentName: "phoenix:strategy-guardian",
    phase: isClarificationResponse ? "clarification" : "analysis",
    modelMode: "agent_runtime",
    metadata: {
      sessionId: session.id,
      stmPath
    },
    execute: ({ agentInvocationId }) =>
      executeStrategyGuardian({
        query: stm.currentQuery,
        originalQuery,
        stmPath,
        clarificationRound,
        runId: input.runId,
        agentInvocationId
      }),
    summarize: (agentResult) => {
      if (agentResult.status === "needs_clarification") {
        return `Asked ${agentResult.questions.length} clarification question(s).`;
      }

      if (agentResult.status === "blocked") {
        return agentResult.content;
      }

      return agentResult.resolvedUnderstanding;
    }
  });

  if (result.status === "blocked") {
    await persistSessionMetadata({
      sessionId: session.id,
      metadataPatch: {
        pendingClarification: false,
        pendingQuestion: null
      }
    });
    await appendSessionHistory({
      sessionId: session.id,
      role: "system",
      text: result.content,
      source: "system"
    });
    return {
      kind: "message",
      message: result.content
    };
  }

  if (result.status === "needs_clarification") {
    const channel = selectResponseChannel({
      source: input.channel,
      gate: "clarification",
      content: result.content
    });
    const clarification =
      channel === "web"
        ? await issueSignedPage({
            kind: "clarification",
            sessionId: session.id,
            runId: input.runId,
            metadata: {
              query: originalQuery,
              gate: "clarification"
            }
          })
        : null;
    const message =
      channel === "web"
        ? `Clarification: ${baseUrl()}${clarification?.path}`
        : result.content;

    await persistSessionMetadata({
      sessionId: session.id,
      metadataPatch: {
        pendingClarification: true,
        pendingQuestion: result.questions.join("\n"),
        clarificationRound,
        lastClarification: {
          title: originalQuery,
          content: result.content,
          createdAt: nowIso()
        }
      }
    });
    await saveDecision(
      {
      action: "response_gate",
      input: stm.currentQuery,
      sessionId: session.id,
      confidence: null,
      thresholdUsed: "ask",
      autoApproved: false,
      userResponse: null,
      evalAgentModel: process.env.ANTHROPIC_API_KEY
        ? loadConfig().engine.engine.model
        : "heuristic",
      decision: {
        gate: "clarification",
        responseChannel: channel
      },
      metadata: {
        stmPath,
        questions: result.questions
      }
      },
      {
        runId: input.runId
      }
    );
    await appendSessionHistory({
      sessionId: session.id,
      role: "system",
      text: message,
      source: "system"
    });
    return {
      kind: "message",
      message
    };
  }

  const channel = selectResponseChannel({
    source: input.channel,
    gate: "strategy_brief",
    content: result.content
  });
  const brief =
    channel === "web"
      ? await issueSignedPage({
          kind: "strategy_brief",
          sessionId: session.id,
          runId: input.runId,
          metadata: {
            query: originalQuery,
            gate: "synthesis"
          }
        })
      : null;
  const message =
    channel === "web" ? `Strategic brief: ${baseUrl()}${brief?.path}` : result.content;

  await persistSessionMetadata({
    sessionId: session.id,
    metadataPatch: {
      pendingClarification: false,
      pendingQuestion: null,
      clarificationRound,
      lastBrief: {
        title: originalQuery,
        content: result.content,
        createdAt: nowIso()
      },
      lastResolvedUnderstanding: result.resolvedUnderstanding,
      lastAssumptions: result.assumptions
    }
  });
  await saveDecision(
    {
    action: "response_gate",
    input: stm.currentQuery,
    sessionId: session.id,
    confidence: plan.confidence,
    thresholdUsed: "auto",
    autoApproved: true,
    evalAgentModel: process.env.ANTHROPIC_API_KEY
      ? loadConfig().engine.engine.model
      : "heuristic",
    decision: {
      gate: "synthesis",
      responseChannel: channel
    },
    metadata: {
      stmPath,
      resolvedUnderstanding: result.resolvedUnderstanding,
      assumptions: result.assumptions
    }
    },
    {
      runId: input.runId
    }
  );
  await appendSessionHistory({
    sessionId: session.id,
    role: "system",
    text: message,
    source: "system"
  });

  return {
    kind: "message",
    message
  };
}
