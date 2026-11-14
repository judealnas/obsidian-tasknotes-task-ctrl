---
phase: 06-staged-tab-core
plan: "04"
subsystem: ui
tags: [ordering, persistence, staging, counts, lifecycle]
requires:
  - phase: 06-03
    provides: Staged timer controls and safe Stage/Unstage commands
provides: [Independent persisted path order, safe external append and rename reconciliation, numeric tab counts, regular-running cue, Timers staged markers]
affects: [07]
tech-stack:
  added: []
  patterns: [Nonpersisting read observation, execution-time single-writer serialization, vault rename generation authority]
key-files:
  created: [src/state/StagedOrderStore.ts, tests/stagedOrderStore.test.ts]
  modified: [src/state/StagingStore.ts, src/model/staging.ts, src/main.ts, src/ui/TimerPaneView.ts, styles.css, tests/main.test.ts, tests/stagingStore.test.ts, tests/stagingController.test.ts, tests/timerPaneView.test.ts]
key-decisions:
  - Reordering visible tasks preserves saved hidden-path slots.
  - Read observation updates only memory; explicit order/Stage/Unstage/rename actions persist through persistAll.
  - Deletion pruning requires a successful full task read and a vault existence check confirming absence.
  - Known renamed cards survive TaskNotes reindex gaps until their new paths are indexed.
requirements-completed: [ORDER-01, ORDER-02, ORDER-03, STAGE-02, TABS-03, TABS-04]
actuals:
  tokens: 12537
  tasks: 3
  commits: 8
plan_head_before: 78462cb5574e7ea739a87925b58bb660c94f1f24
plan_head_after: c5ab63cd5a3bf58d8458af4da65f99693c39b12f
duration: 13min
completed: 2026-11-14
status: complete
---

# Phase 6 Plan 4: Independent priorities and tab cues

Staged priorities now survive restarts, external staging and vault renames, while both tab labels show accurate counts and regular timing stays visible independently of the selected tab.

## Accomplishments

- StagedOrderStore normalizes/deduplicates paths, caps stored entries at 1000, provides defensive copies, preserves changes made before load, and catches UI persistence errors. Awaited command commits report save failure separately.
- Main owns stagedOrder, loads it with existing data, excludes it from unknown extras, and serializes it inside the existing execution-time persistAll callback. Empty order omits its key. Interleaved settings/pauses/Timers/Staged saves and restart preserve all current values and unknown extras.
- Staged CardList uses its own order callback and shared order notifications. Keyboard and drag preserve local authority and focus; Timers order remains independent. Hidden task slots retain priority.
- Full successful reads append new external arrivals at the bottom in deterministic date/path order without persisting. Future/completed/archived/unstaged tasks do not count as deleted. Only full absence plus a missing vault file prunes memory.
- Vault renames synchronously remap order and current staged snapshots at exact/slash boundaries, invalidate late responses, deduplicate collisions, and preserve renamed cards/order through TaskNotes reindex gaps. Explicit Stage/Unstage update order only after a committed field write.
- Counts always include numeric zero. Staged counts eligible listed paths; Timers uses the existing conservative regular-running header count. Only the Timers count receives the accent. Timers markers use the same eligible staged set, and shared changes never select either leaf's tab.

## Task Commits

- Ordering tracer RED `252ed40`, GREEN `4dbc7cf`.
- Lifecycle RED `fe82baf`, GREEN `4645a68`.
- Counts RED `3c3197d`, GREEN `26e558d`.
- Additional explicit-refresh safety RED `2133f1f`, GREEN `c5ab63c`.

## Verification

- All four named RED assertions validated as RED_EVIDENCE_OK with actual TAP output and semantic assessments.
- `npx vitest run --dir tests stagedOrderStore main cardList cardOrderStore timerPaneView`: 55 passed at persistence tracer completion.
- `npx vitest run --dir tests stagingStore stagingController stagedOrderStore main`: 62 passed after lifecycle expansion.
- `npx vitest run --dir tests cardList taskCard timerPaneView cardOrder cardOrderStore stagedOrderStore`: 60 passed after tab cues.
- Final affected read/controller/view suite: 61 passed.
- `npm test -- --reporter=dot`: 650 tests in 24 files passed.
- `npm run check`: build, zero-warning lint, 650 tests in 24 files passed.
- `git diff --check`: passed. No new packages or dependency changes.

## Deviations from Plan

[Rule 1 - Bug] Final inspection exposed a second explicit refresh briefly republishing its predecessor's success while retrying. A regression test reproduced it, its RED evidence was validated, and superseding calls now advance the read generation. Final focused and full checks passed after the fix.

## Native Evidence and Handoff

This executor did not start native UAT; the parent orchestrator owns guarded phase-end `npm run uat:start`, build/hash provenance, CDP observations, `npm run uat:stop`, security/regression reports and 06-UAT.md. No native pass is claimed here. In particular native SuggestModal batching/focus/Escape/outside-close, TaskNotes chip/menu behavior, raw staged date/null YAML, actual Pomodoro controls, layout/neutral age styling and persisted restart need their planned observations.

The known path-only stop race remains documented in 06-03-SUMMARY.md. Descriptor-less prohibition enforcement and human judgment of age framing remain COVERAGE.md flags until phase-end evidence resolves them. Phase 7 completion, Done today, automatic overnight rollover, mobile controls, display rename and release remain outside scope.

## Self-Check: PASSED

Created files exist and task commits are reachable on agent-phase-05-discuss. All planned automated commands passed. Refresh/render never call TaskNotes mutation or persistence callbacks. All four implementation plans are complete; phase acceptance is left to the orchestrator.
