import { normalizeTimerPath } from "./pomodoroOwnership";
import type { CardRelationshipSnapshot } from "../state/CardRelationships";

/** Use both directions of the available TaskNotes snapshots to find staged ancestors. */
export function stagedHierarchy(
 paths: readonly string[],
 snapshots: ReadonlyMap<string, CardRelationshipSnapshot>,
): Map<string, string> {
 const staged = new Set(paths);
 const parents = new Map<string, Set<string>>();
 const add = (child: string, parent: string) => {
  if (!child || !parent || child === parent) return;
  let candidates = parents.get(child);
  if (!candidates) parents.set(child, candidates = new Set());
  candidates.add(parent);
 };
 const direct = (path: string) => [...(parents.get(path) ?? [])].sort();
 for (const path of paths) {
  const snapshot = snapshots.get(path);
  if (!snapshot) continue;
  for (const parent of snapshot.parents) add(path, normalizeTimerPath(parent.path));
  for (const child of snapshot.subtasks) add(normalizeTimerPath(child.path), path);
 }

 const hierarchy = new Map<string, string>();
 for (const path of [...staged].sort()) {
  const seen = new Set([path]);
  const pending = direct(path);
  for (const parent of pending) {
   if (seen.has(parent)) continue;
   seen.add(parent);
   if (!staged.has(parent)) {
    pending.push(...direct(parent));
    continue;
   }
   let ancestor: string | undefined = parent;
   while (ancestor !== undefined && ancestor !== path) ancestor = hierarchy.get(ancestor);
   if (ancestor === path) continue;
   hierarchy.set(path, parent);
   break;
  }
 }
 return hierarchy;
}
