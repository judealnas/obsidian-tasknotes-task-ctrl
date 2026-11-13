---
phase: 05-two-tab-shell
verified: 2026-11-13T20:15:41Z
status: human_needed
score: 18/18 must-haves verified
covered_files: [".planning/phases/05-two-tab-shell/05-01-PLAN.md", ".planning/phases/05-two-tab-shell/05-01-SUMMARY.md", ".planning/phases/05-two-tab-shell/05-02-PLAN.md", ".planning/phases/05-two-tab-shell/05-02-SUMMARY.md", ".planning/phases/05-two-tab-shell/05-03-PLAN.md", ".planning/phases/05-two-tab-shell/05-03-SUMMARY.md", ".planning/phases/05-two-tab-shell/05-03-native-evidence.jsonl", ".planning/phases/05-two-tab-shell/05-CONTEXT.md", ".planning/phases/05-two-tab-shell/05-DOM-VERIFY.md", ".planning/phases/05-two-tab-shell/05-SECURITY.md", ".planning/phases/05-two-tab-shell/COVERAGE.md", "package-lock.json", "package.json", "src/main.ts", "src/model/cardOrder.ts", "src/model/taskLink.ts", "src/model/timeMath.ts", "src/state/CardOrderStore.ts", "src/state/TimerController.ts", "src/state/TimerStore.ts", "src/tasknotes/TaskNotesBridge.ts", "src/ui/CardList.ts", "src/ui/TaskCard.ts", "src/ui/TaskPickerModal.ts", "src/ui/TimerPaneView.ts", "styles.css", "tests/cardList.test.ts", "tests/fakes/viewHost.ts", "tests/main.test.ts", "tests/store.test.ts", "tests/taskCard.test.ts", "tests/taskPickerModal.test.ts", "tests/timerPaneView.test.ts"]
covered_digest: "v3:sha256:9d12b068fce3b30889d4164f18b7d677afe042f76f41004bdf140bba0990fb7e"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 12
  total: 12
  not_honored: []
human_verification:
  - test: Physical drag and hover in the native pane
    expected: Handle drag reorders and retains stable card focus/hover across refresh; foreign drags do not reorder.
    why_human: Mounted drag geometry and synthetic native keyboard input do not establish physical pointer behavior.
  - test: Narrow-pane visual appearance
    expected: Text-only underlined tabs remain readable and the four Timers actions wrap clearly without obscuring cards.
    why_human: Computed colors, hidden state and flex-wrap were observed; narrow-width visual judgment was not.
  - test: Real TaskNotes chip mouse/menu ownership and plain fallback
    expected: Chip mouse actions retain TaskNotes ownership without duplicate navigation/menu; plain titles open with ordinary, modifier and middle clicks.
    why_human: Automated ownership/fallback tests pass; recorded native outer-title events did not establish nested chip mouse/menu behavior.
  - test: Physical OS sleep/wake and unattended reconnect
    expected: From either selected tab, wake/reload refreshes live data and wall-clock durations without changing selection.
    why_human: Named simulated wake-gap tests pass and native retry reconnect passed; physical sleep and automatic reconnect latency were not observed.
  - test: Review retained TABS-02 unclassified assumption
    expected: A human explicitly classifies or accepts the generic review-manually item in COVERAGE.md using concrete leaf-state and native restart evidence.
    why_human: The probe provided no additional predicate; successful restart evidence cannot silently resolve its taxonomy or substitute for a human decision.
---

# Phase 5: Two-Tab Shell Verification Report

**Phase Goal:** The pane becomes a two-tab shell (Staged, Timers) in which the Timers tab is the v0.2 pane, unchanged.
**Verified:** 2026-11-13T20:15:41Z
**Status:** human_needed
**Re-verification:** No — initial verification; no previous VERIFICATION.md existed.

The implementation and automated behavioral contract are verified. Five human-review items remain. No missing implementation, broken wiring or blocking anti-pattern was found. The clean automated score does not certify unobserved native input, visual judgment or physical OS wake.

## Goal Achievement

### Observable Truths

The four roadmap criteria are retained below. Plan 05-01 truth 1 is merged into SC-1, 05-02 truth 3 into SC-2, and 05-03 truth 4 into SC-4; all other plan predicates add distinct detail. This yields 18 truths. No prohibition or backstop-tier truth is declared.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1: The pane shows two tabs, Staged and Timers. The Timers tab shows every regular timed task with the same cards, Start, Pause all, Resume all, Stop all, drag/keyboard reordering and Pomodoro hiding as v0.2. All v0.2 automated tests still pass. | VERIFIED | main.ts registers production TimerPaneView with shared services. TimerPaneView creates TaskCard through CardList, preserves four controller actions and uses TimerStore's filtered snapshot. Independently reran all 568 tests in 20 files; mounted dispatch/order and store ownership tests pass. Native evidence records cards, actions and keyboard ordering. Physical drag/chip limits remain below. |
| 2 | SC-2: The user can switch between tabs with one click. The Staged tab shows a placeholder empty state, and the header actions change with the tab (Timers keeps Start / Pause all / Resume all / Stop all). | VERIFIED | selectTab/updateTabs switch stable panels; Stage disabled without handler; exact empty copy and Timers header verified in named stable-panels test. native-shell records disabled Stage and computed hidden-panel display:none. |
| 3 | SC-3: After restarting Obsidian, the pane reopens on the tab that was last active. | VERIFIED | getState/setState and requestSaveLayout are wired. Named save/restore tests pass; raw native-restart observation has the same two leaf IDs restoring timers/staged independently. Native evidence was inspected, not rerun during verification. |
| 4 | SC-4: Bridge-state messages (TaskNotes missing, disabled, too old, reconnecting) still show correctly. Reconnecting after a TaskNotes reload and after sleep/wake still works from either tab. | VERIFIED | Named both-tab connection matrix and shell wake/focus/visibility/reveal tests pass; controller writes remain absent and selection retained. Raw native-reconnect-after-probe restores both bodies and selections. Physical wake and unattended reconnect remain human checks; simulated clock gaps are not presented as physical OS observations. |
| 5 | Different session keys distinguish equal titles; repeated identical keys reconcile once. | VERIFIED | CardList.reconcile keys and deduplicates with next.has; active keys come from timer.sessionKey. cardList key test and mounted duplicate test pass in full run. |
| 6 | Empty/single/null snapshots produce idle/one card/loading. | VERIFIED | currentTimers derives state and reconcile input; mounted ready loading/idle test and key test assert real DOM values/counts. |
| 7 | Equal ranks retain incoming order, unseen keys precede saved keys, and pause/resume preserves DOM identity. | VERIFIED | Existing orderTimers remains upstream; CardList only moves misplaced nodes. Independent order expectations and identity assertions pass, including named mounted pause/resume test. |
| 8 | Removed/closed cards release title Components, including late results; chip mouse ownership is retained. | VERIFIED | TaskCard titleOwners/titleSeq/disposed guards release owners exactly once. Replacement/removal resolve/reject tests, named disposed-stop and chip ownership tests pass. Real chip pointer behavior still requires the native check below. |
| 9 | D-01/D-02: Staged then Timers are text-only full-width tabs with accent underline and muted inactive text using Obsidian variables. | VERIFIED | styles.css flex:1 and scoped button selectors use text-muted/text-normal/interactive-accent. Native-restart records distinct inactive/active colors and selected accent border after the CSS fix. Narrow-pane aesthetics remain human review. |
| 10 | D-03: One tab stop, neighboring arrow activation/focus, active-panel Tab access and hidden inactive content. | VERIFIED | updateTabs/tabKeydown/updatePanelFocus set linked ARIA IDs, roving tabindex and hidden. Named keyboard test passes; native-shell records focused target and computed inactive display:none. |
| 11 | D-05: Invalid/absent saved state falls back to Timers; valid tabs restore before or after onOpen. | VERIFIED | Non-array object and exact enum validation precede superclass setState. Named lifecycle-order matrix passes; native-invalid-state records empty and invalid objects falling back to timers. |
| 12 | D-06: Explicit selection saves updated leaf state; two leaves restore independently with shared order. | VERIFIED | Instance field tab; selection changes state before requestSaveLayout. Named save, unique-leaf and shared-order tests pass; native-restart and native-timers record independent selections and shared order. |
| 13 | D-07/D-08: Reveal and timer/store/bridge events preserve selected tab. | VERIFIED | main.ts revealLeaf supplies no replacement state; only explicit selection and setState assign tab. Named shell lifecycle test changes timers while staged and retains selection. Existing main tests pass; native command reveal retained leaves. |
| 14 | Empty Timers and static Staged states remain independent through empty/single/loading changes. | VERIFIED | Two CardList instances, panel-local state and separate messages. Named stable-panels test exercises empty/null/single transitions and card identity. Null ready snapshot intentionally shows shared loading per D-11. |
| 15 | D-11: Missing/incompatible/loading keep switchable tabs, disable headers and replace active content with shared heading/body/version/retry. | VERIFIED | Stable strip remains outside panels; connected guards every Timers action; both panels call renderMessage. Named connection matrix verifies disabled cached actions, version, loading and probe calls. |
| 16 | D-11: Subscriptions, completion checks, one 1 s interval and focus/visibility/wake/reveal refresh remain shell-owned. | VERIFIED | onOpen registers services, interval and pane document/window events independently of selection. Named lifecycle test proves wake-gap/focus/visibility/reveal refresh, write-free events, late completion rejection after close and released interval/listeners. |
| 17 | D-12: Unreadable Pomodoro note is Timers-only and store exclusion remains exact. | VERIFIED | Note created inside timersPanel. TimerStore filters visibleEntries before deriveSnapshot. Mounted scoped-note test and store tests prove exact owned-entry exclusion, same-path different-start adjacency and unreadable fail-open display. |
| 18 | Start-only options picker retains once-only selection, read-on-open, bridge-loss close, delayed cleanup and Pomodoro tags. | VERIFIED | TimerPaneView passes typed options to production TaskPickerModal; all creation sites updated. Named once-only picker test passes; full suite exercises late reads/renderers, throwing Notice, bridge loss and row tags. Mounted picker mock proves construction/guard release only; separate picker tests exercise real picker code. |

**Score:** 18/18 truths verified; 0 present-but-behavior-unverified. Every behavior-dependent truth has passing behavioral tests. Native acceptance limits remain explicit human items rather than being counted as failed implementation.

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

The key-link query's literal-reference heuristic reported only 1/6 declarations verified. The five negative results are resolved by direct source tracing and passing integration tests: extensionless imports, a destructured store instance and injected generic callbacks do not contain the plan's literal target path/member string. They are not broken links. No override was used.

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| TimerPaneView/TaskCard | timers, title, session and total | TaskNotesBridge.active calls api.time.active; TimerStore refresh reads active/ownership/paused tasks, filters owned entries, derives snapshot and notifies; view orders snapshot then updates cards | Yes | FLOWING |
| Timers order | session keys | Existing CardOrderStore loaded in main.ts; keyboard/drag callbacks call set and notify both views | Yes | FLOWING |
| Leaf selection | tab | Native workspace calls getState/setState; explicit changes requestSaveLayout | Yes | FLOWING |
| TaskPickerModal | tasks/statuses/ownership | Gateway listTasks/statuses/pomodoroOwnership read on opening, guarded against late reads | Yes | FLOWING |
| Staged | Empty list/copy | Explicit D-09/D-10 phase placeholder; reconcile([]), disabled Stage, no staging reads/writes | Intentionally static | IN SCOPE |

Static Staged content is required by this phase, not disconnected dynamic data. Staging interactions, counts and markers are assigned to Phase 6; rename/release and recurring completion changes are Phase 7. No actual failed truth was moved to a future phase.

### Behavioral Spot-Checks

Verifier independently ran the following commands; all exited 0. Named tests used `node C:/Users/ja384/.codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 10 -- node ../../../node_modules/vitest/vitest.mjs run --dir tests <file> -t '<exact test name>'`. Each named run completed within ten seconds. Other tests reported as skipped by the name filter are not disabled tests.

| File | Exact test name / command | Result |
| --- | --- | --- |
| timerPaneView | Staged retains shell wake focus visibility and reveal refresh without writes and closes late completion | PASS |
| timerPaneView | both tabs share connection messages and disable cached header actions until the snapshot is ready | PASS |
| timerPaneView | serializes explicit selection and requests layout saving after state changes | PASS |
| timerPaneView | restores both lifecycle orders with malformed state falling back to timers | PASS |
| timerPaneView | links unique leaf tabs and supports automatic wrapped keyboard activation | PASS |
| timerPaneView | switches stable panels with independent actions and empty states | PASS |
| timerPaneView | mounted view dispatches current targets and keeps session DOM through pause/resume | PASS |
| timerPaneView | two mounted views share persisted order but retain their own DOM and drag authority | PASS |
| taskCard | stop retains captured target and settlement cannot revive a disposed card | PASS |
| taskCard | failed current title render falls back to text and releases its component | PASS |
| taskCard | chip-owned mouse actions do not navigate but keyboard opens the current task | PASS |
| cardList | drag end/removal cancels authority and detached handles cannot commit | PASS |
| taskPickerModal | mouse and keyboard share once-only selection even when host closes first | PASS |
| Full workspace, once for explicit SC-1 regression contract | `node C:/Users/ja384/.codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 10 -- pwsh -NoProfile -Command 'npm test'` | PASS: 20 files, 568 tests, Vitest duration 1.03 s |

The parent reports final build/typecheck/lint success through npm run check; this verifier independently reran tests, not the build. No server, normal Obsidian instance or UAT process was started. No application/task state was mutated.

### Probe Execution

No documented probe shell script or conventional scripts/*/tests/probe-*.sh exists for this UI phase. The spec-less planning probe is a classification input, not an executable acceptance probe. Its remaining flag is retained. Gateway.probe is application retry logic, exercised by named tests; it is not a separate CLI probe.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| TABS-01 | 05-01, 05-02, 05-03 | Staged and unchanged Timers cards/actions | SATISFIED (automated), native review pending | Truths 1/2 and detailed card/list/shell tests; native actions and keyboard observations. |
| TABS-02 | 05-02, 05-03 | Remember last-active tab across restarts | SATISFIED (behavior), classification review pending | Named serialization/restoration tests, raw two-leaf native-restart and native-invalid-state evidence. Generic unclassified assumption remains unresolved. |

REQUIREMENTS.md assigns no additional requirements to Phase 5. No orphaned requirement. The verifier does not change requirement checkboxes or phase state; root owns those files.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. Owner query returned honored:12, total:12, not_honored:[]; advisory gate, no status impact.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped/disabled in source | Circular | Strongest assertion | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| tests/timerPaneView.test.ts | TABS-01/02 | 14 | 0 | No | Behavioral state transitions, calls, DOM identity and cleanup | PASS |
| tests/taskCard.test.ts | TABS-01 | 9 | 0 | No | Exact current targets, clocks, event ownership and delayed cleanup | PASS |
| tests/cardList.test.ts | TABS-01 | 6 | 0 | No | Exact order, movement count, DOM identity and foreign-drag rejection | PASS |
| tests/taskPickerModal.test.ts | TABS-01 | 13 | 0 | No | Selection/write count, late-result cleanup, failure paths and tags | PASS |

No source-level skip/todo tests or expected-value-writing scripts were found in these files. Assertions use explicit independent values and manually supplied models, not output generated from the tested implementation. The dedicated host simulates DOM/CSS/lifecycle and the mounted picker is mocked: these tests cannot prove native rendering, host drag geometry or real TaskNotes chip pointer ownership. Separate production-picker tests and raw native observations limit that blind spot. Production main/store/controller establish the injected service preconditions; no specific coincidental reliance was found.

### Anti-Patterns and Disconfirmation

| File/scope | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| TimerPaneView | Empty Staged list and no-op commitOrder | Info | Explicit Phase 5 placeholder, no enabled Stage action; Phase 6 supplies staging. |
| Native evidence | Initial inactive color equaled active color | Resolved | Final source specificity and native-restart colors demonstrate correction. |
| Native evidence | First re-enable sample remained missing | Warning | Later explicit retry restores ready; no automatic reconnect latency claim. |
| COVERAGE.md | TABS-02 unclassified review-manually assumption | Warning | Human classification remains open despite concrete restart evidence. |
| Phase source/tests | No unreferenced TBD/FIXME/XXX, disabled requirement tests or console-only handler | None | No blocking debt marker or stub. |

Disconfirmation checked three plausible failure modes: shared leaf state, inactive panels leaking/losing timer refresh, and late renderer/closed-handle actions. Independent instance state and named tests falsify those implementation concerns. Partial verification remains for native drag/chip input and OS wake. A misleading-test boundary is explicitly identified: the mounted picker mock tests the shell seam, not real SuggestModal behavior. A native incompatible-version/unreadable-ownership error condition was not induced; mounted/store tests cover these paths, with no claimed native pass. Existing completed-task pause behavior is unchanged in unmodified TimerStore/controller and tracked in roadmap Phase 999.1; it is not a new Phase 5 regression.

### Security and Optional DOM Hook

05-SECURITY.md records 10/10 plan-authored threats closed, zero open, ASVS L1 and no accepted risks. Source checks corroborate current-model action targets, text/wikilink title handling, generation/owner cleanup, local drag authority, strict tab validation, independent leaf fields and write-free lifecycle. package.json/package-lock.json and production service/main files are unchanged from the phase base. No new dependency or staging persistence key was added. Security closure does not upgrade native observation limits.

05-DOM-VERIFY.md correctly records outcome:could_not_look, reason:no_browser_mcp, checked:0. The optional hook is additive. Separate raw CDP observations in 05-03-native-evidence.jsonl were inspected as existing native evidence, without calling them observations made by this verifier. The initial native chip click/menu samples do not show successful intended mouse/menu behavior; keyboard opening is the demonstrated native title action.

### Human Verification Required

1. **Physical drag and hover:** Drag real handles and refresh both leaves. Expected: correct ordering and stable focus/hover, no foreign-drag reorder. Simulated geometry cannot prove physical input.
2. **Narrow-pane appearance:** Resize the native sidebar. Expected: readable text tabs, clear accent/muted states and useful wrapped header actions. Computed styles do not establish subjective appearance.
3. **TaskNotes chip pointer/menu and plain fallback:** Exercise real nested chip controls and ordinary/modifier/middle/context actions, then renderer fallback. Expected: TaskNotes ownership without duplicate navigation/menu, and plain fallback navigation. Current native records establish keyboard opening only.
4. **Physical sleep/wake and unattended reconnect:** Leave each tab selected through OS sleep and TaskNotes reload. Expected: accurate wall-clock data, resumed refresh and preserved selection. Fake clocks and explicit retry do not demonstrate physical wake or automatic latency.
5. **TABS-02 assumption classification:** Review the generic unclassified item against independent-leaf save, fallback and native restart evidence. Expected: explicit human disposition; the verifier supplies no invented predicate or acceptance.

05-03 calls its native checklist supplemental and nonblocking for implementation execution. That does not authorize silently marking human observations as passed. Under the verifier's ordered status contract, any genuine human items produce human_needed. These are warnings and acceptance decisions, not implementation blockers or gap-closure tasks. No accepted override exists.

### Gaps Summary

No actionable implementation gap. The goal's code and automated behavior are present, wired and tested; phase acceptance still requires the five human items above. No gaps or deferred gaps were fabricated. The retained assumption is not silently resolved, and optional DOM-tool absence is not treated as a source failure.

---

_Verified: 2026-11-13T20:15:41Z_
_Verifier: gsd-verifier_
