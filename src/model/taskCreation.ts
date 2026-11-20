import type { ParsedTaskData, TaskCreationData, TaskNotesUserField } from "../tasknotes/runtime-api.types";

// Adapted from TaskNotes buildTaskCreationDataFromParsed/dateUtils/helpers at
// a2414b67be2ce742f50f657f71098eeb2e80311b (MIT; THIRD_PARTY_NOTICES.md).
// Defaults deliberately remain with public tasks.create, using its api context.
export function creationDate(date: string, time?: string): string {
 const day = /^(\d{4}-\d{2}-\d{2})/.exec(date)?.[1];
 return day && time && /^\d{2}:\d{2}$/.test(time) ? `${day}T${time}` : date;
}
export function ambiguousTitle(parsed: ParsedTaskData): boolean {
 return !parsed.title?.trim() || parsed.title.trim().toLowerCase() === "untitled task";
}
export function buildTaskCreation(parsed: ParsedTaskData, title: string, fields: readonly TaskNotesUserField[] | null): TaskCreationData {
 if (!title.trim()) throw new Error("Enter a task title");
 const result: TaskCreationData = { title: title.trim() };
 for (const key of ["status", "priority", "details", "recurrence"] as const) {
  if (typeof parsed[key] === "string" && parsed[key].trim()) result[key] = parsed[key];
 }
 if (parsed.dueDate) result.due = creationDate(parsed.dueDate, parsed.dueTime);
 if (parsed.scheduledDate) result.scheduled = creationDate(parsed.scheduledDate, parsed.scheduledTime);
 for (const key of ["contexts", "projects"] as const) if (parsed[key]?.length) result[key] = [...parsed[key]];
 if (parsed.tags?.length) {
  const tags = parsed.tags.map(tag => tag.split(",").map(value => value.trim().replace(/^#/, "").trim().replace(/\s+/g, "-")).filter(Boolean).join(", ")).filter(Boolean);
  if (tags.length) result.tags = tags;
 }
 if (typeof parsed.estimate === "number" && Number.isFinite(parsed.estimate) && parsed.estimate > 0) result.timeEstimate = parsed.estimate;
 if (parsed.userFields && Object.keys(parsed.userFields).length) {
  const custom: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [id, value] of Object.entries(parsed.userFields)) {
   const field = fields?.find(item => item.id === id);
   if (!field?.key) throw new Error(`Cannot map custom field ${id}. TaskNotes must expose its registered user fields before creation.`);
   custom[field.key] = Array.isArray(value) ? value.join(", ") : value;
  }
  result.customFrontmatter = custom;
 }
 return result;
}
