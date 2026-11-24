import { normalizeTimerPath } from "../model/pomodoroOwnership";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

/** Opening-scoped, non-recursive summaries. Four requests and 100 cached parents maximum. */
export class TaskPickerRelationships {
 private generation = 0;
 private active = 0;
 private cache = new Map<string, TaskInfo[] | null>();
 private queued: Array<() => void> = [];
 private pending = new Set<string>();
 constructor(private readonly read: ((path: string) => Promise<TaskInfo[]>) | undefined) {}
 reset(clear = false): void { this.generation++; this.queued = []; this.pending.clear(); if (clear) this.cache.clear(); }
 request(path: string, show: (tasks: TaskInfo[]) => void): void {
  if (!this.read) return;
  const key = normalizeTimerPath(path);
  const cached = this.cache.get(key);
  if (cached !== undefined) { if (cached) show(cached); return; }
  if (this.pending.has(key)) return;
  this.pending.add(key);
  const generation = this.generation;
  this.queued.push(() => {
   this.active++;
   void this.read!(path).then(tasks => {
    if (generation !== this.generation) return;
    this.remember(key, tasks); show(tasks);
   }).catch(() => { if (generation === this.generation) this.remember(key, null); }).finally(() => {
    this.active--; if (generation === this.generation) this.pending.delete(key); this.pump();
   });
  });
  this.pump();
 }
 private remember(key: string, value: TaskInfo[] | null): void {
  if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
  this.cache.set(key, value);
 }
 private pump(): void { while (this.active < 4 && this.queued.length) this.queued.shift()!(); }
}
