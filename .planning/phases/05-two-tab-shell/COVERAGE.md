# Phase 05 source coverage

No external API integration: extracts existing cards/lists and adds local tabs using Obsidian view state; preserves TaskNotes calls and adds no service capability.

The API detector examined the plans plus the Phase 5 roadmap section and returned `detected:false` on 2026-11-13. This declaration documents scope rather than enumerating unrelated Obsidian/TaskNotes capabilities.

| Source | ID | Feature or constraint | Plan/task | Status |
|---|---|---|---|---|
| GOAL | Phase 5 | Two-tab shell, unchanged Timers experience | 05-01 through 05-03 | COVERED |
| GOAL | SC-1 | Same cards/actions/reorder/Pomodoro hiding and full regressions | 05-01/1-2; 05-03/1-2 | COVERED |
| GOAL | SC-2 | One-click switch, Staged empty state, per-tab header | 05-02/1 | COVERED |
| GOAL | SC-3 | Restore last-active tab after restart | 05-02/2; 05-03 native UAT | COVERED |
| GOAL | SC-4 | Shared bridge states/reload/wake from both tabs | 05-03/1 | COVERED |
| REQ | TABS-01 | Staged and unchanged Timers tabs | All plans | COVERED |
| REQ | TABS-02 | Persist selected leaf tab | 05-02/2; 05-03 native UAT | COVERED |
| RESEARCH | Architecture 5 | TaskCard and CardList<K>; separate tab maps | 05-01/1-2; 05-02/1 | COVERED |
| RESEARCH | Architecture 6 | Shell subscriptions, tick, wake and visibility refresh | 05-03/1 | COVERED |
| RESEARCH | GAP-7 | Per-tab wrapping header actions; decisions override original recommendation | 05-02/1 | COVERED |
| RESEARCH | Resolved question 4 | Active tab in view state, outside data.json | 05-02/2 | COVERED |
| RESEARCH | Phase 5 seam | Start-only options object for picker | 05-03/2 | COVERED |
| RESEARCH | Rendering | Per-tab CSS state; stable frame and minimal DOM movement | 05-01/2; 05-02/1 | COVERED |
| RESEARCH | Safety | Render/refresh read-only; shared controller/WriteQueue | 05-01/1; 05-03/1 | COVERED |
| CONTEXT | D-01 | Underlined text tabs; Staged then Timers; Obsidian variables | 05-02/1 | COVERED |
| CONTEXT | D-02 | Text-only labels | 05-02/1 | COVERED |
| CONTEXT | D-03 | ARIA tabs, roving tabindex and automatic arrow activation | 05-02/2 | COVERED |
| CONTEXT | D-04 | Separate wrapping header with four unchanged Timers actions | 05-01/1; 05-02/1 | COVERED |
| CONTEXT | D-05 | Timers fallback for absent/invalid state | 05-02/2 | COVERED |
| CONTEXT | D-06 | Independent leaf state, shared card order, actual layout-save request | 05-02/2 | COVERED |
| CONTEXT | D-07 | Reveal retains tab | 05-02/2 | COVERED |
| CONTEXT | D-08 | User-only tab changes; no event-driven selection | 05-02/2; 05-03/1 | COVERED |
| CONTEXT | D-09 | Exact connected Staged empty-state text | 05-02/1 | COVERED |
| CONTEXT | D-10 | Disabled Stage with tooltip and no picker action | 05-02/1; 05-03/2 | COVERED |
| CONTEXT | D-11 | Shared connection message, disabled actions, shell-level refresh | 05-03/1 | COVERED |
| CONTEXT | D-12 | Timers-only unreadable Pomodoro note | 05-03/1 | COVERED |

Research is inherited context, not new Phase 05 research. No phase RESEARCH.md is required by `--skip-research`. SUMMARY.md's older Phase 5 proposal included counts/running cue and external-settings merge scaffolding: TABS-03/04 are assigned to Phase 6, and Phase 04 D-01 removed cross-device merge from v0.3. Those items are explicitly excluded by later locked decisions, not unplanned gaps. Staged path keys/render-time TimerStore join are future compatibility constraints; this shell owns independent empty Staged maps but reads/writes no staged tasks or order. Rename/mobile controls/recurring completion changes remain in their assigned later phases. No deferred idea is implemented.

## Spec-less edge audit

The input probe reported four applicable, four unresolved items, including one unclassified. Three TABS-01 items receive explicit predicates in 05-01/05-02 must_haves and mounted tests; the unclassified TABS-02 item remains a visible assumption.

| Requirement | Probe category | Disposition | Predicate/evidence |
|---|---|---|---|
| TABS-01 | adjacency | Resolved, explicit | Identical task titles with distinct sessionKey values remain separate cards; repeated identical sessionKey values reconcile once (05-01). |
| TABS-01 | empty | Resolved, explicit | Empty/single Timers input yields idle/one card; null ready snapshot yields loading. Connected Staged retains its independent fixed empty state (05-01/05-02). |
| TABS-01 | ordering | Resolved, explicit | Equal ranks retain incoming order, unseen Timers keys precede saved keys, pause/resume preserves session identity (05-01). |
| TABS-02 | unclassified | Unresolved, flagged assumption | Generic "review manually" classification remains unresolved; D-05/D-06 concretely require invalid-state fallback, before/after-open restore, layout-save requests and per-leaf independence (05-02). Native restart evidence remains separately recorded (05-03). |

Post-authoring coverage: applicable 4, explicit resolved 3, unresolved 1, unclassified 1. Native restart is not claimed from mock tests. No unresolved probe item was silently dropped or converted into a human decision.

## Prohibition recall

Recall considered silently adding staging actions, changing Timers identity/order or chip ownership, writing during refresh, synchronizing tab selection across leaves, and placing selection in data.json. These are existing explicit scope/behavior constraints addressed in the tasks, not newly discovered values/privacy/fairness prohibitions. The precision pass retains zero novel prohibition items; there is no projectProhibitions payload or invented check descriptor. Routine lifecycle cleanup, malformed input and focus correctness remain behavioral acceptance tests. Canon security concerns are handled in plan STRIDE registers and phase security review. This is a recorded zero-result recall, not a dismissal of retained items.

## Sequencing and scope checks

| Plan | Wave | Needs | Produces |
|---|---|---|---|
| 05-01 | 1 | Existing production Timers pane | Extracted TaskCard/CardList and dedicated mounted-view host/tests |
| 05-02 | 2 | 05-01 card/list ownership | Two-tab shell, ARIA activation and per-leaf layout state |
| 05-03 | 3 | 05-02 production shell | Both-tab reconnect matrix, picker options and phase regression/native checks |

Every plan starts with a working tracer path, then expands behavior. Sequential waves are required by overlapping TimerPaneView/test ownership. Each task modifies at most five files. All listed existing source/test/script paths were grounded against tracked files; new intended artifacts are explicitly listed in each plan. No ORM schema files are in scope, so no schema push task is applicable. Graph context is unavailable because graphify is disabled; no graph was created. The assumption-delta scan supplied by the orchestrator returned `detected:false`.

Estimates use calibration factor 1, sample count 0 and derived confidence low. No packages are added, so no package installation/audit checkpoint is required. TaskCard/CardList interfaces are rated costly; leaf state and private UI seams are reversible. No one-way choice or new approval checkpoint is introduced. Security enforcement is ASVS L1, blocking high severity; mitigations are concrete and tested in each plan's threat register.
