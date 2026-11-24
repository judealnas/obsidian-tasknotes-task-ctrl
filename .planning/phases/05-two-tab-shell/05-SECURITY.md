---
phase: "05"
slug: two-tab-shell
status: verified
threats_total: 10
threats_closed: 10
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: "2026-11-13"
---

# Phase 05 Security

ASVS L1 source and test review of the threat registers authored in all three plans. Repeated T-05-SC rows describe the same supply-chain boundary and are counted once. No new threat scan or accepted risk was introduced.

## Trust Boundaries

| Boundary | Data crossing |
|---|---|
| TaskNotes data to card DOM | Titles, paths, asynchronous renderer output |
| DOM actions to controller | Current task and exact entry identity |
| Drag events to persisted order | List-local drag identity |
| Workspace state to shell | Untrusted saved tab value and leaf-local selection |
| Lifecycle and picker callbacks | Late reads, completion checks and selection events |
| Development dependencies | Existing lockfile and installed parent tools |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and evidence | Status |
|---|---|---|---|---|---|---|
| T-05-01 | Tampering | TaskCard actions | high | mitigate | TaskCard reads currentModel at dispatch, captures path/start before await, checks busy/disabled and disposal; taskCard tests cover current targets and settlement after disposal. Existing controller remains the write authority. | closed |
| T-05-02 | Information disclosure | Title rendering | medium | mitigate | TaskCard uses taskWikilink for paths, text setters for titles, titleSeq/disposed checks and tracked Component release. Tests cover rejection, replacement/removal, chip ownership and default prevention. Native chip mouse ownership remains an observation limit, not a claimed native pass. | closed |
| T-05-03 | Tampering | Drag handlers | medium | mitigate | CardList requires a live keyed item and local dragKey set by its own handle; foreign MIME data alone cannot reorder. Independent-list and detached-handle tests pass. | closed |
| T-05-04 | Tampering | setState | medium | mitigate | TimerPaneView validates non-array object and exact staged/timers enum; all other inputs fall back to Timers. Mounted malformed-state matrix and native invalid-state observations pass. | closed |
| T-05-05 | Tampering | Leaf persistence | medium | mitigate | tab is instance-local, IDs are unique per pane, getState serializes tab, explicit changes call requestSaveLayout. Mounted two-view and native two-leaf restart evidence pass. | closed |
| T-05-06 | Elevation of privilege | Hidden panels | low | mitigate | Inactive panel has hidden attribute and CSS display:none; ARIA roving tabindex follows selection. Stage is disabled and has no action handler. Mounted keyboard tests and native computed visibility pass. | closed |
| T-05-07 | Tampering | Lifecycle rendering | high | mitigate | Controller mutations appear only in guarded user-action callbacks; shell rendering/refresh/reconnect matrix spies on mutations and passes. No staged write or persistence key added. | closed |
| T-05-08 | Denial of service | Shell lifecycle | medium | mitigate | One registered interval, registered subscriptions and pane-document/window listeners; close disposes both lists/picker and invalidates completion generation. Closed/late-result tests pass. | closed |
| T-05-09 | Tampering | Picker selection | high | mitigate | TaskPickerModal retains chosen/opened, busy/availability checks, capture ownership, opening/render generations, subscription and row cleanup. Existing picker tests and native start/cancel pass. | closed |
| T-05-SC | Tampering | Dependencies | high | mitigate | No installs or dependency changes; existing parent node_modules used. package.json/package-lock.json unchanged across the phase. Build/typecheck/lint and 568 tests pass. | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---|---|---|---|
| 2026-11-13 | 10 | 10 | 0 | execute-phase orchestrator, ASVS L1 |

## Evidence and Limits

Source: src/ui/TaskCard.ts, CardList.ts, TimerPaneView.ts and TaskPickerModal.ts. Automated evidence: all taskCard/cardList/timerPaneView/taskPickerModal tests plus the final one-shot regression gate (20 files, 568 tests). Native evidence: 05-03-SUMMARY.md and 05-03-native-evidence.jsonl. Physical input, OS wake and native chip mouse/menu ownership are not established by simulated tests; see summary and WINDOWS entry 17. The plan-authored register is fully mitigated at L1, so secure-phase's short-circuit applies without a deeper auditor dispatch.

## Sign-Off

- [x] Every planned threat has a disposition and mitigation evidence.
- [x] No accepted risks introduced.
- [x] threats_open: 0 confirmed.
- [x] status: verified.

Approval: verified 2026-11-13 at ASVS L1.
