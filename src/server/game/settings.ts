import type { Room } from "@server/game/types";
type Settings = Room["settings"];

function setSetting<K extends keyof Settings>(
  room: Room,
  key: K,
  value: Settings[K],
) {
  room.settings[key] = value;
}

export function applySettings(
  room: Room,
  patch: Partial<Settings>,
): (keyof Settings)[] {
  const changed: (keyof Settings)[] = [];
  const keys = Object.keys(patch) as Array<keyof Settings>;

  for (const k of keys) {
    const next = patch[k];
    if (next === undefined) continue;

    const prev = room.settings[k];
    const isDifferent =
      typeof next === "object" && next !== null
        ? JSON.stringify(prev) !== JSON.stringify(next)
        : prev !== next;

    if (isDifferent) {
      setSetting(room, k, next);
      changed.push(k);
    }
  }

  return changed;
}
