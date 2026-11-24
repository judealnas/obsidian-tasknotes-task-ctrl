import type { TaskInfo, TaskPriority, TaskStatus } from "../tasknotes/runtime-api.types";

/** Neutral fallback for untrusted catalog colors; never interpret arbitrary CSS. */
export function pickerColor(color: unknown): string | null {
 return typeof color === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : null;
}
/** Display-only layout inspired by TaskNotes TaskSelectorWithCreateModal at
 * a2414b67be2ce742f50f657f71098eeb2e80311b. MIT: THIRD_PARTY_NOTICES.md.
 * No MarkdownRenderer, links, nested controls, or TaskNotes internal renderer. */
export function renderTaskPickerRow(task: TaskInfo, el: HTMLElement, statuses: readonly TaskStatus[], priorities: readonly TaskPriority[]): HTMLElement {
 el.addClass("tntp-picker-row");
 el.createDiv({ cls: "tntp-picker-title", text: task.title });
 const metadata = el.createDiv({ cls: "tntp-picker-metadata" });
 const chip = (text: string, label: string) => metadata.createSpan({ cls: "tntp-picker-meta", text, attr: { "aria-label": label } });
 const status = statuses.find(value => value.value === task.status);
 chip(status?.label || task.status, `Status: ${status?.label || task.status}`);
 if (task.priority) {
  const priority = priorities.find(value => value.value === task.priority);
  const node = chip(priority?.label || task.priority, `Priority: ${priority?.label || task.priority}`);
  const color = pickerColor(priority?.color);
  if (color) node.style.setProperty("--tntp-picker-priority", color);
 }
 for (const context of task.contexts ?? []) chip(`@${context}`, `Context: ${context}`);
 for (const tag of task.tags ?? []) chip(`#${tag.replace(/^#/, "")}`, `Tag: ${tag}`);
 for (const project of task.projects ?? []) chip(project.replace(/^\[\[|\]\]$/g, ""), `Project: ${project}`);
 if (task.due) chip(`Due ${task.due}`, `Due: ${task.due}`);
 if (task.scheduled) chip(`Scheduled ${task.scheduled}`, `Scheduled: ${task.scheduled}`);
 return metadata;
}
