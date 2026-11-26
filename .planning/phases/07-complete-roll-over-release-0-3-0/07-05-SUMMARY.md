---
phase: 07-complete-roll-over-release-0-3-0
plan: "05"
subsystem: release
status: partial
requirements-completed: []
requirements-pending: [ORDER-04]
---

# Plan 07-05: Release candidate and native acceptance

The display rename, candidate version metadata, compatibility tests and read-only acceptance driver were delivered. Candidate preparation commits were `f66824c` and `bc988d0`. The final check on that candidate passed the build, lint and 725 tests. The later stable tag uses `da52d99` after the beta feedback and subsequent UI changes.

- The guarded desktop vault used TaskNotes 4.18.2. The production-controller matrix passed 16 cases each with TaskNotes auto-stop enabled and disabled. The disabled run verified the live setting before and after use.
- A separate cold asset-swap rehearsal started with published 0.2.0, created and reloaded a 1,344 ms pause, then loaded candidate 0.3.0. All 15 upgrade checks passed, including both orders, settings, an unknown Unicode field and saved pane identities. This was a direct swap of assets in the old plugin folder. BRAT delivery is tracked in Plan 07-06.
- The earlier failed rehearsal and authorized dev-vault completion-history reset remain recorded in [native evidence](07-NATIVE-EVIDENCE.md). The successful rehearsal restored the recorded candidate files with disk-only cleanup.
- The user removed Done today and custom rollover on 2026-11-15. Their overnight and boundary sleep tests are superseded. The implemented mobile arrows have host-simulation coverage, with physical touch acceptance still open.

The candidate implementation and desktop evidence are recorded. The remaining physical mobile check is tracked in [07-UAT.md](07-UAT.md).
