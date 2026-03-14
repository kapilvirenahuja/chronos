import fs from "node:fs";

import { resolveFromRoot } from "@/lib/utils";

export interface SystemLayer {
  soul: string;
  rules: string;
  user: string;
  memory: string;
  heartbeat: string;
}

let cache: SystemLayer | null = null;

export function loadSystemLayer(): SystemLayer {
  if (cache) {
    return cache;
  }

  cache = {
    soul: fs.readFileSync(resolveFromRoot("system/SOUL.md"), "utf8"),
    rules: fs.readFileSync(resolveFromRoot("system/RULES.md"), "utf8"),
    user: fs.readFileSync(resolveFromRoot("system/USER.md"), "utf8"),
    memory: fs.readFileSync(resolveFromRoot("system/MEMORY.md"), "utf8"),
    heartbeat: fs.readFileSync(resolveFromRoot("system/HEARTBEAT.md"), "utf8")
  };

  return cache;
}
