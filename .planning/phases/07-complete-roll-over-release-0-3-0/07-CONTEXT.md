# Phase 7: Complete, Roll Over & Release 0.3.0 - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver Phase 7 of v0.3: complete staged tasks safely on both tabs, show tasks completed today, keep unfinished tasks current across staging-day changes, add mobile card reordering to both tabs, rename the product, and prepare the 0.3.0 BRAT release.

Follow `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` for the complete scope. In particular, recurring completion must complete only the staging-day instance and repeated completion must not undo it. Done today includes staged tasks completed through the pane or elsewhere, performs no TaskNotes writes when observing external completion, and clears at rollover. Rollover uses the configured staging-day boundary without changing task frontmatter. Preserve the plugin id, view type, command ids, and saved data as required for the release.

The roadmap requires recurring-completion research before planning. Run `$gsd-plan-phase 7 --research-phase 7`; research must cover occurrence snapping/materialization, timer behavior, and completion-date handling near midnight. Keep the existing Phase 6 behavior and scope boundaries.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 7 — phase goal, success criteria, research notes, and release constraints.
- `.planning/REQUIREMENTS.md` — DONE-01, CTRL-13, DONE-02, ROLL-02, ROLL-03, ORDER-04, and PANE-04.
- `.planning/PROJECT.md` — v0.3 goal, documented TaskNotes API boundary, compatibility, and release identity.

### v0.3 design and TaskNotes behavior
- `.planning/research/STAGING-DECISIONS.md` — settled v0.3 decisions; later phase contexts supersede older conflicts.
- `.planning/research/SUMMARY.md` — reconciled TaskNotes behaviors, recurring-completion pitfalls, and Done today data rules.
- `.planning/research/ARCHITECTURE.md` — proposed store/view integration for Done today, staging-day changes, and persistence.
- `.planning/research/FEATURES.md` — feature behavior and earlier recommendations; apply the later roadmap and this context where choices differ.
- `.planning/research/STACK.md` — Runtime API capability and write-path constraints.
- `.planning/research/PITFALLS.md` — recurring toggles, rollover, completion-date, and mobile interaction risks.

### Prior phase decisions
- `.planning/phases/04-staging-foundations/04-CONTEXT.md` — fixed staging key, DST-safe staging day, rollover setting, and feature-gated TaskNotes APIs.
- `.planning/phases/05-two-tab-shell/05-CONTEXT.md` — tab shell, existing Timers behavior, card ordering and focus/visibility/wake patterns.
- `.planning/phases/06-staged-tab-core/06-CONTEXT.md` — current Staged cards, timer ownership, title behavior, ordering, and write-queue constraints.
- `.planning/milestones/v0.2-phases/03-pause-resume/03-CONTEXT.md` — pause lifetime, completion behavior, and Pomodoro ownership rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/state/TimerController.ts` — existing completion flow uses the configured completed status, shared WriteQueue, same-entry timer check, refresh, and Obsidian notices.
- `src/state/StagingStore.ts` and `src/model/stagingDay.ts` — staged snapshot derivation and the existing rollover-hour day calculation.
- `src/state/StagedOrderStore.ts`, `src/state/CardOrderStore.ts`, and `src/model/cardOrder.ts` — persisted per-tab order patterns.
- `src/ui/TaskCard.ts` and `src/ui/CardList.ts` — card rendering, title interaction, and list ordering.
- `src/tasknotes/TaskNotesBridge.ts` and `src/tasknotes/runtime-api.types.ts` — feature-gated recurring completion API, availability checks, and TaskNotes contract types.
- `src/main.ts` — shared persistence through `persistAll` and `OWNED_KEYS`.

### Established Patterns and Integration Points
- `src/ui/TimerPaneView.ts` owns the two-tab pane and already handles the timer tick, focus, visibility, and wake-gap refresh. Connect staging-day updates to this lifecycle.
- Serialize TaskNotes writes through the existing shared WriteQueue. Refreshing or rendering must not write to TaskNotes.
- Keep Staged and Timers order independent. New Done today ordering is most-recently-completed first and does not change either manual card order.
- Use the documented TaskNotes API and existing capability gates. Keep Timers usable when recurring or staging capabilities are unavailable.
- Preserve Obsidian's registered event/interval cleanup and current card appearance conventions when adding controls and announcements.

</code_context>

<specifics>
## Specific Ideas

- The user specified arrows on the left side of cards; they should be stacked vertically.
- Phase 7 planning should use `$gsd-plan-phase 7 --research-phase 7` as required by the roadmap.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within Phase 7 scope.

</deferred>

---

*Phase: 7-complete-roll-over-release-0-3-0*
*Context gathered: 2026-11-14*
