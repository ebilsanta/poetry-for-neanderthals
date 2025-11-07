export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}
export function nowMs(): number {
  return Date.now();
}
