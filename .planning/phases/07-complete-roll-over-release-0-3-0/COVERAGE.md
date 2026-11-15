# Phase 7 API and source coverage

Full coverage by default. Reasons below are explicit phase-boundary decisions; each is at most 200 characters. Baseline: public Runtime API v1 capability families in .planning/research/STACK.md and the vendored runtime-api.types.ts. No TaskNotes internal service is an integration surface. Exact optional materialization signature must come from 07-02 contract evidence before use.

| capability | decision | reason |
|---|---|---|
| apiVersion / capabilities / hasCapability | INTEGRATE | |
| lifecycle.ready / isReady / on / off | INTEGRATE | |
| events.on / off for task.updated, task.deleted, time and Pomodoro hints | INTEGRATE | |
| errors.normalize | INTEGRATE | |
| time.active | INTEGRATE | |
| time.start | INTEGRATE | |
| time.stop | INTEGRATE | |
| time.task / summary / other reporting reads | OPT-OUT | Existing snapshots provide card timing; reporting and analytics are outside the v0.3 scope. |
| tasks.list / get | INTEGRATE | |
| tasks.complete | INTEGRATE | |
| tasks.update for registered staged null patches | INTEGRATE | |
| tasks.create / delete / archive and other task editing | OPT-OUT | This pane stages and completes existing tasks; TaskNotes owns task creation and editing. |
| query.tasks / query execution | OPT-OUT | Existing authoritative tasks.list supplies this phase's catalog and occurrence evidence. |
| catalog.statuses / userFields | INTEGRATE | |
| catalog priorities / contexts / projects / tags / other catalog reads | OPT-OUT | Phase 7 needs completed-status and staged-field catalogs; other task metadata remains display data. |
| recurring.toggleCompleteInstance | INTEGRATE | |
| documented public recurring materialization and occurrence identity operations | INTEGRATE | Required materialized support; 07-02 first pins exact public methods and stops if no safe contract exists. |
| other recurring schedule mutation / rescheduling operations | OPT-OUT | User changes recurrence schedules in TaskNotes; the pane completes only the required occurrence. |
| pomodoro.status | INTEGRATE | |
| pomodoro start / pause / resume / stop / other controls | OPT-OUT | Project scope explicitly ignores Pomodoro controls; reads protect its owned entry from side effects. |
| ui.taskMenu.show | INTEGRATE | |
| ui.taskMenu.showAtElement / populate / other UI surfaces | OPT-OUT | Existing gated show preserves title context menu behavior; the pane has no additional TaskNotes UI workflow. |
| settings snapshot / mutation | OPT-OUT | Production reads public catalogs and ownership only; TaskNotes settings remain user-owned. |
| model namespace / internal services | OPT-OUT | Project requires Runtime API v1 behind the bridge and forbids TaskNotes internals. |
| extension registration / export / import / HTTP APIs | OPT-OUT | Companion pane does not register external extensions, import/export tasks, or use the HTTP server. |

Native probes may inspect fixture/frontmatter evidence and installed version; they do not authorize production settings/internal access.

## Multi-source audit

| SOURCE | ID | Feature or constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | Phase 7 | Finish staged tasks, Done today, quiet rollover and ship renamed 0.3.0 | 01–06 | COVERED | Native and publication gates remain execution work. |
| REQ | DONE-01 | Configured ordinary completion, stop, staged null clear | 01–02 | COVERED | Includes idle and paused cards. |
| REQ | CTRL-13 | Both tabs, exact recurring occurrence, safe repeats | 01–02 | COVERED | Safe public contract is an early stop gate. |
| REQ | DONE-02 | Pane/external staged completion until rollover | 03 | COVERED | Local observations only; confirmed identities. |
| REQ | ROLL-02 | Write-free carryover and calendar age | 03,05 | COVERED | Exact boundary/DST/multi-day checks. |
| REQ | ROLL-03 | Open overnight and sleep/wake | 03,05 | COVERED | Requires actual native evidence. |
| REQ | ORDER-04 | Mobile arrows on both tabs | 04–05 | COVERED | Independent persisted orders. |
| REQ | PANE-04 | Rename, stable identity/data and BRAT release | 05–06 | COVERED | Explicit final publish approval. |
| CONTEXT | D-01 | Quiet success | 01–02 | COVERED | Cited in truths. |
| CONTEXT | D-02 | Existing Notice failures/partial warning | 01–02 | COVERED | Cited in truths. |
| CONTEXT | D-03 | Disabled explained completion | 01–02 | COVERED | Cited in truths. |
| CONTEXT | D-04 | Existing busy state | 01–02 | COVERED | Cited in truths. |
| CONTEXT | D-05 | Nothing completed yet | 03 | COVERED | Exact empty text. |
| CONTEXT | D-06 | Clickable title only | 03 | COVERED | Shared safe title owner. |
| CONTEXT | D-07 | Newest-first independent chronology | 03 | COVERED | Stable identity ties. |
| CONTEXT | D-08 | Reopened task removed | 03 | COVERED | Live completion confirmation. |
| CONTEXT | D-09 | Arrows left on every mobile card | 04–05 | COVERED | Both tabs/all card states. |
| CONTEXT | D-10 | Up above down | 04–05 | COVERED | Left vertical column. |
| CONTEXT | D-11 | Boundary disabled | 04–05 | COVERED | Single/empty included. |
| CONTEXT | D-12 | Screen-reader position, no visual notice | 04–05 | COVERED | Focus fallback tested. |
| CONTEXT | D-13 | Quiet day rederivation | 03,05 | COVERED | Cached full snapshots. |
| CONTEXT | D-14 | Preserve staged order | 03,05 | COVERED | Hidden slots retained. |
| CONTEXT | D-15 | Apply changed hour immediately | 03,05 | COVERED | Both day directions/read failure. |
| CONTEXT | D-16 | Actual dates after multi-day sleep | 03,05 | COVERED | No counted ticks. |
| RESEARCH | Identity | Durable intent before mutation; source/request/resolved/actual identity | 01–02 | COVERED | No blind replay, including throw-after-write and failed save. |
| RESEARCH | Materialization | Existing/new occurrence and inherited staged scope | 02 | COVERED | Required capability; unsupported contract halts, not scope reduction. |
| RESEARCH | Ownership | Stop-before-complete and indirect Pomodoro protection | 01–02 | COVERED | Fresh checks on all affected paths. |
| RESEARCH | Persistence | One writer, owned keys, legacy/extras and retention bounds | 01,03,05 | COVERED | Unresolved safety intents are never silently evicted. |
| RESEARCH | Projection | External observations, seen fingerprints, authoritative materialized status | 03 | COVERED | Read-only upstream, stable observation chronology. |
| RESEARCH | Lifecycle | Cached tasks, day/config generations, hidden/no-pane/settings paths | 03 | COVERED | Late results cannot resurrect prior day. |
| RESEARCH | Titles/mobile | Safe shared title rendering, cleanup, live announcements/focus | 03–04 | COVERED | Native limits remain visible. |
| RESEARCH | Release | Name/version/assets, review, downloaded assets and actual BRAT upgrade | 05–06 | COVERED | Approval precedes public tag. |
| RESEARCH | A1/A3/version | Native inheritance/snapping/current-versus-floor behavior | 02,05 | COVERED | Record exact verified versions; stop if required branch unsafe. |
| RESEARCH | A2 | Date-only external history lacks exact chronology | 03,05–06 | COVERED | Flagged assumption; observed-time/date bootstrap disclosed for review. |
| RESEARCH | Security | ASVS1 V4/V5, unique threats and no package additions | 01–06 | COVERED | High/critical unresolved threats block release. |

No deferred Phase 7 ideas exist. Prior-phase deferred cross-device merge, configurable staged key and Pomodoro controls remain excluded.

## Edge-probe disposition (11 in, 11 retained)

| Requirement/category | Disposition | Criterion / location |
|---|---|---|
| DONE-01 / unclassified | unresolved flagged assumption | 01: taxonomy unresolved; completion behavior explicitly specified. |
| CTRL-13 / unclassified | unresolved flagged assumption | 01–02: taxonomy unresolved; required branch and retry criteria explicit. |
| DONE-02 / adjacency | resolved explicit | 03 truths/tasks: deduplicate same evidence, keep distinct occurrences distinct. |
| DONE-02 / empty | resolved explicit | 03 truth/task: Nothing completed yet for empty/null/single-safe projection. |
| DONE-02 / ordering | resolved explicit | 03 truth/task: newest first; equal-time identity tie rules. |
| ROLL-02 / boundary | resolved explicit | 03 truth/task: hour −1ms, exact and +1ms. |
| ROLL-02 / precision | resolved explicit | 03 truth/task: whole calendar-day distance including DST. |
| ROLL-03 / unclassified | unresolved flagged assumption | 03,05: real overnight/sleep still required, taxonomy not invented. |
| ORDER-04 / unclassified | unresolved flagged assumption | 04: taxonomy unresolved; empty/single/boundary/focus criteria explicit. |
| PANE-04 / empty | resolved explicit | 05 truth/task: null/empty legacy data uses defaults. |
| PANE-04 / encoding | resolved explicit | 05 truth/task: exact ASCII product name, preserved Unicode task titles/identity. |

## Prohibition recall

Per requirement, recall then precision retained bespoke intent constraints: preserve Pomodoro autonomy and occurrence intent (DONE-01/CTRL-13); observation/rollover do not rewrite TaskNotes (DONE-02/ROLL-02/ROLL-03); reorder stays quiet and scoped (ORDER-04); rename preserves installed identity/data and publication needs authorization (PANE-04). These are descriptor-less must_haves.prohibitions in the plans, status resolved / verification judgment, hence flagged-unverified downstream until explicitly evidenced; no auto-dismissals or fabricated check descriptors. OWASP validation/output safety is canon, handled by threat models and secure-phase review rather than duplicate prohibitions.

## Dependency graph

| Plan | Needs | Creates | Wave |
|---|---|---|---|
| 07-01 | Existing Phase 6 bridge/cards/queue/persistence | Ordinary production tracer, durable records, one completion entry | 1 |
| 07-02 | 07-01 durable coordinator | Native contract evidence, safe recurrence/materialization and recovery | 2 |
| 07-03 | 07-02 completed identity/evidence | Done today, shared titles and quiet day lifecycle | 3 |
| 07-04 | 07-03 shared card/title/view changes | Mobile list moves, boundaries, focus and announcements | 4 |
| 07-05 | 07-04 final UI; 07-02 native contract | Reviewed candidate/assets and required native evidence | 5 |
| 07-06 | 07-05 candidate/evidence | Explicit release decision, public assets and actual BRAT proof | 6 |

Shared source ownership makes these waves sequential. Within each plan every task has at most five modified paths and an executable verification command with observable failing direction. No implementation or publication occurs during planning.

