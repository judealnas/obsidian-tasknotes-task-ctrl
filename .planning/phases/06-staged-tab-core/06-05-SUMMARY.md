---
phase: 06-staged-tab-core
plan: "05"
subsystem: ui
tags: [css, staging, reorder, native-uat]
requires:
  - phase: 06-04
    provides: Staged cards with independent ordering and Unstage controls
provides: [Separate Unstage and reorder hit areas, Native layout evidence, Corrected review screenshot]
affects: [07]
gap_closure: true
gap_ids: [G-06-6]
tech-stack:
  added: []
  patterns: [Explicit icon-button geometry independent of inherited theme padding]
key-files:
  created: [.planning/phases/06-staged-tab-core/06-layout-check.txt, .planning/phases/06-staged-tab-core/06-layout-results.json, .planning/phases/06-staged-tab-core/06-controls-review.png]
  modified: [styles.css]
requirements-completed: [ORDER-01, STAGE-03, SCARD-01]
actuals:
  tasks: 2
  commits: 2
commits: 2
plan_head_before: deff9707684d302c3e13ece72903d362e8245cc2
plan_head_after: 6c3f71c
completed: 2026-11-14
status: complete
---

# Phase 6 Plan 5: Separate staged card controls

The X button no longer overlaps the reorder grip. Explicit width/height, zero padding, minimum-size resets, centering and border-box sizing keep the Unstage button at the existing 24px control size with a 4px gap to the handle. Existing title spacing was sufficient in native tests and needed no change.

## Task commits

1. `bf86008` — CSS correction.
2. `6c3f71c` — Native verification script/results and corrected screenshot.

## Verification

- `npm run check`: build, zero-warning lint and 650 tests across 24 files passed. These include prior phase suites; no separate repeated regression run was needed.
- Guarded UAT launcher: phase-05-discuss@bf86008+dirty, main.js hash prefix 9fd9432d5f62, TaskNotes 4.18.2 / API v1. The fix changes styles.css; main.js is unchanged.
- 225 native assertions passed across 36 configurations: 448/320/240px cards, short/long titles, idle/running/paused states and LTR/RTL. Every measured gap was exactly 4 CSS pixels; both controls measured 24px wide.
- Native hit testing reached each control center; focus styling remained present; title text fragments never intersected either control. Arrow reorder moved the intended card and retained focus. Idle Unstage removed its intended task while preserving the other fixture. Timers retained its handle.
- Existing `06-native-check.txt`: all 17 assertions passed again, covering Stage, timer start/pause/resume, Unstage, persistence, tab independence and disabled Complete.
- Corrected screenshot inspected: `06-controls-review.png`. User acceptance of the corrected appearance remains pending.
- Fixture tasks, timers and order entries were removed; final native task query found no Phase 6 UAT/Layout fixtures and zero active timers. UAT instance stopped through the guarded stop command.
- Schema drift: none. Codebase drift: skipped because STRUCTURE.md is absent. Existing security report has zero open threats; no API, dependency, schema or mutation-path changes.

## Deviations and limits

Executed inline under the skill's small-plan/single-agent fallback. Shared dependencies required an escalated build/test run after the sandbox denied esbuild's ancestor-directory lookup; the same command then passed. Native CDP checks used the project's local helper because browser MCP tools were unavailable. Layout results are additionally saved as JSON for repeatable inspection. No new fake-DOM spacing tests were added because they do not calculate CSS geometry.

The original interaction regression and existing automated CardList suite cover existing ordering behavior. Native pointer drag was not repeated for this CSS-only change; native keyboard reorder and hit testing passed. The broader Phase 6 source review and descriptor limitations remain as recorded in 06-VERIFICATION.md.

## Self-Check: PASSED

Both task commits are on the current branch; all three created artifacts exist. G-06-6 has an implemented fix and native evidence. Follow-up user visual acceptance is still required before phase advancement.
