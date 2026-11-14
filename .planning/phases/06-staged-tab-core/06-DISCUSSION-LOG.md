# Phase 6: Staged Tab Core - Discussion Log

> Audit trail only. Downstream agents use 06-CONTEXT.md, not this log.

**Date:** 2026-11-14
**Phase:** 06-staged-tab-core
**Areas discussed:** Stage picker flow, Staged card details, Counts and running indicator, Setup and unavailable states

## Stage picker flow

### After staging a task, what should happen?

| Option | Description |
|--------|-------------|
| Keep the picker open | As presented in the discussion |
| Close after each selection | As presented in the discussion |

**User choice:** Keep the picker open, remove the successfully staged task from results; Escape or clicking outside closes it.

### How should it confirm success?

| Option | Description |
|--------|-------------|
| Brief inline message | As presented in the discussion |
| Obsidian notification | As presented in the discussion |
| Result removal only | As presented in the discussion |

**User choice:** Result removal only: task disappears from picker and joins Staged list, without a notification.

### If staging fails, how should the picker respond?

| Option | Description |
|--------|-------------|
| Keep it open with an inline error | As presented in the discussion |
| Keep it open with an Obsidian notification | As presented in the discussion |
| Close and show a notification | As presented in the discussion |

**User choice:** Keep it open with an inline error and retain the task in results for retry.

### After successfully staging a task, what should happen to search text?

| Option | Description |
|--------|-------------|
| Keep it | As presented in the discussion |
| Clear it | As presented in the discussion |

**User choice:** Keep the query and focus.

## Staged card details

### How should the days-staged count read?

| Option | Description |
|--------|-------------|
| Staged today, then Staged N days ago | As presented in the discussion |
| Day 1, Day 2, Day 3 | As presented in the discussion |
| Date plus age | As presented in the discussion |

**User choice:** Show the staged date plus age, for example Nov 14 · 2 days ago, using the configured staging-day boundary.

### Where should the staged date and age appear?

| Option | Description |
|--------|-------------|
| Below the title | As presented in the discussion |
| Beside the title | As presented in the discussion |
| At the bottom | As presented in the discussion |

**User choice:** In a muted line below the title, in the same place for idle, running, and paused cards.

### Where should the Unstage control sit?

| Option | Description |
|--------|-------------|
| Top-right corner | As presented in the discussion |
| Last in the action row | As presented in the discussion |

**User choice:** Top-right corner, separate from timer and completion controls, with an Unstage task tooltip.

### Should unstaging require confirmation?

| Option | Description |
|--------|-------------|
| No confirmation | As presented in the discussion |
| Confirm when running or paused | As presented in the discussion |
| Always confirm | As presented in the discussion |

**User choice:** No confirmation. Apply immediately, including stopping a regular timer or clearing a pause. Pomodoro-owned timing remains untouched per locked requirements.

## Counts and running indicator

### What should the Timers count include?

| Option | Description |
|--------|-------------|
| Running and paused cards | As presented in the discussion |
| Running timers only | As presented in the discussion |

**User choice:** Running regular timers only; paused cards do not contribute. Pomodoro-owned entries stay excluded. Staged counts its listed tasks.

### How should the Timers tab indicate active timing?

| Option | Description |
|--------|-------------|
| Accent-colored count | As presented in the discussion |
| Accent-colored label and count | As presented in the discussion |
| Subtle background tint | As presented in the discussion |

**User choice:** Accent-colored count while any regular timer runs. Keep the underline for selected-tab state.

### How should a zero count appear?

| Option | Description |
|--------|-------------|
| Show zero | As presented in the discussion |
| Hide zero | As presented in the discussion |

**User choice:** Show zero explicitly on both tabs: Staged 0 and Timers 0.

### How should a Timers card indicate that its task is staged?

| Option | Description |
|--------|-------------|
| Small Staged label | As presented in the discussion |
| Small icon with tooltip | As presented in the discussion |

**User choice:** Small muted Staged text label below the title.

## Setup and unavailable states

### How should the Staged tab explain missing field registration?

| Option | Description |
|--------|-------------|
| Instructions directly in the tab | As presented in the discussion |
| Short notice with expandable instructions | As presented in the discussion |

**User choice:** Show instructions directly in the tab: where to add the field, key staged, type Date, and no default value. Stage remains disabled until registration is correct.

### What if the Date field has a default value?

| Option | Description |
|--------|-------------|
| Warn but allow staging | As presented in the discussion |
| Disable Stage until default removed | As presented in the discussion |

**User choice:** Disable Stage until the default is removed; keep existing staged tasks usable. User additionally prefers automated TaskNotes configuration; recorded as a follow-up investigation because this changes the prior documented-API-only boundary and the current integration has no configuration setter.

### What if field configuration cannot be read?

| Option | Description |
|--------|-------------|
| Keep existing cards visible with warning and Retry | As presented in the discussion |
| Replace list with error and Retry | As presented in the discussion |

**User choice:** Keep existing cards visible with a warning and Retry button. Disable Stage until the check succeeds.

### How much detail for unsupported TaskNotes staging?

| Option | Description |
|--------|-------------|
| Short explanation | As presented in the discussion |
| Explanation plus technical details | As presented in the discussion |

**User choice:** Short explanation: staging requires TaskNotes 4.13.0 or newer and staging APIs, with an update suggestion. Timers stays usable.

## Agent discretion

No explicit you-decide selections. Routine implementation and wording choices remain with the planner within the approved decisions.

## Deferred ideas

User: "2. BUT I would prefer to setup automated configuration of TaskNotes to avoid this". Recorded as an investigation into supported setup automation; no change to TaskNotes configuration or the documented-API boundary in this phase.

## Review

User selected all four areas, completed each area, reviewed the combined summary, and selected Create the Phase 6 context document.
