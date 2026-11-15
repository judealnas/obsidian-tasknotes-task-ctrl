---
status: diagnosed
trigger: User beta.2 note reports delayed/stale native TaskNotes status bar after pane start/stop.
created: 2026-11-15
updated: 2026-11-15
---

# Status bar stale after pane timer actions

## Symptoms

- Expected: native TaskNotes status bar promptly reflects pane-started and pane-stopped tasks.
- Actual: delayed appearance/removal, differing elapsed display, and sometimes a stop button after all tracking has ended.
- Error on stale native stop: No active time tracking session found.
- Timeline: observed on 0.3.0-beta.2; exact onset unknown.
- Repro supplied: start/stop in Timers, including stopping the last tracked task; compare vanilla TaskNotes start.
- Source: Personal Vault/Obsidian Task Pane/Timer Pane v0.3 beta notes.md and images 20261115134532 / 20261115134940.

## Current Focus

hypothesis: Confirmed TaskNotes status-bar query caches completed results for five seconds and the ticker renders retained task snapshots.
next_action: Apply a fix in TaskNotes status-bar query invalidation/deduplication; the pane has no supported public status-bar refresh endpoint. No production fix applied here.

## Boundaries

Diagnose before choosing a remedy. No Personal Vault timer/task mutations. Preserve supported public API integration; do not patch TaskNotes internals or manually broadcast private events as a workaround. Use durable backups and disk-only restoration for sandbox mutations; compare existing API state with DOM evidence.

## Evidence

- Pane bridge start/stop forward directly to public api.time.start/stop with mutation context; source inspection alone does not establish native status-bar refresh behavior.
- Native TaskNotes 4.18.2 reproduction: status-bar-stale-native.json. Public API start/stop without the pane controller reproduces stale tracking after stop and the exact native stop Notice. A repeat through the real pane controller reproduces the same stale status. Both fixtures ended with no active timers and were archived through the public API.
- Rapid direct restart: active entry was 664ms old while native status text showed 0:03. After stopping, public active count remained zero while native status continued to 0:09. Clicking native stop produced No active time tracking session found.
- Delayed-start reproduction: status-bar-start-delay-native.json. Public active count was one while the native status stayed hidden, including after 5.5 seconds. A later update of the disposable task's priority caused it to appear immediately with 0:06 elapsed.
- Source confirms both public runtime methods delegate to TaskService, which updates its task cache and emits the normal task-updated event. The main plugin schedules the status-bar request from that event. This is not an omitted pane event.
- StatusBarService.updateStatusBar uses requestDeduplicator.execute('update-status-bar', getTrackedTasks) without overriding the default five-second retention. RequestDeduplicator retains a resolved Promise during that period. A newer start/stop can therefore render the previous task list/start time. Cache expiration only deletes the map entry; it schedules no fresh render. The one-second elapsed ticker repeatedly renders currentTrackedTasks rather than querying current tasks.
- Version limit: Personal Vault's on-disk manifest is 4.13.0; its bundle has the same five-second query retention and retained-snapshot ticker. It has no tasknotes-status-stop code, unlike the screenshot/4.18.2 sandbox. The exact vault/running version used in the user's screenshot is not established; no runtime inspection or task mutation was performed in Personal Vault.

## Resolution proposal

Fix TaskNotes StatusBarService so start/stop-driven refreshes obtain fresh tracked tasks and only simultaneous pending reads are deduplicated. Do not reuse a fulfilled status-bar result for five seconds. Include regression coverage for rapid stop, rapid restart with a new start timestamp, cached-empty start, and refresh after invalidation. Native UI coordination's extra 50ms request does not invalidate the same completed query cache.

No timer-pane production change can invalidate this private upstream cache through the supported runtime API. Calling private statusBarService methods or writing unrelated task fields as delayed refresh triggers would violate the integration boundary and is not proposed as a product workaround.

## Verification and cleanup

Guarded launcher loaded current pane build mainjs=369ac0338a7e with TaskNotes 4.18.2/API v1. Source unchanged; launcher production build passed. No new product test result is claimed for this diagnosis.

Reproduction used two uniquely named disposable dev-vault tasks, only public TaskNotes task/time APIs, native DOM stop click, and the pane's own controller. Existing active timers were refused as a precondition. The dev vault originally had tracked status display disabled; enabled only in its stopped settings fixture and verified through the public settings snapshot before running. TaskNotes data/settings, pane assets/data and workspace had durable hash-verified backups before mutation, and disk-only restoration was proved before launch.

UAT stopped after diagnosis. All six original hashes restored, including the original disabled status-bar setting. New fixture notes remain archived for inspection; no existing task or Personal Vault data was changed. See status-bar-restoration.json. Repro script is status-bar-stale-repro.mjs; delayed-start evidence is retained separately. No beta/tag/push was performed.
