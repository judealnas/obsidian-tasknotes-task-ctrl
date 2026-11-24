# Phase 06 coverage and assumptions

Planning evidence only. No implementation, native UAT, plan-checker or Nyquist result is asserted here. The existing research recorded 568/568 baseline tests; execution must collect its own affected-suite and final results. Estimate calibration returned factor 1, sample_count 0, confidence low; each plan's calibrated and raw estimates therefore match.

## API coverage — TaskNotes Runtime API v1

The installed `api-coverage.cjs --json` scanned the actual Phase 06 roadmap section plus all four PLAN bodies and returned `detected:true` with a Runtime API surface signal. The matrix covers the public capability surface relevant to this companion integration. Methods outside that surface are explicitly grouped by namespace; scope remains the locked Phase 06 core loop.

| capability | decision | reason |
|---|---|---|
| apiVersion / hasCapability / lifecycle ready and unloading | INTEGRATE | Preserve the existing bridge and feature gates. |
| tasks.list | INTEGRATE | Full authoritative task existence, membership and Stage source. |
| tasks.get | INTEGRATE | Fresh selected-task check where needed; null alone never proves deletion. |
| tasks.update | INTEGRATE | Exact staged date/null patches through the existing bridge and shared queue. |
| catalog.userFields | INTEGRATE | Registration, type and default readiness before mutations. |
| catalog.statuses | INTEGRATE | Configured completed-status filtering. |
| time.active | INTEGRATE | Existing TimerStore and fresh in-queue identity checks. |
| time.start / time.stop | INTEGRATE | Existing timer commands and safe regular unstage stop. |
| pomodoro.status | INTEGRATE | Existing ownership read only; exact owned entry stays protected. |
| events task.updated / task.deleted | INTEGRATE | Existing bridge hints shared by both stores; no duplicate subscriptions. |
| events time.started / time.stopped / pomodoro lifecycle | INTEGRATE | Existing bridge hints shared by both stores; no duplicate subscriptions. |
| lifecycle settings.changed / cache.changed / cache.rebuilt | INTEGRATE | Recheck field setup and authoritative task state. |
| ui.taskMenu.show | INTEGRATE | Existing note/context-menu behavior on staged cards. |
| errors.normalize | INTEGRATE | Existing bridge normalization; do not expose full task/config snapshots. |
| tasks.complete | OPT-OUT | No new staged completion invocation; existing Timers behavior is preserved until Phase 7. |
| recurring.toggleCompleteInstance and other recurring operations | OPT-OUT | Recurring-safe completion and occurrence semantics are Phase 7. |
| tasks create/delete/bulk mutation | OPT-OUT | Phase 06 stages existing tasks only; deletion observation is read-only. |
| time append/deleteEntry/summary/history operations | OPT-OUT | Core loop uses existing live timer operations and time math. |
| query.tasks and query namespaces | OPT-OUT | Full task list plus established ranked local search suffices; user-field query syntax remains unverified. |
| settings.snapshot and settings/model internals | OPT-OUT | Only documented field catalog is needed; no automated field configuration in this phase. |
| pomodoro mutation methods | OPT-OUT | Pane control of Pomodoro is explicitly excluded. |
| catalog methods other than statuses/userFields | OPT-OUT | No additional catalog is needed for locked staged metadata or controls. |
| UI methods other than task menu | OPT-OUT | Reuse current task links/note opening and Obsidian modal; no additional Runtime UI surface required. |
| HTTP API / additional service integrations | OPT-OUT | Project requires in-process Runtime API through one bridge. |

## Multi-source audit

| SOURCE | ID | Feature / constraint | Plan | Status |
|---|---|---|---|---|
| GOAL | Phase 06 | Pick, order, start/pause/stop/unstage with Timers one click away | 01–04 | COVERED |
| REQ | SETUP-02 | Registered Date/no-default check, no speculative writes, setup/Retry | 01,02,03 | COVERED |
| REQ | SETUP-03 | Staging unavailable explanation; Timers retained | 01 | COVERED |
| REQ | STAGE-01 | Eligible ranked picker and current staging-day update | 02 | COVERED |
| REQ | STAGE-02 | External staged tasks append at bottom | 01,04 | COVERED |
| REQ | STAGE-03 | Null unstage, stop regular/clear pause/protect owner | 03 | COVERED |
| REQ | STAGE-04 | Invalid absent/null values and future eligibility | 01,02 | COVERED |
| REQ | STAGE-05 | Neutral staged date and calendar-day age | 01,03 | COVERED |
| REQ | SCARD-01 | Idle Start, disabled ✓, Unstage, title/menu | 01,03 | COVERED |
| REQ | SCARD-02 | Running Session/Total, Pause/Stop, disabled ✓, Unstage | 03 | COVERED |
| REQ | SCARD-03 | Paused frozen Session/Total, Resume, disabled ✓, Unstage | 03 | COVERED |
| REQ | SCARD-04 | Owned task idle; existing Start refusal | 03 | COVERED |
| REQ | ORDER-01 | Drag/ArrowUp/Down and restart | 04 | COVERED |
| REQ | ORDER-02 | Separate shared persisted orders | 04 | COVERED |
| REQ | ORDER-03 | File/folder rename and authoritative deletion | 04 | COVERED |
| REQ | TABS-03 | Always-visible counts and independent running cue | 04 | COVERED |
| REQ | TABS-04 | Muted Staged marker on Timers | 04 | COVERED |
| CONTEXT | D-01 | Keep Stage modal open between successes | 02 | COVERED |
| CONTEXT | D-02 | Only result removal/list arrival as success feedback | 02 | COVERED |
| CONTEXT | D-03 | Retain failed result with inline retryable error | 02 | COVERED |
| CONTEXT | D-04 | Preserve newest query and input focus | 02 | COVERED |
| CONTEXT | D-05 | Staged date plus age | 01,03 | COVERED |
| CONTEXT | D-06 | Consistent muted line below title in all states | 01,03 | COVERED |
| CONTEXT | D-07 | Separate top-right ✕ and Unstage task tooltip | 03 | COVERED |
| CONTEXT | D-08 | Immediate unstage, stop regular/clear pause/protect owner | 03 | COVERED |
| CONTEXT | D-09 | Listed staged count; running regular timer count | 04 | COVERED |
| CONTEXT | D-10 | Count accent separate from selected underline; text labels | 04 | COVERED |
| CONTEXT | D-11 | Show numeric zeros | 04 | COVERED |
| CONTEXT | D-12 | Muted Staged text under Timers title | 04 | COVERED |
| CONTEXT | D-13 | Direct field registration instructions and Stage gate | 01,02 | COVERED |
| CONTEXT | D-14 | Default blocks only Stage; existing cards usable | 01,02,03 | COVERED |
| CONTEXT | D-15 | Read failure retains cards; warning and Retry | 01 | COVERED |
| CONTEXT | D-16 | Short version/API update explanation; Timers usable | 01 | COVERED |
| CONTEXT | carried | Fixed field; documented bridge patches only; no auto-registration | 01–03 | COVERED |
| CONTEXT | carried | Stage-only header; per-leaf tabs; no automatic switching | 02,04 | COVERED |
| CONTEXT | carried | Path Staged/session Timers; exact ownership; title/menu; stable DOM | 01,03,04 | COVERED |
| CONTEXT | carried | Independent orders; confirmed-absence pruning; rename | 04 | COVERED |
| CONTEXT | carried | Read/render never writes; shared WriteQueue; single persistAll | 01–04 | COVERED |
| RESEARCH | predicates | Own-property precedence; reservation distinct from visibility/existence | 01,02,04 | COVERED |
| RESEARCH | setup | Fresh queued catalog/status checks; nonempty default only blocks Stage | 01–03 | COVERED |
| RESEARCH | reads | Last-good retention; independent failures; generation/revision/disposal guards | 01,02,04 | COVERED |
| RESEARCH | picker | Public selection override; done filter; pending/lifetime split; latest query | 02 | COVERED |
| RESEARCH | unstage | New private in-queue fresh ownership-safe stop; no nested queue | 03 | COVERED |
| RESEARCH | partial | Stop/null/save failures reported according to committed side effects | 02–04 | COVERED |
| RESEARCH | order | External append; bounded loader; current save serialization; no refresh persistence | 04 | COVERED |
| RESEARCH | timing | Render-time exact timer join; existing time math; Pomodoro idle/start refusal | 03 | COVERED |
| RESEARCH | completion | Disabled visible staged ✓; Timers unchanged; no recurring series call | 01,03 | COVERED |
| RESEARCH | security | ASVS L1 trust boundaries; exact patches; safe titles/logs/drag/input bounds | 01–04 | COVERED |
| RESEARCH | validation | Focused suites, full check, guarded CDP UAT and honest limits | 01–04 | COVERED |

Excluded deliberately by existing scope: Phase 07 full completion/Done today/overnight rollover automation/mobile buttons/product rename/release; deferred investigation of automatic field registration; cross-device data.json merge. External task staging remains supported, including another device's task-frontmatter edits; multi-device plugin-data merge is not implied.

## Spec-less edge probe

No SPEC exists; the orchestrator ran the installed compiled edge-probe over requirements. Input coverage was applicable=22, resolved=0, unclassified=11. Planning explicitly resolves the 11 classifiable edges below with task criteria and lifts them into must_haves.truths. The 11 unclassified requirements remain flagged assumptions, not resolved or dismissed by this prose.

| Requirement | Edge | Explicit criterion | Plan | Status |
|---|---|---|---|---|
| TABS-03 | empty | Both zero counts always visible, including paused-only Timers | 04 task3 | resolved / explicit |
| TABS-03 | encoding | Numeric listed-task and regular-running count text; accent only count | 04 task3 | resolved / explicit |
| SETUP-02 | idempotency | Repeated registration checks perform zero writes | 01 task3,02 task2 | resolved / explicit |
| SETUP-02 | concurrency | Stale check cannot enable Stage; fresh queued preflight | 01 task2,02 task2 | resolved / explicit |
| STAGE-01 | idempotency | Duplicate or externally staged task has at most one update/card | 02 task2 | resolved / explicit |
| STAGE-01 | concurrency | Queue barrier rechecks field/default/status/archive/reservation | 02 task2 | resolved / explicit |
| STAGE-04 | boundary | Equal staging day eligible; future hidden/reserved; rollover/DST cases | 01 task2 | resolved / explicit |
| STAGE-04 | precision | Strict valid Gregorian date; no elapsed-ms age; impossible date rejected | 01 task2 | resolved / explicit |
| STAGE-05 | adjacency | Same day today/0, prior day singular, earlier plural | 01 task2 | resolved / explicit |
| STAGE-05 | empty | No cards produces no metadata rows | 01 task2 | resolved / explicit |
| STAGE-05 | ordering | Equal age/date ranks retain stable incoming order | 01 task2,04 task2 | resolved / explicit |

Flagged unclassified requirements: **TABS-04, SETUP-03, STAGE-02, STAGE-03, SCARD-01, SCARD-02, SCARD-03, SCARD-04, ORDER-01, ORDER-02, ORDER-03**. Their concrete behavior tests are required by the corresponding task behavior/acceptance blocks above; a generic classifier's missing taxonomy coverage is not proof of edge completeness. Preserve all 11 flags through verification. Updated coverage: applicable=22, resolved=11, unresolved/unclassified=11; no backstop completion is asserted.

## Prohibition recall and precision

Applied the required adversarial question to every phase requirement: what could this become that the author would not want but the requirement fails to forbid? Routine engineering candidates (bad parsing, stale reads, deadlocks, input mutation, malformed arrays, leaked listeners) were dropped from this probe and handled by normal task/security criteria. Injection/access/data-leak canon is referred to `$gsd-secure-phase` plus existing lint, not minted as bespoke prohibitions.

Kept bespoke intent constraints: no implicit start-on-stage, no automatic tab navigation, no takeover of Pomodoro through Unstage, no accidental recurring-series completion through the staged ✓, and no punitive age styling. All five are serialized in must_haves.prohibitions in 06-02/03/04. No existing wired node-test/lint-rule descriptor exists, so no check_* keys are fabricated.

| Requirement | Prohibition | Lifecycle / tier | Evidence and flag |
|---|---|---|---|
| STAGE-01 | Stage never starts timing implicitly | resolved / test | Planned zero-start picker test; **descriptor-less mechanical enforcement flagged**. |
| STAGE-03 | Unstage never controls active Pomodoro | resolved / test | Planned negative controller tests; **descriptor-less mechanical enforcement flagged**, cannot assert deterministic enforcement green. |
| SCARD-01 | Staged ✓ never closes a recurring series | resolved / test | Planned zero-call card tests; **descriptor-less mechanical enforcement flagged**. |
| TABS-03 | Background changes never navigate away from chosen tab | resolved / test | Planned two-leaf mounted tests; **descriptor-less mechanical enforcement flagged**. |
| STAGE-05 | Age uses no shame/punitive framing | resolved / judgment | Muted neutral copy; **unverified-prohibition — human review recommended** until end-of-phase review. |

Serialized prohibition coverage: applicable=5, resolved=5, unresolved=0, byVerification={test:4, judgment:1}. Lifecycle resolution denotes a planned check/review, not an observed passing result. Deterministic descriptor discovery/fail-first proof has not run; absent descriptors remain fail-closed at verification. No machinery is added to the product for this probe.

## Assumption delta, discovery and execution limits

- Detector signal reported by orchestrator: “another/also” externally staged tasks. Decision recorded in 06-01: **no-change**, normalized task path remains primary Staged identity; timer sessionKey is view-specific, not another required task key. No unanswered product preference.
- Date reader discretion: accept strict date-only strings, reject datetime strings. Research expressly made datetime prefix support optional. Boundary/precision tests encode this choice.
- **A1 remains unverified:** documented SuggestModal selection override must preserve native repeated keyboard/mouse behavior. Existing fake-host tests cannot prove focus or native selection. Use the approved UAT launcher and CDP, and record any unavailable observations honestly.
- Shared queue does not serialize external TaskNotes actors. Fresh final checks reduce the path-only time.stop race; they do not create a conditional stop or transaction.
- Graph context is disabled according to installed `graphify status`; no graph build was attempted. Research and tracked analogs provide discovery evidence; no extra packages or new service research is needed.
- Four sequential waves reflect shared main/view/card/store files and actual production dependencies. Every task touches at most five files. 06-01 starts with external-read→store→card tracer; write/controller and persistence slices follow without throwaway code.
- No ORM/schema exists in scope; schema gate does not apply. UI-SPEC/AI-SPEC generation, plan checker and Nyquist are disabled; their absence is not a passed check.
- End-of-phase verification starts `npm run uat:start` from the checkout under test, checks build/hash provenance, drives CDP without a visible handoff, and stops the sandbox. Never claim native observations from source-only plans.
