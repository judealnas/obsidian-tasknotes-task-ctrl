---
phase: 06-staged-tab-core
plan: "01"
subsystem: ui
tags: [staging, dates, lifecycle, tasknotes]
requires:
  - phase: 04-staging-foundations
    provides: Staging bridge and calendar-day helpers
  - phase: 05-two-tab-shell
    provides: Stable card lists and per-leaf tabs
provides: [Shared staged read store, strict membership and date metadata, idle staged cards, setup and Retry states]
affects: [06-02, 06-03, 06-04]
tech-stack:
  added: []
  patterns: [Read-only retained snapshots, generation guards, explicit idle card union]
key-files:
  created: [src/state/StagingStore.ts, src/model/staging.ts, tests/staging.test.ts, tests/stagingStore.test.ts]
  modified: [src/main.ts, src/ui/TaskCard.ts, src/ui/TimerPaneView.ts, styles.css, tests/timerPaneView.test.ts]
key-decisions:
  - Strict date-only strings are accepted; datetime suffixes are rejected.
  - New reads revoke write readiness immediately while retaining existing cards.
requirements-completed: [SETUP-02, SETUP-03, STAGE-02, STAGE-04, STAGE-05, SCARD-01]
actuals:
  tokens: 11412
  tasks: 3
  commits: 6
plan_head_before: 8bb93284fed5c464aa489c4b8b0dd5b113f411c1
plan_head_after: 65fe4db4ca2eb9792f117ac37215620ee8273803
duration: 13min
completed: 2026-11-14
status: complete
---

# Phase 6 Plan 1: External staged cards and setup recovery

Externally staged tasks now reach stable path-keyed cards through a shared, read-only StagingStore, with strict date/age metadata and recoverable setup states.

## Accomplishments

- Main creates and disposes the shared store, connects settings changes and safety resync, and injects it into every leaf.
- Top-level field presence overrides nested values, including explicit null. Future valid dates are reserved but hidden; completed/archived tasks are excluded. Calendar ordinal ages and local-noon formatting avoid DST and UTC display shifts.
- Failed task/status/catalog reads retain cards, expose Retry, and disable staging readiness. Late responses after generation change, disconnect or disposal cannot overwrite newer data.
- Idle staged cards use a genuine idle model, guarded Start, existing note/menu behavior and visibly disabled completion. Timers remain independent.

## Task Commits

1. Tracer: `7f17bb3` RED, `82195d3` GREEN.
2. Date/read safety: `ab8e131` RED, `2130abf` GREEN.
3. Setup/Retry: `919c302` RED, `65fe4db` GREEN.

## Verification

- All three named RED assertions executed and failed for their planned behavior; their complete TAP evidence records were validated as `RED_EVIDENCE_OK`. The semantic assessments are in `06-01-*-red.json`.
- `npx vitest run --dir tests taskCard timerPaneView`: 24 passed at tracer completion.
- `npx vitest run --dir tests staging stagingStore stagingDay stagedField`: 120 passed.
- `npx vitest run --dir tests timerPaneView stagingStore`: 24 passed after setup coverage.
- `npm run check`: build, lint (zero warnings), and all 601 tests in 22 files passed.

## Deviations from Plan

- The build needed approved access beyond the workspace to read shared esbuild dependencies; no package was installed or changed.
- Existing placeholder-shell tests keep their original fixture without the new optional store; the tracer and setup tests explicitly inject the real StagingStore. Production main always provides it.

## Planned Follow-on Boundaries

The Stage header remains disabled until 06-02 wires the command. Staged timer-state joins and Unstage arrive in 06-03. Shared persisted ordering and counts arrive in 06-04. These are the plan's explicit future tasks.

## Native Evidence Limits

Mounted fake-host tests establish component behavior, not native Obsidian rendering or TaskNotes chip semantics. Guarded CDP UAT remains at phase end. Neutral date/age styling still needs native review.

## Self-Check: PASSED

Created source/test files exist; task commits are reachable on agent-phase-05-discuss; all specified automated behavior checks and full check passed. No dependencies were added.
