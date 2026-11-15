---
phase: 07-complete-roll-over-release-0-3-0
plan: "02"
subsystem: completion
requires:
  - phase: 07-01
    provides: Durable ordinary completion coordinator
provides:
  - Recurring completion with distinct requested day, resolved date and actual note identity
  - Materialized occurrence handling and scoped inherited staging cleanup
  - Native public-API, restart, Pomodoro and auto-stop evidence
affects: [07-03, 07-05]
key-files:
  created: [scripts/uat/phase7-contract.mjs, .planning/phases/07-complete-roll-over-release-0-3-0/07-CONTRACT-FINDINGS.md]
  modified: [src/state/CompletionController.ts, src/model/completionLedger.ts, src/tasknotes/TaskNotesBridge.ts]
requirements-completed: [CTRL-13]
coverage:
  - id: recurring-completion
    description: Follow TaskNotes resolution and refuse repeated completion across actual plugin reload
    requirement: CTRL-13
    verification:
      - kind: integration
        ref: tests/completionController.test.ts
        status: pass
      - kind: e2e
        ref: .planning/phases/07-complete-roll-over-release-0-3-0/07-contract-native.json
        status: pass
    human_judgment: false
---

# Plan 07-02: Resolved recurring completion

Virtual tasks pass the captured staging day exactly once and confirm the actual added occurrence date. Materialized tasks use their own authoritative status and actual path; automatic materialization uses the documented public method before completion. Parent series stay open. Saved request guards survive restart and cannot be silently evicted; unresolved attempts block rather than replay. Cleanup clears only captured source staging and newly inherited occurrence values, preserving pre-existing future staging. Affected family timing is freshly checked, including indirect Pomodoro auto-stop.

## Tasks and commits

- `cf75215`: bridge identity/retirement/calendar validation, documented public contract, initial native fixtures.
- `d4c2124`: shared recurring coordinator, failure/replay cases, scoped cleanup and final native matrix.
- All three plan tasks completed. No package installation or dependency change.

## Verification

- Full `npm run check`: build, lint, **693 tests in 27 files passed** before the last two failure-matrix tests; focused final completion suite **20/20 passed**, including those two additions.
- `07-contract-native.json`: TaskNotes 4.18.2, sixteen cases, zero runner failures, actual production callbacks for ordinary/virtual/automatic/existing/future-explicit branches. A fresh plugin instance reloads the persisted guard and refuses replay. Active Pomodoro timing remains open when the coordinator refuses completion.
- `07-contract-native-autostop-off.json`: thirteen successful native cases with isolated fixture auto-stop false. Exact original settings restored in finally; SHA-256 equality verified before resuming true-setting tests.
- Final native deployment: checkout `cf75215+dirty`, main.js `01a83d61ab55`; run `P7-contract-1794715327261`. Raw before/after metadata and paths are retained.
- Unit/integration failures cover initial save rejection, post-stop status failure, throw-after-write uncertainty, post-write local save rejection, failure between staged clears, refresh failure, capacity protection, replacement timing, ambiguous occurrence identity, unreadable parent ownership and request spanning an injected 4 AM boundary.

## Decisions and deviations

- User selected **follow TaskNotes' resolved occurrence with protection against repeated completion** after seeing native off-schedule differences. Recorded as D-17; no forced materialization of virtual series or copied recurrence engine.
- Two native stress runs timed out with accumulated fixtures. Added unchanged-card availability reuse and its regression test; reversibly moved 118 generated fixture notes outside the vault's indexed tree. The final sixteen-case run succeeded. Timing contributions of those changes were not isolated.
- Reload observation is bounded and checks a genuinely fresh plugin plus connected restored pane. Simulated rollover timing remains distinct from Plan 07-05's physical overnight/sleep checks.
- Only TaskNotes 4.18.2 was natively tested. The existing global feature floors remain unchanged; missing materialization capabilities disable that affected action.

## Self-Check: PASSED

Production commits and declared artifacts exist on this phase branch. Native and local checks are separately identified. Plan 07-03 is next; release and physical overnight/sleep acceptance remain pending.
