import type { CaptureLogEntry, MemorySearchResult } from "@/lib/types";

export interface MemoryWriteResult {
  libraryId: string;
  path: string;
}

export interface MemoryAdapter {
  search(query: string, limit?: number): Promise<MemorySearchResult[]>;
  write(input: {
    capture: CaptureLogEntry;
    category: string;
    related: MemorySearchResult[];
    note?: string;
  }): Promise<MemoryWriteResult>;
}
