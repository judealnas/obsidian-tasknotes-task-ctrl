# Phase 6: Staged Tab Core - Pattern Map

**Mapped:** 2026-11-14  
**Files analyzed:** 12 planned source seams (4 new modules, 8 existing integration files)  
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest tracked Analog | Match Quality |
|---|---|---|---|---|
| `src/model/staging.ts` (new; exact name at planner discretion) | utility/model | transform | `src/model/stagedField.ts`, `src/model/stagingDay.ts` | role-match |
| `src/state/StagingStore.ts` (new) | store | request-response | `src/state/TimerStore.ts` | role-match |
| `src/state/StagedOrderStore.ts` (new) | store | CRUD | `src/state/CardOrderStore.ts` | role-match |
| `src/state/StagingController.ts` (new) | controller | request-response | `src/state/TimerController.ts` | role-match |
| `src/ui/TaskPickerModal.ts` | component | request-response | same file | exact |
| `src/ui/TaskCard.ts` | component | event-driven | same file | exact |
| `src/ui/CardList.ts` | component | event-driven | same file | exact |
| `src/ui/TimerPaneView.ts` | component | request-response | same file | exact |
| `src/main.ts` | provider/config wiring | CRUD | same file | exact |
| `src/model/cardOrder.ts` | utility/model | transform | same file | exact |
| `tests/staging*.test.ts`, `tests/stagedOrder*.test.ts` (proposed) | test | request-response / transform | `tests/cardOrderStore.test.ts`, `tests/bridge.test.ts`, `tests/timerPaneView.test.ts` | role-match |
| Existing picker/card/view/order tests | test | event-driven / request-response | corresponding test files | exact |

All named source and test analogs below were confirmed tracked with `git ls-files`. No graph was available (`graphify-out/graph.json` absent). Source/test trees are `src/{model,state,tasknotes,ui}` and `tests/`.

## Pattern Assignments

### New staging model

**Analogs:** `src/model/stagedField.ts` lines 11-40; `src/model/stagingDay.ts` lines 12-46; `src/model/cardOrder.ts` lines 6-23.

Keep pure helpers free of Obsidian imports and clock reads; pass `nowMs` and rollover hour in. Centralize the fixed field key and use `fieldStatus` (including unknown and non-empty default states) rather than repeating catalog checks. For membership, follow research guidance: own top-level field presence takes precedence over nested data, validate dates strictly, and keep eligibility separate from order projection. The existing bounded-order helper caps stored keys at 1000.

### New StagingStore

**Analog:** `src/state/TimerStore.ts` (tracked; inspect refresh lifecycle and listener cleanup around lines 1-120 and 180-300 during implementation).

Use plugin-scoped shared state, last-good snapshots, subscriptions, debounced reads, and generation/revision checks. Retain cards on failed task/catalog reads and expose warning/retry state separately from an empty result. Reconcile only from a successful full task list; never infer deletion from a filtered or eligible subset. Do not mutate TaskNotes or invoke persistence from refresh/render.

### New StagedOrderStore and order projection

**Analog:** `src/state/CardOrderStore.ts` lines 5-20 and 21-82; `src/model/cardOrder.ts` lines 6-23 and 45-54.

```ts
export interface CardOrderStoreDeps {
  log: (message: string) => void;
  persist?: (order: readonly string[]) => Promise<void>;
}
```

Copy load-once behavior, defensive copies, change-only notification, bounded/deduplicated path data, and caught persistence failures. Keep Staged order distinct from timer session order. Append newly observed external staging at the bottom; apply rename only to an exact path or slash-bounded descendants, then deduplicate. Prune only after authoritative absence; explicit successful unstage can remove its entry.

**Tests:** `tests/cardOrderStore.test.ts` lines 1-9, 12-53, 69-80 covers factory setup, copies, one-time load, persistence, and rejection logging. Extend with empty omission, malformed/capped input, rename and confirmed-prune cases.

### New StagingController

**Analog:** `src/state/TimerController.ts` lines 137-149, 219-229, 375-394; `src/state/WriteQueue.ts` lines 15-22.

```ts
outcome = await queue.run(async () => {
  // Re-read safety-sensitive state inside the serialized operation.
  // Perform the minimal public TaskNotes write, then update plugin state.
});
```

Return explicit outcome values; guard busy actions, re-check availability/registration/defaults and eligibility inside the shared queue, and normalize failures. For unstage, keep the stop/pause-clear/null-write sequence in one queue callback and use a non-queued in-queue helper; never call a public queued controller method from inside `queue.run`. Check fresh Pomodoro ownership before stopping regular timing; unreadable ownership must not be treated as safe. A successful TaskNotes write followed by order-save failure is partial success: keep the task staged and surface the order-save problem.

### Picker, cards, list, and pane

**Picker analog:** `src/ui/TaskPickerModal.ts` lines 41-77, 80-112, 115-145. Reuse the task snapshot + `filterAndSortTasks` flow, lifecycle generation guards, component cleanup for rendered links, and event-time availability checks. Add a Stage-specific choice path so successful selection removes only that task, preserves query/focus and keeps the modal open; failures keep the row and show inline retryable error. Preserve current Start close behavior.

**Card/list analogs:** `src/ui/TaskCard.ts` lines 14-42, 63-84, 120-139; `src/ui/CardList.ts` lines 3-20 and remaining keyed reconciliation/drag handlers. Extend card models while preserving the same mounted card and title component when only timer/staging metadata changes. Reuse task title, note/context-menu, cleanup, drag handle and ArrowUp/Down behavior; keep ordering supplied by caller. Preserve existing Timers controls by making staged-card behavior an explicit option/model state.

**Pane analog:** `src/ui/TimerPaneView.ts` lines 101-119, 280-299. Keep stable tab panels and per-leaf selected tab; derive counts/highlight separately from selected state. Join staging membership with timer snapshots for the muted Timers marker. Follow the existing registered lifecycle cleanup for subscriptions and intervals. Retry/configuration messages belong to Staged panel state; setup failure must not blank retained cards.

### Shared service and persistence wiring

**Analog:** `src/main.ts` lines 15-22, 86-103, 145-159; `src/tasknotes/TaskNotesBridge.ts` lines 1-7, 280-293, 356-390.

Create one shared StagingStore, StagedOrderStore, and controller for all leaves, inject the existing single `WriteQueue`, and persist staged order through `persistAll`. Extend `OWNED_KEYS` and load/save serialization together; the persistence callback must read current serialization when the queued save runs. Keep TaskNotes access behind the bridge and use the already feature-gated `userFields`, `stagingAvailability`, and `updateTask` methods; write only `{ staged: day }` or `{ staged: null }` with mutation context. Do not add TaskNotes internals or auto-registration.

## Shared Patterns

| Concern | Source | Reuse |
|---|---|---|
| TaskNotes feature gate and mutation boundary | `src/tasknotes/TaskNotesBridge.ts:57-75, 280-293, 356-390` | public gateway APIs, stage availability, catalog reads, minimal update |
| Serialized writes and fresh checks | `src/state/WriteQueue.ts:15-22`; `src/state/TimerController.ts:137-149` | same queue for stage, unstage, and timers; safety checks inside callback |
| One writer and unknown-key preservation | `src/main.ts:15-22, 50-71` | extend owned key and snapshot state at actual persistence execution |
| Pure staging-day logic | `src/model/stagingDay.ts:12-46` | pass clock/config explicitly; reuse calendar boundary |
| Stable DOM and cleanup | `src/ui/CardList.ts`, `src/ui/TaskCard.ts:63-84` | keyed cards and unload render components only when card leaves/changes title |

## Test Patterns

- `tests/timerPaneView.test.ts:25-43, 81-105, 162-200`: local fake gateway/controller, flush helper, mounted DOM checks, and assertions that refresh/render cause no writes.
- `tests/taskPickerModal.test.ts:1-20` and remaining picker cases: mock Obsidian surface and track renderer lifecycle; extend the fake to represent input value/focus and keep-open Stage selection.
- `tests/bridge.test.ts`: fake TaskNotes runtime contract and feature gate behavior; cover staged API availability and user field reads without runtime dependency.
- `tests/main.test.ts`: persistence wiring and preservation of unknown keys; cover interleaved settings/order saves and empty staged-order removal.
- `tests/taskCard.test.ts`: mounted card lifecycle and action dispatch; cover staged metadata across idle/running/paused and zero completion calls.

## No Analog Found

No exact staged membership model/store/controller exists yet. The analogs above supply structure only; the staging-specific semantics (date eligibility, field readiness, ownership-safe unstage and retained read failures) should follow Phase 06 context/research.

## Metadata

**Analog search scope:** `src/model`, `src/state`, `src/tasknotes`, `src/ui`, `tests/`  
**Files scanned:** 12 core source analogs and matching test suites  
**Pattern extraction date:** 2026-11-14
