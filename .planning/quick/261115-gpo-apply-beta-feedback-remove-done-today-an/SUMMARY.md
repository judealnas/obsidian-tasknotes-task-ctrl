---
status: complete
date: 2026-11-15
quick_id: 261115-gpo
commit: 71d8d73
---

# Applied v0.3 beta feedback

Read the user's beta note and all four linked images. Personal Vault was read only. User confirmed persistent staging until completion/Unstage, with calendar-date age and no rollover-hour setting. Executed inline on milestone-v0.3; no new beta or tag was published.

## Changes

- Removed Done today presentation and projection, automatic external completion observations, custom rollover settings, and day-boundary visibility/history writes. Replaced custom staging-day math with local calendar dates for staging, recurring requests and age. Cached age still updates across midnight/focus/wake without task writes or clearing the list.
- Kept durable completion safety/replay protection, pending cleanup, quarantine and legacy saved records. External ordinary/recurring completion still removes eligible staged cards through read-only current-state checks. Retired rolloverHour is ignored on load and omitted on the next normal save; pauses, orders, completion safety records and foreign data survive.
- Removed the visible Paused text; muted numbers indicate pause. Wrapped narrow action rows and TaskNotes chips, and explicitly spaced tab counts.
- Added rounded full-width + insertion buttons before, between and after cards (one when empty). All use the same batch picker. Each selection is inserted before its anchor in selection order; a missing anchor falls back to append. Header Stage retains append behavior.
- Added repeated drag edge scrolling with cleanup on drag end, drop, drag leave, stale timeout, removed source and disposal. Existing keyed cards, keyboard/mobile ordering and independent tab order remain.
- Revised current project requirements/state and added a scope override to historical roadmap/checkpoint descriptions. Removed-feature overnight/custom-rollover gates are superseded, not passed.

## Verification

- Final npm run check passed: production build, lint with zero warnings, **636 tests in 28 files**. Removed obsolete Done today/custom-rollover tests; added calendar/DST, migration, external recurring state, insertion order, picker anchoring, disabled controls and scroll-cleanup coverage.
- Guarded hidden native sandbox: Obsidian with TaskNotes 4.18.2/API v1; launcher provenance mainjs=3ebe60dfa61f. Final production main.js SHA256: 3ebe60dfa61f66995bb537ccfc3cc9918f5ba731d768f97bb634b39fc889f3e5. CSS SHA256: 1ad1d5b7fe61c735e85b8185bf915899fae9baa4c4e134cba3aaa0f2d9d243b7.
- native-final.json records the visible staged panel, 36 cards/37 insertion buttons, no Done today or Paused label, 4.55px count spacing, and no horizontal overflow in idle/running/paused UI models at widths 160/200/280/400px. Temporary card models only; no task timer/completion writes. Real picker opened at first, middle and end positions. Synthetic native drag events scrolled 185px and stopped without further motion after drag end.
- Native insertion selection writes were not exercised; batch placement/persistence and anchor propagation are covered by the automated store/controller/picker/view tests. No physical mobile, physical drag, actual BRAT update, overnight or physical sleep claim is made.
- First sandbox startup lost its CDP target; a clean guarded restart succeeded. Initial geometry probing used a hidden panel and is not acceptance evidence; final native-final.json explicitly used the visible wider leaf.
- Before native launch, all five existing pane assets/data/workspace files were backed up and hash-verified. Disk-only restore was proved before launching. After checks, UAT was stopped and all five original hashes restored. Pane completion data was unchanged even before restoration (native-restoration.json). Backups remain in Temp/tasknotes-feedback-261115-gpo-backup. No Personal Vault changes.

## Remaining release work

Physical mobile/touch and an actual published BRAT update remain open. The published beta.1 keeps its original content and historical release notes. Current changes are a local source revision for a future release. Stable Phase 7 is not marked complete. Pre-existing config/settings/lock/cache files remain untouched and excluded from this commit.
