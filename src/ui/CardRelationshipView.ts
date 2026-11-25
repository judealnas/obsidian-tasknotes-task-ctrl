import type { App } from "obsidian";
import { taskDisplayKey } from "../model/timeMath";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskInfo } from "../tasknotes/runtime-api.types";
import type { CardRelationshipSnapshot, CardRelationshipSource } from "../state/CardRelationships";
import { TaskTitle } from "./TaskTitle";

interface CardRelationshipOptions {
 app: App;
 gateway: Pick<TaskNotesGateway, "showTaskMenu">;
 source?: CardRelationshipSource;
 onSnapshot?: (snapshot: CardRelationshipSnapshot) => void;
}

/** Task links and their render owners within the card's native disclosure. */
export class CardRelationshipView {
 private readonly root: HTMLElement;
 private readonly parents: HTMLElement;
 private readonly details: HTMLDetailsElement;
 private readonly summary: HTMLElement;
 private readonly list: HTMLElement;
 private readonly links: TaskTitle[] = [];
 private path: string | null = null;
 private unsubscribe?: () => void;
 private generation = 0;
 private signature = "";
 private disposed = false;

 constructor(parent: HTMLElement, private readonly options: CardRelationshipOptions) {
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
  this.unsubscribe = this.options.source?.subscribe(path, snapshot => {
   if (this.disposed || generation !== this.generation) return;
   this.render(snapshot);
   if (snapshot) this.options.onSnapshot?.(snapshot);
  });
 }

 dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  this.generation++;
  this.unsubscribe?.();
  this.clearLinks();
  this.root.detach();
 }

 private render(snapshot: CardRelationshipSnapshot | null): void {
  const signature = JSON.stringify(snapshot && {
   parents: snapshot.parents.map(taskDisplayKey),
   subtasks: snapshot.subtasks.map(taskDisplayKey),
   completedStatuses: snapshot.completedStatuses,
  });
  if (signature === this.signature) return;
  this.signature = signature;
  this.clearLinks();
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
   this.link(row, task);
  }
 }

 private link(parent: HTMLElement, task: TaskInfo): void {
  this.links.push(new TaskTitle(parent, { taskPath: task.path, title: task.title || task.path, displayKey: "" }, {
   app: this.options.app,
   gateway: this.options.gateway,
   relationship: { sourcePath: this.path ?? "" },
  }));
 }

 private clearLinks(): void {
  for (const link of this.links.splice(0)) link.dispose();
 }
}
