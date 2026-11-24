---
phase: 07-complete-roll-over-release-0-3-0
plan: "04"
subsystem: ui
tags: [mobile, ordering, accessibility]
requires:
  - phase: 07-03
    provides: Shared task titles and Done today
provides:
  - Shared bounded CardList.moveBy authority for keyboard and mobile arrows
  - Left stacked mobile arrow controls on all task cards
  - Per-pane polite position announcements and boundary focus handling
affects: [07-05]
key-files:
  created: []
  modified: [src/ui/CardList.ts, src/ui/TaskCard.ts, src/ui/TimerPaneView.ts, styles.css, tests/cardList.test.ts, tests/timerPaneView.test.ts, tests/fakes/viewHost.ts, tests/fakes/fakeObsidian.ts]
requirements-completed: [ORDER-04]
---

# Plan 07-04: Mobile reorder controls

Mobile Staged and Timers cards now have left-side arrows stacked up/down. The shared keyed list validates each move against current keys, updates only its own persisted order, and rejects empty/single/boundary/removed/disposed moves. Keyboard and drag behavior remain supported.

## Tasks and commits

1. Shared list move authority, mobile Platform gate and host support.
2. Polite task/position announcements, retained arrow focus with opposite-arrow fallback at a boundary, and mobile layout.

## Verification

- New moveBy test first failed because the API was absent, then passed after implementation.
- Focused card/list/view suite: **46 tests passed**.
- Full `npm run check`: build, lint and **720 tests in 28 files passed**.
- Mobile fake-host tests exercise idle/running/paused Staged cards and running/paused Timers cards, up/down boundaries, rapid moves, independent orders, stable nodes/focus, disposal, no upstream mutations, empty/single lists and desktop absence.
- Native physical mobile/touch behavior is not established by these tests. Desktop sandbox/emulation and physical-device limits belong to Plan 07-05.

## Deviations from Plan

- Added Platform to the separate startup/settings fake as well as viewHost; production imports TaskCard there through the view module.
- Reorder announcements also cover successful keyboard and drag moves through the same authority. Boundary no-ops and refreshes remain silent.

## Self-Check: PASSED

Production changes and focused evidence exist on the phase branch. No device or release claim is made. Next: Plan 07-05 candidate and native evidence.
