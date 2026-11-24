---
phase: quick-261115-ogd
plan: "01"
status: complete
subsystem: timer-pane
tags: [tasknotes, native-task-creation, staged, idle-cards, modal-lifecycle]
requires: [tasknotes-runtime-api, staging-controller, idle-card-store]
provides: [native-create-task-action, single-request-creation-capture, originating-pane-routing]
affects: [staged-picker, timers-picker, tasknotes-bridge]
tech-stack:
  added: []
  patterns: [plugin-scoped-coordinator, request-token-cancellation, detachable-runtime-listeners]
key-files:
  created: [src/state/TaskCreationCoordinator.ts]
  modified: [src/main.ts, src/tasknotes/TaskNotesBridge.ts, src/tasknotes/runtime-api.types.ts, src/ui/TaskPickerModal.ts, src/ui/TimerPaneView.ts]
key-decisions:
  - Capture TaskNotes' documented task.created event before invoking its registered native creation command.
  - Fail closed unless the public events.list catalog explicitly advertises task.created; tasks.events alone is insufficient for older compatible versions.
  - Treat the newly opened TaskNotes modal and a request token as the lifetime of one plugin-wide capture.
  - Route the saved task only through StagingController.stage or IdleCardStore.add; task creation never starts timing.
requirements-completed: []
coverage:
  - id: D1
    description: Both task pickers expose TaskNotes' native Create new task dialog with plugin-wide cancellation and busy gating.
    verification:
      - kind: other
        ref: npm run typecheck
        status: pass
      - kind: other
        ref: npm run lint
        status: pass
    human_judgment: true
    rationale: Native Obsidian modal behavior was intentionally not exercised by this source-only quick task.
  - id: D2
    description: Saved tasks return to the originating Staged insertion point or Timers idle-card store without starting a timer.
    verification:
      - kind: other
        ref: scoped source control-flow review
        status: pass
    human_judgment: true
    rationale: Runtime persistence and visible pane placement require later native acceptance.
completed: 2026-11-15
commits: 2
plan_head_before: ac3985524bc13a2978fcb21cf53b7e6745b79a86
plan_head_after: a5bdb858907cda84933917a8336de12c92617d90
---

# Quick Task 261115-ogd: Create TaskNotes tasks from either pane

Task pickers now open TaskNotes' native creation dialog and return the saved task to the exact originating destination without starting time tracking.

## Accomplishments

- Added one plugin-scoped `TaskCreationCoordinator` that validates the command and Runtime API event capability, subscribes before command execution, and owns at most one request across pane leaves.
- Cancellation detaches the task listener, bridge-state listener, modal observer and timeout when the modal closes unsaved, TaskNotes disconnects, a request is superseded, opening fails, or the plugin unloads.
- Added a clearly labelled and availability-gated `Create new task` action to both pickers. Staged routing preserves `beforePath`; Timers routing calls `IdleCardStore.add(task)` and persists an idle card.
- Coordinator busy state is shared across open pane leaves. Destination failures use existing Notice/log behavior.

## Task Commit

- `cf4a676` — `feat(261115-ogd): create tasks from pane pickers`
- `a5bdb85` — `fix(261115-ogd): require task created event catalog`

## Verification

- PASS: `npm run typecheck`.
- PASS: `npm run lint` with zero warnings.
- PASS: the installed dev-vault TaskNotes manifest is 4.18.2, and its public bundled Runtime API exposes `events.list()` with `task.created` advertised. Missing, unreadable, or non-advertising catalogs now disable creation with a clear reason.
- PASS: scoped diff review found changes only in the six planned source files.
- PASS: source audit confirms the new success routes call exactly `StagingController.stage({ taskPath, title, beforePath })` or `IdleCardStore.add(task)`. They do not call `TimerController.start`, `IdleCardStore.start`, `tasks.create`, or a TaskNotes time-write API.
- PASS: unrelated `styles.css`, `.planning/STATE.md`, `.planning/config.json`, local settings, lock/cache files, and the separate TaskNotes checkout were not staged or committed.
- Tests were neither added nor run, as required by the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Compatibility] Required explicit `task.created` catalog support**

- **Found during:** Post-commit compatibility review.
- **Issue:** The `tasks.events` capability and `events.on/off` methods are present in the older 4.13.8-compatible contract but do not prove that `task.created` is supported.
- **Fix:** Added the optional public `events.list()` contract and fail-closed catalog checks in availability and immediately before subscription.
- **Verification:** Installed TaskNotes 4.18.2 bundle inspection, `npm run typecheck`, and `npm run lint`.
- **Committed in:** `a5bdb85`.

## Known Stubs

None.

## Remaining Acceptance

Native Obsidian acceptance remains unobserved: cancel the TaskNotes dialog and confirm no later task is captured; save from each picker and confirm the Staged insertion position or persistent idle Timers card; confirm no timer starts.

## Self-Check: PASSED

All six committed source files exist, commits `cf4a676` and `a5bdb85` are ancestors of HEAD, both required validation commands passed after the compatibility fix, and the summary exists on disk. The completed quick task is now linked from `.planning/STATE.md`; Phase 7 acceptance remains open.
