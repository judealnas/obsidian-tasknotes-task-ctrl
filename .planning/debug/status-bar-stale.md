---
status: awaiting_human_verify
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
next_action: Source fix is verified and packaged. Confirm the vault and running TaskNotes version exhibiting the bug before any real installation; Personal Vault disk version is 4.13.0 while the tested fix targets 4.18.2. Await real-workflow confirmation before resolving.

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

## Verified source fix — resumed 2026-11-15

User selected session 1 to continue toward a fix. Cloned official TaskNotes tag 4.18.2 (base f1600dc9db9b570b1df37a785979661a3d6e856e) into an isolated checkout, now at `.planning/debug/tasknotes-statusbar-fix/`, excluded through local .git/info/exclude. No runtime monkeypatch or private TaskNotes call was added to the pane.

Local upstream commit: **3802d151d40db28c18178872b9ad8a532fd5b4e9**, branch fix/status-bar-tracking-refresh. Portable patch: `tasknotes-statusbar-fix.patch` (SHA256 8bd1b6efa1c1baa93753b1e68b3489c542201576bd30a629aa308327933e9ec9).

The fix removes RequestDeduplicator only from StatusBarService. Its existing 100ms event debounce remains; each resulting refresh reads current in-memory task state. Tracking, elapsed ticking, Pomodoro rendering and stop controls remain. Added four regressions and a browser regression, updated an existing ticker test to assert no additional reads per tick rather than expecting two explicit refresh calls to share a stale result, and added the upstream-required unreleased note acknowledging the reporter.

### Resolution.verification

```yaml
target_test: { result: pass, tests: 4 }
mutation_check: { result: skipped, reason_if_skipped: "Stryker not installed/configured in upstream checkout" }
no_op_deletion: { result: pass, deletion_justified_by_rca: true }
adjacent_tests:
  result: pass
  suites_run: [status-bar-tracking-refresh, issue-1880-status-bar-dash-title, issue-1655-time-tracking-status-widget]
  tests_passed: 9
revert_and_reconfirm:
  result: pass
  bug_returned_on_revert: true
  fixed_on_reapply: true
guardrail_verdict: accepted
```

- Four driving tests failed on original source, passed after the fix, failed again on a deliberate source-only revert, then passed on reapply. See status-bar-revert-result.json. Source-only byte backup/restoration preserved unrelated checkout changes instead of stashing the whole tree.
- Strict upstream Jest catalogue gates and all 9 status-bar tests passed; TypeScript and both normal/review-type ESLint configurations passed for the changed service. Strict production build passed. Full upstream test/release matrices were not run.
- Fresh checkout initially needed Windows PO line-ending normalization for the byte-comparison catalogue gate; authored translations and committed dependency pins are unchanged and excluded from the patch. The pinned official NLP Git dependency's generated files were built from its exact pinned source after lifecycle scripts were disabled at installation. Missing shallow-history tag warnings during release-note import generation were observed; the build completed successfully.
- New Playwright regression is discoverable (`playwright test --list`). Its separate launch helper was not run because this project requires the guarded hidden sandbox. Equivalent scenarios were executed through that sandbox with CDP and exact vault-path checks.
- Native fixed build: main.js SHA256 **4a2668af1cba20a3b702cb1137af83ccc3b881c85f532765f8ac8c2863a36abd**. Final rebuild after formatting review produced the same hash. Temporary whole-file formatter drift was discarded to keep the source patch minimal.
- status-bar-fixed-native.json verifies status visibility equals active timer membership across direct public API and pane-controller start/stop paths. Rapid restart displayed 0:00 for a 671ms-old entry, replacing the original 0:03 stale display. No stale native stop click or Notice remained necessary.
- status-bar-start-delay-fixed.json verifies a start after an empty status snapshot appears within the 650ms observation window and remains correct across the former cache-expiry boundary. Both tests stopped and archived only their new fixtures.
- Backed up nine files before testing the rebuilt TaskNotes bundle; verified disk-only restoration before launch. After testing, UAT was stopped and all nine original TaskNotes/pane assets, settings, data and workspace hashes restored. See status-bar-sourcefix-restoration.json. Personal Vault was not modified.

### Concrete test build and remaining checkpoint

Local ZIP: `.planning/debug/tasknotes-statusbar-fix/.ops/tasknotes-4.18.2-statusbar-fix.zip`, SHA256 **31fdeaf4e1f87a40a3b6af274b0d5307bf722da0a0c8c8c75e80821c99bdd41b**. Contains built main.js, manifest.json, styles.css, upstream MIT license and installation/provenance notes. This is an unofficial local TaskNotes 4.18.2 test build, not a new pane beta or official TaskNotes release. No upstream push, PR, tag or release was made.

The user's exact running vault/version remains unconfirmed. Installing this build over Personal Vault's on-disk 4.13.0 would also upgrade TaskNotes; that has not been done. A question requesting the actual affected vault/version is pending. GSD requires confirmation in the user's real workflow before the session can be marked resolved.
