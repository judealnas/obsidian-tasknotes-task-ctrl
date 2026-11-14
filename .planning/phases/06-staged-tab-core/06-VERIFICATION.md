---
phase: 06-staged-tab-core
verified: "2026-11-14"
status: human_needed
score: "16/16 requirements supported by automated evidence; 5 prohibition reviews pending"
covered_files: [".planning/phases/06-staged-tab-core/06-01-PLAN.md",".planning/phases/06-staged-tab-core/06-01-SUMMARY.md",".planning/phases/06-staged-tab-core/06-02-PLAN.md",".planning/phases/06-staged-tab-core/06-02-SUMMARY.md",".planning/phases/06-staged-tab-core/06-03-PLAN.md",".planning/phases/06-staged-tab-core/06-03-SUMMARY.md",".planning/phases/06-staged-tab-core/06-04-PLAN.md",".planning/phases/06-staged-tab-core/06-04-SUMMARY.md","package-lock.json","package.json","src/main.ts","src/model/cardOrder.ts","src/model/errors.ts","src/model/pauseLedger.ts","src/model/pomodoroOwnership.ts","src/model/stagedField.ts","src/model/staging.ts","src/model/stagingDay.ts","src/model/taskLink.ts","src/model/taskPicker.ts","src/model/timeMath.ts","src/settings.ts","src/state/CardOrderStore.ts","src/state/PauseStore.ts","src/state/StagedOrderStore.ts","src/state/StagingController.ts","src/state/StagingStore.ts","src/state/TimerController.ts","src/state/TimerStore.ts","src/state/WriteQueue.ts","src/tasknotes/TaskNotesBridge.ts","src/tasknotes/runtime-api.types.ts","src/ui/CardList.ts","src/ui/TaskCard.ts","src/ui/TaskPickerModal.ts","src/ui/TimerPaneSettingTab.ts","src/ui/TimerPaneView.ts","styles.css","tests/bridge.test.ts","tests/cardList.test.ts","tests/cardOrder.test.ts","tests/cardOrderStore.test.ts","tests/contract.test.ts","tests/controller.test.ts","tests/fakes/fakeGateway.ts","tests/fakes/fakeObsidian.ts","tests/fakes/fakeTaskNotes.ts","tests/fakes/viewHost.ts","tests/main.test.ts","tests/pauseLedger.test.ts","tests/pauseResume.test.ts","tests/pauseStore.test.ts","tests/readPath.test.ts","tests/settings.test.ts","tests/stagedField.test.ts","tests/stagedOrderStore.test.ts","tests/staging.test.ts","tests/stagingController.test.ts","tests/stagingDay.test.ts","tests/stagingStore.test.ts","tests/store.test.ts","tests/taskCard.test.ts","tests/taskLink.test.ts","tests/taskPicker.test.ts","tests/taskPickerModal.test.ts","tests/timerPaneView.test.ts"]
covered_digest: v3:sha256:e10036b66b037e3ac4463598cbc98b09a94b187fc9f0db33d4d7eba9a0e3f666
behavior_unverified: 0
human_verification:
  - test: "Stage must not implicitly start timing"
    expected: "Review the native no-timer result and confirm Stage only adds membership. Descriptor-less test enforcement remains flagged."
  - test: "Unstage must not control active Pomodoro timing"
    expected: "Confirm exact Pomodoro-owned timing remains untouched when unstaging its task. Automated takeover/ownership cases pass; actual native Pomodoro interaction remains unobserved."
  - test: "Staged Complete must not complete a recurring series"
    expected: "Confirm the disabled staged Complete control is correct for Phase 6. Handler zero-call tests pass in every staged state; descriptor-less enforcement remains flagged."
  - test: "Background changes must not change the selected tab"
    expected: "Review the passing two-leaf tests/native observation and confirm independent tab choice. Descriptor-less enforcement remains flagged."
  - test: "Age metadata must use neutral visual framing"
    expected: "Review the muted date/age presentation and confirm it has no punitive wording or styling. Human judgment is required."
gaps: []
decision_coverage:
  honored: 16
  total: 16
  not_honored: []
---

# Phase 6 verification

Four plans and ten tasks are implemented and committed. The phase goal is supported by source, 650 passing tests, and a live TaskNotes 4.18.2 check. Phase acceptance remains pending the five explicit prohibition reviews below. The independent verifier and code-review capabilities were disabled in project configuration; this report records the parent agent's source/runtime verification, not an independent review.

## Requirements and actual data flow

| Requirement | Evidence | Result |
|---|---|---|
| SETUP-02 | fieldStatus → StagingStore.canStage → Stage disabled/setup/Retry; missing/wrong/default/failure mounted tests | Supported |
| SETUP-03 | stagingAvailability → version/API explanation scoped to Staged; Timers remains operational in mounted tests | Supported |
| STAGE-01 | Native keyboard then mouse selection → StagingController → shared WriteQueue → staged-only date patch; query/focus and pending/failure tests | Supported |
| STAGE-02 | Full-list store projection → nonpersisting order observation → bottom append; external arrival and changed-date native/test evidence | Supported |
| STAGE-03 | Unstage current model → shared queue → exact regular-stop checks → null patch → pause/order updates; native stop/null read-back and negative ownership tests | Supported; native Pomodoro review pending |
| STAGE-04 | Strict Gregorian date parser, own-property precedence, reservation/eligibility split; calendar/timezone tests | Supported |
| STAGE-05 | Calendar ordinals and local-noon format → neutral date/age metadata in each card state; age/DST tests and native metadata | Supported; visual judgment pending |
| SCARD-01 | Genuine idle/running/paused model union, existing guards, disabled staged Complete; native Start and zero-call tests | Supported |
| SCARD-02 | Real timer snapshot joined by path; native Start → Pause → Resume → Unstage/stop; stable title and mounted elapsed-time tests | Supported |
| SCARD-03 | Paused card exposes Resume/Unstage; existing controller ledger semantics and mounted/native resume | Supported |
| SCARD-04 | Exact Pomodoro-owned entry excluded from timer join, producing idle display; Start uses the existing ownership refusal; mounted real-controller tests | Supported; actual native Pomodoro review pending |
| ORDER-01 | Independent StagedOrderStore and CardList callback; native Arrow reorder/focus/save plus drag authority tests | Supported |
| ORDER-02 | Separate Staged path order and Timers session order; list-specific callbacks and independent-order tests; main interleaved-save/restart tests | Supported |
| ORDER-03 | Slash-bounded path remap, invalidated reads and reindex retention; full-absence plus vault-missing prune tests | Supported |
| TABS-03 | Current eligible Staged count; regular-running Timers count and count-only accent; no automatic tab assignment; multi-leaf mounted/native evidence | Supported |
| TABS-04 | Same eligible membership drives Timers Staged marker; native marker and removal/update tests | Supported |

Key links were inspected in main.ts, StagingStore.ts, StagingController.ts, StagedOrderStore.ts, TaskPickerModal.ts, TaskCard.ts, CardList.ts and TimerPaneView.ts. Main constructs one staging store/controller/order store, shares the existing queue, injects them into every pane, and disposes read subscriptions. Rendering only observes state. Persistence remains in main.persistAll.

## Executed checks

- Final `npm run check`: build passed; ESLint zero warnings; 650 tests in 24 files passed after the native CSS fix.
- Full regression covers the previous phase suites; no test failures remain.
- Security: 15 distinct planned threats closed at L1; no packages/dependency changes.
- Schema drift gate: no drift. Codebase drift gate: skipped because no STRUCTURE.md exists.
- Native guarded launcher: build from phase-05-discuss@e2fb40f+dirty; TaskNotes 4.18.2, API v1, pane loaded. Local and installed main.js SHA256 matched `9fd9432d5f625160c91411b3246395d5d3da9b684005a93dc22605376f7094ba`. Native CSS fix changes styles.css only.
- Final live script: 17 assertions passed using `node scripts/uat/cdp.mjs` and 06-native-check.txt. Keyboard/mouse batch selection, retained query/focus, Escape, no implicit timer start, disabled Complete, visible idle cards, keyboard reorder/focus, saved order, real timer start/pause/resume, stable title node, Timers marker, Unstage stopping the timer, YAML null read-back, changed external date, and independent tab selections were observed. Temporary task notes/timers/order entries were cleaned up.

## Native defect found and fixed

The inherited `.tntp-panel:not(.tntp-panel--running) .tntp-cards` rule had greater specificity than the Staged display rule and hid idle staged cards. Fake DOM tests do not calculate CSS. The hide selector now distinguishes Timers from empty Staged panels. A native nonzero-layout assertion and native keyboard-focus assertion pass after rebuilding/reinstalling through the guarded launcher.

## Prohibition evidence and remaining gate

The four test-tier prohibitions have passing behavior tests (and native support for no implicit start and no automatic navigation), but the plans contain no wired enforcement descriptors. Per COVERAGE.md and the verifier contract, those are flagged as descriptor-less enforcement, not silently green. The neutral age presentation is judgment-tier. All five are persisted in 06-UAT.md and require explicit resolution; this manual invocation has no autonomous override.

Native outside-click closing, actual Pomodoro ownership interaction, native chip/menu gestures, and a full application restart with staged fixtures were not claimed as observed. Automated tests cover their relevant logic where applicable. TaskNotes path-only stop retains its documented external replacement race after the last safety read; the queue does not make external actors transactional.

Phase 7 completion, Done today, daily rollover/mobile controls and release work remain outside this phase.
