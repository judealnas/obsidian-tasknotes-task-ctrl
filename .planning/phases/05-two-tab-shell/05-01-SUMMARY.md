---
phase: 05-two-tab-shell
plan: "01"
subsystem: ui
tags: [obsidian, timer-cards, keyed-lists, vitest, lifecycle]
requires:
  - phase: 03
    provides: Timer session identity, pause/resume controllers and shared card order
provides:
  - TaskCard owns timer DOM, current-model actions, clocks and title-render lifecycle
  - CardList owns keyed reconciliation and independent drag/keyboard order
  - Mounted production-view tests through a dedicated deterministic Obsidian host
affects: [05-02, 05-03, 06-staged-tab-core]
tech-stack:
  added: []
  patterns: [injected keyed list callbacks, card-local renderer ownership, simulated host integration tests]
key-files:
  created:
    - src/ui/TaskCard.ts
    - src/ui/CardList.ts
    - tests/fakes/viewHost.ts
    - tests/taskCard.test.ts
    - tests/cardList.test.ts
    - tests/timerPaneView.test.ts
    - .planning/phases/05-two-tab-shell/05-01-task1-red.json
    - .planning/phases/05-two-tab-shell/05-01-task2-red.json
  modified: [src/ui/TimerPaneView.ts]
key-decisions:
  - Keep ordering upstream through orderTimers and the existing CardOrderStore; CardList owns no staging service or persistence format.
  - Track pending and attached title components together and release each once on replacement or disposal.
  - Retain shell subscriptions, completion checks and the single interval in TimerPaneView.
requirements-completed: [TABS-01]
coverage:
  - id: D1
    description: Current-model card actions, timestamp clocks and renderer cleanup through TaskCard
    verification:
      - kind: integration
        ref: node ../../../node_modules/vitest/vitest.mjs run --dir tests taskCard timerPaneView
        status: pass
    human_judgment: false
  - id: D2
    description: Keyed list identity, independent drag state, keyboard focus and shared saved order
    verification:
      - kind: integration
        ref: node ../../../node_modules/vitest/vitest.mjs run --dir tests cardList taskCard timerPaneView cardOrder cardOrderStore
        status: pass
    human_judgment: false
  - id: D3
    description: Native TaskNotes chip interaction, HTML drag geometry and rendered appearance
    verification: []
    human_judgment: true
    rationale: The deterministic host simulates DOM and lifecycle; native confirmation belongs to plan 05-03.
actuals:
  tokens: 20435
  tasks: 2
  commits: 4
plan_head_before: 13702803b9151290dcca9ba22f7be779c5ec1e80
plan_head_after: 948b640a45d61976479c721d8dce2bd58e0c16a2
duration: 13min
completed: 2026-11-13
status: complete
---

# Phase 5 Plan 1: Timer Card and List Extraction Summary

**The production timer pane now renders through TaskCard and CardList, with current-target actions, immediate renderer cleanup and independent reorder state.**

## Performance

- Duration: approximately 13 minutes, including context loading and verification.
- Tasks: 2 completed.
- Source/test files changed: 7; RED evidence files: 2.
- Actual tokens: 20,435, measured as the realized source/test/evidence diff characters divided by four and rounded upward.
- Commit count: 4 measured from the persisted plan ledger through the final implementation commit. The separate summary commit is outside this measured range.

## Accomplishments

- TaskCard receives the latest OpenTimer, dispatches exact current targets, maintains busy/stopping state, writes timestamp-derived clocks and owns both pending and attached title components.
- CardList reconciles unique session keys, moves only misplaced nodes, disposes removed cards, and handles local drag/keyboard ordering through injected callbacks. Each list retains independent DOM and drag state.
- TimerPaneView retains shared services, header guards, completion availability, event subscriptions and its single interval. Timers ordering and persistence keys are unchanged.
- Dedicated host tests import and instantiate production TimerPaneView, TaskCard and CardList. Two mounted views propagate shared order while retaining their own cards and drag authority.

## Task Commits

1. Task 1 RED: `2b22dd9` — mounted actions and pending title cleanup.
2. Task 1 GREEN: `0429ea7` — TaskCard extraction and lifecycle ownership.
3. Task 2 RED: `7830e9e` — disposed-list handle order protection.
4. Task 2 GREEN: `948b640` — keyed CardList extraction and independent reordering.

No separate REFACTOR commit was needed; each extraction was implemented in its GREEN commit.

## Verification

- `node ../../../node_modules/vitest/vitest.mjs run --dir tests taskCard timerPaneView`: 11 tests passed at the task 1 tracer feedback gate.
- `node ../../../node_modules/vitest/vitest.mjs run --dir tests cardList taskCard timerPaneView cardOrder cardOrderStore`: 37 tests passed across all 5 named files.
- `npm run typecheck`: passed after each extraction.
- `npm run check`: passed production build/typecheck, zero-warning ESLint and 560 tests across 20 files.
- `git diff --check`: passed.
- Existing parent-checkout node_modules supplied the installed lockfile dependencies. No install, package addition or lockfile change was required.
- The initial sandboxed build could not traverse a parent directory; rerunning the same full check with approved filesystem access succeeded.

## TDD Gate Compliance

- Task 1 RED: the mounted happy path passed, while removing a card left its pending renderer loaded (`0` unloads instead of `1`). The target executed and failed its cleanup assertion; no fixture or collection failure occurred. The unchanged TAP report and semantic assessment are in `05-01-task1-red.json`; `check tdd-red-evidence` returned `RED_EVIDENCE_OK` before implementation.
- Task 1 GREEN: TaskCard tracks every renderer owner, releases it once on replacement/removal/close, and invalidates late output. The targeted suite passed and was rerun successfully after the tracer commit before task 2 expanded the extraction.
- Task 2 RED: a retained handle from a closed view cleared the saved order. The target executed and failed the saved-order assertion. Vitest's multiline array diagnostic initially produced TAP rejected by the evidence parser; the test was rerun with a scalar order assertion and the real replacement report passed `RED_EVIDENCE_OK`. Evidence and semantic assessment are in `05-01-task2-red.json`.
- Task 2 GREEN: CardList checks both disposal and current card identity before reorder actions; the closed-handle regression and the complete targeted suite passed.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Pending title render ownership survived removal.** Found by task 1's planned delayed-render test. TaskCard now releases pending and attached components immediately and exactly once. Files: `src/ui/TaskCard.ts`, `src/ui/TimerPaneView.ts`; verified by card and mounted-view tests; implementation commit `0429ea7`.
2. **[Rule 1 - Bug] Closed-view handle could clear shared order.** Found by task 2's disposal coverage. CardList ignores events unless the owning list and exact card are current. Files: `src/ui/CardList.ts`, `src/ui/TimerPaneView.ts`; verified by retained-handle, drag isolation and two-view tests; implementation commit `948b640`.
3. **[Rule 3 - Blocking] Existing worktree branch failed the executor commit namespace guard.** With orchestrator authorization, renamed `gsd/phase-05-discuss` to `agent-phase-05-discuss`, preserving HEAD/history and the existing checkout. No new worktree was created. All commits passed the protected-branch and cwd checks and used normal hooks.

## Evidence Limits

The host simulates DOM insertion, capture/bubble events, focus, visibility, bounding rectangles and Obsidian Component ownership. It does not demonstrate native CSS/layout, Electron drag geometry or real TaskNotes post-processor behavior. Native confirmation remains assigned to 05-03, rather than being counted as an observed pass here.

## Known Stubs

None in production code. Test-host stand-ins intentionally model only the public behavior exercised by these tests. No new endpoints, file access or schema trust boundaries were introduced beyond the planned title/action/list surfaces.

## Tracking and Next Plan

- TABS-01 is also declared by unfinished sibling plans. `requirements.ready-ids` returned 0/1 ready, so REQUIREMENTS.md remains open despite the required plan-local frontmatter ID above.
- The orchestrator owns STATE.md/ROADMAP.md synchronization for this existing worktree. Its pre-existing STATE/config/state.json/milestone.lock changes were preserved.
- Ready for 05-02. This summary completes only 05-01; the phase is not complete.

## Self-Check: PASSED

All 7 source/test files and both RED records exist. All 4 recorded task commits are ancestors of HEAD. The full check passed and no source/test changes remain uncommitted.
