---
phase: 06-staged-tab-core
plan: "03"
subsystem: ui
tags: [staging, timers, ownership, unstage]
requires:
  - phase: 06-02
    provides: Queued staging commands and shared membership
provides: [Stable staged timer controls, Pomodoro-safe null Unstage, honest partial failure outcomes]
affects: [06-04, 07]
tech-stack:
  added: []
  patterns: [Render-time path join, private nonqueued stop body, guarded current-model actions]
key-files:
  created: []
  modified: [src/state/StagingController.ts, src/state/StagingStore.ts, src/ui/TaskCard.ts, src/ui/TimerPaneView.ts, src/main.ts, styles.css, tests/stagingController.test.ts, tests/taskCard.test.ts, tests/timerPaneView.test.ts]
key-decisions:
  - Staged cards prefer a regular running session, then paused session, then genuine idle state.
  - Exact Pomodoro ownership protects only that entry; unreadable ownership blocks Unstage when an open entry exists.
  - A failed null write after stopping or clearing a pause reports partial success without restarting timing.
requirements-completed: [STAGE-03, SCARD-01, SCARD-02, SCARD-03, SCARD-04]
actuals:
  tokens: 10030
  tasks: 2
  commits: 4
plan_head_before: 73bb72959ccc0a3324e73c87505c1a5be1ca1e79
plan_head_after: 3d266acc91396f6c3fbe7e2cf3cbd0d387c54572
duration: 9min
completed: 2026-11-14
status: complete
---

# Phase 6 Plan 3: Staged timer controls and safe Unstage

Staged cards now follow live regular timer sessions without replacing their DOM, and Unstage stops only a freshly verified regular entry before writing exactly `staged: null`.

## Accomplishments

- The real TimerStore/PauseStore/TimerController tracer exercises Start, Pause, Resume and Stop on one mounted card; session time runs, freezes and resumes correctly, retaining title and keyboard focus.
- A readable exact Pomodoro-owned timer is absent from the join, appears idle, and Start reaches the existing refusal Notice with zero extra starts.
- Staged completion stays visible/disabled with zero complete calls in idle, running and paused states. Timers completion remains unchanged.
- Separate top-right Unstage reads the current task target, respects combined busy state and performs no confirmation step.
- Unstage enters the shared queue once, checks Date registration before side effects, repeats active/ownership identity checks before a private path-only stop, clears only that path's pane pause, and writes exactly the documented null patch.
- Nonempty Date defaults block Stage only. Missing/wrong/unreadable registration and unsafe ownership block before stopping. Stop failures retain staging; subsequent null failure leaves an idle staged task and reports partial success. Successful null outcomes remain successful after refresh/order-save failure.

## Task Commits

- Timer tracer RED `5a62231`, GREEN `2c3b67a`.
- Unstage RED `4175431`, GREEN `3d266ac`.

## Verification

- Both named RED assertions validated as RED_EVIDENCE_OK with semantic assessments in their JSON evidence.
- `npx vitest run --dir tests taskCard timerPaneView`: 27 passed at timer tracer completion.
- `npx vitest run --dir tests stagingController taskCard pauseResume timerPaneView`: 96 passed after Unstage expansion.
- `npm run check`: build, zero-warning lint and 633 tests in 23 files passed.
- Barrier tests protect exact ownership, same-path/different-start timers, takeover, replacement, unreadable ownership, fresh empty-path permission, failed stop/null/catalog reads, duplicate commands and save/refresh failures.

## Deviations from Plan

None in product scope. Partial-result reporting also covers a pause cleared before a failed null write, so it does not imply the operation rolled back.

## Residual External Race and Native Limits

TaskNotes time.stop accepts only a path. Another actor can replace an entry after the final active/ownership read and before that call. The pane queue serializes pane commands; it is not a TaskNotes transaction. No atomicity claim is made.

Native regular/Pomodoro operation, chip behavior and raw YAML null observation remain phase-end guarded CDP UAT items. Source and fake-host tests do not establish those native observations.

## Self-Check: PASSED

All modified source/test files exist, task commits are reachable, and focused/full checks passed. No dependencies or Phase 7 completion behavior were added.
