---
phase: 07-complete-roll-over-release-0-3-0
plan: "03"
subsystem: staging
tags: [completion, rollover, titles]
requires:
  - phase: 07-02
    provides: Confirmed ordinary and recurring completion identities
provides:
  - Persistent read-only completion observations and Done today projection
  - Title-only Done today rows shared across leaves
  - Cached wall-clock rollover with day/config/evidence generation guards
affects: [07-04, 07-05]
key-files:
  created: [src/model/doneToday.ts, src/ui/TaskTitle.ts, tests/doneToday.test.ts]
  modified: [src/model/completionLedger.ts, src/state/CompletionStore.ts, src/state/StagingStore.ts, src/ui/TimerPaneView.ts, src/ui/TaskCard.ts, src/main.ts, tests/completionStore.test.ts, tests/stagingStore.test.ts, tests/timerPaneView.test.ts, tests/main.test.ts]
requirements-completed: [DONE-02, ROLL-02]
---

# Plan 07-03: Done today and cached rollover

Completed the resumed partial implementation without discarding its changes. Done today shows confirmed staged completions through shared safe title owners, removes reopened tasks, deduplicates actual occurrences and preserves observation chronology across refresh/restart. Source membership is retained locally after staging is cleared. Observations and rollover make no TaskNotes mutations.

## Tasks and commits

1. `addc5a6`: validated observation union, projection and persistent seen fingerprints; ordinary/materialized/virtual evidence and late prior-day protection.
2. `0f2037d`: extract TaskTitle, complete card metadata extraction, mount title-only rows on Staged, subscribe/dispose across leaves and test quiet completion through the shared coordinator.
3. `102dc4a`: cached rederivation on day/hour changes; pending reads compare day/config and completion evidence revisions; cached rename/Unstage survive offline rollover. Main settings save rederives before API refresh; safety resync works without an open pane.

## Verification

- Initial resumed baseline: 33 focused model/store tests passed; all 12 TaskCard tests failed because the incomplete title extraction referenced a missing metadata element. Fixed as part of the planned extraction.
- Added a failing test for a completed materialized child without parent completion history, then implemented public snapshot-based identity matching.
- Final `npm run check`: build, lint and **717 tests across 28 files passed**. esbuild required execution outside the restricted filesystem sandbox because it traverses a parent directory; build configuration was not changed.
- After the final membership-fallback adjustment, the full affected eight-file set passed: **163/163 tests**. Existing timezone/DST staging-day tests ran in that set.
- Coverage includes empty/malformed/ordinary/distinct recurring projection, external first observation and restart, materialized reopen authority, quiet pane completion, two leaves and late renderer cleanup, exact rollover boundary, hidden panes, no-pane safety resync, changed hour both ways with failed reads, stale pending reads and cached rename/Unstage retention.
- No native overnight or physical sleep was performed in this plan. ROLL-03 native acceptance remains for Plan 07-05.

## Deviations from Plan

- Resumed files already contained portions of all three tasks. They were verified together, then committed by task responsibility; a pre-existing RED commit was not fabricated.
- Auto-fixed cached rename/Unstage retention after tests exposed the additional cache's responsibility: a later clock rederivation must not restore obsolete paths or successfully cleared staging.
- Observation capacity refuses new excess observations rather than evicting live seen fingerprints; mutation safety attempts are preserved. Orphaned invalidation markers are pruned only after their attempt is gone.

## Evidence limits

External date-only completion history has no demonstrated exact timestamp. Cold-start history uses its completion/occurrence date as a best-effort day and first-observed time for ordering; observed transitions use observation time. `dateModified` is never treated as completion time. This A2 limitation must be visible in README/release evidence in Plan 07-05.

## Self-Check: PASSED

Declared production artifacts and three task commits exist. Automated local behavior is verified; physical-device and release gates remain open. Next: Plan 07-04.
