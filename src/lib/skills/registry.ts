import {
  phoenixCognitionEvaluateUnderstanding,
  phoenixManifestationGenerateQuestions,
  phoenixPerceptionAnalyzeRequest
} from "@/lib/skills/clarify";

export function normalizeSkillName(name: string): string {
  const normalized = name.trim().toLowerCase();
  switch (normalized) {
    case "analyze-request":
      return "phoenix-perception-analyze-request";
    case "generate-questions":
      return "phoenix-manifestation-generate-questions";
    case "evaluate-understanding":
      return "phoenix-cognition-evaluate-understanding";
    default:
      return normalized;
  }
}

export async function invokeSkill(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (normalizeSkillName(name)) {
    case "phoenix-perception-analyze-request":
      return phoenixPerceptionAnalyzeRequest(
        input as Parameters<typeof phoenixPerceptionAnalyzeRequest>[0]
      );
    case "phoenix-manifestation-generate-questions":
      return phoenixManifestationGenerateQuestions(
        input as Parameters<typeof phoenixManifestationGenerateQuestions>[0]
      );
    case "phoenix-cognition-evaluate-understanding":
      return phoenixCognitionEvaluateUnderstanding(
        input as Parameters<typeof phoenixCognitionEvaluateUnderstanding>[0]
      );
    default:
      throw new Error(`Skill "${name}" is not registered in the runtime.`);
  }
}
