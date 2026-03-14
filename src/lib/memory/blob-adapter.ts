import { get, list, put } from "@vercel/blob";

import { makeSignalSlug, makeSignalTitle, similarityScore, tokenize } from "@/lib/intelligence/classifier";
import { indexMemoryDocument, searchIndexedMemory } from "@/lib/memory/indexed-search";
import type { MemoryAdapter, MemoryWriteResult } from "@/lib/memory/adapter";
import type { CaptureLogEntry, MemorySearchResult } from "@/lib/types";

const SIGNAL_PREFIX = "library/signals/";

export class BlobMemoryAdapter implements MemoryAdapter {
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
    const pathname = `${SIGNAL_PREFIX}${input.category}/${slug}.md`;

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

    await put(pathname, body, {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "text/markdown",
      cacheControlMaxAge: 0
    });
    await indexMemoryDocument({
      id: pathname,
      title,
      path: pathname,
      excerpt: body.split(/\n+/).slice(0, 8).join(" ").slice(0, 280),
      category: input.category,
      body
    });

    return {
      libraryId: pathname,
      path: pathname
    };
  }
}
