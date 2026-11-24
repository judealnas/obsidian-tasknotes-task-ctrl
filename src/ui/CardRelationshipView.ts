import { Keymap, type App } from "obsidian";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import type { CardRelationshipSnapshot, CardRelationshipSource } from "../state/CardRelationships";

/** Read-only note navigation; native details retains keyboard and expansion behavior. */
export class CardRelationshipView {
 private readonly root: HTMLElement;
 private readonly parents: HTMLElement;
 private readonly details: HTMLDetailsElement;
 private readonly summary: HTMLElement;
 private readonly list: HTMLElement;
 private path: string | null = null;
 private unsubscribe?: () => void;
 private generation = 0;
 private signature = "";
 private disposed = false;

 constructor(parent: HTMLElement, private readonly app: App, private readonly source?: CardRelationshipSource) {
  this.root = parent.createDiv({ cls: "tntp-relationships tntp-relationships--empty" });
  this.parents = this.root.createDiv({ cls: "tntp-relationships__parents" });
  this.details = this.root.createEl("details", { cls: "tntp-relationships__subtasks" });
  this.summary = this.details.createEl("summary");
  this.list = this.details.createEl("ul", { cls: "tntp-relationships__list" });
 }

 update(path: string): void {
  if (this.disposed || this.path === path) return;
  const generation = ++this.generation;
  this.unsubscribe?.();
  this.path = path;
  this.details.removeAttribute("open");
  this.signature = "";
  this.render(null);
  this.unsubscribe = this.source?.subscribe(path, snapshot => {
   if (!this.disposed && generation === this.generation) this.render(snapshot);
  });
 }

 dispose(): void {
  this.disposed = true;
  this.generation++;
  this.unsubscribe?.();
  this.root.detach();
 }

 private render(snapshot: CardRelationshipSnapshot | null): void {
  const signature = JSON.stringify(snapshot && {
   parents: snapshot.parents.map(task => [task.path, task.title]),
   subtasks: snapshot.subtasks.map(task => [task.path, task.title, task.status]),
   completedStatuses: snapshot.completedStatuses,
  });
  if (signature === this.signature) return;
  this.signature = signature;
  const parents = snapshot?.parents ?? [];
  const subtasks = snapshot?.subtasks ?? [];
  this.root.toggleClass("tntp-relationships--empty", !parents.length && !subtasks.length);
  this.parents.empty();
  if (parents.length) {
   this.parents.createSpan({ text: parents.length === 1 ? "Parent: " : "Parents: " });
   parents.forEach((task, index) => {
    if (index) this.parents.createSpan({ text: ", " });
    this.link(this.parents, task);
   });
  }
  this.details.toggleClass("tntp-relationships--empty", !subtasks.length);
  const completed = new Set(snapshot?.completedStatuses);
  const statusesKnown = snapshot?.completedStatuses != null;
  this.summary.setText(statusesKnown ? `Subtasks · ${subtasks.filter(task => completed.has(task.status)).length} of ${subtasks.length} complete` : `Subtasks · ${subtasks.length}`);
  this.list.empty();
  for (const task of subtasks) {
   const row = this.list.createEl("li");
   row.createSpan({ cls: "tntp-relationships__status", text: statusesKnown ? completed.has(task.status) ? "✓" : "○" : "•", attr: { "aria-hidden": "true" } });
   row.createSpan({ cls: "tntp-visually-hidden", text: `${statusesKnown ? completed.has(task.status) ? "Complete" : "Incomplete" : task.status}: ` });
   this.link(row, task);
  }
 }

 private link(parent: HTMLElement, task: TaskInfo): void {
  const sourcePath = this.path ?? "";
  const link = parent.createEl("a", { cls: "internal-link tntp-relationships__link", text: task.title || task.path, attr: { href: task.path, "data-href": task.path } });
  link.addEventListener("click", event => {
   event.preventDefault();
   event.stopPropagation();
   if (!this.disposed && this.path === sourcePath) void this.app.workspace.openLinkText(task.path, sourcePath, Keymap.isModEvent(event)).catch((error: unknown) => console.error("TaskNotes Task Control: could not open related task", error));
  });
 }
}
