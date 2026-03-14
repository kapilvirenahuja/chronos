import fs from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "@/lib/config";
import { similarityScore, tokenize } from "@/lib/intelligence/classifier";
import type { MemorySearchResult } from "@/lib/types";
import { resolveFromRoot } from "@/lib/utils";

interface IndexedDocument {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  category: string | null;
  body: string;
}

type SearchProviderConfig =
  | {
      provider: "elastic";
      url: string;
      apiKey?: string;
      index: string;
    }
  | {
      provider: "upstash_vector";
      url: string;
      token: string;
    }
  | {
      provider: "local_index";
      rootPath: string;
    };

function elasticConfig() {
  const url = process.env.ELASTIC_URL;
  const index = process.env.ELASTIC_INDEX ?? "chronos-signals";
  if (!url) {
    return null;
  }

  return {
    provider: "elastic" as const,
    url: url.replace(/\/$/, ""),
    index,
    apiKey: process.env.ELASTIC_API_KEY
  };
}

function upstashConfig() {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  return {
    provider: "upstash_vector" as const,
    url: url.replace(/\/$/, ""),
    token
  };
}

function localIndexConfig() {
  const config = loadConfig();
  if (
    config.memory.memory.layer2.provider !== "local_index" ||
    config.memory.memory.layer1.type !== "local"
  ) {
    return null;
  }

  return {
    provider: "local_index" as const,
    rootPath: resolveFromRoot(config.memory.memory.layer1.connection)
  };
}

function searchProvider(): SearchProviderConfig | null {
  return elasticConfig() ?? upstashConfig() ?? localIndexConfig();
}

async function readMarkdownFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
          return readMarkdownFiles(fullPath);
        }
        return entry.name.endsWith(".md") ? [fullPath] : [];
      })
    );

    return files.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function overlapBoost(query: string, body: string): number {
  const queryTokens = new Set(tokenize(query));
  const bodyTokens = new Set(tokenize(body));
  const overlap = [...queryTokens].filter((token) => bodyTokens.has(token)).length;
  return overlap / Math.max(queryTokens.size, 1);
}

export async function searchIndexedMemory(
  query: string,
  limit = 5
): Promise<MemorySearchResult[] | null> {
  const config = searchProvider();
  if (!config) {
    return null;
  }

  if (config.provider === "elastic") {
    const response = await fetch(`${config.url}/${config.index}/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `ApiKey ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        size: limit,
        query: {
          multi_match: {
            query,
            fields: ["title^3", "body", "excerpt^2", "category"]
          }
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      hits?: {
        hits?: Array<{
          _score?: number;
          _source?: IndexedDocument;
        }>;
      };
    };

    return (
      body.hits?.hits?.map((hit) => ({
        id: hit._source?.id ?? "",
        title: hit._source?.title ?? "",
        path: hit._source?.path ?? "",
        excerpt: hit._source?.excerpt ?? "",
        category: hit._source?.category ?? null,
        score: hit._score ?? 0
      })) ?? []
    );
  }

  if (config.provider === "local_index") {
    const files = await readMarkdownFiles(config.rootPath);
    const ranked = await Promise.all(
      files.map(async (filePath) => {
        const raw = await fs.readFile(filePath, "utf8");
        const title =
          raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(filePath, ".md");
        const excerpt = raw.split(/\n+/).slice(0, 8).join(" ").slice(0, 280);
        const score = similarityScore(query, raw) + overlapBoost(query, raw);
        return {
          id: path.relative(config.rootPath, filePath),
          title,
          path: filePath,
          excerpt,
          category: path.relative(config.rootPath, filePath).split(path.sep)[0] ?? null,
          score
        } satisfies MemorySearchResult;
      })
    );

    return ranked
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  const response = await fetch(`${config.url}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`
    },
    body: JSON.stringify({
      data: query,
      topK: limit,
      includeMetadata: true,
      includeData: true
    })
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    result?: Array<{
      id?: string;
      score?: number;
      data?: string;
      metadata?: Partial<IndexedDocument>;
    }>;
  };

  return (
    body.result?.map((hit) => ({
      id: hit.id ?? "",
      title: hit.metadata?.title ?? hit.id ?? "Untitled signal",
      path: hit.metadata?.path ?? "",
      excerpt: hit.metadata?.excerpt ?? hit.data?.slice(0, 280) ?? "",
      category: hit.metadata?.category ?? null,
      score: hit.score ?? 0
    })) ?? []
  );
}

export async function indexMemoryDocument(document: IndexedDocument): Promise<void> {
  const config = searchProvider();
  if (!config) {
    return;
  }

  if (config.provider === "local_index") {
    return;
  }

  if (config.provider === "elastic") {
    await fetch(
      `${config.url}/${config.index}/_doc/${encodeURIComponent(document.id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `ApiKey ${config.apiKey}` } : {})
        },
        body: JSON.stringify(document)
      }
    );
    return;
  }

  await fetch(`${config.url}/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`
    },
    body: JSON.stringify([
      {
        id: document.id,
        data: document.body,
        metadata: {
          title: document.title,
          path: document.path,
          excerpt: document.excerpt,
          category: document.category
        }
      }
    ])
  });
}
