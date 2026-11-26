---
phase: 05-two-tab-shell
verified: 2026-11-24
status: passed
score: 18/18 must-haves satisfied (17 verified, 1 includes accepted physical-observation limit)
covered_files: [".planning/phases/05-two-tab-shell/05-01-PLAN.md",".planning/phases/05-two-tab-shell/05-01-SUMMARY.md",".planning/phases/05-two-tab-shell/05-02-PLAN.md",".planning/phases/05-two-tab-shell/05-02-SUMMARY.md",".planning/phases/05-two-tab-shell/05-03-PLAN.md",".planning/phases/05-two-tab-shell/05-03-SUMMARY.md",".planning/phases/05-two-tab-shell/05-03-native-evidence.jsonl",".planning/phases/05-two-tab-shell/05-CDP-UAT-evidence.jsonl",".planning/phases/05-two-tab-shell/05-CONTEXT.md",".planning/phases/05-two-tab-shell/05-DOM-VERIFY.md",".planning/phases/05-two-tab-shell/05-SECURITY.md",".planning/phases/05-two-tab-shell/05-UAT.md",".planning/phases/05-two-tab-shell/05-cdp-client.mjs.txt",".planning/phases/05-two-tab-shell/05-narrow-640.png",".planning/phases/05-two-tab-shell/05-narrow-768.png",".planning/phases/05-two-tab-shell/05-narrow-staged.png",".planning/phases/05-two-tab-shell/COVERAGE.md","package-lock.json","package.json","src/main.ts","src/model/cardOrder.ts","src/model/taskLink.ts","src/model/timeMath.ts","src/state/CardOrderStore.ts","src/state/TimerController.ts","src/state/TimerStore.ts","src/tasknotes/TaskNotesBridge.ts","src/ui/CardList.ts","src/ui/CardRelationshipView.ts","src/ui/TaskCard.ts","src/ui/TaskPickerModal.ts","src/ui/TaskTitle.ts","src/ui/TimerPaneView.ts","styles.css","tests/cardList.test.ts","tests/cardRelationships.test.ts","tests/fakes/viewHost.ts","tests/main.test.ts","tests/store.test.ts","tests/taskCard.test.ts","tests/taskPickerModal.test.ts","tests/timerPaneView.test.ts"]
covered_digest: "v3:sha256:228784c0a33dea847330805b86263b8a1ec78add58091aef8212300181611e57"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "SC-4: Bridge-state messages (TaskNotes missing, disabled, too old, reconnecting) still show correctly. Reconnecting after a TaskNotes reload and after sleep/wake still works from either tab."
    reason: "User explicitly accepted the remaining physical Windows sleep/wake observation after reviewing the expected behavior, passing native renderer suspension/recovery and automatic reload evidence. Actual Windows sleep was not exercised."
    accepted_by: user
    accepted_at: "2026-11-14T04:02:57.600Z"
human_verification: []
gaps: []
decision_coverage:
  honored: 12
  total: 12
  not_honored: []
---

# Phase 5: Two-Tab Shell Verification Report

## Current-source re-verification — 2026-11-24

`TimerPaneView` restores tab state per leaf through `getState` and `setState`, with Timers as the fallback. Shared refreshes reconcile separate lists and leave selection intact. Timers keeps the regular timer controls and keyboard/drag ordering. The shared `+` selector, persistent idle cards and live Staged list are later features. The local relationship chip changes affect card-title rendering and event ownership. The current view/card/store/main tests passed alongside the build, lint, 692 feature tests and 13 vault-switch tests.

The accepted Phase 5 native results below apply to the shell tested on 2026-11-14. The user accepted native renderer suspension and reconnect as the available evidence. Actual Windows sleep remains unobserved.

## Original phase verification — 2026-11-14

The phase is verified and accepted. All three plans are executed, all 13 UAT checks pass, and the current regression run passes 568 tests across 20 files. The TABS-02 review classification was explicitly accepted by the user. Physical Windows sleep was accepted as an observation limit, not claimed as exercised.

## Re-verification scope

This replaces the initial human_needed report at commit 4ca65a5. A tracked diff from that commit to current HEAD shows no changes to src/, tests/, styles.css, package.json or package-lock.json. Changes were UAT evidence and COVERAGE.md clarification/acceptance. Existing source, artifact and wiring evidence therefore remains applicable. Closeout rechecked shell/picker/main wiring, the must-have and requirement lists, current UAT rows, and the security record. The inline verifier role refreshed the covered-input fingerprint through the GSD CLI; no separate agent was spawned.

The prior full npm run check passed build/typecheck, zero-warning lint and 568 tests on these unchanged sources. The closeout regression gate independently ran gsd-tools run-with-timeout 60 -- npm.cmd test: 20 files and 568 tests passed. No repeated native tests were requested from the user.

## Observable truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1: The pane shows two tabs, Staged and Timers. The Timers tab shows every regular timed task with the same cards, Start, Pause all, Resume all, Stop all, drag/keyboard reordering and Pomodoro hiding as v0.2. All v0.2 automated tests still pass. | VERIFIED | main.ts registers production TimerPaneView with shared services. TimerPaneView creates TaskCard through CardList, preserves four controller actions and uses TimerStore's filtered snapshot. Independently reran all 568 tests in 20 files; mounted dispatch/order and store ownership tests pass. Native evidence records cards, actions and keyboard ordering. Current trusted CDP drag and real chip pointer/menu cases also pass. |
| 2 | SC-2: The user can switch between tabs with one click. The Staged tab shows a placeholder empty state, and the header actions change with the tab (Timers keeps Start / Pause all / Resume all / Stop all). | VERIFIED | selectTab/updateTabs switch stable panels; Stage disabled without handler; exact empty copy and Timers header verified in named stable-panels test. native-shell records disabled Stage and computed hidden-panel display:none. |
| 3 | SC-3: After restarting Obsidian, the pane reopens on the tab that was last active. | VERIFIED | getState/setState and requestSaveLayout are wired. Named save/restore tests pass; raw native-restart observation has the same two leaf IDs restoring timers/staged independently. Current full restart and saved-state validation are recorded in 05-CDP-UAT-evidence.jsonl. |
| 4 | SC-4: Bridge-state messages remain correct; reconnect after TaskNotes reload and sleep/wake works from either tab. | PASSED (override for physical OS observation) | Both-tab connection tests pass. Current CDP journal records automatic real TaskNotes reload recovery in about 1.2 s from both tabs and accurate clocks/refresh after 4.5 s native renderer suspension. The user explicitly accepted the remaining physical Windows sleep observation in UAT test 5. |
| 5 | Different session keys distinguish equal titles; repeated identical keys reconcile once. | VERIFIED | CardList.reconcile keys and deduplicates with next.has; active keys come from timer.sessionKey. cardList key test and mounted duplicate test pass in full run. |
| 6 | Empty/single/null snapshots produce idle/one card/loading. | VERIFIED | currentTimers derives state and reconcile input; mounted ready loading/idle test and key test assert real DOM values/counts. |
| 7 | Equal ranks retain incoming order, unseen keys precede saved keys, and pause/resume preserves DOM identity. | VERIFIED | Existing orderTimers remains upstream; CardList only moves misplaced nodes. Independent order expectations and identity assertions pass, including named mounted pause/resume test. |
| 8 | Removed/closed cards release title Components, including late results; chip mouse ownership is retained. | VERIFIED | TaskCard titleOwners/titleSeq/disposed guards release owners exactly once. Replacement/removal resolve/reject tests, named disposed-stop and chip ownership tests pass. Current trusted CDP chip editor, nested date menu and context-menu interactions retain ownership. |
| 9 | D-01/D-02: Staged then Timers are text-only full-width tabs with accent underline and muted inactive text using Obsidian variables. | VERIFIED | styles.css flex:1 and scoped button selectors use text-muted/text-normal/interactive-accent. Native-restart records distinct inactive/active colors and selected accent border after the CSS fix. Agent-inspected screenshots at 298/362 px pane widths show readable tabs and wrapped headers. |
| 10 | D-03: One tab stop, neighboring arrow activation/focus, active-panel Tab access and hidden inactive content. | VERIFIED | updateTabs/tabKeydown/updatePanelFocus set linked ARIA IDs, roving tabindex and hidden. Named keyboard test passes; native-shell records focused target and computed inactive display:none. |
| 11 | D-05: Invalid/absent saved state falls back to Timers; valid tabs restore before or after onOpen. | VERIFIED | Non-array object and exact enum validation precede superclass setState. Named lifecycle-order matrix passes; native-invalid-state records empty and invalid objects falling back to timers. |
| 12 | D-06: Explicit selection saves updated leaf state; two leaves restore independently with shared order. | VERIFIED | Instance field tab; selection changes state before requestSaveLayout. Named save, unique-leaf and shared-order tests pass; native-restart and native-timers record independent selections and shared order. |
| 13 | D-07/D-08: Reveal and timer/store/bridge events preserve selected tab. | VERIFIED | main.ts revealLeaf supplies no replacement state; only explicit selection and setState assign tab. Named shell lifecycle test changes timers while staged and retains selection. Existing main tests pass; native command reveal retained leaves. |
| 14 | Empty Timers and static Staged states remain independent through empty/single/loading changes. | VERIFIED | Two CardList instances, panel-local state and separate messages. Named stable-panels test exercises empty/null/single transitions and card identity. Null ready snapshot intentionally shows shared loading per D-11. |
| 15 | D-11: Missing/incompatible/loading keep switchable tabs, disable headers and replace active content with shared heading/body/version/retry. | VERIFIED | Stable strip remains outside panels; connected guards every Timers action; both panels call renderMessage. Named connection matrix verifies disabled cached actions, version, loading and probe calls. |
| 16 | D-11: Subscriptions, completion checks, one 1 s interval and focus/visibility/wake/reveal refresh remain shell-owned. | VERIFIED | onOpen registers services, interval and pane document/window events independently of selection. Named lifecycle test proves wake-gap/focus/visibility/reveal refresh, write-free events, late completion rejection after close and released interval/listeners. |
| 17 | D-12: Unreadable Pomodoro note is Timers-only and store exclusion remains exact. | VERIFIED | Note created inside timersPanel. TimerStore filters visibleEntries before deriveSnapshot. Mounted scoped-note test and store tests prove exact owned-entry exclusion, same-path different-start adjacency and unreadable fail-open display. |
| 18 | Start-only options picker retains once-only selection, read-on-open, bridge-loss close, delayed cleanup and Pomodoro tags. | VERIFIED | TimerPaneView passes typed options to production TaskPickerModal; all creation sites updated. Named once-only picker test passes; full suite exercises late reads/renderers, throwing Notice, bridge loss and row tags. Mounted picker mock proves construction/guard release only; separate picker tests exercise real picker code. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| src/ui/TaskCard.ts | Card DOM/actions/title lifecycle | VERIFIED | Substantive class, constructed and updated by production callbacks; owns renderer cleanup and clocks. |
| src/ui/CardList.ts | Keyed list/reorder/dispose | VERIFIED | Two production instances; create/update/dispose injection, current-instance drag authority and minimal DOM movement. |
| src/ui/TimerPaneView.ts | Shell, leaf persistence and shared refresh | VERIFIED | Registered by main.ts; consumes shared services and real store snapshots. |
| src/ui/TaskPickerModal.ts | Start-only options picker | VERIFIED | Imported and constructed from guarded Start task action; tests exercise production picker independently. |
| styles.css | Tab/panel/hidden states | VERIFIED | Obsidian plugin stylesheet with scoped tab variables and hidden selector; recorded native computed styles prove installation. |
| tests/timerPaneView.test.ts | Mounted production view | VERIFIED | Imports actual TimerPaneView and renders through dedicated host; 14 active tests collected in the full run. |

Artifact queries returned 3/3 passing for each of the three plans (nine declarations, with duplicates). Source and call paths were inspected beyond these presence checks.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| TimerPaneView | CardList | Per-tab constructors, sessionKey reconcile and order commit | WIRED | Actual new CardList calls and reconcile use store output; Timers commitOrder invokes cardOrder.set. |
| CardList | TaskCard | Injected create/update/dispose callbacks | WIRED | CardList invokes options.create/update/dispose; TimerPaneView supplies new TaskCard/card.update/card.dispose. Deliberately no direct TaskCard import in generic CardList. |
| TimerPaneView | workspace.requestSaveLayout | Changed explicit selection | WIRED | Named serialization test observes the updated selected state at save time. |
| TimerPaneView | TimerStore.requestRefresh | Tick wake/reveal, pane focus and visibility | WIRED | Local store destructuring and services.store reach the shared injected store; named lifecycle test observes calls. |
| TimerPaneView | TaskPickerModal | Guarded Start action, options constructor | WIRED | Production constructor passes mode:start, gateway, controller and onClose; separate picker tests prove its behavior. |

The key-link query's literal-reference heuristic reported only 1/6 declarations verified. The five negative results are resolved by direct source tracing and passing integration tests: extensionless imports, a destructured store instance and injected generic callbacks do not contain the plan's literal target path/member string. They are not broken links. The sleep-observation acceptance below is the sole override; no artifact or key-link failure is overridden.


## Requirement traceability

| Requirement | Plans | Result | Evidence |
|---|---|---|---|
| TABS-01 | 05-01, 05-02, 05-03 | Satisfied | Shared production card/list/controller path, mounted regression tests, native drag/hover, screenshots, native keyboard and chip interactions. |
| TABS-02 | 05-02, 05-03 | Satisfied and accepted | Independent original leaf IDs restore Timers/Staged after a full native restart; absent/invalid values restore Timers; both valid values restore correctly. User accepted the retained review flag. |

The complete phase requirement set is TABS-01 and TABS-02. No orphaned requirement or deferred implementation truth was found. The disabled Stage button and static Staged list are required Phase 5 placeholders; Phase 6 owns staging behavior.

## Native UAT and acceptance disposition

| Original open item | Closure evidence |
|---|---|
| Drag, focus and hover | Browser-trusted CDP dragstart/dragover/drop/dragend reordered live cards; saved order, focus, hover and card identity survived refresh. Foreign drag left order unchanged. |
| Narrow-pane appearance | Inspected 05-narrow-640.png and 05-narrow-768.png at 298/362 px pane widths; text tabs and underline remain readable and all four header actions wrap above the cards. Staged empty state was also captured. |
| Chip pointer/menu and plain fallback | Real chip ordinary click opens TaskNotes editor; nested date and context menus show once, with zero pane-owned duplicate calls. Plain fallback ordinary/modifier/middle click invokes pane navigation exactly once with the expected new-leaf argument. The native fallback state was entered via production showTitleText; renderer-failure triggering remains unit-tested. |
| Sleep/wake and unattended reconnect | Real TaskNotes disable/re-enable automatically restored both tabs in about 1.2 s. Freezing/resuming the renderer for 4.5 s refreshed data and clocks without changing selection. Actual Windows sleep was not exercised; user explicitly stated "mark it as passed" after reviewing this distinction. |
| Generic TABS-02 review | User stated "2. sounds like everything passed" after reviewing native restart, independent-pane and malformed-state evidence; disposition recorded in COVERAGE.md and UAT test 6. |

The journal retains failed exploratory interactions with inactive/clipped geometry. Those samples are explicitly excluded as pass evidence in UAT.md. Only the later valid-* cases and cdp-drag-at-visible-geometry establish the corresponding native passes. Physical input hardware was not used; CDP input is browser-trusted input rather than synthetic DOM dispatch. No real incompatible TaskNotes version or live Pomodoro exclusion condition was induced; those paths remain covered by passing mounted/store tests.

## Security, regression and cleanup

05-SECURITY.md remains verified: 10 threats closed, 0 open, ASVS L1. No dependency, application code, persisted schema or write boundary changed during acceptance. Code review capability is inactive; no code-review step or execute:post gate is active. No gap-closure parent artifacts apply. Prior-phase behavior is covered by the current full regression suite. No LEARNINGS.md graduation candidates or lingering phase handoffs exist.

The original Timers order, two leaf selections and sidebar state were restored before the native restart. Temporary validation leaves were detached. Both disposable test timers were stopped, no active timer remained, and the isolated instance was stopped. Only seeded dev-vault tasks received test time entries.

## Gaps summary

No unresolved implementation or acceptance gap remains. The physical OS sleep observation limit is retained under the explicit user acceptance above. This report refresh closes the old human_needed/stale state; the phase-completion owner must still validate it before advancing state.
