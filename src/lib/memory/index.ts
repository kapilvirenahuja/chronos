import { loadConfig } from "@/lib/config";
import type { MemoryAdapter } from "@/lib/memory/adapter";
import { BlobMemoryAdapter } from "@/lib/memory/blob-adapter";
import { LocalMemoryAdapter } from "@/lib/memory/local-adapter";

export function getMemoryAdapter(): MemoryAdapter {
  const config = loadConfig();
  const layer1Type = config.memory.memory.layer1.type;

  if (layer1Type === "local") {
    return new LocalMemoryAdapter();
  }

  if (layer1Type === "blob") {
    return new BlobMemoryAdapter();
  }

  throw new Error(
    `Memory adapter for layer1.type="${layer1Type}" is not implemented yet.`
  );
}
