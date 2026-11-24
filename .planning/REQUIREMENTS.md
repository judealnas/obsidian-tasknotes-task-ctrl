# Requirements: TaskNotes Task Control — v0.3 Staging Tasks

**Defined:** 2026-11-12
**Core Value:** With the pane open, I can always see what task is being timed and how long I've spent on it, and stop, pause, or switch tasks in one to two clicks, without leaving the pane.

Design sources: `.planning/research/STAGING-DECISIONS.md` (settled decisions; v0.3 resolutions at top), `.planning/research/SUMMARY.md` (research synthesis). Scope revised by user beta feedback on 2026-11-15: Today means the local calendar date. Done today and configurable rollover are removed; earlier phase artifacts remain historical.

## v0.3 Requirements

### Tabs

- [x] **TABS-01**: Pane has two tabs: **Staged** and **Timers**; Timers shows every regular timed task exactly as in v0.2 (cards, Start, Pause all, Resume all, Stop all)
- [x] **TABS-02**: Pane remembers the last-active tab across restarts
- [x] **TABS-03**: Tab labels show counts (e.g. "Staged 4 · Timers 1"), and the Timers tab is visibly highlighted while any regular timer runs
- [x] **TABS-04**: Timers-tab cards for staged tasks show a small staged marker

### Setup

- [x] **SETUP-01** (revised 2026-11-15): The staged field key remains fixed as `staged`. Completion settings save safely. The rollover-hour setting is removed and legacy values are retired on the next normal save.
- [x] **SETUP-02**: If the `staged` key isn't registered as a TaskNotes **date** user field (checked via `catalog.userFields()`), the Staged tab shows a setup notice explaining how to register it (type date, no default value) and Stage is disabled; no write is attempted
- [x] **SETUP-03**: If TaskNotes lacks the staging APIs (older than 4.13.0 or missing capability), the Staged tab explains why and the Timers tab keeps working as before

### Staging

- [x] **STAGE-01**: User can stage a task from a picker listing tasks that are not done, not archived, and not already staged; staging writes `staged: <staging day>` via `api.tasks.update`
- [x] **STAGE-02**: Tasks staged outside the pane (hand edit, other device) appear on the Staged tab, appended at the bottom of the order
- [x] **STAGE-03**: ✕ unstages a task by writing an empty (`null`) `staged` value; if the task's regular timer is running it is stopped, and if paused its pause is cleared; a Pomodoro-owned timer is left untouched
- [x] **STAGE-04**: Missing, empty/null, or invalid `staged` values count as not staged; a future date stays hidden until that day
- [x] **STAGE-05**: Each staged card shows how many days the task has been staged (since its `staged` date)

### Staged Cards

- [x] **SCARD-01**: An idle staged card offers start, ✓ complete, and ✕ unstage; clicking the title opens the note and right-click opens TaskNotes' task menu
- [x] **SCARD-02**: A running staged card shows the live session and total time, with pause, stop, ✓ and ✕
- [x] **SCARD-03**: A paused staged card shows the frozen session, with resume, ✓ and ✕
- [x] **SCARD-04**: A staged task being timed by Pomodoro appears idle, and start is refused with the existing "being timed by Pomodoro" notice

### Ordering

- [x] **ORDER-01**: User can reorder the Staged tab by drag and by ArrowUp/Down, and the order persists across restarts
- [x] **ORDER-02**: Staged and Timers orders are independent — reordering one never changes the other
- [x] **ORDER-03**: Staged order follows task renames, and deleted tasks drop out
- [ ] **ORDER-04**: On mobile, ▲▼ buttons let the user reorder cards on both tabs

### Completion

- [ ] **DONE-01**: ✓ on a non-recurring staged task completes it (configured completed status), stops its timer, and clears `staged`
- [ ] **CTRL-13**: On either tab, ✓ on a recurring task completes only today's instance (local calendar date passed explicitly), never closes the series, and a repeated ✓ never un-completes it
- **DONE-02 — Removed by user, 2026-11-15:** No Done today section or external completion-history collection. Completion safety records remain.

### Persistent staging and calendar age

- **ROLL-01 — Superseded, 2026-11-15:** Use local calendar dates with no custom boundary.
- [x] **ROLL-02** (revised): Unfinished tasks stay staged in order until completed or unstaged. Calendar age updates without frontmatter writes.
- **ROLL-03 — Removed by user, 2026-11-15:** No daily rollover feature; normal timer/wake refresh remains.

### Release

- [ ] **PANE-04**: Display name becomes "TaskNotes Task Control"; plugin id (`tasknotes-timer-pane`), view type, command ids and saved data are unchanged; released as 0.3.0 through BRAT

## Future Requirements

Deferred; tracked but not in this roadmap.

- **DONE-F1 — Removed:** Done today is no longer part of the product.
- **STAGE-F1**: "Stage" item in the Timers-card context menu
- **SCARD-F1**: Total tracked time shown (muted) on idle staged cards
- **HIST-F1**: Recent tasks, today's log, estimate progress
- **PANE-F1**: Hotkeys
- **VER-F1**: v0.2 leftovers — skipped Phase 1 native desktop checks; observe the unreadable-Pomodoro note

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pomodoro display or 🍅 start on staged cards | User chose to keep v0.2 behavior: Pomodoro-owned entries hidden in both tabs |
| Using TaskNotes' `scheduled` field for staging | Kept free for its intended purpose (Q2) |
| Auto-registering the `staged` user field | No official API; would require TaskNotes internals (Q15) |
| Deleting the key via undocumented `customFrontmatter` | User chose documented-only `null` write; empty `staged:` is harmless |
| Already-staged tasks in the Stage picker / re-staging to reset days | User chose to hide them; unstage + re-stage resets instead |
| Configurable staged field key | Hard-coded as `staged` for simplicity (Phase 4 discussion) |
| Cross-device data.json merge (former SYNC-05) | Multi-device operation is out of scope (Phase 4 discussion); single-device saves still never reset other keys |
| Bulk timer actions on the Staged tab header | Staged header has Stage only; bulk actions stay on Timers |
| Auto-archive / "overdue" styling for long-staged tasks | Anti-feature per research; quiet carry-over with days count instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TABS-01 | Phase 5 | Complete |
| TABS-02 | Phase 5 | Complete |
| TABS-03 | Phase 6 | Complete |
| TABS-04 | Phase 6 | Complete |
| SETUP-01 | Phase 4 | Complete |
| SETUP-02 | Phase 6 | Complete |
| SETUP-03 | Phase 6 | Complete |
| STAGE-01 | Phase 6 | Complete |
| STAGE-02 | Phase 6 | Complete |
| STAGE-03 | Phase 6 | Complete |
| STAGE-04 | Phase 6 | Complete |
| STAGE-05 | Phase 6 | Complete |
| SCARD-01 | Phase 6 | Complete |
| SCARD-02 | Phase 6 | Complete |
| SCARD-03 | Phase 6 | Complete |
| SCARD-04 | Phase 6 | Complete |
| ORDER-01 | Phase 6 | Complete |
| ORDER-02 | Phase 6 | Complete |
| ORDER-03 | Phase 6 | Complete |
| ORDER-04 | Phase 7 | Pending |
| DONE-01 | Phase 7 | Pending |
| CTRL-13 | Phase 7 | Pending |
| DONE-02 | Phase 7 | Removed by user 2026-11-15 |
| ROLL-01 | Phase 4 | Superseded: calendar dates |
| ROLL-02 | Phase 7 | Revised: persistent staging / calendar age |
| ROLL-03 | Phase 7 | Removed by user 2026-11-15 |
| PANE-04 | Phase 7 | Pending |

**Coverage:**
- v0.3 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-12*
*Last updated: 2026-11-12 after Phase 4 discussion (SYNC-05 dropped; staged key fixed)*
