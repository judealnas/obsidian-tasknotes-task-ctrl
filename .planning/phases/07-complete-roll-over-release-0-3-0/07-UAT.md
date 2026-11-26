---
status: testing
phase: 07-complete-roll-over-release-0-3-0
source: [07-NATIVE-EVIDENCE.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-RELEASE.md, "../../verification/2026-11-24-native-followup.md"]
updated: 2026-11-24
---

## Current Test

Test 4 remains open and needs a physical mobile device.

## Tests

### 1. Complete an ordinary staged task with auto-stop enabled and disabled
expected: Completing a staged task sets the resolved status, stops its regular timer and clears the staged field.
result: pass
evidence: The TaskNotes 4.18.2 candidate desktop check and both settings matrices in [07-NATIVE-EVIDENCE.md](07-NATIVE-EVIDENCE.md) confirmed the outcome. The disabled-setting run verified the public setting before and after the matrix.

### 2. Complete a recurring occurrence from either tab
expected: One resolved occurrence is completed while the series stays open. Retry does not toggle the occurrence off or duplicate a write.
result: pass
evidence: The TaskNotes 4.18.2 candidate matrix exercised virtual, materialized, automatic materialization and existing-next paths through production controllers. It checked repeat, restart and Pomodoro protection. Calendar-date and tab wiring remain covered by the current regression suite.

### 3. Keep unfinished staging and update calendar age
expected: At local midnight, unfinished tasks remain in saved order and their calendar age updates without task writes.
result: pass
evidence: Automated calendar and staging-store tests cover the revised behavior. The user removed Done today and custom rollover on 2026-11-15, superseding their overnight and boundary sleep checks.

### 4. Reorder both tabs on a physical mobile device
expected: Tap the up/down controls in Staged and Timers, verify boundary behavior and confirm both independent orders survive reopening.
result: pending
evidence: Mobile-host tests exercise controls, focus, boundaries and persistence. A physical mobile touch session remains unobserved.

### 5. Preserve data in a cold native 0.2.0 → 0.3.0 candidate asset swap
expected: Pause timing, both orders, settings, unknown fields and the saved pane survive a restart with the candidate assets.
result: pass
evidence: The [cold upgrade result](07-upgrade-cold-restart-result.json) records 15 passed checks after loading actual 0.2.0 assets and the local 0.3.0 candidate. The pause retained 1,344 ms and asset replacement left data bytes intact.

### 6. Upgrade 0.2.0 to the published 0.3.0 through BRAT
expected: BRAT updates the existing install and preserves the populated 0.2.0 pauses, order, data and saved pane.
result: pass
evidence: In a disposable vault, BRAT 2.2.0 installed published 0.2.0, then updated it to published 0.3.0 under the same plugin ID. Two pauses, the saved Timers order and the pane survived the reload with equal parsed plugin data, including the default completion preference. The installed bundle and stylesheet matched published hashes. Test 5 separately covers both order arrays, a nondefault preference and an unknown-data field. [Native follow-up](../../verification/2026-11-24-native-followup.md).

### 7. Verify published release and plugin identity
expected: Tag 0.3.0 is stable, its release workflow succeeded and the downloadable manifest uses the original plugin ID with the new display name.
result: pass
evidence: [07-RELEASE.md](07-RELEASE.md) lists the fixed commit, tag, uploaded assets and successful workflow.

## Summary

total: 7
passed: 6
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

Test 4 remains open. Mobile-host tests exercise the intended controls and ordering, and physical touch remains unobserved.
