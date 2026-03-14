import { loadConfig } from "@/lib/config";

export function isOwner(authorId: string): boolean {
  const config = loadConfig();
  return config.trust.trust.owner_ids.includes(authorId);
}

export function unknownUserMessage(): string {
  return "Unknown user. Contact the owner for access.";
}
