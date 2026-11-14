---
status: diagnosed
phase: 06-staged-tab-core
source: [06-VERIFICATION.md]
started: "2026-11-14T22:00:00Z"
updated: 2026-11-14T22:17:14Z
---

## Current Test

[testing complete]

## Tests

### 1. Stage must not implicitly start timing
expected: Stage adds membership only. Review the native zero-active-timer result and confirm this behavior; descriptor-less enforcement is flagged.
result: pass
source: automated

### 2. Unstage must not control active Pomodoro timing
expected: Unstaging a Pomodoro-owned task leaves its Pomodoro timing untouched. Automated exact-ownership/takeover tests pass; verify this in native TaskNotes.
result: pass
source: automated

### 3. Staged Complete must not complete a recurring series
expected: Staged Complete stays disabled for Phase 6 and invokes no completion operation. Automated zero-call tests pass for all states; explicit review of descriptor-less enforcement is pending.
result: pass
source: automated

### 4. Background changes must not change the selected tab
expected: Each pane keeps its own chosen tab after shared staging/timer changes. Mounted two-leaf and native observations pass; explicit review of descriptor-less enforcement is pending.
result: pass
source: automated

### 5. Age metadata must use neutral visual framing
expected: The date/age line is muted and neutral, without punitive wording or styling. Confirm the visual presentation is acceptable.
result: pass
source: human

### 6. Unstage button and reorder handle remain separate
expected: The Unstage (X) button and reorder handle have distinct, non-overlapping visible and clickable areas.
result: issue
reported: 'wording and appearance looks good. However, the "X" button overlaps with what appears to be the handle for re-organizing cards.'
severity: cosmetic

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-06-6
  truth: "The Unstage button and reorder handle have non-overlapping visible and clickable areas."
  status: failed
  reason: 'User reported: wording and appearance looks good. However, the "X" button overlaps with what appears to be the handle for re-organizing cards.'
  severity: cosmetic
  test: 6
  root_cause: "Unstage inherits Obsidian button padding (4px 12px), yielding a 34.625px width, while fixed corner offsets reserve only 28px between control ends. Native rectangles overlap by 6.625px."
  artifacts:
    - path: styles.css
      issue: "Unstage lacks explicit dimensions/padding; staged handle offset assumes a smaller adjacent button."
    - path: src/ui/TaskCard.ts
      issue: "Handle and Unstage are separate absolutely positioned buttons within the same card."
  missing:
    - "Explicit corner-control sizing and positive spacing independent of inherited button padding."
    - "Native geometry and hit-target verification at normal/narrow widths and long titles."
  debug_session: "06-controls-overlap"

## Resume evidence — 2026-11-14

- Guarded UAT launch rebuilt phase-05-discuss@e5d33c6+dirty; installed main.js hash prefix 9fd9432d5f62; TaskNotes 4.18.2, API v1.
- Existing 06-native-check.txt rerun: all 17 assertions passed. Tests 1, 3 and 4 passed from live behavior; Complete remained disabled, and two leaves retained their own selected tabs during shared updates.
- Test 2: selected a temporary task in the native Pomodoro picker and clicked Start focus. Unstage cleared staged membership while Pomodoro session 1794694211593 and its time entry start 2026-11-14T22:10:11.602Z remained unchanged and active. Stopped the test Pomodoro afterward and removed the temporary task.
- Native appearance screenshot: 06-age-review.png. Screenshot fixture removed. Initial timer/Pomodoro state was idle; cleanup restored idle state.
- Source enforcement descriptor omissions remain documented in 06-VERIFICATION.md; these passes record observed runtime behavior, not descriptor completeness or user approval.


