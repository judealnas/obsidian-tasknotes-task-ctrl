// Native TaskNotes public-API contract probe. Start only with npm run uat:start.
// Leaves uniquely named disposable fixture notes for inspection; touches no other tasks or settings.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cdp = fileURLToPath(new URL("./cdp.mjs", import.meta.url));
const expression = String.raw`(async () => {
 const api = app.plugins.getPlugin("tasknotes").api;
 await api.lifecycle.ready();
 const run = "P7-contract-" + Date.now();
 const ctx = { source: "timer-pane-phase7-contract", reason: "disposable native fixture probe", correlationId: run };
 const result = { run, at: new Date().toISOString(), version: app.plugins.getPlugin("tasknotes").manifest.version, apiVersion: api.apiVersion,
  capabilities: api.capabilities, recurringMethods: Object.keys(api.recurring), cases: [], fixturePaths: [] };
 const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
 const snapshot = async path => {
  const file = app.vault.getAbstractFileByPath(path);
  return { task: await api.tasks.get(path), raw: file ? await app.vault.read(file) : null };
 };
 const ownTasks = async () => (await api.tasks.list()).filter(task => task.title?.includes(run));
 const create = async (label, fields = {}) => {
  const task = await api.tasks.create({ title: run + "-" + label, status: "open", recurrence: "FREQ=WEEKLY;BYDAY=MO", scheduled: "2026-11-09", ...fields }, ctx);
  result.fixturePaths.push(task.path);
  await api.tasks.update(task.path, { staged: "2026-11-14" }, ctx);
  await wait(250);
  return task;
 };
 const step = async (name, action) => {
  try { result.cases.push({ name, ...(await action()) }); }
  catch (error) { result.cases.push({ name, error: String(error), code: error?.code }); }
 };
 await step("virtual-exact-and-repeat", async () => {
  const t = await create("exact"); const before = await snapshot(t.path);
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-09", ctx);
  const after = await snapshot(t.path);
  const repeatedReturn = await api.recurring.toggleCompleteInstance(t.path, "2026-11-09", ctx);
  return { requestedDate: "2026-11-09", before, returned, after, repeatedReturn, afterRepeat: await snapshot(t.path) };
 });
 await step("virtual-off-schedule-and-repeat", async () => {
  const t = await create("off-schedule"); const before = await snapshot(t.path);
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx); const after = await snapshot(t.path);
  const repeatedReturn = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
  return { requestedDate: "2026-11-14", before, returned, after, repeatedReturn, afterRepeat: await snapshot(t.path) };
 });
 await step("completion-anchor", async () => {
  const t = await create("completion-anchor", { recurrence: "FREQ=DAILY;INTERVAL=2", recurrence_anchor: "completion" });
  const before = await snapshot(t.path); const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
  return { before, returned, after: await snapshot(t.path) };
 });
 await step("existing-materialized-undone-and-done", async () => {
  const t = await create("existing", { occurrence_materialization: "manual" });
  const materialized = await api.recurring.materializeOccurrence(t.path, "2026-11-09", ctx);
  await wait(250);
  const before = { parent: await snapshot(t.path), occurrence: await snapshot(materialized.path) };
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-09", ctx);
  await wait(250);
  const after = { parent: await snapshot(t.path), occurrence: await snapshot(materialized.path) };
  const repeatedReturn = await api.recurring.toggleCompleteInstance(t.path, "2026-11-09", ctx);
  return { materialized, before, returned, after, repeatedReturn, afterRepeat: { parent: await snapshot(t.path), occurrence: await snapshot(materialized.path) } };
 });
 await step("automatic-materialization-new-next", async () => {
  const t = await create("auto", { occurrence_materialization: "on_completion" });
  const before = await snapshot(t.path); const beforePaths = new Set((await ownTasks()).map(t => t.path));
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
  await wait(350);
  const created = (await ownTasks()).filter(t => !beforePaths.has(t.path));
  return { before, returned, after: await snapshot(t.path), created: await Promise.all(created.map(t => snapshot(t.path))) };
 });
 await step("automatic-materialization-existing-explicitly-staged-next", async () => {
  const t = await create("existing-next", { occurrence_materialization: "on_completion" });
  const next = await api.recurring.materializeOccurrence(t.path, "2026-11-16", ctx);
  await api.tasks.update(next.path, { staged: "2026-11-17" }, ctx);
  const before = { parent: await snapshot(t.path), next: await snapshot(next.path) };
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
  await wait(350);
  return { before, returned, after: { parent: await snapshot(t.path), next: await snapshot(next.path) } };
 });
 await step("public-materialization-off-schedule-target", async () => {
  const t = await create("off-schedule-materialize", { occurrence_materialization: "manual" });
  const before = await snapshot(t.path); const returned = await api.recurring.materializeOccurrence(t.path, "2026-11-14", ctx);
  return { requestedDate: "2026-11-14", before, returned, after: await snapshot(t.path), occurrence: await snapshot(returned.path) };
 });
 result.autoStopSettings = Object.fromEntries(Object.entries(api.settings.snapshot()).filter(([key]) => /auto.*stop|stop.*complet/i.test(key)));
 await step("regular-timing-public-completion-side-effect", async () => {
  const t = await create("regular-timing"); await api.time.start(t.path, {}, ctx);
  const before = await snapshot(t.path);
  const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
  await wait(500);
  const after = await snapshot(t.path);
  const active = (await api.time.active()).filter(e => e.taskPath === t.path);
  if (active.length) await api.time.stop(t.path, ctx);
  return { before, returned, after, activeAfter: active };
 });
 await step("active-pomodoro-completion-side-effect", async () => {
  const original = await api.pomodoro.status();
  if (original.isRunning || original.currentSession) return { skipped: "Existing Pomodoro state was left untouched" };
  const t = await create("pomodoro");
  try {
   await api.pomodoro.start({ taskPath: t.path, duration: 25 }, ctx);
   await wait(250);
   const before = { task: await snapshot(t.path), pomodoro: await api.pomodoro.status(), active: (await api.time.active()).filter(e => e.taskPath === t.path) };
   const returned = await api.recurring.toggleCompleteInstance(t.path, "2026-11-14", ctx);
   await wait(500);
   return { before, returned, after: { task: await snapshot(t.path), pomodoro: await api.pomodoro.status(), active: (await api.time.active()).filter(e => e.taskPath === t.path) } };
  } finally {
   const current = await api.pomodoro.status();
   if (current.currentSession?.taskPath === t.path) await api.pomodoro.stop(ctx);
   if ((await api.time.active()).some(e => e.taskPath === t.path)) await api.time.stop(t.path, ctx);
  }
 });
 await step("ordinary-card-controller-callback", async () => {
  const t = await create("ordinary-callback", { recurrence: "" });
  await api.time.start(t.path, {}, ctx);
  await app.commands.executeCommandById("tasknotes-timer-pane:open-timer-pane");
  await wait(250);
  const view = app.workspace.getLeavesOfType("tasknotes-timer-pane")[0]?.view;
  if (!view?.services?.completion) throw new Error("The new completion build is not loaded");
  const before = await snapshot(t.path);
  const outcome = await view.services.controller.complete({ taskPath: t.path, title: t.title });
  return { before, outcome, after: await snapshot(t.path), busyAfter: view.services.controller.isBusy() };
 });
 result.fixtures = await Promise.all((await ownTasks()).map(t => snapshot(t.path)));
 return result;
})()`;
const response = spawnSync(process.execPath, [cdp, "eval", "--expr", expression], { encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
if (response.status !== 0) throw new Error(response.stderr || response.stdout || "CDP contract probe failed");
const result = JSON.parse(response.stdout);
const output = new URL("../../.planning/phases/07-complete-roll-over-release-0-3-0/07-contract-native.json", import.meta.url);
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ run: result.run, version: result.version, cases: result.cases.map(c => ({ name: c.name, error: c.error })), output: fileURLToPath(output) }, null, 2));
