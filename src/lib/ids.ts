export function makeId(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const entropy = crypto.randomUUID().slice(0, 8);
  return `${prefix}-${stamp}-${entropy}`;
}
