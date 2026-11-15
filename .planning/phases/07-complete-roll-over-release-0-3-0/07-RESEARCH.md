# Phase 7: Complete, Roll Over & Release 0.3.0 - Research

**Researched:** 2026-11-14 (America/New_York)
**Domain:** Obsidian companion plugin; TaskNotes recurring completion, local records, lifecycle and BRAT release
**Confidence:** MEDIUM overall; current project seams HIGH, native edge cases still require execution evidence.

<user_constraints>
## User Constraints (from CONTEXT.md)

<!-- DATA_P7c4K9mQ_START: verbatim phase decisions -->
### Locked Decisions

### Completion feedback
- **D-01:** Successful completion is quiet. Update the card and Done today section without a success notice or inline success message.
- **D-02:** Completion failures use the existing Obsidian notices, including the existing partial-success warning. Do not add a duplicate inline error.
- **D-03:** When completion is unavailable, keep the ✓ control visible but disabled and explain why.
- **D-04:** While completion is running, use the existing busy state to disable controls. Do not add a spinner or other animation.

### Done today display
- **D-05:** When no tasks are listed, show “Nothing completed yet”.
- **D-06:** Show a clickable task title only, with no timer controls. Preserve the established title behavior from Phase 6.
- **D-07:** Sort Done today with the most recently completed task first, independent of the manually ordered Staged list.
- **D-08:** Remove a task from Done today if TaskNotes later shows that it is no longer completed.

### Mobile reorder controls
- **D-09:** Put up/down arrow controls on the left side of every card on both Staged and Timers.
- **D-10:** Stack the arrows vertically, with up above down.
- **D-11:** Disable the arrow that would move a card beyond the beginning or end of its list.
- **D-12:** After a move, announce the task’s new position to screen readers. Do not show a visual notice.

### Rollover transition
- **D-13:** Refresh the Staged and Done today views quietly when the staging day changes.
- **D-14:** Preserve the user’s Staged order across rollover.
- **D-15:** Apply a changed rollover-hour setting immediately. If it changes the staging day, rederive the views and clear the prior day’s Done today entries.
- **D-16:** Derive staged age from the actual staging dates, so it reflects all elapsed days after sleep across multiple staging days.

### the agent's Discretion
No explicit “you decide” choices were made. The planner may choose implementation structure and concise screen-reader announcement wording while preserving these decisions and existing UI conventions.

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within Phase 7 scope.
<!-- DATA_P7c4K9mQ_END -->
</user_constraints>

## Summary

Use one completion coordinator for both tabs, backed by a durable completion-attempt record and the existing shared write queue. Do not implement recurring completion as a bare date-membership check followed by a toggle: the prior native spike recorded two different weekly occurrences from two identical requests. This can advance the series twice without ever toggling the first occurrence off. [VERIFIED: .planning/phases/04-staging-foundations/04-SPIKE-FINDINGS.md:203-241] Verbatim evidence: `"complete_instances": ["2026-11-09"]`, then `"complete_instances": ["2026-11-09", "2026-11-16"]`.

Preserve the distinction between the staged source task, requested staging day, resolved recurrence date, and actual completed note. TaskNotes can return a separate materialized occurrence; the bridge currently throws away that return value. Completion must stop eligible regular timing before mutating completion, and must refuse writes that could indirectly stop Pomodoro timing. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:304-307,348-355] Verbatim signatures: `Promise<void>` for both `completeTask` and `toggleCompleteInstance`. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/TaskService.ts#L898-L925]

**Primary recommendation:** plan a narrow contract/native evidence task first; then implement durable completion/recovery, Done today and rollover, mobile ordering, and release in that order. Recommendations below describe proposed implementation, not existing behavior or native proof.

## Architectural Responsibility Map

| Capability | Primary owner | Secondary owner | Planning direction |
|---|---|---|---|
| Completion decisions and retries | Plugin controller | Plugin local storage | One coordinator, one queued operation, durable intent before a toggle. |
| Recurrence resolution/materialization/status | TaskNotes public API | TaskNotes storage | Delegate mutations; never transplant internal recurrence helpers. |
| Timer ownership | Plugin ownership model | TaskNotes time/Pomodoro reads | Fresh exact-entry checks before stop and before completion. |
| Staged/Done today derivation and rollover | Plugin model/store | Existing view lifecycle | Recompute from snapshots and wall clock; no TaskNotes observation writes. |
| Order and completion records | Plugin local storage | Single persistence writer | Preserve legacy data and unknown keys; add owned keys explicitly. |
| Card/title/mobile interaction | Obsidian client | Existing CardList/TaskCard | Stable DOM, separate tab order, native platform detection. |
| Release | GitHub release workflow | BRAT | Keep installed identity; verify upgrade from an actual old installation. |

The existing integration already constructs one `WriteQueue` and shares it between controllers; its implementation serializes calls but is not a transaction across TaskNotes and plugin storage. [VERIFIED: src/main.ts:113-125; src/state/WriteQueue.ts:7-23] Verbatim implementation: `const result = this.tail.then(task);`.

<phase_requirements>
## Phase Requirements

The descriptions below are copied from the current requirements. [VERIFIED: .planning/REQUIREMENTS.md:43-59]

| ID | Description | Research support |
|---|---|---|
| DONE-01 | ✓ on a non-recurring staged task completes it (configured completed status), stops its timer, and clears `staged` | Completion sequence and partial recovery below. |
| CTRL-13 | On either tab, ✓ on a recurring task completes only today's instance (staging day passed explicitly), never closes the series, and a repeated ✓ never un-completes it | Durable request identity, actual occurrence evidence, and ambiguity gates. |
| DONE-02 | A "Done today" section on the Staged tab lists staged tasks completed today — from the pane (plugin's own record) or elsewhere (no write by the pane) — until rollover | Read-only observation, completion confirmation, rollover generation. |
| ROLL-02 | Unfinished staged tasks roll forward to the next day with no writes, and their days-staged count increases | Existing date model plus cached rederivation. |
| ROLL-03 | Rollover takes effect promptly even if Obsidian was left open overnight or the machine slept | Tick/focus/visibility/wake/reveal hooks. |
| ORDER-04 | On mobile, ▲▼ buttons let the user reorder cards on both tabs | CardList move operation, focus and live announcement. |
| PANE-04 | Display name becomes "TaskNotes Task Control"; plugin id (`tasknotes-timer-pane`), view type, command ids and saved data are unchanged; released as 0.3.0 through BRAT | Identity inventory and release/upgrade validation. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- User-supplied AGENTS instructions require clear efficient language, links for papers, and numbered options if offering next prompts. No research papers are needed here. [VERIFIED: instructions supplied in this research session]
- Use Runtime API v1; never mutate TaskNotes internals; degrade gracefully; keep mobile compatibility. [VERIFIED: .claude/CLAUDE.md:15-26]
- Work through GSD; this artifact is the research subtask of phase planning. For native UI verification use the guarded UAT launcher from the code checkout; check its build provenance; stop it afterward; never bypass its already-open-vault guard or launch another way. [VERIFIED: .claude/CLAUDE.md:211-231]
- Carry forward the fixed staging field, documented null clearing, single writer, independent orders, and no refresh/render writes. Older research recommendations for configurable keys, `customFrontmatter`, cross-device merging and a separate Phase 8 are superseded. [VERIFIED: .planning/phases/04-staging-foundations/04-CONTEXT.md:22-39; .planning/phases/06-staged-tab-core/06-CONTEXT.md:47-54; .planning/ROADMAP.md:158-184] Verbatim fixed values: `staged`, `{staged: null}`.
- No project skills directories were found at the checked project locations; agent-skills configuration returned empty. Graphify was read; its status reported disabled and the conventional graph file check returned false, so direct source inspection was used. [VERIFIED: research-session filesystem and GSD command output]

## Standard Stack

Keep the existing toolchain; install no packages for this phase. These are existing declarations and locally installed versions, not claims about latest registry releases. [VERIFIED: package.json:22-33; research-session local package reads]

| Existing dependency | Declared version (verbatim) | Local installed | Use |
|---|---|---|---|
| Obsidian typings | `"obsidian": "1.14.4"` | 1.14.4 | Host types, Platform, Components, DOM lifecycle. |
| TypeScript | `"typescript": "~6.0.3"` | 6.0.3 | Existing compiler. |
| esbuild | `"esbuild": "0.28.2"` | 0.28.2 | Existing bundle/release pipeline. |
| Vitest | `"vitest": "^5.0.4"` | 5.0.4 | Existing unit and view-host tests. |

No dependency upgrade, registry publish-date claim, or external package installation is proposed; a new-package legitimacy audit is therefore not applicable. If the plan later adds a recurrence package, perform official-source discovery and the legitimacy gate first. Do not add an upstream model package merely to duplicate TaskNotes resolution.

## Architecture Patterns

### Existing seams that must change

| Seam | Current source evidence | Required change |
|---|---|---|
| Completion | `complete` calls status completion before checking/stopping the captured entry. [VERIFIED: src/state/TimerController.ts:440-478] | Shared coordinator, fresh task classification, stop-before-completion, staged idle targets, durable recovery. |
| Bridge results | Completion and recurring wrappers return `Promise<void>`. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:304-307,348-355] | Return authoritative TaskInfo/structured identity; do not discard the actual occurrence path. Keep staging update echoes untrusted. |
| Vendored task shape | Base task interface currently ends at `timeEntries?: TimeEntry[];`. [VERIFIED: src/tasknotes/runtime-api.types.ts:20-32] | Add documented recurrence, completion date and occurrence identity fields, with contract tests; do not assume they already exist because Phase 4 research recommended them. |
| Staged derivation | Current filter checks date, archive and completed status only. [VERIFIED: src/model/staging.ts:38-48] | Exclude confirmed completed recurrence instances/records as well as completed tasks. |
| Completion control | Listener explicitly refuses `current.timer.state === "idle" || current.timer.stagedCard`. [VERIFIED: src/ui/TaskCard.ts:182-188] | Route both tabs and every staged state into the shared coordinator. |
| Staged refresh | Full task list is local to one refresh; last cards survive failed reads. [VERIFIED: src/state/StagingStore.ts:96-135] | Retain last authoritative tasks/statuses for local day rederivation, preserve generation guards and last-good display. |
| Rollover | Tick refreshes for wake/reveal but only writes times on normal ticks. [VERIFIED: src/ui/TimerPaneView.ts:460-473] | Check day before the hidden-content early return and rederive on change. |

### Completion flow: one request, staged checkpoints

Recommended data flow: card click → shared busy gate → one WriteQueue body → fresh task/settings/ownership reads → durable intent → explicit eligible timer stops → public completion operation → durable completion evidence → minimal staged clears → both store refreshes → quiet Done today update.

Use a proposed record with separate source path, request day, resolved occurrence date, actual completed path, completion timestamp, and progress/uncertainty. These are NEW fields to design and version; they are not existing persisted schema. Persist through the existing writer, and await the save that protects a non-idempotent call. Save failure before the call means no completion mutation. Keep safety history separate from the visible day's Done today rows so clearing the section does not erase recovery evidence.

Do not queue a public controller call from inside another queued controller call: call a private nonqueued body, or have both entry points delegate directly to one coordinator. The queue only starts a task after the previous task finishes, so nesting and awaiting another queued action would wait on itself. [VERIFIED: src/state/WriteQueue.ts:15-22]

### Recurrence: what is established and what is not

1. **The API is explicitly a toggle.** It accepts an optional date and returns TaskInfo; materialization is also a documented public API. Always pass the bare staging day explicitly. [CITED: https://tasknotes.dev/javascript-api/#recurring-tasks]
2. **An explicit date does not guarantee that exact date is recorded.** Inspected recurrence planning first preserves an exact generated occurrence; otherwise it searches unprocessed past occurrences, then forward. Completion-anchored and moved-calendar cases branch differently. Do not reimplement this resolver from a partial RRULE parser. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskRecurringPlanning.ts#L88-L124]
3. **Identical requests can advance twice.** The prior native spike is concrete historical evidence, not a test rerun in this research. It disproves the idea that checking only requested-day membership is sufficient. [VERIFIED: .planning/phases/04-staging-foundations/04-SPIKE-FINDINGS.md:203-241] Verbatim: `"scheduled": "2026-11-16"`, then `"scheduled": "2026-11-23"`.
4. **Preserve a request-day tombstone even when the completion is later undone externally.** Done today disappears on reopen, but a repeated stale ✓ must not toggle or silently complete the next cycle. Retry only unfinished idempotent cleanup; do not turn external undo into automatic re-completion. This is a recommended safety design derived from the observed toggle behavior.
5. **A durable attempt precedes mutation; proof follows mutation.** Store the before completion set and occurrence candidates. After success identify the returned occurrence, or the unique newly completed recurrence date confirmed by a fresh read. If the call rejects after writing, reconcile reads against that saved before-state. Zero or multiple candidates, stale reads, reconnects or a failed evidence save mean uncertainty: refuse another toggle. An at-most-once intent protects against crash replay but cannot establish whether a crashed call wrote; uncertainty must stay visible through the existing failure notice.
6. **Do not claim atomic idempotency against external actors.** Neither the public toggle signature nor the pane's local queue supplies an expected-state token; external TaskNotes changes can race the check/call gap. Document this API limitation and test the best available final recheck. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/main/src/api/runtime-api.ts] [VERIFIED: src/state/WriteQueue.ts:15-22]

### Materialized occurrence identity and timer safety

TaskNotes checks an existing occurrence before its on-completion creation policy, then toggles that note's status. Therefore an already-completed occurrence must be detected before calling the parent toggle, even if the parent's compatibility list is stale. Its own status is authoritative. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/TaskService.ts#L898-L925] [CITED: https://tasknotes.dev/developers/specification/02-model-and-mapping/]

The documented fields are `recurrence_parent`, `occurrence_date`, `occurrence_materialization`; their identity is the resolved parent plus occurrence date, not title or the possibly moved scheduled date. Occurrence custom properties are inherited, but time entries are not. [CITED: https://tasknotes.dev/settings/property-types-reference/] This means the staged source and completion note can differ; next-note creation may also inherit staging. Treat that last staging consequence as a risk to prove, not an observed failure. [ASSUMED A1]

Recommended implementation choices:

- Resolve existing occurrences from a successful public task list and Obsidian's public link resolution, with duplicate/ambiguous matches blocked. Never guess a parent by basename or title.
- For an existing occurrence, stop eligible regular entries on the source and the actual completion path before completion. Use the existing configured-status completion operation on the non-recurring occurrence when its identity is established, rather than a parent status write. Confirm parent reconciliation afterward.
- For automatic materialization, add the documented materialization surface only if a native contract probe establishes the returned identity and staged inheritance behavior. Explicit materialization followed by completion can establish a note path before stopping, but creates a note on a failed completion and must be treated as partial progress. Do not force every virtual recurrence into materialization as a workaround.
- Keep distinct obligations for clearing the original staged source and any occurrence staged value inherited by this action. Do not clear unrelated or explicitly staged future occurrences. A next occurrence already present before the action must not be treated as a newly inherited artifact.
- **Safe fallback:** if materialization identity, inherited staging cleanup, or its timers cannot be established, disable ✓ for that affected recurring task with an explanation; keep ordinary timers usable and let the user complete it in TaskNotes. This is an implementable degradation path, not evidence that the complete Phase 7 acceptance criteria have been met. Universal materialization support remains a release gate.

### Pomodoro: guard completion itself

The installed bundle has an auto-stop listener that treats either a status transition or an increased recurring completion list as completion and calls TaskNotes stop when an active session exists. So merely omitting the pane's explicit stop does not protect a Pomodoro entry. [VERIFIED: dev-vault/.obsidian/plugins/tasknotes/main.js:3936] Verbatim inspected expressions: `if(!s&&a&&(i=!0),r.recurrence)` and `(r.complete_instances||[]).length>l.length&&(i=!0)` and `await this.plugin.stopTimeTracking(r)`.

Before ANY completion write, inspect active entries and ownership for every affected known path. Refuse completion if it could cause TaskNotes to close a Pomodoro-owned entry, or when ownership is unreadable and affected active entries exist. Also guard materialized-parent reconciliation, which can grow the parent's completion list. This is stricter than start-only ownership protection and is necessary to preserve the existing ignore-Pomodoro boundary.

Use normalized path plus exact start timestamp for stop eligibility, and re-read immediately before each path-only stop; a replaced entry must not be intentionally stopped. The current model exposes `EntryId = { taskPath: string; startTime: string }` and `Ownership = { readable: true; owner: EntryId | null } | { readable: false }`. [VERIFIED: src/model/pomodoroOwnership.ts:3-12] A residual external replacement race remains because the bridge exposes only path-based stop. [VERIFIED: src/tasknotes/runtime-api.types.ts:142-146] Verbatim signature: `stop(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;`.

### Partial failure recovery

| Last proven stage | Next explicit retry | Forbidden behavior |
|---|---|---|
| Intent save failed | Start again after storage recovers; no TaskNotes mutation yet | Toggle before persisting protection. |
| Regular timer stopped; completion failed before a proven change | Re-read same saved request; preserve stopped session; retry only if proven safe | Restarting the timer automatically. |
| Toggle threw or process ended; write result uncertain | Reconcile saved before-state and occurrence identity; otherwise fail closed | Blind toggle replay or deleting uncertain intent. |
| Completion confirmed; staged clear failed | Retry only minimal null clearing on the saved identity | Toggle/status completion again. |
| Completion confirmed; local save failed | Reconcile from durable prewrite intent; preserve an in-memory guard and report partial success | Treating save failure as proof completion failed. |
| Completion confirmed; refresh failed | Keep record, retry reads, retain last-good cards with warning | Undo or repeat completion. |

Use the existing partial-success notice when its description matches (completion confirmed but timer stop unconfirmed); use a concise existing Notice-style partial message for failed staged/local cleanup. Do not misreport all partial failures as timer failures. The current warning is `Task completed, but its timer could not be confirmed stopped. Check the timer in TaskNotes.` [VERIFIED: src/state/TimerController.ts:475-477]

## Done Today and Rollover

### Read-only external completion

Recommended projection: combine local pane completion records with observed staged-task completion. Keep enough last-seen staged membership to recognize a task whose staged field was cleared elsewhere. When starting with no history, a still-valid staged value plus current completion evidence is the available fallback; do not include every completed TaskNotes task.

- Confirm ordinary tasks against live configured completed statuses; confirm virtual recurrences against the saved actual occurrence date; confirm materialized occurrences against their own current status.
- On external completion, create/update ONLY plugin-owned observation records if persistence is needed. Refresh, render and rollover must make zero calls to TaskNotes writes, including timer stop, status update, recurring toggle and staged clearing. Persisting local observations is separate from writing TaskNotes.
- Use a completion timestamp from the pane action or the first observed transition for sorting. Preserve it on repeated hints. Use deterministic tie-breaking for equal timestamps.
- Keep an observation fingerprint/seen-completion marker across visible-day clearing while that same completion remains true; otherwise a completed task retaining staged frontmatter can be rediscovered as newly done after every rollover. Reopening invalidates the visible row; a later newly observed completion can get a new record.
- Render title-only rows with the existing title ownership/generation/component cleanup behavior, extracted from TaskCard if needed; do not render full TaskCards with hidden timer controls. Current titles deliberately render a path-based wikilink, not task-title Markdown. [VERIFIED: src/ui/TaskCard.ts:226-260,314-383]

### Midnight and information limits

The inspected TaskNotes date helper explicitly uses local calendar getters for completion dates. Its date is not the pane staging day. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/utils/dateUtils.ts#L727-L738] Ordinary completion writes that date only for non-recurring tasks. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskPropertyUpdate.ts#L59-L79]

For pane records the action timestamp and captured request day are authoritative for grouping; confirmation may accept completion date matching either that staging day or its local calendar date, as the roadmap permits. Never recompute the action day after awaiting a write across rollover. [VERIFIED: .planning/ROADMAP.md:174-182]

**Unresolved data limit:** date-only external completion metadata cannot uniquely reconstruct the actual completion time or which side of an early-morning rollover it occurred on after a cold start. Nor can a changed dateModified prove that completion happened then rather than a later edit. [ASSUMED A2, information-loss inference from the documented date-only field] Recommended fallback: observation time for observed transitions, stable ties and a documented best-effort date-based bootstrap; do not claim exact historical ordering. This needs explicit acceptance or additional authoritative timestamp evidence before locking a stronger guarantee.

### Day lifecycle

Reuse the current pure `stagingDay(nowMs, rolloverHour)` and `daysStaged(date, today)` rather than replacing their DST handling. [VERIFIED: src/model/stagingDay.ts:39-46; src/model/staging.ts:27-32] Verbatim defaults: `export const DEFAULT_ROLLOVER_HOUR = 4;`; validation: `value >= 0 && value <= 23`. [VERIFIED: src/model/stagingDay.ts:13-20]

Add a store operation that checks the day from the wall clock and locally rederives cached tasks/statuses when it changes. Call it on every existing one-second tick, focus, visible-document transition, wake/reveal, initial load and successful rollover-hour setting save. Check even if the pane content is hidden. Existing hooks are already at shell level. [VERIFIED: src/ui/TimerPaneView.ts:213-235,460-473; src/main.ts:144-149]

On a day change, clear the prior visible Done today generation, preserve manual order and all task dates, and recompute age from dates rather than incrementing it by one. Guard in-flight reads/actions with the day/config generation so yesterday's completion does not repopulate today's section. A changed hour applies the same rule immediately, even if it moves the day backwards; this follows D-15 and supersedes older pitfalls advice to retain the visible list on a backward setting change.

Preserve existing hidden order slots: current `reorder` replaces visible slots while retaining temporarily hidden paths. [VERIFIED: src/state/StagedOrderStore.ts:37-41] Do not prune ordering because a task is temporarily filtered at rollover or because a cache read failed.

## Mobile Ordering

Use Obsidian Platform mobile detection in UI code and extend the fake host accordingly. Current installed typings expose `Platform.isMobile`; prior research points to its public declaration. [CITED: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts] Gate the added arrows for mobile while preserving desktop drag and keyboard ordering, unless the final UI plan explicitly chooses always-visible controls within D-09.

Implement one list-owned move-by-one operation shared by handle keyboard and ▲▼ clicks. CardList already commits keys using `moveKeyBy([...this.cards.keys()], key, ... )`; use current list order, not stale construction indexes. [VERIFIED: src/ui/CardList.ts:62-71] Update first/last disabled state on every reconciliation, stack buttons in a left column, retain the same mounted card and button focus, and update one polite live region with the new position. Decide a deterministic focus fallback when the just-used arrow becomes disabled at the boundary; test it rather than assuming disabled buttons retain focus.

## Don't Hand-Roll

| Problem | Use instead | Reason/evidence |
|---|---|---|
| Recurrence scheduling | Public TaskNotes operations plus guarded results | Official resolver has exact-date, anchor, processed-history and moved-event branches. [CITED: https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskRecurringPlanning.ts] |
| YAML/task writes | Existing bridge and registered staged null patch | Bridge explicitly rejects `customFrontmatter`. [VERIFIED: src/tasknotes/TaskNotesBridge.ts:326-331] Verbatim: `Object.prototype.hasOwnProperty.call(patch, "customFrontmatter")`. |
| Day arithmetic | Existing pure model | Already uses local-calendar rollover and date ordinals. [VERIFIED: src/model/stagingDay.ts:39-46; src/model/staging.ts:27-32] |
| Ordering | Existing CardList and per-tab order stores | Keyed reconciliation and independent commit callbacks already exist. [VERIFIED: src/ui/CardList.ts:18-48; src/ui/TimerPaneView.ts:145-152,179-186] |
| Plugin persistence | Existing single persistAll | It merges current owned data with preserved extras. [VERIFIED: src/main.ts:54-74] |

## Runtime State Inventory

This is a display rename with new local records, not an installed-identity migration.

| Category | Items found / evidence | Plan action |
|---|---|---|
| Stored data | Owned keys are `"completionStatus", "rolloverHour", "pauseRecordsVersion", "pauseRecords", "cardOrder", "stagedOrder"`. [VERIFIED: src/main.ts:19] | Preserve loaders and values. Add new completion/observation version keys to owned set and single writer; test unknown extras and empty-record saves. No rewrite of existing task frontmatter for rename. |
| Live service configuration | BRAT tracks a repository and reloads updates. [CITED: https://raw.githubusercontent.com/TfTHacker/obsidian42-brat/master/README.md] Actual user's BRAT configuration was not inspected in this research. | Keep repository identity. Verify actual upgrade in disposable dev-vault; do not claim source checks prove BRAT retention. |
| OS-registered state | No OS registration is introduced by the inspected plugin onload; UAT has a separate launcher. [VERIFIED: src/main.ts:80-184; scripts/uat/start-uat-obsidian.ps1:1-28] Machine-wide scheduled tasks were not enumerated. | Preserve helper identities; no OS rename task is required by the source change. Report machine audit as unperformed, not verified empty. |
| Secrets/env | Release workflow reads `secrets.GITHUB_TOKEN`. [VERIFIED: .github/workflows/release.yml:36-43] | Keep existing secret name; no credential migration. Do not dump TaskNotes settings. Other external secrets were not inspected. |
| Build/install artifacts | Build creates `dev-vault/.obsidian/plugins/tasknotes-timer-pane` with `await mkdir(DEV_DIR, { recursive: true });`. [VERIFIED: esbuild.config.mjs:16-22] | Keep that folder. Rebuild deployed assets and manifest; never replace data.json. Native upgrade proof still required. |

Identity pins: manifest has `"id": "tasknotes-timer-pane"`, `"version": "0.2.0"`, `"minAppVersion": "1.12.2"`, `"isDesktopOnly": false`. [VERIFIED: manifest.json:2-8] View definition is `VIEW_TYPE_TIMER_PANE = "tasknotes-timer-pane"`; command registration is `id: "open-timer-pane"`. [VERIFIED: src/ui/TimerPaneView.ts:34; src/main.ts:158-159] Preserve those identities and the current CSS prefix; change display strings and intended release version only.

## Common Pitfalls

- **Requested day is not resolved identity:** repeating an off-schedule request may advance again; day-membership alone fails. Retain durable attempt/evidence even when the visible row clears. [VERIFIED: .planning/phases/04-staging-foundations/04-SPIKE-FINDINGS.md:203-241]
- **Protecting only explicit stops:** TaskNotes' own completion listener can stop a Pomodoro entry. Gate the completion mutation too. [VERIFIED: dev-vault/.obsidian/plugins/tasknotes/main.js:3936]
- **Using the source path after occurrence completion:** the actual note may differ; stop/confirm/clear the correct paths and preserve source membership independently. [CITED: https://tasknotes.dev/features/recurring-tasks/]
- **Observations resurrecting after rollover:** retaining staged frontmatter plus forgetting prior evidence can make the same completion look new. Keep seen evidence separate from visible rows; do not use today's read time to restamp every refresh. Recommended invariant.
- **Calling cleanup harmless:** failed staged clearing can leave a recurring series in the unfinished list because its series status remains open. Current staged filter is status-based. [VERIFIED: src/model/staging.ts:38-48] Hide only on confirmed completion evidence, retain explicit retry context.
- **Global completion availability:** current controller availability checks only status capability/catalog, not per-task recurrence/ownership/materialization safety. [VERIFIED: src/state/TimerController.ts:433-437] Add per-task reasoned gates while retaining controller-side final validation.

## Code Examples

The following proposed coordinator skeleton describes ordering, not an existing API or ready-to-paste implementation. New helper names and persistence shapes must be defined by the plan.

```text
capture source and request staging day
enter shared busy state
run one queued body:
    load durable attempt and fresh TaskNotes state
    if completion already proved: resume only pending cleanup
    if previous attempt uncertain: reconcile; otherwise refuse replay
    establish affected identities and fresh Pomodoro safety
    persist pending attempt; abort if save fails
    stop only freshly matched eligible regular entries
    perform one public completion operation with explicit request day when recurring
    confirm and persist actual completed identity
    clear registered staged fields belonging to this action
finally:
    refresh both projections and release busy state
```

Existing exact-entry predicate to reuse, rather than changing timestamp identity:

<!-- DATA_R8u2qN6z_START: source excerpt -->
```typescript
return normalizeTimerPath(a.taskPath) === normalizeTimerPath(b.taskPath) && a.startTime === b.startTime;
```
<!-- DATA_R8u2qN6z_END -->
[VERIFIED: src/model/pomodoroOwnership.ts:10-12]

## Recommended Plan Decomposition and Checks

These are proposed tasks, not claims of completed validation. Nyquist architecture generation is disabled by the explicit `"nyquist_validation": false` setting; normal tests and native acceptance remain required. [VERIFIED: .planning/config.json:20-25]

1. **Contract and native evidence:** return completion TaskInfo through bridge, add documented task fields/fakes, and guarded dev-vault scratch probes for exact/off-schedule/completion-anchored recurrence, existing done/undone occurrence, automatic materialization and inherited staged fields, regular timers with auto-stop both enabled/disabled, Pomodoro protection, and midnight dates. Probe installed version and record actual source/build. Keep source claims separate from runtime results.
2. **Completion records and shared coordinator:** loader/version/owned-key integration, durable prewrite intent, actual identity, partial progress, local save failures and uncertainty; wire both tabs. Tests must include two panes, double-click, same request after restart, snapped different date, throw-after-write, cleanup retry, reconnect, renamed returned path, replaced timer, and a completed materialized note with a stale parent list.
3. **Done today and day lifecycle:** pure projection, external observation with zero TaskNotes writes, persistent evidence, reopen removal, ordering, title-only rows, day generation and cached rederivation. Cover setting changes in both directions, normal tick, hidden pane, focus/visibility/wake/reveal, multi-day sleep, DST and action/refresh crossing rollover.
4. **Mobile ordering:** shared move operation and controls on both tabs; first/last, one-card lists, focus, announcement, independent orders, paused cards and detached listeners.
5. **Rename, release and upgrade:** pin identity/data, update display copy/docs/manifest/version files, run full checks, perform native old-to-new upgrade with real pauses/orders and unknown data keys, then release and verify assets. Keep the publishing action distinct from merely preparing version files.

Suggested targeted commands: `npm test -- tests/controller.test.ts tests/bridge.test.ts tests/contract.test.ts`; `npm test -- tests/stagingStore.test.ts tests/stagingDay.test.ts tests/timerPaneView.test.ts`; `npm test -- tests/cardList.test.ts tests/taskCard.test.ts tests/main.test.ts`. Full gate is `npm run check`, currently defined as `npm run build && npm run lint && npm test`. [VERIFIED: package.json:11-15] Add test cases to the relevant existing files or focused new suites; the commands must include any newly created suites.

**Current-session execution evidence:** `npm test -- tests/controller.test.ts tests/stagingStore.test.ts tests/cardList.test.ts tests/main.test.ts` passed: 5 test files, 105 tests, Vitest 5.0.4. This is a baseline only; it proves none of the proposed Phase 7 behavior.

Native UAT must explicitly include leaving Obsidian open across rollover and a real sleep/wake run, plus the BRAT upgrade; a fake clock or source inspection does not replace those. [VERIFIED: .planning/ROADMAP.md:180-184]

## Release Procedure

Keep the existing tag-driven workflow. It runs checks, rejects a tag that differs from manifest version, and attaches `main.js manifest.json styles.css`. [VERIFIED: .github/workflows/release.yml:22-43] The roadmap fixes tag `0.3.0` with no prefix. [VERIFIED: .planning/ROADMAP.md:184] BRAT's current developer guide confirms release assets are its source and it can select a frozen version or latest release. [CITED: https://tfthacker.com/brat-developers]

Prepare synchronized package/lock/manifest/versions changes without accidentally publishing during an intermediate version bump. The existing version script writes manifest and versions using npm's target version; inspect its result before the final tag. [VERIFIED: version-bump.mjs:1-20; package.json:20] Release verification must inspect downloaded assets and the upgraded plugin's actual data and restored leaf, rather than merely checking that source identifiers match.

## State of the Art and Source Currency

| Earlier statement | Current evidence | Planning impact |
|---|---|---|
| Dev vault is on TaskNotes 4.13.8 | Installed manifest now says `"version": "4.18.2"`. [VERIFIED: dev-vault/.obsidian/plugins/tasknotes/manifest.json:2-5] | Re-run native contract cases; historical spike is not current-version runtime proof. |
| Guard only requested-day completion membership | Prior native spike completed successive occurrences. [VERIFIED: .planning/phases/04-staging-foundations/04-SPIKE-FINDINGS.md:203-241] | Durable at-most-once request and actual occurrence identity. |
| Toggle probably does not stop a timer | Installed upstream auto-stop event listener exists. [VERIFIED: dev-vault/.obsidian/plugins/tasknotes/main.js:3936] | Explicit pre-stop plus completion-side Pomodoro guard; test auto-stop settings. |
| Done today can be only a path/day pair | Materialized note status overrides parent compatibility state. [CITED: https://tasknotes.dev/features/recurring-tasks/] | Store both source and actual occurrence identity plus timestamp/evidence. |

The browser fetched primary tagged source under 4.13.8 and current main/docs; direct 4.18.2 raw-source lookups returned cache misses and shell fetching was denied by the environment's socket policy. No absence or incompatibility claim is inferred from those failures. Installed 4.18.2 bundle inspection confirmed the corresponding API/materialized dispatch and auto-stop listener, but was not native execution.

## Assumptions Log

| ID | Claim needing confirmation | Risk / required response |
|---|---|---|
| A1 | Inheriting custom properties can cause staged current/next occurrence notes during automatic materialization. [ASSUMED] | Probe raw frontmatter on installed TaskNotes; prove a narrowly scoped safe clearing strategy or gate this branch unavailable. |
| A2 | Exact external completion chronology/staging-day attribution cannot always be recovered from date-only completion metadata after cold start. [ASSUMED: information-loss inference] | Confirm an authoritative timestamp if available; otherwise explicitly accept observed-time ordering and best-effort bootstrap. Never silently substitute dateModified as completion time. |
| A3 | The historical recurrence spike's exact output remains unchanged on installed 4.18.2. [ASSUMED] | Do not rely on this assumption: repeat native fixture matrix before declaring supported behavior. Source similarities are insufficient. |

## Open Questions and Safe Fallbacks

- **Materialization:** full identity resolution, current/next staged inheritance and parent timer effects need current native proof. Fallback is a per-task disabled completion control with reason; ordinary timers remain functional. This is a limitation requiring closure before claiming universal recurring support.
- **Exactly-once across crash and external races:** local durable intent gives at-most-once attempts, not an atomic upstream mutation. Keep uncertain attempts blocked until evidence resolves them; guide the user to TaskNotes rather than replaying a toggle.
- **Cold-start external history:** date-only completion data does not supply exact ordering. Keep the assumption explicit in the plan and document the chosen fallback; do not promise reconstructing an unobserved timestamp.
- **Version floor:** preserve the existing staging/recurring capability floor rather than raising the global timer dependency. Installed current-version tests do not establish every behavior on the minimum accepted version. Contract and native evidence must identify which versions/branches are verified.

## Environment Availability

| Dependency | Observation this session | Fallback/action |
|---|---|---|
| Node / npm | v24.13.1 / 11.8.0 from version commands. [VERIFIED: tool output] | Available. |
| Local compiler/test dependencies | Installed versions match table; focused tests executed. [VERIFIED: local package reads and test output] | No install proposed. |
| TaskNotes dev-vault bundle | Manifest version 4.18.2. [VERIFIED: dev-vault/.obsidian/plugins/tasknotes/manifest.json:4] | Native behavior not exercised this research. |
| Obsidian executable | File existence probe succeeded at launcher-expected path. [VERIFIED: research-session probe; scripts/uat/start-uat-obsidian.ps1:66-67] | Start only through guarded UAT launcher during execution. Existence is not launch readiness. |
| GitHub CLI | Command discovered. [VERIFIED: Get-Command output] | Release authentication/network not tested; address at release task. |
| Context7 / ctx7 | Tool discovery and command lookup found neither callable. [VERIFIED: session tool/command inventory] | Official web docs/source used; no package auto-install. |
| Direct shell network | Raw-source fetch failed with socket permission error. [VERIFIED: research-session output] | Browser web fetch worked; 4.18.2 tagged fetch still unresolved. |

No missing tool blocks writing plans. Native compatibility, overnight and upgrade checks remain execution gates.

## Security Domain

Security enforcement is enabled at level 1. [VERIFIED: .planning/config.json:48-50] This is a local Obsidian extension using the host's permissions, not a new server. The runtime docs distinguish it from authenticated HTTP API access. [CITED: https://tasknotes.dev/javascript-api/]

Use the GSD template's **ASVS 4.0.3 category names** explicitly (not an assertion of current-version certification); OWASP's 4.0.3 source names V2 Authentication and discusses V3 Session Management/V4 Access Controls. [CITED: https://raw.githubusercontent.com/OWASP/ASVS/v4.0.3/4.0/en/0x11-V2-Authentication.md]

| Category | Applicability to this change | Proposed control |
|---|---|---|
| V2 Authentication | No new login/API server | Keep in-process integration; no tokens/settings dump. |
| V3 Session Management | No new authentication session | Do not confuse timer sessions with login sessions. |
| V4 Access Control | Local mutation boundary applies | Public bridge, user-action-only mutation, capability and ownership checks. |
| V5 Validation / output safety | Applies to loaded records, paths, dates and title output | Defensive capped loaders, exact validated dates, path-based safe wikilinks/textContent, no task-title HTML. |
| V6 Cryptography | No new cryptographic storage/protocol | Reuse host/runtime identity generation; add no custom crypto. |

Threat checks: malformed persisted records causing incorrect writes (Tampering: validate identities); stale retry advancing a different instance (Tampering: durable request guard); indirect Pomodoro stop (Tampering: completion-side gate); raw titles/settings in diagnostics (Information disclosure: preserve existing safe logging); unbounded evidence growth (Denial of service: cap display/observation records but never silently evict unresolved safety intent). These are phase-specific threat analyses and recommended controls, not claims of ASVS conformance.

## Sources and Research Method

- Current project source and required phase contexts/research docs, opened this session; source inspection is distinct from native execution.
- [TaskNotes runtime API](https://tasknotes.dev/javascript-api/) — methods, capabilities, returns and event model.
- [Tagged TaskNotes API dispatch](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/api/TaskNotesAPI.ts#L2383-L2408) — string date conversion and returned TaskInfo.
- [Tagged recurring planning](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskRecurringPlanning.ts#L88-L124) — occurrence snapping; [completion plan](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskRecurringPlanning.ts#L191-L295).
- [Tagged materialized dispatch](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/TaskService.ts#L898-L925) — existing note, automatic materialization and virtual fallback.
- [Recurring task documentation](https://tasknotes.dev/features/recurring-tasks/), [property types](https://tasknotes.dev/settings/property-types-reference/), [identity specification](https://tasknotes.dev/developers/specification/02-model-and-mapping/) — separate-note identity, authoritative status and inheritance.
- [Completion date helper](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/utils/dateUtils.ts#L727-L738), [status/date write](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/services/task-service/taskPropertyUpdate.ts#L59-L79) — local date basis.
- [BRAT developer guide](https://tfthacker.com/brat-developers) — release assets and version selection.

The research-plan seam produced Context7 and websearch providers. Context7 was unavailable (including CLI fallback), so official web sources were used. The confidence seam returned MEDIUM for verified websearch and LOW for the unrecognized webfetch provider; cached digests use MEDIUM/websearch. Primary local definitions earn source-inspection provenance, not runtime guarantees. No latest-package or unpublished-package claims were inferred from older reports.

## Metadata

| Area | Confidence | Reason |
|---|---|---|
| Existing stack/seams | HIGH | Definitions and local versions read; baseline tests passed. |
| Public API behavior | MEDIUM | Official docs/tagged source plus installed bundle inspection; current native edge cases unrun. |
| Proposed recovery architecture | MEDIUM | Handles known failure points; external races remain non-atomic. |
| Materialization and cold-start history | LOW pending checks | Explicit assumptions and safe fallback, not locked support claims. |

**Research date:** 2026-11-14. **Recheck:** TaskNotes native contract before implementation and release; primary API findings within seven days if versions change.

Only this research artifact was changed in the project by this agent. No commit or branch change was made, as instructed by the orchestrator.
