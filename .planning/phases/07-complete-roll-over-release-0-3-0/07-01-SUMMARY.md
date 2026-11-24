---
phase: 07-complete-roll-over-release-0-3-0
plan: "01"
subsystem: completion
tags: [completion, persistence, staging]
requires:
  - phase: 06-staged-tab-core
    provides: Shared queue, staged cards and plugin persistence
provides:
  - Plugin-scoped ordinary completion with durable intent and confirmed cleanup
  - Validated completion history and quarantine for unsafe saved data
  - Shared busy gate and completion routing for both tabs
affects: [07-02, 07-03]
tech-stack:
  added: []
  patterns: [Persist intent before mutation, quarantine unsafe histories]
key-files:
  created:
    - src/state/CompletionController.ts
    - src/model/completionLedger.ts
    - src/state/CompletionStore.ts
    - tests/completionController.test.ts
    - tests/completionLedger.test.ts
    - tests/completionStore.test.ts
  modified: [src/main.ts, src/state/TimerController.ts, src/ui/TaskCard.ts, src/ui/TimerPaneView.ts]
requirements-completed: [DONE-01]
coverage:
  - id: ordinary-completion
    description: Both card lists route ordinary idle/running/paused completion through saved intent and one write queue
    requirement: DONE-01
    verification:
      - kind: integration
        ref: tests/completionController.test.ts
        status: pass
      - kind: automated_ui
        ref: tests/taskCard.test.ts
        status: pass
    human_judgment: false
---

# Plan 07-01: Ordinary completion

Ordinary task completion persists an intent before stopping eligible regular timing, confirms configured completion, and clears only the captured registered staged value. Both tabs receive one plugin-scoped coordinator. Shared busy state lasts through final refresh; failure Notices distinguish incomplete actions and confirmed partial success. The loader preserves pending/uncertain records and quarantines malformed or future histories rather than treating them as permission to replay.

## Tasks and commits

All three tasks implemented in `0a092a6` (`feat(07-01): coordinate durable ordinary task completion`). The tracer and storage extraction were committed together so no intermediate production commit exposed an unvalidated loader.

1. Card/controller callback through real bridge and shared queue, with awaited persistence before writes.
2. Versioned completionLedger / CompletionStore with validation, quarantine, capacity protection, save rejection propagation and production writer integration.
3. Ordinary completion on both tabs, per-target availability, shared busy and quiet success / accurate failure feedback.

## Verification

- Initial tracer test failed because CompletionController did not exist; after implementation, the six original tracer scenarios passed before adding recovery coverage.
- Initial ledger/store tests failed because their modules did not exist.
- `npm run check`: build, lint and **675 tests across 27 files passed**. The build required execution outside the filesystem sandbox because esbuild directory traversal was denied inside it; no build configuration workaround was introduced.
- Focused integration tests cover save-before-stop-before-complete ordering, initial save failure, idle identity, Pomodoro/unreadable ownership, double clicks, cleanup retry, post-write local-save failure, throw-after-write protection, refresh failure and busy release.
- Production persistence tests cover save/reload, settings/order/extras preservation and future-schema quarantine. TaskCard tests cover idle/running/paused dispatch and disabled explanations.
- Guarded UAT launcher started successfully on TaskNotes **4.18.2**, Runtime API v1. This is environment readiness, not native completion proof. Native completion evidence belongs to 07-02/07-05.

## Deviations and limits

- User authorized creating the phase branch from milestone-v0.3 because origin/master remains v0.2.0 and lacks staging prerequisites.
- Worktree base-check automatically selected sequential execution because HEAD differs from origin/HEAD.
- No dependency changes or installations.
- CTRL-13 is intentionally **not** marked complete here: recurring and materialized targets stay disabled until 07-02 establishes their public contract. The compatibility fallback in standalone TimerController tests remains; production always installs the shared completion handler.
- Native behavior and physical-device interaction are not inferred from fake tests.

## Self-Check: PASSED

Created files exist; production commit is reachable on the phase branch; build/lint/regression passed. No phase completion or release claim is made.
