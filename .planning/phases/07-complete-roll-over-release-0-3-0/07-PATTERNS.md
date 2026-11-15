# Phase 7: Complete, Roll Over & Release 0.3.0 - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 40 proposed new/modified files (grouped below)
**Analog coverage:** 38 files have exact or role matches; 2 have partial matches only.

This map covers CONTEXT and RESEARCH implementation seams. New filenames are proposals for the planner, not established contracts. Source inspection only: no tests or native probes were run for this artifact. Existing tests are examples, not proof of proposed behavior. No root AGENTS.md or project skill directories were present; user-supplied instructions apply. No existing Graphify graph was found. All existing source/test/config paths named below were verified by nonempty `git ls-files` output from the project root; no runtime installation mirrors are analogs.

## File Classification

Each path in a grouped row receives that row's role, flow and assignment. “Exact” describes the existing module's role/flow, not an assertion that Phase 7 behavior already exists.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/model/completionLedger.ts` (new) | model | transform, file-I/O | `src/model/pauseLedger.ts` | role-match |
| `src/state/CompletionStore.ts` (new) | store | file-I/O, event-driven | `src/state/PauseStore.ts` | role-match |
| `src/state/CompletionController.ts` (new) | controller | request-response | `src/state/TimerController.ts` | role-match |
| `src/model/doneToday.ts` (new) | model | transform | `src/model/staging.ts` | role-match |
| `src/ui/DoneTodayList.ts` (new, optional extraction) | component | event-driven | `src/ui/TaskCard.ts` | partial: title behavior only |
| `src/ui/TaskTitle.ts` (new, optional shared extraction) | component | event-driven | `src/ui/TaskCard.ts` | role-match |
| `src/state/TimerController.ts` | controller | request-response | same file | exact |
| `src/state/StagingStore.ts` | store | event-driven, transform | same file | exact |
| `src/model/staging.ts`, `src/model/stagingDay.ts` | model | transform | same files | exact |
| `src/tasknotes/TaskNotesBridge.ts` | service | request-response | same file | exact |
| `src/tasknotes/runtime-api.types.ts` | model | request-response | same file | exact |
| `src/ui/TimerPaneView.ts`, `src/ui/TaskCard.ts`, `src/ui/CardList.ts` | component | event-driven | same files | exact |
| `src/model/cardOrder.ts` | utility | transform | same file | exact |
| `src/main.ts` | provider | event-driven, file-I/O | same file | exact |
| `styles.css` | config | transform | same file | exact |
| `tests/completionLedger.test.ts` (new) | test | transform | `tests/pauseLedger.test.ts` | role-match |
| `tests/completionStore.test.ts` (new) | test | file-I/O | `tests/pauseStore.test.ts` | role-match |
| `tests/completionController.test.ts` (new) | test | request-response | `tests/controller.test.ts` | role-match |
| `tests/doneToday.test.ts` (new) | test | transform | `tests/staging.test.ts` | role-match |
| `tests/bridge.test.ts`, `tests/contract.test.ts` | test | request-response | same files | exact |
| `tests/stagingStore.test.ts`, `tests/stagingDay.test.ts`, `tests/timerPaneView.test.ts` | test | event-driven | same files | exact |
| `tests/cardList.test.ts`, `tests/taskCard.test.ts`, `tests/main.test.ts` | test | event-driven | same files | exact |
| `tests/fakes/fakeGateway.ts`, `tests/fakes/fakeTaskNotes.ts` | utility | request-response | same files | exact |
| `tests/fakes/viewHost.ts` | utility | event-driven | same file | exact |
| `manifest.json`, `package.json`, `package-lock.json`, `versions.json` | config | file-I/O | same files | exact |
| `version-bump.mjs`, `.github/workflows/release.yml` | config | batch, file-I/O | same files | exact |
| `README.md` | config (documentation) | batch | same file | partial: release copy |

Coverage counts: 29 exact, 9 role-match, 2 partial. A separate Done today store is unnecessary if CompletionStore and StagingStore own records and projection; if selected, map it to StagingStore below. Existing order stores are integration dependencies; edit them only if the chosen move API requires it.

## Pattern Assignments

### Completion ledger and local store

**Applies to:** new `completionLedger.ts`, `CompletionStore.ts`, and their tests.
**Primary analog:** `src/state/PauseStore.ts`; model companion `src/model/pauseLedger.ts`.

Imports are relative; use `import type` for contracts and keep model/store runtime code independent of Obsidian. `pauseLedger.ts:10-14`:

```typescript
import { normalizeTimerPath, sameEntry, type Ownership } from "./pomodoroOwnership";
import { parseMs, sessionMs } from "./timeMath";
import type { ActiveTimeEntry, TaskInfo } from "../tasknotes/runtime-api.types";

export const PAUSE_RECORDS_VERSION = 1;
```

Versioned defensive loading, `pauseLedger.ts:131-139`:

```typescript
export function loadPauseRecords(data: unknown): PauseRecord[] {
  if (!plainRecord(data) || data.pauseRecordsVersion !== PAUSE_RECORDS_VERSION || !Array.isArray(data.pauseRecords)) return [];
  const items = (data.pauseRecords as unknown[]).slice(0, MAX_STORED_RECORDS);
  const byPath = new Map<string, PauseRecord>();
  for (const item of items) {
    const record = parseStoredRecord(item);
    if (record === null) continue;
    const existing = byPath.get(record.taskPath);
    if (existing && newnessMs(existing) > newnessMs(record)) continue;
```

Copy per-item validation (`pauseLedger.ts:89-115`), normalized identities, explicit versions, and startup readiness (`PauseStore.ts:56-79`). Do **not** copy path-only deduplication: completion needs source identity, request staging day, resolved occurrence and actual completed path. Do not silently evict unresolved safety intent under an observation/display cap.

Snapshot/subscription/serialization, `PauseStore.ts:155-164`:

```typescript
serialize(): PauseRecord[] {
  return this.records().map(record => ({ ...record }));
}
subscribe(listener: () => void): () => void {
  this.listeners.add(listener);
  return () => {
    this.listeners.delete(listener);
  };
}
```

**Critical difference:** `PauseStore.ts:191-199` catches persistence rejection and logs it. This is suitable for its existing UI recovery, but not a durable pre-mutation intent barrier. CompletionStore must expose a promise whose failure reaches the coordinator; mutation must abort if intent saving fails. Keep visible Done today records separate from durable attempts and already-seen external evidence. Rollover clears visible membership, not unresolved replay protection.

**Integration:** construct one plugin-scoped store in main; await its loader; include it in the one persistence writer; share it across panes. Decide explicitly how source and materialized paths follow rename/delete using `PauseStore.ts:106-141` and main vault listeners as structural patterns. Never treat a stale missing list row as verified deletion.

### Shared completion coordinator and existing TimerController

**Applies to:** new `CompletionController.ts`, modified `TimerController.ts`, controller tests and gateway fakes.
**Primary analog:** `src/state/TimerController.ts:440-478`.

Copy action guard, shared queue and context structure (`440-453`):

```typescript
if (this.isBusy()) return "busy";
this.completing = true;
this.busy(1);
// ...
outcome = await queue.run(async (): Promise<CompleteOutcome> => {
  await this.deps.settingsReady?.();
  if (!gateway.completionAvailable()) return "unavailable";
  const status = resolveCompletionStatus(await gateway.statuses(), this.deps.getSettings?.().completionStatus ?? null);
  if (!status) return "unavailable";
  const context = { source: MUTATION_SOURCE, reason: "user complete", correlationId: newCorrelationId() };
```

Cleanup and feedback pattern (`467-478`):

```typescript
} catch {
  outcome = statusWritten ? "partial" : "failed";
  log(statusWritten ? "Task completed, but its timer could not be confirmed stopped." : "Completing the task failed.");
} finally {
  try { await store.refreshNow(); }
  catch { log("Refreshing timers after completion failed."); }
  finally { this.completing = false; this.busy(-1); }
}
if (outcome === "partial") this.notice("Task completed, but its timer could not be confirmed stopped. Check the timer in TaskNotes.");
else if (outcome === "failed") this.notice("Couldn't complete the task. Try again in TaskNotes.");
else if (outcome === "unavailable") this.notice("Complete is unavailable. Check TaskNotes and its completed statuses.");
```

Copy the quiet success and finally cleanup, adapting partial-state messages to confirmed progress. **Do not copy the current operation order**: existing line 454 completes before lines 459-463 inspect and stop timing. Phase 7 must check fresh ownership, persist intent, stop exact eligible regular entries, mutate once, retain returned identity, confirm evidence, persist progress, then clear scoped staged fields. Protect against indirect Pomodoro stops caused by completion itself. Ambiguous prior attempts require reconciliation, never blind replay.

**Integration:** one coordinator for both tabs; allow staged idle tasks without inventing a startTime. Existing TimerController completion can delegate. Share the original main WriteQueue, busy authority and readiness; do not queue a coordinator body inside another queued body. Refresh both projections in finally while reliably releasing busy state. Local queue serialization does not prevent external TaskNotes races or make two storage systems atomic.

### Bridge result preservation and contract types

**Applies to:** `TaskNotesBridge.ts`, `runtime-api.types.ts`, bridge/contract tests and both request fakes.
**Primary analog:** existing bridge wrappers and feature gates.

`TaskNotesBridge.ts:304-307` currently discards a result:

```typescript
async completeTask(path: string, status: string, context: TaskNotesMutationContext): Promise<void> {
  const api = this.featureApi("tasks.write", "tasks.complete", api => typeof api.tasks?.complete === "function");
  await api.tasks!.complete!(path, { status }, context);
}
```

`TaskNotesBridge.ts:348-353` preserves receiver and explicit date but also discards identity:

```typescript
async toggleCompleteInstance(path: string, date: string, context: TaskNotesMutationContext): Promise<void> {
  // An omitted date targets the scheduled date and a datetime can shift a day (research F11, F13).
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Recurring completion needs a YYYY-MM-DD day");
  const api = this.featureApi("recurring.write", "recurring.toggleCompleteInstance", api => typeof api.recurring?.toggleCompleteInstance === "function");
  // Called as a method so TaskNotes keeps its receiver; the echoed TaskInfo is dropped (Pitfall 1).
  await api.recurring!.toggleCompleteInstance(path, date, context);
```

Return the public TaskInfo/validated identity from these completion wrappers; update gateway signatures and fakes together. Keep `updateTask` echoes untrusted (`326-331`) for staged cleanup. Reuse reasoned feature gates (`310-345`) without making recurring capability a global timer prerequisite. Date shape is not date validity: reuse `parseStagedValue` for exact calendar validation where appropriate.

`runtime-api.types.ts:20-32` currently contains base fields through `timeEntries?: TimeEntry[]`; recurrence/completion/materialization fields must be deliberately added from the contract evidence task. Existing `tests/contract.test.ts:125-132,179-183` already asserts public completion methods return `Promise<TaskInfo>`. `tests/bridge.test.ts:62-73` verifies receiver binding and capability failure; `751-803` covers recurring explicit-day gates. Extend these to assert returned materialized identity and replacement/unload behavior. Fakes must model different returned paths and ambiguous throw-after-write cases, not only an in-memory day toggle.

### Done today projection, cached staging and rollover

**Applies to:** new `doneToday.ts`, modified `staging.ts`, `StagingStore.ts`, `stagingDay.ts` only if a helper is needed, and projection/store/day tests.
**Primary analog:** `src/state/StagingStore.ts`; pure helper companion `src/model/staging.ts`.

Parallel independent reads and stale-result rejection (`StagingStore.ts:106-111`):

```typescript
const [tasks, statuses, fields] = await Promise.allSettled([gateway.listTasks(), gateway.statuses(), gateway.userFields()]);
if (this.disposed || gateway.getState().kind !== "ready") return;
if (generation !== this.generation) { this.dirty = true; return; }
const field = fieldStatus(fields.status === "fulfilled" ? fields.value : null);
const good = tasks.status === "fulfilled" && Array.isArray(tasks.value) && statuses.status === "fulfilled" && Array.isArray(statuses.value);
```

Retain the last cards on failed reads and revoke action readiness; distinguish authoritative empty data from failure. Cache full successful tasks and completed statuses, not just currently unfinished cards, so Done today can observe external completion and local day transitions can rederive without upstream writes. Generation invalidation (`71-94`) is the existing protection for overlapping reads; include day/evidence revision in new derivations so old reads cannot repopulate yesterday.

Pure date and projection pattern (`staging.ts:32,38-45`):

```typescript
export function daysStaged(date: string, today: string): number { return Math.max(0, ordinal(today) - ordinal(date)); }
export function deriveStaged(tasks: readonly TaskInfo[], completed: ReadonlySet<string>, today: string): StagedItem[] {
  const result = new Map<string, StagedItem>();
  for (const task of tasks) {
    if (typeof task?.path !== "string") continue;
    const taskPath = normalizeTimerPath(task.path);
    const date = parseStagedValue(readStaged(task));
    if (!taskPath || !date || date > today || task.archived || completed.has(task.status) || result.has(taskPath)) continue;
    const age = daysStaged(date, today);
```

Reuse this pure caller-supplied-day design and real calendar age; do not increment a stored counter once per tick/wake. Extend exclusion with confirmed recurrence evidence. Done today sorts by confirmed/first-observed completion time, not Staged order. Preserve source staging membership after clearing; use materialized-note authority when available, remove reopened tasks, and never restamp the same evidence on refresh. Cold-start chronology from date-only data remains a research limitation.

`stagingDay.ts:39-46` is already DST-safe:

```typescript
export function stagingDay(nowMs: number, rolloverHour: number): string {
  if (!Number.isFinite(nowMs)) throw new RangeError("nowMs must be a finite number");
  const hour = isRolloverHour(rolloverHour) ? rolloverHour : DEFAULT_ROLLOVER_HOUR;
  let day = new Date(nowMs);
  if (day.getHours() < hour) {
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 12);
  }
  return `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
}
```

**Test pattern:** `tests/stagingStore.test.ts:7-16` injects `now`, a cancellable scheduler and fake gateway with fake timers. Lines 18-34 hold reads unresolved and assert retained cards/readiness/no writes; lines 43-53 invalidate a pending read. Extend for day changes, reopen, replay suppression, failed reads, late prior-day completion and multi-day sleep. Use existing staging/day tests for invalid dates and DST; these do not replace native overnight/sleep acceptance.

### Pane lifecycle, Done today rendering and shared title

**Applies to:** `TimerPaneView.ts`, `TaskCard.ts`, optional `TaskTitle.ts`/`DoneTodayList.ts`, view/title tests and viewHost.
**Primary analog:** existing view and card components.

`TimerPaneView.ts:213-234` registers subscriptions, interval, document visibility and window focus; reuse `register`/`registerDomEvent`/`registerInterval`, including pop-out `containerEl.doc` and `.win`. `242-253` disposes card lists and invalidates pending completion availability.

Day checking belongs before the hidden-DOM early return. Existing tick (`460-472`):

```typescript
const now = Date.now();
const { store } = this.services;
if (detectWakeGap(this.lastTickMs, now)) { store.requestRefresh(); this.services.staging?.requestRefresh(); }
this.lastTickMs = now;
const shown = this.contentEl.isShown();
if (shown && !this.wasShown) { store.requestRefresh(); this.services.staging?.requestRefresh(); }
this.wasShown = shown;
if (!shown) return;
this.writeTimes(now);
```

Add a shared/idempotent staging-day check on normal tick, focus, visibility and reveal; main settings save (`144-149`) must apply the new hour and immediately rederive even if an API read fails. Main's staging safety resync (`168`) is the existing plugin-scoped backstop when no pane is open. Preserve StagedOrderStore across day transitions; no TaskNotes writes or notices for rollover.

`TimerPaneView.ts:146-152` wires a keyed Staged CardList with path keys and its own order callback. `370-375` derives idle/running/paused staged models; update their completion availability rather than passing a fixed false. `TaskCard.ts:106-107,182-187` currently disables/refuses staged and idle completion; replace both gates together, retaining a visible disabled control with a reason when unsafe.

Title excerpts (`TaskCard.ts:234-240,255-260,270-285`):

```typescript
const markdown = taskWikilink(card.timer.taskPath);
const linkpath = taskLinkpath(card.timer.taskPath);
// ...
const component = this.addChild(new Component());
this.titleOwners.add(component);
const wrapper = createDiv({ cls: "tntp-title__md" });
const isCurrent = () => (this.disposed ? undefined : this.elements) === card && card.titleSeq === seq;
await MarkdownRenderer.render(this.app, markdown, wrapper, "", component);
// ...
if (!isCurrent()) {
  this.releaseTitle(component);
  return;
}
// ... matched plain link only:
link.setText(card.timer.title);
```

Extract/reuse title behavior rather than rendering timer controls into Done today and hiding them. Preserve path-only wikilink input, safe title text, async render generation checks and Component cleanup; existing TaskCard imports show the Obsidian/type import style (`1-4`). Preserve the current chip-versus-owned-link click/menu distinction. Add title-only Done today rows and exact empty text “Nothing completed yet”; reverse chronological ordering is independent of either manual list. Existing `tests/taskCard.test.ts` and `tests/timerPaneView.test.ts` are the integration homes, using `tests/fakes/viewHost.ts` for host events and DOM lifecycle.

### Mobile reorder arrows

**Applies to:** `CardList.ts`, `TaskCard.ts`, `cardOrder.ts` if needed, `styles.css`, card/list tests and viewHost.
**Primary analog:** existing `src/ui/CardList.ts` and its order callback.

Existing imports and stable reconciliation (`1,39-43`):

```typescript
import { moveKey, moveKeyBy } from "../model/cardOrder";
// ...
let i = 0;
for (const card of next.values()) {
  if (this.parent.children[i] !== card.card) this.parent.insertBefore(card.card, this.parent.children[i] ?? null);
  i++;
}
```

Keep keyed DOM instances and the caller's `commitOrder`; both tabs already instantiate independent lists (`TimerPaneView.ts:146-152` and existing Timers wiring). Route arrow actions through the same `moveKeyBy` model operation used by keyboard reorder. Add a public/shared list move boundary instead of reproducing ordering inside each card. Place ▲ above ▼ in a left control column, disable first/last directions and both directions for one item, and use the existing `tntp-` CSS namespace. Native mobile platform detection is a new addition; no existing mobile arrow implementation is available to copy.

Use a polite visually hidden live region for the new position announcement. Existing `TimerPaneView.ts:153` supplies the `aria-live="polite"` DOM convention; TaskCard uses `tntp-visually-hidden` labels. This is a new reorder announcement behavior, not an existing one. Preserve button focus across reconcile and ensure disposed cards cannot commit moves. Extend existing card/list tests for both independent orders, boundaries, focus and detached events.

### Persistence upgrade and release

**Applies to:** `main.ts`, main tests, version/config files, README display copy.
**Primary analog:** existing single writer and tag release workflow.

`main.ts:19,21-25` owns explicit keys and preserves unknown extras:

```typescript
const OWNED_KEYS = new Set(["completionStatus", "rolloverHour", "pauseRecordsVersion", "pauseRecords", "cardOrder", "stagedOrder"]);
function extrasOf(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) if (!OWNED_KEYS.has(key)) extras[key] = value;
  return extras;
}
```

`persistAll` (`54-77`) builds data at execution time, awaits saveData, updates fileSettings only after success, returns this save's rejection and recovers the queue tail. Add completion keys to OWNED_KEYS and this writer; load via `settingsReady` (`132-139`). Preserve old settings, pauses, both orders and unknown extras. Explicitly test clearing records so old loaded values cannot reappear through extras.

`tests/main.test.ts:11-25` mocks Obsidian, captures constructed store dependencies, resets host and uses fake timers; `43-49` verifies view registration happens synchronously before async load and that merely opening settings does not write. Extend this existing host pattern for legacy data, failed saves, delayed initial load and new record round trips.

Release uses existing files: `version-bump.mjs` reads `npm_package_version`, changes `manifest.version`, and appends `versions[targetVersion] = minAppVersion`. `.github/workflows/release.yml` runs `npm ci` and `npm run check`, verifies tag equals manifest version, then creates the release with:

```yaml
gh release create "$GITHUB_REF_NAME" \
  --title "$GITHUB_REF_NAME" \
  --generate-notes \
  main.js manifest.json styles.css
```

Synchronize manifest/package/lock/versions for 0.3.0 and use tag `0.3.0` without prefix. Rename display strings to “TaskNotes Task Control”, preserving plugin id `tasknotes-timer-pane`, view type, command id `open-timer-pane`, CSS prefix, repository and installed folder. Existing build deployment is in tracked `esbuild.config.mjs`; do not overwrite user data during upgrade. Native old-to-new BRAT upgrade and downloaded release asset verification remain execution gates, not results established by this pattern map.

## Shared Patterns

- **Write boundary:** `src/state/WriteQueue.ts:15-21` uses `const result = this.tail.then(task)` and recovers its tail while returning the operation's own result. One instance is created in `main.ts:111`; pass that instance to all mutating controllers. Never claim it supplies cross-system transactions.
- **Authorization/guards:** no server authentication applies. Use bridge capability/method gates, startup readiness, registered staged-field checks and fresh ownership checks at the controller boundary. UI disabled state alone is insufficient.
- **Notifications/logging:** main injects Notice (`114-117`); completion coordinator owns error notices and quiet success. Keep model/store code free of Obsidian; retain bounded diagnostic text without raw task/settings dumps.
- **Read-only observation:** snapshot refresh derives display and may persist local evidence; it never writes TaskNotes. User completion cleanup uses documented registered `{ staged: null }`, never raw frontmatter or internal services.
- **Lifecycle and concurrency:** subscribe returns unsubscribe; host registers cleanup. Preserve last-good cards on failed reads; generations reject stale publication; durable intent separately protects retries after crashes.
- **Safety tests:** use injected clocks, deferred promises and fake gateways for deterministic ordering/failure tests. Native TaskNotes recurrence/materialization, overnight/wake and BRAT upgrade require the execution evidence specified in RESEARCH.

## No Analog Found

No complete local analog exists for durable at-most-once recurring completion, materialized occurrence identity reconciliation, persistent external completion evidence, mobile arrow announcements, or native BRAT upgrade proof. These are new behaviors assembled from the role matches above; use RESEARCH's invariants and contract/native evidence task. The partial DoneTodayList and README matches do not supply those semantics.

## Metadata

**Analog search scope:** tracked `src/`, `tests/`, root build/version files, release workflow. Five primary implementation anchors: TimerController, PauseStore, StagingStore, TaskCard and CardList; other existing files are direct integration seams or pure helper companions, not an expanded analog search.
**Pattern extraction date:** 2026-11-14.
**Limitations:** no source edits, commits, test runs or upstream research. No Write-named filesystem tool was available; the artifact was created with the available file patch tool.
