---
phase: 05-two-tab-shell
plan: "02"
subsystem: ui
tags: [obsidian, tabs, accessibility, workspace-state, vitest]
requires:
  - phase: 05-01
    provides: Extracted TaskCard, independent CardList and mounted view host
provides:
  - Stable Staged and Timers panels with independent headers and list ownership
  - Per-leaf validated tab persistence through public Obsidian view state
  - Linked ARIA tabs, roving focus and automatic keyboard activation
affects: [05-03, 06-staged-tab-core]
tech-stack:
  added: []
  patterns: [per-leaf view state, per-panel visibility modifiers, public layout-save request]
key-files:
  created:
    - .planning/phases/05-two-tab-shell/05-02-task1-red.json
    - .planning/phases/05-two-tab-shell/05-02-task2-red.json
  modified:
    - src/ui/TimerPaneView.ts
    - styles.css
    - tests/timerPaneView.test.ts
    - tests/fakes/viewHost.ts
key-decisions:
  - Keep tab state on each view instance and request workspace layout saving only after explicit selection changes.
  - Preserve superclass view state and call its setState with the public ViewStateResult signature.
  - Scope content visibility to panels; hide inactive panels with an explicit hidden selector.
requirements-completed: [TABS-01, TABS-02]
coverage:
  - id: D1
    description: Stable panels, independent headers, disabled Stage and exact empty copy
    verification:
      - kind: integration
        ref: node ../../../node_modules/vitest/vitest.mjs run --dir tests timerPaneView taskCard cardList
        status: pass
    human_judgment: false
  - id: D2
    description: Both restore lifecycle orders, malformed state fallback, unique leaf IDs, explicit saves and keyboard activation
    verification:
      - kind: integration
        ref: node ../../../node_modules/vitest/vitest.mjs run --dir tests timerPaneView main
        status: pass
    human_judgment: false
  - id: D3
    description: Native restart persistence, real focus navigation and rendered tab appearance
    verification: []
    human_judgment: true
    rationale: Requires real Obsidian confirmation in 05-03; the host simulates lifecycle and focus.
actuals:
  tokens: 6841
  tasks: 2
  commits: 4
plan_head_before: 68b74d981dcf5660171a01c7babe5cd763b92d77
plan_head_after: 351442acb9fe2ce98d495c30ef14b4bf8729e672
duration: 12min
completed: 2026-11-13
status: complete
---

# Phase 5 Plan 2: Two-Tab Shell and Leaf Persistence Summary

**The pane switches stable Staged and Timers panels, serializes each leaf's selected tab and supports linked ARIA tabs with keyboard activation.**

## Accomplishments

- Built text-only Staged/Timers tabs with an accent underline, independent panel/header DOM and separate CardList instances. Timers retains all four header actions, current card identity, shared order and existing timer behavior.
- Staged shows the exact final empty copy and disabled Stage button with its tooltip. It reads no staging tasks, saves no order and invokes no picker.
- Implemented public getState/setState with enum/container validation, Timers fallback, restoration before or after opening, superclass handling and explicit requestSaveLayout calls after local selection changes. No data.json keys or main.ts behavior changed.
- Added unique per-pane tab/panel IDs, ARIA relationships, selected states, roving tabindex, Left/Right wrapping and Home/End activation. Tab moves into an otherwise empty active panel; ordinary renders preserve focus.

## Task Commits

1. Task 1 RED: `217c6d7` — specify independent tab panels.
2. Task 1 GREEN: `2f77161` — add independent Staged and Timers panels.
3. Task 2 RED: `e6fbefa` — specify leaf restoration and keyboard focus.
4. Task 2 GREEN: `351442a` — persist leaf tabs and add accessible keyboard navigation.

No separate refactor commit was necessary. The measured four commits cover the persisted ledger base through the final implementation commit; the summary metadata commit is separate. Actual tokens use realized source/test/evidence diff characters divided by four, rounded upward.

## Verification

- Task 1 targeted suite and post-commit tracer feedback rerun: 22 tests passed across timerPaneView, taskCard and cardList.
- Task 2 targeted suite: 25 tests passed across timerPaneView and main.
- `npm run typecheck`: passed.
- `npm run check`: passed production build/typecheck, ESLint with zero warnings and all 564 tests across 20 files.
- `git diff --check`: passed; task commits contain no tracked-file deletions.
- No package installation or dependency/lockfile change occurred. Existing parent node_modules supplied pinned dependencies. Public view-state API signatures were checked directly in the installed Obsidian declarations.
- The sandboxed full build could not traverse the parent directory. The same full check passed with approved filesystem access.

## TDD Gate Compliance

- Task 1 RED executed the mounted switch test and failed because the tab-label list was empty. The complete unchanged TAP report and semantic assessment are in `05-02-task1-red.json`. Machine classification returned `RED_EVIDENCE_OK`; the failure was the intended assertion, without collection/fixture errors.
- Task 1 GREEN introduced stable panels, separate lists, switching and scoped visibility. The targeted suite passed, and its successful tracer feedback rerun preceded task 2 implementation.
- Task 2 RED executed and failed on getState returning an undefined tab after explicit selection; additional restore and ARIA assertions also failed as planned. `05-02-task2-red.json` preserves the report and semantic assessment; classification returned `RED_EVIDENCE_OK` before implementation.
- Task 2 GREEN added validated public persistence and ARIA keyboard behavior. Tests cover valid states and malformed undefined/null/object/scalar/array/enum values in both lifecycle orders, no restoration save loop, four keyboard saves, distinct leaves and focus stability.

## Deviations from Plan

- **[Rule 3 - Blocking] Existing unscoped test queried the first message in the new two-panel DOM.** Scoped that assertion to the Timers panel so it continues checking Timers idle copy. No product text changed. Commit: `2f77161`.
- The dedicated host gained base getState/setState methods and resettable layout-save observation. An initial focus test exposed that the simulation does not apply CSS visibility to the retry button; focus eligibility now explicitly follows the same missing/incompatible state rule as retry visibility, avoiding a layout-dependent decision.

## Known Stubs

| File | Location | Reason |
|------|----------|--------|
| src/ui/TimerPaneView.ts | Stage setup near line 129; empty list reconciliation near line 330 | Intentional Phase 05 static Staged list and disabled Stage action; Phase 06 wires staging behavior. |

The intentional stub is required by D-09/D-10 and does not prevent this plan's shell goal. It is recorded as WINDOWS ledger entry 16 for follow-through in Phase 06. No new security-relevant surface beyond the plan's validated saved-state and leaf/hidden-panel boundaries was introduced.

## Evidence Limits and Follow-Through

TABS-02's generic spec-less probe remains **unclassified/unresolved (review manually)**. The mounted tests prove serialization, save-request timing and restoration behavior in the simulated host; they do not prove that native Obsidian persists/replays layout state across restart. Native restart, actual two-leaf layout behavior, rendered hidden-panel CSS, focus navigation and TaskNotes integration remain assigned to 05-03 and are not claimed as observed passes here.

The full connection/event matrix and native UAT remain 05-03 work. This summary completes only 05-02. TABS-01/TABS-02 remain shared phase requirements; the orchestrator owns STATE/ROADMAP/REQUIREMENTS updates and their final readiness decision. Its existing config/state/lock edits were preserved.

## Self-Check: PASSED

All four source/test files, both RED evidence records and this summary exist. All four task commits are ancestors of HEAD. The full check passed and no task source/test changes remain uncommitted.
