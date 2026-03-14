import fs from "node:fs";
import path from "node:path";

export function projectRoot(): string {
  return process.cwd();
}

export function resolveFromRoot(...parts: string[]): string {
  return path.resolve(projectRoot(), ...parts);
}

export function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

export function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
