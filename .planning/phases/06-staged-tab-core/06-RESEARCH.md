# Phase 6: Staged Tab Core - Research

**Researched:** 2026-11-14
**Domain:** TaskNotes Runtime API v1, staged task state, Obsidian pane interactions
**Confidence:** MEDIUM overall; repository seams inspected directly, external API guidance cross-checked against tagged official source. Source inspection is not runtime proof.

<user_constraints>
## User Constraints (from CONTEXT.md)

The following decision and deferred sections are copied verbatim. [VERIFIED: 06-CONTEXT.md, Implementation Decisions and Deferred Ideas]

<!-- DATA_R6K3P9AX_START -->
### Stage picker flow
- **D-01:** Keep the picker open after each successful stage. Remove that task from results so several tasks can be staged in one opening. Escape or clicking outside closes it.
- **D-02:** Success feedback is result removal and the task joining the Staged list only. No success notification or inline success message.
- **D-03:** On failure, keep the picker open, show an inline error and retain the task in results for retry. Do not remove a task before its staging write succeeds.
- **D-04:** Preserve the search query and input focus after each successful selection.

### Staged card details
- **D-05:** Show the staged date plus age, for example `Nov 14 · 2 days ago`. Age uses the configured staging-day boundary.
- **D-06:** Put this in a muted line below the title, consistently across idle, running and paused states.
- **D-07:** Put the ✕ Unstage control in the top-right corner, separate from timer and completion controls. Tooltip: `Unstage task`.
- **D-08:** Unstage applies immediately without confirmation. As already required, it stops regular timing or clears the pause; Pomodoro-owned timing stays untouched.

### Counts and running indicator
- **D-09:** Staged counts its listed tasks. Timers counts running regular timers only, excluding paused cards and Pomodoro-owned entries. The Timers count can therefore be zero while paused cards remain visible.
- **D-10:** Accent-color the Timers count while any regular timer runs. The selected tab keeps its underline; selection and active timing are separate states. Preserve the prior text-only tab labels.
- **D-11:** Always show counts, including `Staged 0` and `Timers 0`.
- **D-12:** Timers cards whose task is staged show a small muted `Staged` text label below the title.

### Setup and unavailable states
- **D-13:** Show field setup instructions directly in the Staged tab, without an expandable section: where to register the field in TaskNotes, key `staged`, type Date, no default value. Stage is disabled until registration is correct.
- **D-14:** If the Date field has a non-empty default, disable Stage until the default is removed, explain the correction, and keep existing staged tasks usable. This is stricter than warning while allowing Stage.
- **D-15:** If field configuration cannot be read, retain existing cards with a warning and Retry button. Disable Stage until the check succeeds. A read failure must not be presented as an empty list.
- **D-16:** If staging is unsupported, show a short explanation that staging requires TaskNotes 4.13.0 or newer and the staging APIs, with an update suggestion. Do not expose capability diagnostics in the normal message. Timers remains usable.

### Carried-forward constraints
- Fixed `staged` key; writes through documented `api.tasks.update`; unstage writes `{staged: null}` only. Never auto-register fields through TaskNotes internals in this phase.
- Picker uses the existing ranked search and hides done, archived and already-staged tasks. External staging appends tasks at the bottom. Missing/empty/invalid dates are not staged; future dates remain hidden until eligible.
- Staged header has Stage only; bulk actions stay on Timers. No automatic tab switching; per-leaf tab selection and shared card orders remain as decided in Phase 5.
- Staged cards use the existing card style and title/note/context-menu behavior, keyed by path and joined with timer state. Pomodoro-owned timing appears idle on Staged and cannot be started by the pane.
- Independent persisted Staged and Timers orders, with drag and ArrowUp/Down. Renames follow paths; prune deleted tasks only after a successful read confirms absence.
- Refresh/render never writes. Every TaskNotes mutation uses the shared WriteQueue; plugin data persists through the single `persistAll` writer without losing other keys.

### Planner's Discretion
- Module boundaries, persistence shape and implementation details within the decisions above and the roadmap.
- Exact sentence-case error/setup copy, date formatting details and compact layout using existing Obsidian theme variables. No additional behavior preferences were delegated during discussion.

### Deferred Ideas

- **Investigate automated TaskNotes user-field configuration.** User: “I would prefer to setup automated configuration of TaskNotes to avoid this.” Check whether a supported configuration method exists before proposing implementation. The current integration has no setter, and prior project research found no official registration method. If automation requires internals, present that tradeoff explicitly before changing the existing documented-API boundary. No TaskNotes settings are changed as part of this discussion.
<!-- DATA_R6K3P9AX_END -->
</user_constraints>

## Project Constraints (from supplied AGENTS.md instructions)

- Communicate efficiently and clearly; avoid ambiguous words and unfamiliar jargon. Link any research papers, preferring peer-reviewed publications before arXiv. Number suggested next prompts. [VERIFIED: user-supplied AGENTS.md instructions]
- Keep the documented TaskNotes integration boundary and graceful degradation. The local guidance explicitly says “never TaskNotes internals”. [.claude/CLAUDE.md, Project Constraints; VERIFIED by direct read]
- This task changes only this research file. Preserve the pre-existing config edit, branch, source, dependencies and runtime services. [VERIFIED: orchestrator assignment]
- User explicitly chose research despite the current config containing `"research": false`. Config also contains `"nyquist_validation": false` and `"security_enforcement": true`; do not change these settings. [VERIFIED: .planning/config.json:20-24,48-50; verbatim values quoted here]
- Local workflow guidance requires GSD entry points for edits; this research is part of the delegated plan-phase workflow. Before UI execution/verification, use the guarded UAT launcher from the checkout under test, repeat after rebuilding, verify build/hash provenance, stop UAT when done, and never bypass a launcher refusal or launch another Obsidian instance manually. Check disk/state behavior in the sandbox before asking for subjective user feedback. [VERIFIED: .claude/CLAUDE.md:211-231]

## Summary

Build a pure staging model, a plugin-scoped read store and path order store, and a stage/unstage controller sharing the existing queue. Join staging membership with the timer snapshot in the view; do not add staging membership to the timer ledger. The current card requires a timer model, while the Staged placeholder already keys its list by task path. [VERIFIED: src/ui/TaskCard.ts:14-42,71-99; src/ui/TimerPaneView.ts:130-137]

The main risks are false absence after failed/filtered reads, the modal's close-on-selection path, losing plugin data in whole-object saves, and stopping a Pomodoro entry during unstage. The existing bridge already supplies the required staging methods; implementation must consume them rather than add another API wrapper. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:57-87,257-287,309-332; src/main.ts:50-71; src/ui/TaskPickerModal.ts:115-135; src/state/TimerController.ts:375-405]

**Primary recommendation:** keep each responsibility separate; add explicit read-success and stale-state handling before wiring UI. Recommendations below resolve implementation choices within the locked decisions; proposed symbols and filenames are design suggestions, not claims that they exist.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Implementation recommendation |
|---|---|---|---|
| Staged membership and field registration | TaskNotes data/API | Plugin read store | Read one unfiltered task list and catalog; derive locally |
| Eligibility, staged age, order projection | Pure plugin model | — | No Obsidian imports, wall clock passed as an argument |
| Stage / unstage / timer operations | Plugin controller | TaskNotes public write API | One shared queue; fresh safety checks inside it |
| Regular timing and pause continuation | Existing timer store/ledger | TaskNotes | Reuse existing session math and ownership filtering |
| Independent order persistence | Plugin storage | Single main writer | Path order separate from timer session order |
| Cards, counts, warnings, picker | Obsidian client view | Shared stores | Stable DOM and keyed models; render performs no writes |

This is an in-process Obsidian integration, with no new HTTP service or authentication layer. [CITED: https://tasknotes.dev/javascript-api/]

<phase_requirements>
## Phase Requirements

Descriptions below retain the requirement meanings; Phase 7 completion behavior remains deferred. [VERIFIED: .planning/REQUIREMENTS.md, v0.3 Requirements; .planning/ROADMAP.md, Phase 6/7]

| ID | Description | Research support |
|---|---|---|
| SETUP-02 | Registered date field required; setup instructions; Stage disabled otherwise | Field-status gate and retained-card warning below |
| SETUP-03 | Unsupported staging explains why; Timers works | Existing feature availability, separate panel messages |
| STAGE-01 | Eligible ranked picker; update with staging day | Multi-select path, fresh eligibility check, minimal patch |
| STAGE-02 | External staging appended at bottom | Shared successful-read snapshot and observed path order |
| STAGE-03 | Null unstage stops regular timer/clears pause; protects Pomodoro | In-queue unstage sequence and partial failure rules |
| STAGE-04 | Missing/empty/invalid excluded; future dates hidden | Strict date parser and separate reservation/visibility predicates |
| STAGE-05 | Days staged visible | Calendar-day ordinal age; reuse staging-day function |
| SCARD-01 | Idle start/complete/unstage; note/menu | Extended card model; Complete present but disabled until Phase 7 |
| SCARD-02 | Running live session/total, pause/stop/complete/unstage | Timer join, existing timing math, disabled staged Complete |
| SCARD-03 | Paused frozen session, resume/complete/unstage | Existing accumulated session model, disabled staged Complete |
| SCARD-04 | Pomodoro-owned task looks idle; Start refused | Existing filtered timer snapshot plus controller.start guard |
| ORDER-01 | Drag/ArrowUp/Down; persisted order | Reuse CardList with new path order |
| ORDER-02 | Independent tab orders | Separate data key and store |
| ORDER-03 | Follow task renames and deletion | Folder-aware path remap and authoritative absence checks |
| TABS-03 | Counts and running highlight | Listed staged count; safe regular running count |
| TABS-04 | Muted staged marker on Timers cards | Same eligible staged path set used by Staged list |
</phase_requirements>

## Standard Stack

Keep the existing toolchain and lockfile. No runtime or development package is added or upgraded in this phase. Registry latest versions and release dates are deliberately not installation recommendations.

The manifest source declares the following exact values: `"obsidian": "1.14.4"`, `"typescript": "~6.0.3"`, `"esbuild": "0.28.2"`, `"vitest": "^5.0.4"`, `"eslint": "^9.39.5"`, `"eslint-plugin-obsidianmd": "^0.4.2"`. [VERIFIED: package.json:22-33]

| Existing component | Version basis | Use |
|---|---|---|
| Obsidian DOM / ItemView / SuggestModal | Declared typings above | Extend existing view/modal |
| TypeScript / esbuild | Declared versions above | Existing build/typecheck |
| Vitest and local fakes | Actual test run reports Vitest 5.0.4 | Pure logic, controllers, mounted component tests |
| TaskNotes Runtime API v1 | Vendored contract identifies `v4.13.8` | Public staging methods, optional feature gate |

Contract provenance quote: `Vendored, trimmed, type-only subset of callumalpass/tasknotes src/api/runtime-api.ts @ 451679289d94 (v4.13.8, MIT). Do not import TaskNotes source.` [VERIFIED: src/tasknotes/runtime-api.types.ts:1-7]

### Package Legitimacy Audit

Not applicable: this phase installs no external package. Do not introduce a date library, drag library, UI framework or TaskNotes model dependency. Existing toolchain versions above are repository declarations, not a newly performed registry legitimacy audit.

## Existing Contract and Code Examples

These are source excerpts, not new implementation. Quotes preserve exact signatures and discrete values. Implementation recommendations later refer back to this inventory.

<!-- DATA_N8Q2VB7H_START -->
```ts
export const STAGED_FIELD_KEY = "staged";
export type FieldStatus =
	| { kind: "unknown" }
	| { kind: "missing" }
	| { kind: "wrong-type"; type: string; hasDefault: boolean }
	| { kind: "ok"; hasDefault: boolean };
export function fieldStatus(userFields: unknown): FieldStatus
```
<!-- DATA_N8Q2VB7H_END -->
[VERIFIED: src/model/stagedField.ts:12-31; function signature quoted without body]

The default test is value-based: `field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== ""`. Do not duplicate it in the UI. [VERIFIED: src/model/stagedField.ts:35-40]

<!-- DATA_F4ZR9WX2_START -->
```ts
export function stagingDay(nowMs: number, rolloverHour: number): string
export const DEFAULT_ROLLOVER_HOUR = 4;
```
<!-- DATA_F4ZR9WX2_END -->
[VERIFIED: src/model/stagingDay.ts:13,39-46; signature quoted without body]

Keep its existing local calendar implementation. Older research examples that subtract rollover hours do not supersede this implemented function. [VERIFIED: src/model/stagingDay.ts:39-46]

<!-- DATA_K9AH2PM6_START -->
```ts
listTasks(): Promise<TaskInfo[]>;
getTask(path: string): Promise<TaskInfo | null>;
statuses(): Promise<TaskStatus[]>;
userFields(): Promise<TaskNotesUserField[]>;
stagingAvailability(): { available: boolean; reason: string };
updateTask(path: string, patch: TaskNotesTaskPatch, context: TaskNotesMutationContext): Promise<void>;
```
<!-- DATA_K9AH2PM6_END -->
[VERIFIED: src/tasknotes/TaskNotesBridge.ts:57-75]

The bridge's staging floor is `STAGING_MIN_TASKNOTES_VERSION = "4.13.0"`; the baseline remains `MIN_TASKNOTES_VERSION = "4.10.0"`. Staging checks `"tasks.read"`, `"tasks.write"`, `"catalog.read"`, while baseline required capabilities remain `["time.read", "time.write", "tasks.events", "lifecycle.events"]`. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:21-25,309-324; values quoted verbatim]

The public tagged TaskNotes source confirms that no-query task listing returns the cached task collection and that user-field catalog entries are copied. Use a full list for membership, never a searched/filtered picker result for deletion. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/api/TaskNotesAPI.ts]

<!-- DATA_J6CY8TR4_START -->
```ts
run<T>(task: () => Promise<T>): Promise<T>
start(target: StartTarget): Promise<StartOutcome>
pause(target: StopTarget): Promise<PauseOutcome>
resume(target: ResumeTarget): Promise<ResumeOutcome>
stop(target: StopTarget): Promise<StopOutcome>
stopPaused(target: ResumeTarget): Promise<"cleared" | "not-paused" | "busy">
export type StopTarget = { taskPath: string; startTime: string; title: string };
export type StartTarget = { taskPath: string; title: string };
export type ResumeTarget = { taskPath: string; title: string };
```
<!-- DATA_J6CY8TR4_END -->
[VERIFIED: src/state/WriteQueue.ts:15-22; src/state/TimerController.ts:18-23,137,182,219,375,413; method signatures quoted without bodies]

Never await one of these queued public controller methods inside another `queue.run` callback. Extract a non-queued shared helper if needed: existing pause/resume implementation already separates in-queue bodies. [VERIFIED: src/state/TimerController.ts:241-282; src/state/WriteQueue.ts:15-22]

## Architecture Patterns

### Data flow

TaskNotes task/settings/cache hints → bridge → debounced staging reads → success/generation checks → pure membership/date projection → path order projection → view joins timer snapshot → keyed Staged cards and Timers markers. A failed read branches to retained cards plus warning. User action → controller → shared queue → fresh preflight → public mutation → explicit refresh; order saves flow separately through the single plugin-data writer. This is the recommended component flow.

### Recommended component responsibilities

All new filenames below are proposed implementation locations, not existing-file claims.

| Proposed or existing seam | Work |
|---|---|
| New model/staging module | Read top-level user field with own-property precedence, strict date parse, eligibility, calendar age, display model and order projection |
| New state/StagingStore | Full-task snapshot, catalog status, successful-read metadata, stale warnings, single-flight reads, generation/revision protection |
| New state/StagedOrderStore | Normalized path order, bounded loader, append, remove, folder rename, in-memory prune and serialization |
| New state/StagingController | Stage and unstage, availability, busy tracking and retryable result objects |
| Existing TaskCard and TimerPaneView | Idle model, staged metadata, action slots, counts, retained cards and setup notice |
| Existing TaskPickerModal | Discriminated start/stage options; multi-select stage path |
| Existing main persistence/service wiring | One shared staging store/order/controller for all leaves; one queue and save writer |

### 1. Separate field reservation, list visibility and task existence

Recommended predicates:

- A valid staged date reserves the task from the Stage picker, including a future date. Otherwise a hidden future task could be selected and its date overwritten.
- A visible staged card additionally requires date at or before the current staging day, an unarchived task, and a status not marked completed by the catalog.
- Existence comes from the full successful task list, before all visibility filters. A future, archived, completed or externally unstaged task is not thereby deleted.
- A top-level own property wins even when null/empty/invalid. Fall back to custom properties only when the top-level property is absent; nullish fallback can resurrect a stale custom-property date immediately after unstage.
- Accept a valid date-only string; optionally accept a valid ISO datetime's date prefix after checking that the suffix is actually a datetime. Reject impossible dates, arrays, numbers, booleans and arbitrary trailing text. Use round-trip calendar validation. Do not silently coerce malformed values.
- Compute age by UTC ordinals built from validated date components, not elapsed local milliseconds. Display same-day age as “today”, one day as “1 day ago”, and plural thereafter; date formatting can use local noon to avoid UTC date shifts.

The current TaskInfo declaration contains `title`, `status`, `path`, `archived` and timer/display fields, but does not yet declare staging/custom-property members. Add only the read members needed, or a narrow local intersection; preserve typo checking rather than adding a broad index signature. [VERIFIED: src/tasknotes/runtime-api.types.ts:20-32; member names quoted verbatim]

The current ranking helper has `filterAndSortTasks(tasks: readonly TaskInfo[], completed: ReadonlySet<string>, query: string): TaskInfo[]`; it excludes archived tasks but uses completed status as a sort partition. Explicitly filter completed and reserved tasks before ranking in Stage mode; keep Start mode behavior. [VERIFIED: src/model/taskPicker.ts:22-43; signature and status distinction read directly]

### 2. Successful authoritative reads versus uncertainty

Use independent results for task list, statuses and user-field catalog. Do not turn rejection into an empty array. Retain the last good cards if any required derivation input fails; initial failure shows a warning/loading state, never “Nothing staged”. Catalog failure must set unknown registration even when last-good cards remain. A successful empty full list while the same bridge generation is ready can establish absence; a failed list, single-task null, search result, disconnected read, or pre-rename in-flight response cannot.

Recommended safety details:

- Wait for settings/order initialization before accepting reconciliation; use the same loaded-before-reconcile discipline as pauses.
- Invalidate in-flight generations on bridge state changes, disposal and vault rename/delete. If a local stage/unstage happens during a read, reject/retry that stale result using a revision guard.
- Keep all-task paths separate from rendered eligible paths. Prune saved order only from confirmed task absence, not from the visible staged set. Explicit successful unstage can remove its own order entry.
- During a rename, remap paths synchronously before requesting a new read. Preserve a remapped path while TaskNotes has not indexed the new file yet; the vault's existing-file check can distinguish that gap from deletion.
- Retain in-memory observed arrival order, append new external staged tasks once, and use deterministic date/path ordering for a batch of previously unseen tasks. Refresh may update in-memory projection but must not call TaskNotes mutations or persist callbacks. Save current order through explicit stage/unstage/reorder actions. This honors the literal no-write-on-refresh constraint while preserving user reorders across restart.

Existing refresh implementation provides reusable patterns: a dirty single-flight loop, bridge generation checks and pause-revision retry. Existing `getTask` explicitly permits null during cache warm-up. [VERIFIED: src/state/TimerStore.ts:120-157,160-201; src/tasknotes/TaskNotesBridge.ts:58-59,265-271]

### 3. Field setup and preflight

Enable Stage only after current staging availability succeeds and field status is correct with no default. Also require a successful completed-status catalog read, so the picker cannot accidentally offer completed tasks. Recheck field registration and target eligibility inside the queue, immediately before writing; opening-time state is insufficient.

Setup copy should direct the user to TaskNotes settings → Task Properties → Custom User Fields, property key fixed by the existing constant, type Date and no default. Official user-field documentation describes that settings location and optional date defaults. The live documentation currently identifies a later plugin version, so the local Phase 4 spike remains the project-specific compatibility evidence. [CITED: https://tasknotes.dev/features/user-fields/]

For an unknown catalog, retain cards and timer controls, disable Stage, and show Retry. A null-clear should also require a fresh successful registration check before stopping anything; if unavailable, fail safely with inline correction/retry feedback. A registered Date with a default blocks Stage only: existing null-clear and timer controls remain usable. Missing/wrong-type setup must not trigger speculative writes.

Unsupported staging uses short user-facing update copy, not the bridge's detailed capability reason. Keep the baseline connection state shared, and keep staging availability separate from Timers usability. The bridge already forwards `"settings.changed"`, `"task.updated"`, `"task.deleted"`, `"cache.changed"`, `"cache.rebuilt"`; use those hints. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:492-500; names quoted verbatim]

### 4. Stage and unstage sequencing

**Stage recommendation:** busy guard → shared queue → await initialization → fresh supported/registered/no-default check → fresh full-list or task/status eligibility check → derive staging day at execution time → minimal fixed-field update → append in-memory order → save through persistAll → refresh both projections. A persistence failure after a successful TaskNotes write is a partial success: retain the staged task and report an order-save problem; do not pretend the field write failed and invite a duplicate mutation.

**Unstage recommendation:** one queue callback; fresh availability/registration and active/ownership reads; identify current regular entry on the path; stop it only after readable ownership excludes the exact owner; clear the pane pause; write only the fixed-field null patch; remove its order entry after successful field write; refresh both stores. Use an in-queue helper rather than calling queued timer-controller methods. Do not reuse the existing path-only public Stop as an ownership guard.

Stop before the null patch so a stop failure leaves the task visibly staged and retryable. If the null write then fails, retain the staged card with its now-idle state and show a retryable failure; do not restart the timer as compensation. If only a Pomodoro entry exists, skip stop, clear only pane-owned pause state, and permit the null field clear. If ownership is unreadable and any open entry on the path could be Pomodoro-owned, abort before either side effect. A paused/idle task with a freshly confirmed empty active set can still unstage.

Exact ownership helpers are `normalizeTimerPath(path: string): string`, `sameEntry(a: EntryId, b: EntryId): boolean`, and `selectRegularStopTargets(active: readonly ActiveTimeEntry[], ownership: Ownership): EntryId[]`. Ownership is `type Ownership = { readable: true; owner: EntryId | null } | { readable: false }`. [VERIFIED: src/model/pomodoroOwnership.ts:3-11,35-43; declarations quoted verbatim]

The public stop API is path-only, so a TaskNotes action outside this plugin can still replace the entry after the final safety read. The shared queue serializes this plugin's commands; it does not create a transaction with TaskNotes or external writers. Existing controller comments recognize this limit. Test the final-read protections and document the remaining race rather than claiming atomicity. [VERIFIED: src/state/TimerController.ts:88-95,303-310; src/tasknotes/TaskNotesBridge.ts:224-227]

### 5. Persistence and independent order

The current ownership set is exactly `new Set(["completionStatus", "rolloverHour", "pauseRecordsVersion", "pauseRecords", "cardOrder"])`. The proposed staged-order key must be added to this set and to the same serialization/load path; otherwise an obsolete extra can reappear when the order empties. [VERIFIED: src/main.ts:15-22; set quoted verbatim]

`persistAll(settings?: TimerPaneSettings): Promise<void>` builds data when its queued save executes and reads current store serialization then. Keep this execution-time snapshot: never capture staged or timer order before waiting on the save chain. Preserve unknown extras, settings-last-written semantics, pause data and both orders. Omit an empty new order consistently, and handle save rejection without poisoning future saves. [VERIFIED: src/main.ts:50-71; signature quoted verbatim]

Use a bounded, type-checked, deduplicated loader like the existing timer order loader. Its cap is `MAX_STORED_ORDER = 1000`; reuse the policy rather than introducing unbounded path arrays. Existing timer sorting intentionally inserts new sessions first; add a staged bottom-insertion helper rather than reversing or changing Timers behavior. [VERIFIED: src/model/cardOrder.ts:7-23,45-54; cap quoted verbatim]

Folder-aware rename must match the exact path or a slash-bounded descendant, preserve relative order, and deduplicate collisions. Reuse the path normalization and PauseStore rename pattern. Never use a raw prefix that would also rename a sibling with a similar name. Existing vault handlers remap pauses before refresh; extend this ordering for staging state. [VERIFIED: src/state/PauseStore.ts:21-24,100-141; src/main.ts:152-163]

### 6. Multi-select picker without private SuggestModal access

Extend the options as a discriminated union. Keep the existing Start branch and its close behavior. In Stage mode override the public selection entry point and directly await the stage handler; do not call the superclass selection method that takes the close path. Do not modify private chooser/suggestion internals. Public selection/input APIs are present in Obsidian's official declaration. [CITED: https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts]

Use a pending-selection guard, separate from modal lifetime. After success, remove only that normalized path from the local task snapshot, dispatch the existing public input event to recompute results using the current input value, restore input focus if still open, and clear pending. Preserve the query typed while the write was pending; never restore an older captured query. On failure retain the result and query, clear pending, and show a stable inline error. No success notice. Escape/outside close may happen during a write: the committed action may complete, but generation checks must prevent DOM work or refocusing a closed modal. Route mouse, Enter and chip clicks through the same guard.

Current options quote: `mode: "start";`, `controller: Pick<TimerController, "start" | "isBusy">;`, `onClose: () => void;`. The constructor is `constructor(app: App, options: TaskPickerOptions)`. Current input-refresh code dispatches an input event via the input element's window; reuse that cross-window pattern. [VERIFIED: src/ui/TaskPickerModal.ts:10-15,32-39,61-64,115-135; declarations quoted verbatim]

### 7. Card join, counts and completion boundary

Create a card display union with a common task/title/display identity and optional real timer payload; do not fabricate timestamps or paused records for idle tasks. Keep Staged card keys as normalized task path; keep Timers keys as session key. Prefer a running regular timer when joining by path; otherwise paused; otherwise idle. Pomodoro-owned entries are already excluded from the readable timer snapshot. Reuse controller Start so a hidden Pomodoro still receives the existing refusal notice. [VERIFIED: src/state/TimerStore.ts:26-40,211-218; src/state/TimerController.ts:137-165]

The timer model explicitly has `state: "running" | "paused"`, `sessionKey: string`, `accumulatedMs: number`, `segmentStartMs: number | null`, `entries: ParsedEntry[]`. Preserve `timerSessionMs` for live/frozen session and `totalMs` for total; do not duplicate clock accumulation. [VERIFIED: src/model/timeMath.ts:21-47,69-72,88-96; members quoted verbatim]

Build idle/running/paused controls once and toggle their visibility in place. Staged idle has Start; running has Pause/Stop; paused has Resume; all have separate top-right Unstage and a consistent muted date/age line. Retain existing title rendering, modifier clicks, chip event ownership, task-menu handoff and renderer disposal. The current card action handlers read the model at click time. Keep that property when extending the model. [VERIFIED: src/ui/TaskCard.ts:149-166,191-301,303-379]

**Phase 6 Complete behavior:** render the control on all staged states but keep it disabled with a clear tooltip explaining that staged completion is not available yet. Never pass a fabricated idle StopTarget or route a new staged recurring task into the existing Complete method. Preserve existing Timers completion behavior for this phase; Phase 7 owns its recurring-safe replacement. Existing Complete calls `gateway.completeTask` before checking the captured timer entry; the staged completion contract is explicitly deferred. [VERIFIED: src/state/TimerController.ts:440-478; .planning/ROADMAP.md, Phase 6 Notes and Phase 7]

Use the eligible staged path set for markers and listed-card count. Use the existing safe regular running count from header state rather than total visible card count; paused cards do not count. Under unreadable ownership the existing header state conservatively reports no eligible stop targets; preserve the Timers warning and treat this count as conservative rather than asserting known ownership. Accent only the count span; retain the selected-tab underline and roving tab accessibility. [VERIFIED: src/state/TimerStore.ts:57-63,217-225; src/model/pomodoroOwnership.ts:35-43; src/ui/TimerPaneView.ts:267-289]

Update both mounted lists' clock values when visible and reconcile staging on relevant data/settings/reveal events. Compute dates from the current staging day whenever deriving. Do not claim Phase 7 overnight/wake rollover acceptance is delivered by these ordinary refreshes; defer the dedicated day-change lifecycle and Done-today handling.

## Don't Hand-Roll

| Problem | Use |
|---|---|
| Task field writes | Existing bridge update method, minimal patch |
| Mutation serialization | Existing single WriteQueue |
| Session continuation and frozen pause time | TimerStore, PauseStore and existing time math |
| Search ranking | Existing filterAndSortTasks after Stage eligibility filtering |
| Reorder behavior / focus-preserving keyed DOM | Existing CardList with independent caller order |
| Plugin data writes | Existing persistAll, extended once |
| Context menu / rendered task links | Existing TaskCard behavior |

These recommendations reuse inspected seams rather than adding dependencies. [VERIFIED: source inventory above]

## Common Pitfalls

| Failure | Prevention / verification |
|---|---|
| A catalog/list rejection clears cards | Retain last-good projection; separate error and empty states; Retry test |
| Future, completed or archived task treated as deleted | Prune against full authoritative task paths, never eligible paths |
| Null top-level field falls back to stale nested date | Own-property precedence test |
| Fresh external task jumps above manual order | Append unseen paths to observed order; separate timer sorting |
| A selection closes the Stage picker | Stage-specific public selection path; mouse/keyboard native check |
| Failed stage disappears or cannot retry | Remove only after successful field write; pending guard always cleared |
| Unstage deadlocks | No public queued controller call inside the shared queue |
| Unstage stops hidden Pomodoro | Fresh exact ownership check before stop; unreadable ownership safety test |
| Refresh races local mutation/rename | Generation and revision guards; stale response test |
| Settings save erases staged order or restores stale extra | Single execution-time writer, OWNED_KEYS, interleaved save tests |
| Adding idle state changes Timers controls | Mounted tests for both lists, default options preserve Timers |
| Disabled staged Complete still calls controller | Assert zero completion calls on staged clicks |
| Refresh starts persisting reconciliation | Spy on update/start/stop and persist during refresh/render |

These are implementation risk predictions grounded in the inspected flows, not claims of reproduced bugs.

## State of the Art and Conflicting Prior Research

Follow the later phase context and implemented foundations. Older research recommends combined custom-frontmatter deletion, configurable keys, cross-device merge, permissive wrong-type operation, one-shot picker selection, raising the baseline minimum, or extra phases. Those proposals are superseded for this task by the copied constraints, Phase 4 decisions and current roadmap. The current bridge actively rejects a `"customFrontmatter"` member and discards the update echo. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:326-332; forbidden member quoted verbatim]

Prior Phase 4 spike results are recorded evidence from an earlier run, not observations repeated here. They report null field clearing leaves empty YAML, catalog default members can exist with undefined values, and registration became visible without a reload. Use those pinned findings and contract tests; do not require a reload in setup instructions. The same spike reports recurring occurrence snapping/advancement that makes Phase 7 research necessary. [VERIFIED: .planning/phases/04-staging-foundations/04-SPIKE-FINDINGS.md, Q1-Q4 and Pins; historical evidence only]

## Environment Availability

| Dependency | Observation in this research run | Fallback / action |
|---|---|---|
| Node / npm | Commands returned v24.13.1 / 11.8.0 | Available; no install |
| Existing test tooling | Test run resolved inherited checkout dependencies and reported Vitest 5.0.4 | Use existing npm scripts; no package changes |
| Native TaskNotes / Obsidian | Not exercised in this research run | Guarded development-vault UAT during execution |
| Context7 | No matching tool and no ctx7 executable observed | Official tagged source and docs via built-in web tools |
| Knowledge graph | Requested default graph file check returned false; GSD status reported disabled | Direct source inspection; no graph built |

[VERIFIED: tool outputs from this research session; availability observations, not future guarantees]

No newly missing dependency blocks planning. Native app behavior, picker focus, chip integration and raw-file writes still need execution-time UAT. The guarded UAT launcher builds the current checkout and only installs runtime assets into a permitted dev vault; preserve its guard checks and confirm printed build provenance. [VERIFIED: scripts/uat/start-uat-obsidian.ps1:1-24,35-45]

## Test and Verification Plan

Nyquist's formal Validation Architecture section is intentionally omitted because config explicitly contains `"nyquist_validation": false`. The following is practical test guidance requested for planning, not a config change or generated Nyquist artifact. [VERIFIED: .planning/config.json:20-24]

The existing scripts are `"test": "vitest run --dir tests"`, `"typecheck": "tsc -noEmit"`, `"lint": "eslint . --max-warnings 0"`, `"check": "npm run build && npm run lint && npm test"`, and `"uat:start": "pwsh -NoProfile -File scripts/uat/start-uat-obsidian.ps1"`. [VERIFIED: package.json:8-19]

**Executed baseline:** `npm test -- --reporter=dot` passed 20 test files / 568 tests; Vitest reported 2.12 seconds. No new functionality was implemented or runtime-tested. [VERIFIED: test command output in this session]

| Requirement area | Recommended automated coverage | Fast command / layer |
|---|---|---|
| SETUP-02/03 | All field states/defaults, unknown after prior success, Retry, baseline older TaskNotes unaffected | Existing bridge/stagedField suites plus proposed staging-store and view tests |
| STAGE-01/02/04/05 | Missing/null/invalid/date/datetime/future; own-property precedence; completed catalog failure; external append; staging boundary and DST age | Proposed pure staging model suite; existing stagingDay timezone matrix |
| STAGE-03 | Serial stage/unstage with timer commands; regular stop before null; paused clear; owner untouched; unreadable owner; partial failures; no nested queue | Proposed staging-controller suite with fake gateway and shared queue |
| ORDER-01/02/03 | Separate stores, reload, malformed load, empty omission, extras, interleaved saves, file/folder rename, stale reads and confirmed deletion | Existing main/order/CardList suites extended |
| SCARD-01–04 | Stable path card through idle/running/paused, fresh action target, live/frozen time, note/menu, owner refusal, disabled Complete | Existing mounted TaskCard/TimerPaneView suites extended |
| TABS-03/04 | Always-visible zero counts, paused excluded, count accent independent of selected tab, marker/date line, same task in both lists | Existing mounted view suite extended |
| Picker D-01–04 | Repeated mouse/Enter, duplicate pending selection, failure retry, newest query retained, focused input, close during async work, row renderer disposal | Existing picker modal suite extended |
| Read-only refresh | Zero TaskNotes writes and zero persistence callbacks during refresh/render, including settings and failed-read paths | Store/controller/view spies |

Suggested new test files are staging model, staging store, staging controller and staged-order suites under the existing tests directory; filenames are planner choices. Fast existing command: `npm test -- tests/taskPickerModal.test.ts tests/taskCard.test.ts tests/timerPaneView.test.ts tests/cardList.test.ts tests/main.test.ts`. Run focused affected suites per task and `npm run check` before phase verification. This command reuses existing npm scripts; new suite paths should be added once created.

The existing tests use local Obsidian/DOM fakes. Extend their input value/focus/event and modal-selection behavior as required; do not mistake a fake passing for native SuggestModal proof. The picker fake explicitly closes before invoking its choose callback. [VERIFIED: tests/taskPickerModal.test.ts:5-37; tests/fakes/viewHost.ts:39-44,83,101-143]

Native UAT should prove batch Stage with preserved query/focus, failure retry, direct external staging, raw frontmatter null clear, timer/Pomodoro ownership, drag/keyboard order and restart, both-leaf updates, setup corrections without reload, tab counts/markers and note/menu behavior. Keep personal-vault mutation outside this workflow. Dedicated overnight rollover, mobile reorder buttons, completion/recurrence, Done today, display rename and release remain Phase 7.

## Security Domain

Config keeps `"security_enforcement": true` and `"security_asvs_level": 1`. [VERIFIED: .planning/config.json:48-50]

The category names below use ASVS 4 terminology requested by the phase template; they are a scoped control checklist, not a claim of ASVS certification. OWASP now publishes ASVS 5.0.0, so do not label these legacy category numbers as ASVS 5 numbering. [CITED: https://asvs.owasp.org/]

| Requested ASVS category | Applies to this phase | Recommended control |
|---|---|---|
| V2 Authentication | No new login surface | Retain in-process host boundary |
| V3 Session Management | No web authentication session | Timer sessions are domain state, not authentication sessions |
| V4 Access Control | Task/timer ownership | Feature gates; exact Pomodoro identity; no internals |
| V5 Input Validation | Yes | Strict date/schema/path/order loading; no title HTML; reject malformed data |
| V6 Cryptography | No new cryptography | No secrets or crypto introduced |

| Threat pattern | STRIDE category | Mitigation / test |
|---|---|---|
| Forged drag payload or stale detached card action | Spoofing / tampering | Preserve CardList local drag authority and current-model checks |
| Malformed date/order or large stored array | Tampering / denial of service | Defensive loader cap and strict validation |
| Arbitrary frontmatter overwrite | Tampering | Fixed field constant and minimal patch; no raw frontmatter writes |
| Task title interpreted as HTML/markdown | Injection / tampering | Preserve text title handling and existing safe wikilink construction |
| Late response overwrites post-rename state | Tampering | Generation/revision guard and authoritative read distinction |
| User tasks/secrets leaked into diagnostics | Information disclosure | Short user-facing errors; path-free new console logs; no settings snapshot |

Existing cards render a safe path wikilink while avoiding title markdown parsing, and CardList requires local drag authority. Preserve these mechanisms. [VERIFIED: src/ui/TaskCard.ts:212-229,271-280; src/ui/CardList.ts:60-100]

## Assumptions Log

| # | Unverified runtime claim | Risk / required check |
|---|---|---|
| A1 | [ASSUMED] Overriding the documented selection entry point without calling its superclass will preserve all native Stage picker keyboard/mouse behavior across supported Obsidian hosts | Confirm native mouse/Enter/Escape/outside close, focus and latest query in guarded UAT; retain existing Start branch |

All other implementation choices above are recommendations within discretion or inspected contracts, not additional locked user decisions. No unanswered product-preference question blocks planning.

## Open Questions

1. Native SuggestModal behavior after repeated async selection needs execution-time confirmation (A1). The public API supports the chosen entry point; no private property fallback is recommended.
2. The external path-only stop race cannot be eliminated by this plugin queue. Keep fresh guards and accurate partial-failure reporting; do not expand scope into TaskNotes internals.
3. Recurring completion and prompt overnight rollover remain Phase 7 research/verification work, with the historical spike as input.

## Sources and Confidence

- Repository source and tests cited inline were opened in this session. They establish implementation shape, not live TaskNotes behavior.
- [TaskNotes 4.13.8 public contract](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/api/runtime-api.ts): catalog and task method contracts; cross-check with vendored subset.
- [TaskNotes 4.13.8 API implementation](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/api/TaskNotesAPI.ts): unfiltered cached task reads and copied field catalog.
- [TaskNotes Runtime API documentation](https://tasknotes.dev/javascript-api/): in-process API and capability gating; live page displayed plugin 4.14.0 when fetched, so tagged source anchors target behavior.
- [TaskNotes user-field documentation](https://tasknotes.dev/features/user-fields/): settings location and optional date defaults; live page displayed plugin 4.18.2 when fetched.
- [Obsidian official API declaration](https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts): public modal selection/input surface. Use existing declared project typings at implementation time, not new master-only methods.
- [OWASP ASVS](https://asvs.owasp.org/): current standard version context only.

Research seam selected Context7, but no matching MCP/CLI was available. Official primary sources were fetched with built-in web tools instead. The code seam returned **MEDIUM** for `classify-confidence --provider websearch --verified` (the seam does not recognize the built-in webfetch label and returns LOW for that label). External findings are therefore tagged CITED, not promoted to registry-verified facts. No registry package claim is needed.

Both research-cache writes were attempted but failed with filesystem `EPERM` outside the allowed workspace. This research file contains the findings and sources; cache persistence is not a planning prerequisite. [VERIFIED: research-store command output in this session]

| Area | Confidence | Reason |
|---|---|---|
| Standard stack | HIGH for existing declarations | No install or version choice; baseline suite ran |
| Architecture | HIGH for inspected seams; MEDIUM end-to-end | New composition not implemented yet |
| API compatibility | MEDIUM | Tagged official contract plus existing bridge; no fresh native staging probe |
| Picker native behavior | LOW pending A1 | Public API verified; host behavior requires UAT |
| Pitfalls | MEDIUM | Concrete source-grounded failure paths; proposed fixes unimplemented |

**Valid until:** planning/execution of this phase; recheck source line references after implementation and public API compatibility if the installed TaskNotes version changes.
