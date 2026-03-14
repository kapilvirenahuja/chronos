import fs from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "@/lib/config";
import { makeSignalSlug, makeSignalTitle, similarityScore, tokenize } from "@/lib/intelligence/classifier";
import { indexMemoryDocument, searchIndexedMemory } from "@/lib/memory/indexed-search";
import type { MemoryAdapter, MemoryWriteResult } from "@/lib/memory/adapter";
import type { CaptureLogEntry, MemorySearchResult } from "@/lib/types";
import { resolveFromRoot } from "@/lib/utils";

export class LocalMemoryAdapter implements MemoryAdapter {
  private readonly rootPath: string;

  constructor(rootPath?: string) {
    const config = loadConfig();
    this.rootPath = resolveFromRoot(
      rootPath ?? config.memory.memory.layer1.connection
    );
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    return (await searchIndexedMemory(query, limit)) ?? [];
  }

  async write(input: {
    capture: CaptureLogEntry;
    category: string;
    related: MemorySearchResult[];
    note?: string;
  }): Promise<MemoryWriteResult> {
    const title = makeSignalTitle(input.capture.message);
    const slug = makeSignalSlug(input.capture.message);
    const categoryDir = path.join(this.rootPath, "signals", input.category);
    await fs.mkdir(categoryDir, { recursive: true });
    const filePath = path.join(categoryDir, `${slug}.md`);

    const relatedLines = input.related.length
      ? input.related.map((item) => `- ${item.title} (${item.id})`).join("\n")
      : "- None";

    const noteBlock = input.note ? `\n## Note\n\n${input.note}\n` : "";

    const body = `# ${title}

> Promoted by Chronos heartbeat from capture ${input.capture.id}

## Message

${input.capture.message}

## Classification

- Category: ${input.category}
- Confidence: ${input.capture.deepClassification?.confidence ?? input.capture.quickClassification?.confidence ?? "n/a"}
- Session: ${input.capture.sessionId}

## Related Signals

${relatedLines}
${noteBlock}
## Metadata

- Captured: ${input.capture.createdAt}
- Promoted: ${new Date().toISOString()}
- Source: ${input.capture.source}
`;

    await fs.writeFile(filePath, body, "utf8");
    await indexMemoryDocument({
      id: path.relative(resolveFromRoot("."), filePath),
      title,
      path: filePath,
      excerpt: body.split(/\n+/).slice(0, 8).join(" ").slice(0, 280),
      category: input.category,
      body
    });

    return {
      libraryId: path.relative(resolveFromRoot("."), filePath),
      path: filePath
    };
  }
}
