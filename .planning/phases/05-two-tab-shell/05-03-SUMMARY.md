---
phase: 05-two-tab-shell
plan: "03"
subsystem: ui
tags: [obsidian, reconnect, picker, lifecycle, native-uat]
requires:
  - phase: 05-02
    provides: Independent tab panels, per-leaf state and ARIA keyboard navigation
provides:
  - Shared loading and connection messages with disabled cached header actions
  - Typed start-only picker options with retained lifecycle guards
  - Automated regression and isolated native restart/reconnect evidence
affects: [06-staged-tab-core, phase-05-verification]
tech-stack:
  added: []
  patterns: [shell-owned lifecycle, connection-before-content rendering, scoped native button styling]
key-files:
  created:
    - .planning/phases/05-two-tab-shell/05-03-task1-red.json
    - .planning/phases/05-two-tab-shell/05-03-task2-red.json
    - .planning/phases/05-two-tab-shell/05-03-native-evidence.jsonl
  modified:
    - src/ui/TimerPaneView.ts
    - src/ui/TaskPickerModal.ts
    - tests/timerPaneView.test.ts
    - tests/taskPickerModal.test.ts
    - styles.css
key-decisions:
  - Derive connection readiness from PaneState so a ready bridge with a null snapshot still renders loading in both tabs.
  - Keep native computed-style and restart observations distinct from simulated host tests and synthetic input events.
requirements-completed: [TABS-01, TABS-02]
coverage:
  - id: D1
    description: Both-tab connection messages, disabled actions and retained shell lifecycle
    requirement: TABS-01
    verification:
      - kind: integration
        ref: tests/timerPaneView.test.ts
        status: pass
      - kind: automated_ui
        ref: 05-03-native-evidence.jsonl#native-reconnect-after-probe
        status: pass
    human_judgment: false
  - id: D2
    description: Start-only picker options preserve selection and cleanup behavior
    verification:
      - kind: integration
        ref: tests/taskPickerModal.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Independent leaf selections restore after isolated native restart
    requirement: TABS-02
    verification:
      - kind: automated_ui
        ref: 05-03-native-evidence.jsonl#native-restart
        status: pass
    human_judgment: false
  - id: D4
    description: Physical drag/hover, narrow-pane appearance, chip mouse ownership and OS sleep/wake
    verification: []
    human_judgment: true
    rationale: Hidden isolated desktop and synthetic DOM events cannot establish these observations; precise limits are retained below.
actuals:
  tokens: 8220
  tasks: 2
  commits: 5
plan_head_before: e38b88e41a4f359731012c81b3e34652f5de3713
plan_head_after: a50c78a22976786f3508c3882f08fbc0164f7528
duration: 16min
completed: 2026-11-13
status: complete
---

# Phase 5 Plan 3: Reconnect and Regression Gates Summary

**Both tabs retain the shared timer lifecycle, prioritize connection/loading messages, and use a start-only picker; 568 tests and native two-leaf restart checks pass.**

## Accomplishments

- Disabled every Timers header action while missing, incompatible or loading, even when the store still holds eligible/paused counts. Staged now shares loading copy when a ready bridge has no snapshot, then restores its exact empty copy without changing selection.
- Preserved shell subscriptions, one registered interval, document/window refresh, wake/reveal handling, completion generations and close cleanup. Mounted tests cover reconnect, version/retry, paused-only content, new timer data while Staged is selected, write-free lifecycle and unreadable Pomodoro note scope. Existing store tests retain exact Pomodoro-owner exclusion.
- Introduced `TaskPickerOptions` with `mode: "start"`, gateway, controller and onClose. Updated every tracked construction site while retaining once-only selection, late read/render cleanup, bridge-loss closure, throwing Notice recovery and Pomodoro row tags. A mounted mock checks shell construction and guard release; separate real picker tests check modal behavior.
- Corrected native button selector specificity after computed styles showed the inactive tab color was overridden by Obsidian.

## Task Commits

1. Task 1 RED: `4074377` — specify shared reconnect and shell lifecycle guards.
2. Task 1 GREEN: `1fbd1ba` — share loading and connection guards across tabs.
3. Task 2 RED: `2aa32b3` — specify start-only picker options and guard release.
4. Task 2 GREEN: `6b97aaa` — use typed start-only task picker options.
5. Native regression fix: `a50c78a` — preserve muted tabs against native button styles.

Five commits are measured from the persisted plan ledger through the final implementation commit; this summary/evidence metadata commit is separate. Tokens use realized source/test/TDD-evidence diff characters divided by four plus native evidence characters divided by four, rounded upward; they are not harness usage.

## Automated Verification

- Task 1 requested targeted suites: **127 tests across 7 files passed**, including timerPaneView, taskCard, cardList, store and readPath. The post-commit tracer feedback rerun passed before task 2 expansion.
- Task 2 picker/view suites: **27 tests across 2 files passed**.
- Final `npm run check` after the CSS fix: production build/typecheck passed, ESLint passed with zero warnings, **568 tests across 20 files passed**.
- Direct invocation of the installed parent Vitest executable replaced `npx vitest`; no packages were installed or changed. Elevated filesystem execution was required for existing parent dependencies and git metadata.
- `git diff --check` passed. All five commits exist on this branch, evaluation-scope resolves them, and no task commit deletes tracked files.

## TDD Gate Compliance

- Task 1 RED ran the named both-tab test and failed on an enabled cached header action (`false` instead of expected disabled `true`). The unchanged TAP report, command, exit code and semantic assessment are preserved in `05-03-task1-red.json` and `.tap`. The classifier returned `RED_EVIDENCE_OK` before implementation. GREEN added connection guards and loading semantics.
- Task 2 RED reached the mounted Start action and failed because the positional constructor supplied no options mode (`undefined` instead of `start`). The unchanged report and semantic assessment are in `05-03-task2-red.json` and `.tap`. The classifier returned `RED_EVIDENCE_OK` before implementation. GREEN introduced the options constructor and updated all real creation sites.
- No separate cleanup refactor was needed. The additional CSS fix followed observed native evidence and passed the full suite before native rebuild.

## Native UAT Evidence

Used only tracked `npm run uat:start`, `npm run uat:stop`, `npm run uat:smoke` and `scripts/uat/cdp.mjs` on the validated **dev-vault**. No personal vault was modified. Real TaskNotes was **4.18.2**, runtime API **1**, time.write **true**. Only seeded scratch/weekly dev tasks received timer writes; the scratch task was completed to `done` and no test timer remained active.

- Final launcher provenance: checkout `phase-05-discuss@a50c78a+dirty`, main.js SHA256 prefix **af950e616573**. Dirty state included root-owned planning updates and the native evidence; source/CSS fixes were committed. The unchanged JavaScript hash across the last restart is expected because the final change was CSS, which the launcher also installs.
- `native-shell`: one-click Staged selection, exact disabled Stage tooltip/empty copy, linked panels, inactive `hidden` panel computed `display:none`, and synthetic ArrowRight/Home native DOM events selected and focused the expected tab. Command invocation did not add leaves or change existing selection.
- `native-timers`: real TaskNotes chips rendered for two disposable tasks. Synthetic ArrowDown on a real handle changed the shared order in both leaves while their Timers/Staged selections remained independent; handle focus and order survived refresh. This is native DOM keyboard handling, not physical OS input.
- `native-card-actions`: per-card Pause produced zero active entries and a paused card, Resume restored one active entry, and Stop returned to idle. Start opened the expected prompt with five rows; synthetic Escape cancelled it.
- `native-start-header-note-complete`: clicking the scratch picker row started one timer and closed the prompt. Pause all produced 0 active/1 paused; Resume all produced 1 active/0 paused; Stop all produced 0 active/0 paused. Enter on the title opened the scratch markdown note. Complete set scratch status to done and stopped its entry.
- `native-restart`: after explicit `uat:stop` then rebuilding `uat:start`, leaf **c88f9ce6849cf981** restored **Timers** and **c2a2a844402f0a8e** restored **Staged**. Computed inactive color was `rgb(179,179,179)`, selected color `rgb(218,218,218)` with accent underline `rgb(138,92,245)`. Header flex-wrap computed `wrap`.
- `native-invalid-state`: new native leaves with `{}` or `{tab:"invalid"}` both fell back to Timers; temporary leaves were detached afterward, leaving the original pair.
- `native-reconnect`: disabling real TaskNotes displayed the same missing heading/body/retry in both leaves and disabled every active header button. Immediately after re-enable, the first 1.8-second sample still showed missing; a subsequent Check for TaskNotes probe restored ready bodies in both leaves without changing selection. Automatic reconnect latency was not measured.
- Final tracked smoke test passed: **72 samples, uatForeground=0, uatLeft=0, userBefore=4, userAfter=4, installedMatch=True**. It rebuilt the final checkout, verified installed JavaScript, and stopped all four isolated processes. The user's normal process set was unchanged.

Raw native observations are in `05-03-native-evidence.jsonl`. The smoke output and launcher provenance above were observed directly from the tracked commands.

## Evidence Limits and Retained Flags

- Physical OS drag, actual hover, visual judgment at a narrow pane width and real sleep/wake were not observed on the hidden desktop. Model/mounted wake-gap and synthetic native keyboard tests do not establish physical input or wake behavior.
- Synthetic click/modifier/middle/context-menu events on the outer title did not establish navigation/menu ownership for the nested real TaskNotes chip; only keyboard opening was observed. No native pass is claimed for chip mouse/menu ownership or forced plain-title renderer fallback. These remain covered only by automated card tests where applicable.
- No safe native incompatible TaskNotes version or unreadable Pomodoro ownership condition was introduced. Shared version metadata and Timers-only ownership-note behavior passed mounted tests, not native observation. A live Pomodoro exclusion case was not created.
- One exploratory CDP evaluation called the host key handler without its required event and threw after performing header actions; its intermediate observations were discarded and a later independently recorded sequence established the header results above. No source change or safety bypass followed that evaluation error.
- **TABS-02 unclassified probe assumption remains unresolved as classified in COVERAGE.md.** Native restart and invalid-state observations strengthen the concrete D-05/D-06 evidence without silently changing that generic classification.
- Remaining native limits are recorded in WINDOWS entry **17**. This plan is implementation-complete; this summary does not mark the phase fully verified.

## Deviations from Plan

- **[Rule 1 - Bug] Native host button styles overrode the planned inactive muted color.** Observed both colors as text-normal, increased tab selector specificity in styles.css, reran the full check and confirmed distinct native computed colors after rebuilding. Commit: `a50c78a`.
- Updated the pre-existing mounted Staged placeholder assertion to expect the shared loading message for a null snapshot, as explicitly required by this plan. Commit: `1fbd1ba`.
- Root orchestrator owns STATE/ROADMAP/REQUIREMENTS updates; this executor leaves those concurrent changes intact and returns completion evidence for root close-out.

## Known Stubs

The disabled Stage button and empty Staged list are intentional D-09/D-10 scope, already recorded in WINDOWS entry **16**; Phase 06 wires them. No additional stub, dependency, data.json key, endpoint, authentication path or trust-boundary schema change was introduced.

## Self-Check: PASSED

All modified source/test files and RED/native evidence files exist. All five task/fix commits are ancestors of HEAD; evaluation-scope lists all five. Targeted suites, final full check, native restart evidence and tracked isolation smoke succeeded. The summary and evidence are committed separately before root state updates.
