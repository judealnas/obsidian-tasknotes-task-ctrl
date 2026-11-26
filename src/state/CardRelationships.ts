import { normalizeTimerPath } from "../model/pomodoroOwnership";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

export interface CardRelationshipSnapshot {
 parents: TaskInfo[];
 subtasks: TaskInfo[];
 /** Null means the status catalog could not be read; do not infer completion. */
 completedStatuses: readonly string[] | null;
}
type Listener = (snapshot: CardRelationshipSnapshot | null) => void;
export interface CardRelationshipSource {
 subscribe(path: string, listener: Listener): () => void;
}
interface Entry {
 listeners: Set<Listener>;
 snapshot: CardRelationshipSnapshot | null;
 generation: number;
}

/** One shared read per visible task, at most four card reads in flight. No timer polling. */
export class CardRelationships implements CardRelationshipSource {
 private entries = new Map<string, Entry>();
 private generation = 0;
 private active = 0;
 private queued: Array<() => void> = [];
 private scheduled = false;
 private disposed = false;
 private statuses: Promise<readonly string[] | null> | null = null;
 private offs: Array<() => void>;

 constructor(private readonly gateway: TaskNotesGateway) {
  this.offs = [gateway.onData(() => this.refresh()), gateway.onState(() => this.refresh())];
 }

 subscribe(path: string, listener: Listener): () => void {
  if (this.disposed) { listener(null); return () => {}; }
  const key = normalizeTimerPath(path);
  let entry = this.entries.get(key);
  if (!entry) {
   entry = { listeners: new Set(), snapshot: null, generation: -1 };
   this.entries.set(key, entry);
  }
  entry.listeners.add(listener);
  listener(entry.snapshot);
  this.request(key, entry);
  return () => {
   entry.listeners.delete(listener);
   if (!entry.listeners.size && this.entries.get(key) === entry) this.entries.delete(key);
  };
 }

 /** Invalidate synchronously, then coalesce bursts of TaskNotes changes into one read batch. */
 refresh(): void {
  if (this.disposed) return;
  this.generation++;
  this.queued = [];
  this.statuses = null;
  for (const entry of this.entries.values()) {
   entry.snapshot = null;
   for (const listener of entry.listeners) listener(null);
  }
  if (this.scheduled) return;
  this.scheduled = true;
  void Promise.resolve().then(() => {
   this.scheduled = false;
   if (this.disposed) return;
   for (const [path, entry] of this.entries) this.request(path, entry);
  });
 }

 dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  this.generation++;
  for (const off of this.offs) off();
  this.offs = [];
  this.queued = [];
  this.entries.clear();
  this.statuses = null;
 }

 private request(path: string, entry: Entry): void {
  if (this.disposed || this.gateway.getState().kind !== "ready" || entry.generation === this.generation) return;
  const generation = this.generation;
  entry.generation = generation;
  this.queued.push(() => {
   if (this.entries.get(path) !== entry || !entry.listeners.size || generation !== this.generation) return;
   this.active++;
   this.statuses ??= Promise.resolve().then(() => this.gateway.statuses())
    .then(statuses => statuses.filter(status => status.isCompleted).map(status => status.value)).catch(() => null);
   const read = (method: ((path: string) => Promise<TaskInfo[]>) | undefined) =>
    Promise.resolve().then(() => method?.call(this.gateway, path) ?? []).catch(() => [] as TaskInfo[]);
   void Promise.all([read(this.gateway.parents?.bind(this.gateway)), read(this.gateway.subtasks?.bind(this.gateway)), this.statuses]).then(([parents, subtasks, completedStatuses]) => {
    if (this.disposed || generation !== this.generation || this.entries.get(path) !== entry) return;
    entry.snapshot = { parents: this.unique(parents, path), subtasks: this.unique(subtasks, path), completedStatuses };
    for (const listener of entry.listeners) listener(entry.snapshot);
   }).finally(() => { this.active--; this.pump(); });
  });
  this.pump();
 }

 private unique(tasks: TaskInfo[], sourcePath: string): TaskInfo[] {
  const byPath = new Map<string, TaskInfo>();
  for (const task of tasks) {
   const path = normalizeTimerPath(task.path);
   if (path && path !== sourcePath) byPath.set(path, task);
  }
  return [...byPath.values()];
 }

 private pump(): void {
  while (!this.disposed && this.active < 4 && this.queued.length) this.queued.shift()!();
 }
}

