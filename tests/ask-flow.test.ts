import fs from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { resetConfigForTests } from "@/lib/config";
import { captureThought } from "@/lib/engine/capture";
import { handleCommand } from "@/lib/engine/commands";
import { runHeartbeat } from "@/lib/engine/heartbeat";
import { getStore, resetStoreForTests } from "@/lib/store";
import { resolveFromRoot } from "@/lib/utils";

const storePath = ".chronos-data/test-ask-store.json";
const libraryPath = "./data/test-ask-library";

beforeEach(async () => {
  process.env.CHRONOS_STORE = "file";
  process.env.CHRONOS_OWNER_IDS = "owner-dev";
  process.env.CHRONOS_FILE_STORE_PATH = storePath;
  process.env.CHRONOS_LTM_PATH = libraryPath;
  delete process.env.ANTHROPIC_API_KEY;
  resetConfigForTests();
  resetStoreForTests();
  await fs.rm(resolveFromRoot(storePath), { force: true });
  await fs.rm(resolveFromRoot(libraryPath), { force: true, recursive: true });
});

describe("ask flow", () => {
  it("blocks intents that are not active in the consult-cto recipe", async () => {
    await fs.mkdir(resolveFromRoot(libraryPath, "signals/ai-intelligence"), {
      recursive: true
    });
    await fs.writeFile(
      resolveFromRoot(
        libraryPath,
        "signals/ai-intelligence/decision-context.md"
      ),
      `# Decision Context

This signal discusses deciding between Postgres and MongoDB in an AI-native system on Vercel, including trade-offs, audit constraints, and architecture choices.
`,
      "utf8"
    );

    const outcome = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Should I use an AI-native Postgres design or MongoDB for this system?"
      }
    });

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toContain("**Status**: blocked");
    expect(outcome.message).toContain("`clarify`");
  });

  it("returns clarification questions for vague asks and records the exchange", async () => {
    const outcome = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Help me with my system"
      }
    });

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toContain("/review/clarifications/");

    const sessions = await getStore().listSessions("owner-dev");
    const current = sessions.find((session) => Boolean(session.metadata?.isCurrent));
    expect(current?.history.length).toBeGreaterThan(1);
    expect(typeof current?.metadata?.stmPath).toBe("string");
    const stmPath = current?.metadata?.stmPath as string;
    await expect(fs.stat(resolveFromRoot(stmPath, "state.md"))).resolves.toBeTruthy();
    await expect(fs.stat(resolveFromRoot(stmPath, "context.md"))).resolves.toBeTruthy();
    await expect(fs.stat(resolveFromRoot(stmPath, "intents.md"))).resolves.toBeTruthy();
    expect(
      (current?.metadata?.lastClarification as { content?: string } | undefined)?.content
    ).toContain("What specifically");
    expect(
      (current?.metadata?.lastRoutingPlan as { steps?: unknown[] } | undefined)?.steps?.length
    ).toBe(1);

    const decisions = await getStore().listDecisions();
    expect(decisions.some((decision) => decision.action === "intent_detection")).toBe(true);
    expect(decisions.some((decision) => decision.action === "response_gate")).toBe(true);
    const runs = await getStore().listRuns({ recipeId: "consult-cto" });
    expect(runs[0]?.status).toBe("awaiting_user");
    const invocations = await getStore().listAgentInvocations({
      runId: runs[0]?.id
    });
    expect(invocations.some((record) => record.agentName === "phoenix:strategy-guardian")).toBe(
      true
    );
    const toolCalls = await getStore().listToolCalls({ runId: runs[0]?.id });
    expect(toolCalls.some((record) => record.toolName === "identify_intents")).toBe(true);
    expect(toolCalls.some((record) => record.toolName === "build_routing_plan")).toBe(true);
    expect(
      toolCalls.some((record) => record.toolName === "phoenix-perception-analyze-request")
    ).toBe(true);
    expect(
      toolCalls.some(
        (record) => record.toolName === "phoenix-manifestation-generate-questions"
      )
    ).toBe(true);
    expect(toolCalls.some((record) => record.toolName === "write_decision_log")).toBe(true);
    expect(toolCalls.some((record) => record.toolName === "issue_signed_page")).toBe(true);
    const artifacts = await getStore().listArtifacts({ runId: runs[0]?.id });
    expect(artifacts.some((artifact) => artifact.artifactType === "clarification_page")).toBe(
      true
    );
  });

  it("re-enters the same STM workspace after clarification and produces a brief", async () => {
    const first = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Help me with my system"
      }
    });

    expect(first.kind).toBe("message");
    expect(first.message).toContain("/review/clarifications/");

    const followUp = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question:
          "I am building an internal AI assistant for finance analysts, and it must run on Vercel with strict audit requirements so weekly metrics are summarized faster."
      }
    });

    expect(followUp.kind).toBe("message");
    expect(followUp.message).toContain("/review/briefs/");

    const sessions = await getStore().listSessions("owner-dev");
    const current = sessions.find((session) => Boolean(session.metadata?.isCurrent));
    expect(current?.metadata?.pendingClarification).toBe(false);
    expect((current?.metadata?.lastBrief as { content?: string } | undefined)?.content).toContain(
      "## Strategic Brief"
    );
    const stmPath = current?.metadata?.stmPath as string;
    const runtimeState = JSON.parse(
      await fs.readFile(resolveFromRoot(stmPath, "evidence/runtime-state.json"), "utf8")
    ) as { userResponses?: unknown[]; completedIntents?: string[] };
    expect(runtimeState.userResponses?.length).toBe(1);
    expect(runtimeState.completedIntents).toContain("clarify");
    const runs = await getStore().listRuns({ recipeId: "consult-cto" });
    const toolCalls = await getStore().listToolCalls({ runId: runs[0]?.id });
    expect(
      toolCalls.some((record) => record.toolName === "phoenix-cognition-evaluate-understanding")
    ).toBe(true);
    const artifacts = await getStore().listArtifacts({ runId: runs[0]?.id });
    expect(artifacts.some((artifact) => artifact.artifactType === "strategy_brief")).toBe(true);
  });

  it("returns a signed brief URL for detailed discord asks", async () => {
    const outcome = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question:
          "I am building an internal AI assistant for finance analysts to summarize weekly operating metrics on Vercel with strict audit requirements."
      }
    });

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toContain("/review/briefs/");

    const sessions = await getStore().listSessions("owner-dev");
    const current = sessions.find((session) => Boolean(session.metadata?.isCurrent));
    expect((current?.metadata?.lastBrief as { content?: string } | undefined)?.content).toContain(
      "## Strategic Brief"
    );
  });

  it("returns a signed decision-log URL for audit queries", async () => {
    const outcome = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Show me decisions"
      }
    });

    expect(outcome.kind).toBe("message");
    expect(outcome.message).toContain("/review/decisions/");
    const artifacts = await getStore().listArtifacts({ artifactType: "decision_review" });
    expect(artifacts).toHaveLength(1);
  });

  it("returns signed urls for capture and session history queries", async () => {
    await handleCommand({
      name: "new",
      authorId: "owner-dev",
      options: {
        topic: "Testing session history"
      }
    });

    const captures = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Show me captures"
      }
    });
    const sessionHistory = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Show me session history"
      }
    });

    expect(captures.message).toContain("/review/captures/");
    expect(sessionHistory.message).toContain("/review/sessions/");
  });

  it("reports classification accuracy from reviewed captures", async () => {
    await captureThought({
      message: "AI agents need intent alignment before they get more agency.",
      authorId: "owner-dev",
      channel: "claude_code"
    });
    await runHeartbeat();

    const outcome = await handleCommand({
      name: "ask",
      authorId: "owner-dev",
      options: {
        question: "Show me classification accuracy"
      }
    });

    expect(outcome.message).toContain("Classification accuracy:");
    expect(outcome.message).toContain("1/1");
  });
});
