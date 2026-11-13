---
status: testing
phase: 05-two-tab-shell
source: [05-VERIFICATION.md]
started: 2026-11-13T20:19:37Z
updated: 2026-11-13T20:19:37Z
---

## Current Test

number: 1
name: Physical drag and hover in the native pane
expected: |
  Handle drag reorders and retains stable card focus/hover across refresh; foreign drags do not reorder.
awaiting: user response

## Tests

### 1. Physical drag and hover in the native pane
expected: Handle drag reorders and retains stable card focus/hover across refresh; foreign drags do not reorder.
result: [pending]

### 2. Narrow-pane visual appearance
expected: Text-only underlined tabs remain readable and the four Timers actions wrap clearly without obscuring cards.
result: [pending]

### 3. Real TaskNotes chip mouse/menu ownership and plain fallback
expected: Chip mouse actions retain TaskNotes ownership without duplicate navigation/menu; plain titles open with ordinary, modifier and middle clicks.
result: [pending]

### 4. Physical OS sleep/wake and unattended reconnect
expected: From either selected tab, wake/reload refreshes live data and wall-clock durations without changing selection.
result: [pending]

### 5. Review retained TABS-02 unclassified assumption
expected: A human explicitly classifies or accepts the generic review-manually item in COVERAGE.md using concrete leaf-state and native restart evidence.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

No implementation gaps found. All 18 automated must-haves are verified. These pending observations and review items are not recorded as passes. Detailed native successes and limits remain in 05-03-SUMMARY.md and 05-VERIFICATION.md.
