import fs from "node:fs";

import { resolveFromRoot } from "@/lib/utils";

export interface IntentBinding {
  intent: string;
  agent: string;
  status: "active" | "planned";
  domain: string;
}

export interface RelatedIntentRules {
  evolvesTo: string[];
  requiresFirst: string[];
  conflictsWith: string[];
}

export interface IntentDefinition {
  intent: string;
  description: string;
  patterns: string[];
  contextSignals: string[];
  routesTo: string[];
  questionShapes: string[];
  inputCompleteWhen: string;
  related: RelatedIntentRules;
}

export interface AgentDefinition {
  name: string;
  markdown: string;
  activeSkills: string[];
  availableSkills: string[];
}

export interface RecipeDefinition {
  id: string;
  markdown: string;
  bindings: IntentBinding[];
  activeBindings: IntentBinding[];
  synthesizer: string;
  vaultPath: string;
  intentDomainPath: string;
  availableAgents: string[];
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveFromRoot(relativePath), "utf8");
}

function linesInSection(section: string, heading: string): string[] {
  const match = section.match(
    new RegExp(`### ${heading}[\\s\\S]*?(?=\\n### |$)`, "i")
  )?.[0];
  if (!match) {
    return [];
  }

  return match
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function extractSection(markdown: string, startHeading: string): string | null {
  return (
    markdown.match(new RegExp(`${startHeading}[\\s\\S]*?(?=\\n## |$)`, "i"))?.[0] ??
    null
  );
}

function extractListItems(section: string, heading: string): string[] {
  return linesInSection(section, heading).map((line) => line.replace(/^- /, "").trim());
}

function parseRelated(section: string): RelatedIntentRules {
  const related = extractSection(section, "### Related Intents") ?? "";
  const value = (label: string) =>
    related
      .match(new RegExp(`\\*\\*${label}\\*\\*:\\s*([^\\n]+)`, "i"))?.[1]
      ?.trim() ?? "";

  const parseValues = (raw: string) => {
    if (!raw) {
      return [];
    }

    if (/all others/i.test(raw)) {
      return ["*"];
    }

    return raw
      .split(",")
      .map((item) => item.replace(/`/g, "").trim())
      .filter(Boolean);
  };

  return {
    evolvesTo: parseValues(value("evolves_to")),
    requiresFirst: parseValues(value("requires_first")),
    conflictsWith: parseValues(value("conflicts_with"))
  };
}

export function loadConsultCtoRecipe(): RecipeDefinition {
  const markdown = read(".claude/commands/consult-cto.md");
  const intentDomainPath =
    markdown.match(/Intent definitions:\s*([^\n]+)/i)?.[1]?.trim() ??
    "@memory/engine/intents/cto-intents.md";
  const synthesizer =
    markdown.match(/\|\s*Synthesizer\s*\|\s*`?([^`|\n]+)`?\s*\|/i)?.[1]?.trim() ??
    "phoenix:strategy-guardian";
  const vaultPath =
    markdown.match(/\|\s*Vault Path\s*\|\s*`?([^`|\n]+)`?\s*\|/i)?.[1]?.trim() ??
    "@{user-vault}/";

  const bindings = markdown
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      const [intentCell, agentCell, statusCell] = cells;
      return {
        intent: intentCell.replace(/`/g, ""),
        agent: agentCell.replace(/`/g, ""),
        status: /active/i.test(statusCell) ? "active" : "planned",
        domain: intentDomainPath
      } satisfies IntentBinding;
    });

  const availableAgents = [...new Set([...bindings.map((binding) => binding.agent), synthesizer])];

  return {
    id: "consult-cto",
    markdown,
    bindings,
    activeBindings: bindings.filter((binding) => binding.status === "active"),
    synthesizer,
    vaultPath,
    intentDomainPath,
    availableAgents
  };
}

export function loadCtoIntent(intentName: string): IntentDefinition | null {
  const markdown = read("memory/engine/intents/cto-intents.md");
  const section = markdown.match(
    new RegExp(`## Intent: ${intentName}[\\s\\S]*?(?=\\n## Intent: |\\n## Intent Detection Priority|$)`, "i")
  )?.[0];

  if (!section) {
    return null;
  }

  const routesToRaw =
    section.match(/### Routes To[\s\S]*?(?=\n### |\n---|$)/i)?.[0] ?? "";
  const routesTo = [...routesToRaw.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const inputCompleteWhen =
    section.match(/\*\*Input complete when\*\*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const description =
    section.match(/\*\*Goal\*\*:\s*([^\n]+)/i)?.[1]?.trim() ?? intentName;

  return {
    intent: intentName,
    description,
    patterns: extractListItems(section, "Patterns"),
    contextSignals: extractListItems(section, "Context Signals"),
    routesTo,
    questionShapes: [...section.matchAll(/- "([^"]+)"/g)].map((match) => match[1].trim()),
    inputCompleteWhen,
    related: parseRelated(section)
  };
}

export function loadIntentPriority(): string[] {
  const markdown = read("memory/engine/intents/cto-intents.md");
  const section = extractSection(markdown, "## Intent Detection Priority") ?? "";
  return [...section.matchAll(/\d+\.\s+\*\*([^*]+)\*\*/g)].map((match) =>
    match[1].trim()
  );
}

export function loadAgentDefinition(agentName: string): AgentDefinition | null {
  const relativePath = `.claude/agents/${agentName.replace(/^phoenix:/, "")}.md`;
  try {
    const markdown = read(relativePath);
    const skillsSection =
      markdown.match(/## Skills[\s\S]*?(?=\n## |$)/i)?.[0] ?? markdown;
    const skills = skillsSection
      .split("\n")
      .filter((line) => line.startsWith("| `") || line.startsWith("| "))
      .map((line) =>
        line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
      )
      .filter((cells) => cells.length >= 3)
      .map((cells) => ({
        name: cells[0].replace(/`/g, ""),
        status: cells.at(-1) ?? ""
      }))
      .filter((skill) => !/skill/i.test(skill.name))
      .filter((skill) => !/^[-]+$/.test(skill.name));

    return {
      name: agentName,
      markdown,
      activeSkills: skills
        .filter((skill) => /active|✅/i.test(skill.status))
        .map((skill) => skill.name),
      availableSkills: skills.map((skill) => skill.name)
    };
  } catch {
    return null;
  }
}
