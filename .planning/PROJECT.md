# TaskNotes Task Control

## What This Is

An Obsidian plugin that adds a dockable pane for monitoring and controlling TaskNotes' regular (non-Pomodoro) task time tracking. TaskNotes already has a Pomodoro pane, but for normal task timing the only indication that a task is being timed is a small status-bar indicator in the bottom right of the window. This pane fills that gap: keep it open beside your notes to see how long you've spent on the current task, and stop, pause, or switch tasks in one or two clicks.

The pane has two tabs, Staged and Timers. 0.3.0 changed the display name to TaskNotes Task Control and added persistent task staging. Since 0.4.0, the plugin ID, folder and command prefix use `tasknotes-task-ctrl`. Obsidian layouts still use the saved view type `tasknotes-timer-pane`.

## Core Value

With the pane open, I can always see what task is being timed and how long I've spent on it, and stop, pause, or switch tasks in one to two clicks, without leaving the pane.

## v0.3 Staging Tasks

**Goal:** Let me pick the tasks I'll tackle today, put them in order, and start, stop, pause, or complete each from that list, with the all-timers view one tab away.

Stable 0.3.0 ships the shared task selector, persistent idle timer cards, the Staged tab, independent per-tab order and recurring-safe completion. The staging key is fixed at `staged` and ordinary staging writes go through `api.tasks.update`.

On 2026-11-15, the user removed Done today and configurable rollover. Unfinished tasks stay staged until completion or Unstage, and days-staged is calculated from local calendar dates. See [the beta feedback summary](quick/261115-gpo-apply-beta-feedback-remove-done-today-an/SUMMARY.md).

Design source: `.planning/research/STAGING-DECISIONS.md` (grilling log; Q7/Q23/Q25 superseded by this milestone's choices).

## Requirements

### Validated

- ✓ Sidebar pane opened from the ribbon icon and command palette, revealed rather than duplicated, and restored after restart — v0.2 (Phase 1)
- ✓ Live H:MM:SS session time and total tracked time to the second, one card per running timer — v0.2 (Phase 1; one card per timer replaced the earlier "most recent plus +N more" design)
- ✓ One-click Stop of a timer from the pane — v0.2 (Phase 1)
- ✓ Stays in sync with timers started or stopped anywhere in TaskNotes, via Sync, or by hand-edited frontmatter; reconnects after TaskNotes reloads and after sleep/wake — v0.2 (Phase 1; some native desktop checks skipped and overridden at milestone close)
- ✓ Start task from the pane with a searchable picker while preserving other running timers — v0.2 (Phase 2); automated checks and user desktop acceptance
- ✓ Stop all regular timers while protecting the exact active Pomodoro-owned entry — v0.2 (Phase 2); user confirmed the mixed regular/Pomodoro case
- ✓ Complete timed tasks using a live, persisted completed-status preference — v0.2 (Phase 2); automated checks and user desktop acceptance
- ✓ Pause and resume per card and from the header, persisted across restarts, with Pomodoro-owned timers hidden from the pane — v0.2 (Phase 3); 361 automated tests and user desktop acceptance (the unreadable-ownership note is a deferred follow-up)
- ✓ Settings saves preserve other plugin data and retire the legacy rollover field on normal save. Staging age and completion use local calendar dates.
- ✓ The bridge detects support for staging and recurring completion (4.13.0 floor), while regular timers retain the 4.10.0 floor.
- ✓ Phases 5 and 6 verified the two-tab shell, independent restored selection and order, staging controls, counts and staged markers.
- ✓ Phase 7 verified ordinary and recurring completion in candidate native matrices with TaskNotes auto-stop enabled and disabled.

### Active

See [REQUIREMENTS.md](REQUIREMENTS.md) and the [v0.3 audit](v0.3-MILESTONE-AUDIT.md) for Phase 7 acceptance. Current-release follow-up tracks the flows below.

Still deferred from v0.2 (not in v0.3 scope):
- Finish the skipped Phase 1 native desktop checks (already-stopped race, stop failure and recovery, archived timers, completion auto-stop)
- Observe the muted "Can't check Pomodoro" line on desktop (unreadable ownership)
- v2 ideas: recent tasks, today's log, estimate progress, hotkeys

### Out of Scope

- Desktop overlay / always-on-top window outside Obsidian — that's what jane-t/TaskNotesTimer does; this project wants in-Obsidian integration
- Pomodoro controls — TaskNotes already has a Pomodoro pane (possible through `api.pomodoro.*`; revisit in a later version)
- Using TaskNotes' HTTP API — in-process integration chosen instead (no API server/token needed)
- Basing implementation on the zczs520/tasknotes 5.2.3 fork — unknown provenance; user prefers not to rely on it
- Community plugin directory submission (for now) — personal use; manual/BRAT install is enough
- Rich reporting/analytics — not part of the core need
- "Also running" list — superseded in v0.2 by one card per running timer
- Recent tasks, today's log, estimate progress, hotkeys — deferred to v2 during scoping (next-milestone candidates)
- Pomodoro display or 🍅 start on staged cards — v0.3 keeps v0.2 behavior: Pomodoro-owned entries are hidden in both tabs and start is refused with a notice
- Using TaskNotes' `scheduled` field for staging — kept free for its intended purpose; staging uses its own `staged` field
- Background registration of the `staged` field. Setup is an explicit settings action with a manual alternative.

## Context

- **Host:** Obsidian desktop, with the TaskNotes plugin (callumalpass/tasknotes) installed. TaskNotes stores tasks as markdown notes with YAML frontmatter; time tracking is stored as `timeEntries` (start/end timestamps) in task frontmatter, and TaskNotes shows an active-timer indicator in the status bar.
- **Inspiration:** https://github.com/jane-t/TaskNotesTimer — Tauri desktop overlay that polls TaskNotes' HTTP API (active-timer endpoint), offers a task dropdown of open/in-progress tasks, START/STOP buttons, large live count-up clock. Good reference for feature set and UX; architecture differs (external app vs. in-Obsidian view).
- **Possible reference (low trust):** https://github.com/zczs520/tasknotes/releases/tag/5.2.3 — a fork that claims to implement this feature; user knows little about it and prefers not to use it.
- **UI precedent:** TaskNotes' own Pomodoro timer pane — the target look/feel for a persistent sidebar pane.
- **Integration approach:** in-process via TaskNotes Runtime API v1. Timer and task operations use public API methods. The separate Configure staged field action uses TaskNotes settings internals because there is no public field-registration method. Its manual alternative is TaskNotes Custom User Fields.

## Current State

- **0.3.0** published stable and retained the original installed identity. The Phase 7 [release record](phases/07-complete-roll-over-release-0-3-0/07-RELEASE.md) records all three releases and workflows. The v0.3 milestone remains open for the checks in [07-UAT.md](phases/07-complete-roll-over-release-0-3-0/07-UAT.md).
- **0.4.0** is GitHub's Latest stable release. It uses the new repository and installed identity. The saved view type is unchanged. [Release notes](../docs/releases/0.4.0.md).
- **0.5.0-beta.1** is published as a prerelease. Parent links and expandable immediate subtasks appear in both tabs. The release build, lint, 690 feature tests and 13 vault-switch tests passed. Native TaskNotes 4.18.2 checks covered parent navigation, subtask counts and expansion through refresh, and cards at 448 and 280 px. [Release notes](../docs/releases/0.5.0-beta.1.md).

Native desktop follow-up verified the published 0.4.0 → 0.5.0-beta.1 BRAT update, restored idle card/order, Enter and Shift+Enter in both tabs, and the Configure staged field action on TaskNotes 4.18.2. The earlier selector report preserves prototype observations. [Current native evidence](verification/2026-11-24-native-followup.md).

Unpublished commit `5430b4c` uses TaskNotes title chips and task menus for parent and subtask links, replacing the custom status glyphs. The build, lint, 692 feature tests and 13 vault-switch tests passed. Native desktop checks confirmed chip rendering, both task menu targets, no horizontal overflow at 256 px and the plain-link fallback with the TaskNotes overlay disabled. [Native evidence](verification/2026-11-24-native-followup.md).

Phase 1's deferred desktop checks and the Phase 3 unreadable-Pomodoro observation remain tracked.

## Constraints

- **Dependency**: Requires TaskNotes plugin installed and enabled — the pane is a companion, not a replacement
- **Data format**: Must write time entries exactly as TaskNotes does (ideally by calling TaskNotes' own APIs) — avoids corrupting tracked time or desyncing TaskNotes' UI
- **Compatibility**: Regular timers require TaskNotes Runtime API v1 (TaskNotes 4.10.0+). Staging and recurring completion need TaskNotes 4.13.0+ and relevant capabilities. Field registration has a separate compatibility check and manual fallback.
- **Platform**: `isDesktopOnly: false`, but verified on desktop only
- **Tech stack**: Obsidian plugin (TypeScript, Obsidian API, esbuild per sample-plugin conventions)
- **Distribution**: Personal use — manual install or BRAT

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| In-Obsidian pane instead of desktop overlay | User wants it integrated into the Obsidian window like the Pomodoro pane | ✓ Good (v0.2) |
| In-process integration via Runtime API v1, not HTTP API or internals | No API server/token setup; documented, versioned companion-plugin surface | ✓ Good (v0.2): covered every need without internals |
| One card per running timer instead of the most recent plus "+N more" | Concurrent timers are normal in TaskNotes; hiding them made the others hard to control | ✓ Good (v0.2) |
| Start adds a concurrent timer; Stop all skips the exact active Pomodoro-owned entry | Independent timer model chosen during Phase 2 discussion; switch action and its setting were removed | Phase 2 accepted |
| Individual Stop closes task time tracking without stopping the Pomodoro countdown | Pane controls regular time entries; Pomodoro countdown controls remain in TaskNotes | User observed and clarified during Phase 2 UAT |
| Pomodoro-owned timers hidden from the pane; if ownership can't be read, show all timers with a note | Pomodoro owns its entry, and pane pause would orphan it. Hiding is simpler than labelling, and the pane stays focused on regular timers (replaces the earlier label-and-hide-pause plan, 2026-10-16) | Phase 3 accepted; unreadable-note visual deferred |
| Per-leaf tab selection through Obsidian view state | Leaves restore independently without adding tab settings to plugin data.json | Phase 5 verified and accepted |
| Full control (start/stop/pause/switch), not just monitoring | Done = stop, pause, or switch in 1–2 clicks from the pane | ✓ Good (v0.2): switch became Start plus concurrent timers |
| Pause implemented as stop + new entry on resume | TaskNotes time tracking has no native pause; time entries are start/end pairs | Phase 3 accepted |
| Pause records live in the plugin's data.json, keyed by session and reconciled against TaskNotes on every refresh | Survives restarts; renames follow vault events; clears only on clear signals (resume, stop, complete, delete, Pomodoro takeover), never by age or a null read | Phase 3 accepted |
| Sidebar view + ribbon icon + command | Matches Pomodoro pane placement; easy to open | ✓ Good (v0.2) |
| Task staging and display rename in 0.3.0, installed identity change in 0.4.0 | Keep the saved Obsidian view type across releases | Both published. The original-ID 0.2.0 → 0.3.0 BRAT update passed. |
| Two tabs (Staged, Timers) with independent per-tab order | Keep regular timers and staging accessible in one pane | Phase 5 and 6 accepted |
| Staging stored as a `staged: YYYY-MM-DD` user field; order stored in plugin data | `tasks.update` writes the registered field. Its date allows age to update without task writes. | Phase 4 spike confirmed null unstage. Phase 6 verified UI wiring. |
| Fixed `staged` key and local calendar dates | The user removed the custom rollover setting on 2026-11-15 | Reflected in current source and requirements |
| Staging and recurring completion share one TaskNotes 4.13.0 floor, feature-gated outside `REQUIRED_CAPABILITIES` | Timers must keep working on TaskNotes 4.10–4.12 | Phase 4 accepted (4.12.3 regression tested) |
| Pomodoro-owned entries stay hidden from Timers and appear idle when staged | Preserve the v0.2 ownership protection | Accepted; native unreadable-ownership message observation remains deferred |
| Don't base on zczs520 fork | Unknown provenance | ✓ Good (v0.2): not needed |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-24 UTC after release and acceptance reconciliation*
