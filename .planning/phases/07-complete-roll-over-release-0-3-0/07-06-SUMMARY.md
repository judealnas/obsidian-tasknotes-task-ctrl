---
phase: 07-complete-roll-over-release-0-3-0
plan: "06"
subsystem: release
status: complete
requirements-completed: [PANE-04]
---

# Plan 07-06: Stable 0.3.0 publication and BRAT acceptance

GitHub published stable 0.3.0 from `da52d990c6f2bf69dc09cab276ee50c14e5155a6` on 2026-11-24 at 00:38:57 UTC (November 23 local time). The successful release workflow verified the tag and ran the build, lint and automated tests. All four uploaded assets are listed with their hashes in [07-RELEASE.md](07-RELEASE.md).

The 0.3.0 manifest identifies the plugin as `tasknotes-timer-pane` with display name TaskNotes Task Control. 0.4.0 is a separate published identity change to `tasknotes-task-ctrl`. The 0.3.0 acceptance applies to an upgrade within the old ID.

BRAT 2.2.0 updated a populated 0.2.0 installation to published 0.3.0 in a disposable vault. The same plugin ID and saved pane reloaded with two pauses, preserved Timers order and equal parsed plugin data, including the default completion preference. Installed `main.js` and `styles.css` matched the published asset hashes. The separate cold candidate rehearsal exercised the extended fixture with both order arrays, a nondefault setting and an unknown-data sentinel. See [native follow-up](../../verification/2026-11-24-native-followup.md) and [07-UAT.md](07-UAT.md).

The original plan's exact-SHA approval packet is absent from the checked-in evidence.
