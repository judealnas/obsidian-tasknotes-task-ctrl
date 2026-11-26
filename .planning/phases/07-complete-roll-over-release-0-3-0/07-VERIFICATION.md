---
phase: 07-complete-roll-over-release-0-3-0
verified: 2026-11-24
status: human_needed
score: "4 of 5 retained requirements verified; physical mobile acceptance open"
covered_files: [".planning/phases/07-complete-roll-over-release-0-3-0/07-01-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-01-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-02-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-02-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-03-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-03-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-04-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-04-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-05-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-05-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-06-PLAN.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-06-SUMMARY.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-NATIVE-EVIDENCE.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-RELEASE.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-UAT.md",".planning/phases/07-complete-roll-over-release-0-3-0/07-contract-native-autostop-off.json",".planning/phases/07-complete-roll-over-release-0-3-0/07-contract-native.json",".planning/phases/07-complete-roll-over-release-0-3-0/07-upgrade-cold-restart-result.json",".planning/verification/2026-11-24-native-followup.md","manifest.json","src/main.ts","src/model/calendarDate.ts","src/state/CompletionController.ts","src/state/CompletionStore.ts","src/state/StagingStore.ts","src/tasknotes/TaskNotesBridge.ts","src/ui/CardList.ts","src/ui/TaskCard.ts","src/ui/TimerPaneView.ts","styles.css","tests/calendarDate.test.ts","tests/cardList.test.ts","tests/completionController.test.ts","tests/completionStore.test.ts","tests/stagingStore.test.ts","tests/taskCard.test.ts","tests/timerPaneView.test.ts"]
covered_digest: "v3:sha256:07502c7d36c12bf70f5ea5dd7649874e36ed1cfd76dd16acae159ce888d1c375"
behavior_unverified: 1
human_verification:
  - test: "Reorder both tabs using physical touch"
    expected: "On a physical mobile device, reorder Staged and Timers using the arrows and confirm both orders persist."
gaps: []
---

# Phase 7 verification

Completion and calendar continuity are verified. Stable 0.3.0 is published and the in-place BRAT upgrade passed. Physical mobile remains open.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| DONE-01 | Satisfied | A shared queue routes ordinary staged completion through status write, exact regular timer stop and staged cleanup. TaskNotes 4.18.2 candidate completion matrices ran with both auto-stop settings. Current completion tests cover partial failure and retries. |
| CTRL-13 | Satisfied | The coordinator uses the requested local calendar date, resolves the occurrence, guards materialized notes and persists replay safety. Candidate matrices exercised virtual/materialized/automatic/existing-next branches, repeat, restart and Pomodoro. Current controller and view tests cover the calendar-date and both-tab paths. |
| ROLL-02 | Satisfied, revised | `StagingStore.checkDay` updates calendar age while preserving staged membership and order, including on failed upstream reads. Store and date tests cover local midnight, timezones and stale reads. |
| ORDER-04 | Partial | `TaskCard` gates arrows on Obsidian's mobile flag. `CardList.moveBy` uses its own order and persists through the same callback as keyboard/drag. Mobile-host tests cover movement and boundaries. Physical touch is open. |
| PANE-04 | Satisfied | Published 0.3.0 keeps the original installed ID, saved view type and local command ID while changing the display name. In-place BRAT update preserved two actual 0.2.0 pauses, Timers order, plugin data and the saved pane. The separate candidate rehearsal covered both order arrays, settings and unknown data. |
| DONE-02, ROLL-03 | Removed | The user removed Done today and configurable daily rollover on 2026-11-15. Their physical overnight/sleep acceptance is superseded. |

## Release and evidence scope

- [07-NATIVE-EVIDENCE.md](07-NATIVE-EVIDENCE.md) records the candidate runs. The controller matrices cover both auto-stop settings, 16 cases each. The cold upgrade used published 0.2.0 and the earlier local 0.3.0 candidate. Final stable 0.3.0 includes later UI and date behavior.
- [07-RELEASE.md](07-RELEASE.md) records the successful stable workflow and four assets. Its exact-SHA approval packet is missing from the local record.
- [07-UAT.md](07-UAT.md) holds the remaining mobile check and links the published BRAT result. The 0.4.0 plugin ID change is a later release. The preserved-ID requirement applies to the 0.3.0 tag.

This is an inline source and evidence review. The current checkout passed the build, lint, 692 feature tests and 13 vault-switch tests after the local relationship chip change. The historical native matrices were read from their retained evidence.
