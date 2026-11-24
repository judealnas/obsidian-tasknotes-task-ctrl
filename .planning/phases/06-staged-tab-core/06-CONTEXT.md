# Phase 6: Staged Tab Core - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Staged tab's core loop: stage eligible tasks, order them independently of Timers, and start, pause, stop or unstage each task. Include registration checks, setup messages, tab counts, a running indicator and staged markers on Timers cards. Follow Phase 6 in `.planning/ROADMAP.md` for requirements and acceptance criteria.

Completion controls are present, but full staged completion, recurring-safe completion, Done today, prompt overnight rollover handling, mobile reorder buttons, rename and release belong to Phase 7. Automated TaskNotes configuration is a follow-up investigation, not an implementation task in this phase.

</domain>

<decisions>
## Implementation Decisions

### Stage picker flow
- **D-01:** Keep the picker open after each successful stage. Remove that task from results so several tasks can be staged in one opening. Escape or clicking outside closes it.
- **D-02:** Success feedback is result removal and the task joining the Staged list only. No success notification or inline success message.
- **D-03:** On failure, keep the picker open, show an inline error and retain the task in results for retry. Do not remove a task before its staging write succeeds.
- **D-04:** Preserve the search query and input focus after each successful selection.

### Staged card details
- **D-05:** Show the staged date plus age, for example `Nov 14 · 2 days ago`. Age uses the configured staging-day boundary.
- **D-06:** Put this in a muted line below the title, consistently across idle, running and paused states.
- **D-07:** Put the ✕ Unstage control in the top-right corner, separate from timer and completion controls. Tooltip: `Unstage task`.
- **D-08:** Unstage applies immediately without confirmation. As already required, it stops regular timing or clears the pause; Pomodoro-owned timing stays untouched.

### Counts and running indicator
- **D-09:** Staged counts its listed tasks. Timers counts running regular timers only, excluding paused cards and Pomodoro-owned entries. The Timers count can therefore be zero while paused cards remain visible.
- **D-10:** Accent-color the Timers count while any regular timer runs. The selected tab keeps its underline; selection and active timing are separate states. Preserve the prior text-only tab labels.
- **D-11:** Always show counts, including `Staged 0` and `Timers 0`.
- **D-12:** Timers cards whose task is staged show a small muted `Staged` text label below the title.

### Setup and unavailable states
- **D-13:** Show field setup instructions directly in the Staged tab, without an expandable section: where to register the field in TaskNotes, key `staged`, type Date, no default value. Stage is disabled until registration is correct.
- **D-14:** If the Date field has a non-empty default, disable Stage until the default is removed, explain the correction, and keep existing staged tasks usable. This is stricter than warning while allowing Stage.
- **D-15:** If field configuration cannot be read, retain existing cards with a warning and Retry button. Disable Stage until the check succeeds. A read failure must not be presented as an empty list.
- **D-16:** If staging is unsupported, show a short explanation that staging requires TaskNotes 4.13.0 or newer and the staging APIs, with an update suggestion. Do not expose capability diagnostics in the normal message. Timers remains usable.

### Carried-forward constraints
- Fixed `staged` key; writes through documented `api.tasks.update`; unstage writes `{staged: null}` only. Never auto-register fields through TaskNotes internals in this phase.
- Picker uses the existing ranked search and hides done, archived and already-staged tasks. External staging appends tasks at the bottom. Missing/empty/invalid dates are not staged; future dates remain hidden until eligible.
- Staged header has Stage only; bulk actions stay on Timers. No automatic tab switching; per-leaf tab selection and shared card orders remain as decided in Phase 5.
- Staged cards use the existing card style and title/note/context-menu behavior, keyed by path and joined with timer state. Pomodoro-owned timing appears idle on Staged and cannot be started by the pane.
- Independent persisted Staged and Timers orders, with drag and ArrowUp/Down. Renames follow paths; prune deleted tasks only after a successful read confirms absence.
- Refresh/render never writes. Every TaskNotes mutation uses the shared WriteQueue; plugin data persists through the single `persistAll` writer without losing other keys.

### Planner's Discretion
- Module boundaries, persistence shape and implementation details within the decisions above and the roadmap.
- Exact sentence-case error/setup copy, date formatting details and compact layout using existing Obsidian theme variables. No additional behavior preferences were delegated during discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and design
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria and notes; Phase 7 boundary.
- `.planning/REQUIREMENTS.md` — SETUP-02/03, STAGE-01–05, SCARD-01–04, ORDER-01–03 and TABS-03/04; deferred features and exclusions.
- `.planning/PROJECT.md` — core value, compatibility and documented-API constraints.
- `.planning/research/STAGING-DECISIONS.md` — settled design and v0.3 resolutions. Later Phase 4/5 context and this context supersede older conflicting choices.
- `.planning/research/SUMMARY.md` — staging architecture and resolved research conflicts.
- `.planning/research/ARCHITECTURE.md` — staging model/store integration and TaskNotes API behavior.
- `.planning/research/STACK.md` — catalog registration check, supported write paths and settings-change refresh.
- `.planning/research/PITFALLS.md` — registration, write/read-back, calendar-day and ownership pitfalls.

### Earlier decisions
- `.planning/phases/04-staging-foundations/04-CONTEXT.md` — fixed key, staging day, fieldStatus, compatibility and single-writer safety.
- `.planning/phases/05-two-tab-shell/05-CONTEXT.md` — tab appearance, per-leaf restoration, no automatic switching and connection messages.
- `.planning/milestones/v0.2-phases/03-pause-resume/03-CONTEXT.md` — pause lifetime, session continuation and Pomodoro ownership exclusions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/TaskPickerModal.ts` — ranked modal, rendered task links, loading and generation guards; currently start-mode-only and closes on selection. Stage mode must implement D-01–04 without changing Start behavior.
- `src/ui/TaskCard.ts` — timer card, title rendering, controls and state updates; extend for idle staged tasks and staging metadata.
- `src/ui/CardList.ts` — keyed reconciliation and ordering integration.
- `src/model/stagedField.ts` — `STAGED_FIELD_KEY` and pure `fieldStatus`, including `unknown` and `hasDefault`; use for D-13–15.
- `src/model/stagingDay.ts` — existing staging-day calculation.
- `src/state/CardOrderStore.ts` and `src/model/cardOrder.ts` — persisted ordering patterns.
- `src/tasknotes/TaskNotesBridge.ts` — feature-gated `userFields`, `stagingAvailability`, `updateTask`, and settings-change data hints.

### Established Patterns and Integration Points
- `src/ui/TimerPaneView.ts` already owns the tab shell, disabled Stage placeholder, per-tab card lists and shell-level refresh lifecycle. Add staging content and tab indicators here without automatic navigation.
- `src/state/TimerController.ts`, `src/state/WriteQueue.ts` and `src/state/TimerStore.ts` provide timer operations, serialization and live state.
- `src/main.ts` owns shared services and `persistAll`/`OWNED_KEYS`; extend the shared persistence path for Staged order.
- Keep mounted elements stable when updating cards so focus and hover survive; use registered event/interval cleanup and theme-based CSS.

</code_context>

<specifics>
## Specific Ideas

- Batch task selection should be quiet: no success toasts, no query reset, no modal close between tasks.
- User explicitly prefers automated TaskNotes setup to avoid manual registration and unwanted defaults. Preserve that preference in the follow-up below.

</specifics>

<deferred>
## Deferred Ideas

- **Investigate automated TaskNotes user-field configuration.** User: “I would prefer to setup automated configuration of TaskNotes to avoid this.” Check whether a supported configuration method exists before proposing implementation. The current integration has no setter, and prior project research found no official registration method. If automation requires internals, present that tradeoff explicitly before changing the existing documented-API boundary. No TaskNotes settings are changed as part of this discussion.

</deferred>

---

*Phase: 06-staged-tab-core*
*Context gathered: 2026-11-14*
