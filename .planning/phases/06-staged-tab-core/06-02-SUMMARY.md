---
phase: 06-staged-tab-core
plan: "02"
subsystem: ui
tags: [staging, picker, concurrency]
requires:
  - phase: 06-01
    provides: Shared staging projection and setup readiness
provides: [Queued fresh-checked Stage command, keep-open ranked batch picker, retry and focus guards]
affects: [06-03, 06-04]
tech-stack:
  added: []
  patterns: [Discriminated picker options, command outcomes separate from refresh results, single shared queue]
key-files:
  created: [src/state/StagingController.ts, tests/stagingController.test.ts]
  modified: [src/ui/TaskPickerModal.ts, src/ui/TimerPaneView.ts, src/main.ts, src/state/StagingStore.ts, tests/taskPickerModal.test.ts]
key-decisions:
  - Recheck the selected task after the final registration await to protect an externally staged future date.
  - A committed field update remains successful when later refresh or order persistence fails.
requirements-completed: [STAGE-01, SETUP-02, STAGE-04]
actuals:
  tokens: 7646
  tasks: 2
  commits: 7
plan_head_before: 49bfba4d1e9e0c095ddb38c3aa7ea8091e7c88c0
plan_head_after: e634b5221a27c5905e2a52cd24e2ea58fd8772b9
duration: 9min
completed: 2026-11-14
status: complete
---

# Phase 6 Plan 2: Batch Stage picker and fresh queued writes

The Stage picker now stages several eligible tasks quietly in one opening, preserving the latest query and focus while validating each mutation inside the shared write queue.

## Accomplishments

- One plugin-scoped controller uses the existing WriteQueue and documented bridge updateTask with exactly a staged calendar-date patch and mutation context.
- Fresh availability, Date/no-default registration, completed-status and task checks block missing, archived, completed or already reserved tasks. A valid future date is never overwritten.
- Stage mode bypasses the public modal superclass close path; Start retains its existing once-only close behavior. Pending mouse/Enter selections share one guard.
- Success removes only the selected normalized path. Failures preserve the row/query and show a concise inline retry message. Closed modal generations cannot update or refocus.
- Main wires the real controller; header readiness depends on successful setup reads and current busy state. No timer starts as a side effect of staging.

## Task Commits

- Task 1 RED: `1a6ae7a`, `1b3aec2`, `a611118`; GREEN: `b1c9c11`.
- Task 2 RED: `849d784`; GREEN: `858db77`, `e634b52`.

## Verification

- Both intended RED assertions validated as RED_EVIDENCE_OK. The initial Vitest spy message emitted malformed multiline TAP; replacing it with the equivalent numeric call-count assertion produced a valid unchanged reporter record before production implementation.
- Real picker/controller/store integration asserts exact `staged: 2026-11-14`, one listed task, input focus/query, no notification and zero timer starts.
- `npx vitest run --dir tests taskPickerModal timerPaneView`: 31 passed.
- `npx vitest run --dir tests stagingController stagingStore taskPickerModal`: 36 passed.
- `npm run check`: build, zero-warning lint, 617 tests in 23 files passed.

## Deviations from Plan

No product scope changes or dependencies. A numeric assertion was required because the installed RED classifier correctly rejected Vitest's malformed multiline spy-error TAP.

## Native Evidence Limits

Public selectSuggestion is tested against the fake modal, not native Obsidian. Repeated mouse/Enter Stage, Escape/outside-close and newest-query focus remain native assumption A1 until guarded phase-end CDP UAT.

## Planned Follow-on Boundary

The optional explicit order-commit seam is intentionally not connected until 06-04 adds persisted Staged ordering.

## Self-Check: PASSED

Source/test files and reachable task commits verified; focused and full checks passed. No packages installed.
