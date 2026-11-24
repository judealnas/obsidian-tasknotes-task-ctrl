---
phase: quick-261115-na9
plan: "01"
status: complete
subsystem: timer-pane
tags: [idle-cards, persistence, task-picker, ordering]
requires: [existing-TimerController, single-data-writer]
provides: [persistent-local-idle-cards, explicit-idle-start, local-idle-remove]
affects: [timers-tab, card-order, vault-path-events]
tech-stack:
  added: []
  patterns: [versioned-local-membership, revision-guarded-reads, serialized-single-writer]
key-files:
  created: [src/state/IdleCardStore.ts]
  modified: [src/main.ts, src/model/cardOrder.ts, src/state/CardOrderStore.ts, src/ui/TaskPickerModal.ts, src/ui/TimerPaneView.ts, src/ui/TaskCard.ts, styles.css, README.md]
key-decisions:
  - Add and Remove change only plugin-local membership; Start delegates to the existing TimerController.
  - Unreadable plugin data blocks all saves; unsupported idle payloads are preserved verbatim.
  - Existing session identities are unchanged; pending cards use normalized idle-task identities.
completed: 2026-11-15
commits: 1
plan_head_before: 7a0dc3a2522eae33225d89a3f4cb8e5d6c1a79ad
plan_head_after: 6045c1f
---

# Quick Task 261115-na9: Persistent idle timer cards

The Timers Add task picker now creates a locally saved idle card, with separate Start and Remove actions and mixed idle/running/paused ordering.

## Implementation

The idle-card implementation was committed in `6045c1f` (`feat: add idle tasks to timers pane`). That commit changed nine source, stylesheet, and README files; it changed no tests, release versions, vault files, or deployment files. The executor validation recorded below is historical; later beta.3 release validation is recorded separately.

1. `IdleCardStore` loads bounded, deduplicated normalized paths with a readiness barrier; retains immediate selection metadata and refreshes metadata through TaskNotes; subscribes through existing bridge/data and pane lifecycle signals; preserves last-good membership on failed reads. Main's existing serialized writer merges the newest idle state with settings, pause records, staged order, completion safety records, and unknown keys. Unsupported or malformed idle payloads are preserved and local mutations disabled. Failed data loading prevents subsequent saves over unreadable data.
2. The header and prompt use Add task. Picker selection invokes local Add without a timer write. Idle-only Timers lists render under explicit card-presence CSS. Real running/paused snapshots take precedence by normalized path without collapsing distinct sessions; counts still use actual running timers. Idle Start uses the existing guarded controller; successful confirmed starts consume pending membership, while already-running consumes only after an authoritative regular-active read. Failed/busy/Pomodoro results retain membership. Remove changes local membership/order only. Explicit actions await persistence and report save failures. Mixed drag/keyboard/mobile order uses the same idle identity throughout, preserves hidden pending slots, and transfers a confirmed idle slot to its session key.
3. Note/folder renames and deletes update pending membership and idle order synchronously with slash-boundary checks and deterministic collision handling; events arriving before saved data loads are queued. Revision guards reject stale reads/actions, and existence cleanup waits for layout readiness. Header bulk timer actions exclude idle membership. README describes Add, persistence, explicit Start, local Remove, and bulk-action behavior.

## Verification

- PASS: `npm run typecheck` on the final source.
- PASS: `npm run lint` on the final source.
- PASS: final scoped `git diff --check`.
- Historical executor build limitation: `npm run build` passed its TypeScript stage, then esbuild failed with `Cannot read directory "../..": Access is denied` and the consequent unresolved `./src/main.ts`. Later beta.3 build, lint, and 636-test release validation are recorded in [the beta.3 summary](../261115-tuj-prepare-and-publish-0-3-0-beta-3-with-pe/261115-tuj-SUMMARY.md). That later gate does not establish native idle-card acceptance.
- Source audit: the Add picker has no `controller.start` invocation. IdleCardStore's only TaskNotes write path is its explicit Start delegation. There remains one `saveData` call in main. No test files appear in the changed-file list.
- Historical executor Git limitation: the sandbox denied a temporary delete-on-close probe under `.git`; no probe file was created. The orchestrator subsequently committed the implementation as `6045c1f`, which is an ancestor of the current HEAD.

## Deviations and compatibility

- Existing test sources construct the old `mode: "start"` picker shape and are included in `tsc`. Its type shape remains accepted as a disabled legacy branch to preserve compilation without editing tests. Production callers use only the new `mode: "add"` branch; the picker has no timer-start invocation.
- The existing `rolloverHour` owned key was otherwise omitted by the writer. It is now preserved if present so this new persistence path does not erase that legacy setting.
- As dispatched, no branch/worktree was created and no STATE/PLAN/config tracking changes were made by this executor. All pre-existing dirty state/config and unrelated untracked files were preserved.
- The orchestrator completed the implementation commit after the executor handoff. Later release-gate corrections superseded some original compatibility details, including preservation of retired rollover data; see the beta.3 summary. Native acceptance remains unobserved by this quick task.

## Pending manual acceptance

These are written acceptance steps only; no sandbox, Obsidian instance, or runtime checks were launched.

1. Add an untimed task: an idle card appears and no TaskNotes time entry is created. Close/reopen the pane and restart Obsidian: the card returns.
2. Mix idle, running, and paused cards; reorder by drag, keyboard, and mobile controls; restart and check order. Start an idle card and check its slot transfers to the real timer.
3. Confirm successful Start consumes pending membership and Stop then removes the timer normally. Failed, busy, Pomodoro-blocked, and unverified already-running outcomes keep pending membership.
4. Remove an idle card and restart: it stays removed without task/staging/time-entry writes. Simulate a failed membership save and confirm the Notice does not claim restart durability.
5. Add already running/paused normalized paths: existing state/order does not change and no duplicate appears. Start a pending task externally and confirm authoritative reconciliation consumes membership.
6. Rename/delete a note or folder containing pending cards; confirm descendants and order keys update, prefix siblings are untouched, and late reads cannot resurrect old paths.
7. Disconnect/reconnect TaskNotes and simulate failed/null task reads: pending membership survives and metadata recovers without per-tick polling.
8. Load old data without idle keys, malformed/future idle payloads, and unreadable plugin data; confirm empty legacy membership, preservation/disabled mutations, and blocked unreadable saves respectively.
9. Interleave settings, pause, completion, staging-order, and idle saves; verify every owned section, legacy rollover value, and unknown saved key survives.
10. Use Staged Start/Unstage for a task also pending in Timers; verify existing staging behavior and bulk timer controls, including idle cards remaining after Stop all.

## Known Stubs

None in the production Add/Start/Remove flow. Runtime acceptance remains unobserved; no test results are claimed.

## Self-Check: PASSED (implementation artifacts)

The implementation files and this summary exist. Commit `6045c1f` is an ancestor of HEAD and contains the nine implementation files. Executor typecheck/lint results are recorded above; later release validation is documented separately. No native acceptance was performed during this documentation reconciliation.
