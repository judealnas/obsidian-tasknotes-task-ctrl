---
status: partial
phase: 05-two-tab-shell
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-11-14T03:44:36.382Z
updated: 2026-11-14T04:01:41.481Z
---

## Current Test

[testing paused — physical Windows sleep/wake remains unverified]

## Tests

### 1. CDP drag, focus and hover
expected: Trusted Chromium drag events reorder live cards, retain saved order and preserve card identity, focus and hover across refresh; a foreign drag does not reorder.
result: pass
source: automated
evidence: 05-CDP-UAT-evidence.jsonl cases cdp-drag-at-visible-geometry, drag-focus-hover-after-refresh, foreign-drag
method: CDP Input events in the isolated native Electron renderer; no physical input hardware used.

### 2. Narrow-pane appearance
expected: Text tabs remain readable with distinct selected styling; the four Timers header actions wrap above cards at narrow widths.
result: pass
source: automated
evidence: 05-narrow-640.png, 05-narrow-768.png, 05-narrow-staged.png; screenshots inspected by the agent; live pane widths 298 and 362 px.

### 3. TaskNotes chip pointer actions and plain-title fallback
expected: Real chip controls retain TaskNotes ownership without duplicate pane navigation or menus; plain fallback titles open the intended task once for ordinary, modifier and middle clicks.
result: pass
source: automated
evidence: 05-CDP-UAT-evidence.jsonl cases valid-chip-date, valid-chip-context, valid-chip-ordinary, valid-chip-modifier, valid-chip-middle, valid-forced-fallback-input
method: Trusted CDP mouse events; fallback state entered via production showTitleText; actual renderer-failure trigger is covered by unit tests, not newly induced in the native host.

### 4. Native keyboard navigation
expected: Home/End select the first/last tabs, arrows wrap and activate the focused tab, and Tab moves into the active panel.
result: pass
source: automated
evidence: 05-CDP-UAT-evidence.jsonl case valid-native-keyboard-complete; trusted CDP key events.

### 5. Physical OS sleep/wake and unattended reconnect
expected: Both tabs recover after OS sleep and TaskNotes reload without changing selection or needing explicit retry.
result: blocked
blocked_by: physical-device
reason: Physical Windows sleep is unavailable through CDP and was not performed on the user computer. Both tabs passed real renderer suspension/resume (4.5 seconds frozen, accurate clocks and refresh) and unattended real TaskNotes disable/re-enable (about 1.2 seconds). These observations are preserved without claiming physical OS sleep.
evidence: 05-CDP-UAT-evidence.jsonl cases native-renderer-suspend-timers, native-renderer-suspend-staged, unattended-reload-timers, unattended-reload-staged

### 6. Review the retained TABS-02 assumption
expected: Explicitly classify the generic review-manually item against concrete native restoration and saved-state evidence.
result: pass
source: user review of automated evidence
reported: "2. sounds like everything passed"
disposition: User accepted the concrete native restart, independent-pane selection and invalid-state fallback evidence; no additional behavioral predicate remains.
evidence: Current native-full-restart-selections restored c88f9ce6849cf981 to Timers and c2a2a844402f0a8e to Staged; native-saved-state-validation confirms absent/invalid values fall back to Timers and both valid values restore correctly.

### 7. Current-model card actions, timestamp clocks and renderer cleanup through TaskCard
expected: Current-model card actions, timestamp clocks and renderer cleanup through TaskCard
result: pass
source: automated
coverage_id: 05-01:D1
evidence: 05-01-SUMMARY.md; current targeted suite

### 8. Keyed list identity, independent drag state, keyboard focus and shared saved order
expected: Keyed list identity, independent drag state, keyboard focus and shared saved order
result: pass
source: automated
coverage_id: 05-01:D2
evidence: 05-01-SUMMARY.md; current targeted suite

### 9. Stable panels, independent headers, disabled Stage and exact empty copy
expected: Stable panels, independent headers, disabled Stage and exact empty copy
result: pass
source: automated
coverage_id: 05-02:D1
evidence: 05-02-SUMMARY.md; current targeted suite and live CDP panel inspection

### 10. Both restore lifecycle orders, malformed state fallback, unique leaf IDs, explicit saves and keyboard activation
expected: Both restore lifecycle orders, malformed state fallback, unique leaf IDs, explicit saves and keyboard activation
result: pass
source: automated
coverage_id: 05-02:D2
evidence: 05-02-SUMMARY.md; current targeted suite

### 11. Both-tab connection messages, disabled actions and retained shell lifecycle
expected: Both-tab connection messages, disabled actions and retained shell lifecycle
result: pass
source: automated
coverage_id: 05-03:D1
evidence: 05-03-SUMMARY.md; current targeted suite; recorded native-reconnect-after-probe (explicit retry, not unattended reconnect)

### 12. Start-only picker options preserve selection and cleanup behavior
expected: Start-only picker options preserve selection and cleanup behavior
result: pass
source: automated
coverage_id: 05-03:D2
evidence: 05-03-SUMMARY.md; current targeted suite

### 13. Independent leaf selections restore after isolated native restart
expected: Independent leaf selections restore after isolated native restart
result: pass
source: automated
coverage_id: 05-03:D3
evidence: 05-03-native-evidence.jsonl#native-restart; current cold launch restored Timers and Staged in separate leaves

## Summary

total: 13
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none yet]

## Session Evidence and Limits

Restart requested by user; previous session had no completed tests. Structured SUMMARY coverage produced seven automated passes. Overlapping native-check deliverables were split into six focused manual checks; the retained classification review was preserved from VERIFICATION.md. No cold-start test was injected from SUMMARY file paths because no application entry point or startup file was modified; the UAT launcher nevertheless performed a fresh build/start.

Current targeted suite: 73 tests across seven files passed (timerPaneView, taskCard, cardList, cardOrder, cardOrderStore, taskPickerModal, main). Build/typecheck passed through uat:start. All three recorded plan commit windows reconcile (4, 4 and 5 commits; recorded heads are ancestors of HEAD).

Current isolated launcher: checkout phase-05-discuss@4ca65a5+dirty, main.js SHA256 prefix af950e616573, TaskNotes 4.18.2, Runtime API 1, pane loaded. Live CDP inspection found two restored leaves: c88f9ce6849cf981 selected Timers and c2a2a844402f0a8e selected Staged; linked panel IDs were distinct and inactive panels computed display:none. The Timers-only unreadable-Pomodoro note was present; no native Pomodoro capability pass is claimed.

Prior native evidence is identified as recorded evidence, not newly repeated physical input. The hidden UAT desktop cannot establish physical drag/hover, subjective appearance, physical keyboard/mouse ownership or OS sleep/wake. These remain pending. No task timer was started during this restart.

Phase verification is reported stale by init.verify-work. This UAT session does not refresh the verifier report or mark the phase complete; execute-phase must refresh verification before transition.


## CDP Follow-through

The user clarified that a visible window is unavailable and the isolated CDP environment is the intended test surface. The agent completed all feasible native input, visual, keyboard, reload and restart checks there. Browser-trusted CDP input is distinguished from synthetic DOM dispatch and physical hardware. The seven SUMMARY-derived passes are supplemented by four current native-check passes; no pending item was converted into a user pass.

The raw journal retains exploratory samples. Initial cdp-trusted-drag and the first native-forced-text-fallback-input/native-keyboard-complete attempts used clipped or inactive geometry and establish no pass. The later cdp-drag-at-visible-geometry and valid-* cases are the conclusive observations. Hidden inline ellipsis samples establish no menu result; actual nested date and context-menu interactions establish ownership instead.

Both disposable task timers were stopped. Original card order, original two tab selections and sidebar state were restored before a full isolated restart. The same two leaf IDs restored Timers/Staged, no active timers remained, and temporary validation leaves were detached. The isolated instance was stopped at the end. Test time entries remain only in seeded dev-vault tasks. No application source files changed.

Final regression: npm run check passed build/typecheck, zero-warning lint, and all 568 tests across 20 files. The temporary CDP driver is archived as 05-cdp-client.mjs.txt for review; it is not application source. No current implementation gap was found. The earlier sandbox-only build failure and temporary-driver lint failure were corrected in the verification environment before this successful run.

