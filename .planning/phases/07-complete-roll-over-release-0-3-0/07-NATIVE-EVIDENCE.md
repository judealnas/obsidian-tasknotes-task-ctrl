# Phase 7 candidate acceptance — INCOMPLETE

**Release follow-up (2026-11-24):** This file preserves candidate observations and the recovery incident. [07-UAT.md](07-UAT.md) records the current device and BRAT checks, and [07-RELEASE.md](07-RELEASE.md) records the subsequent stable publication. The user removed Done today and configurable rollover on 2026-11-15.

Date: 2026-11-15. Candidate: TaskNotes Task Control 0.3.0, id/view type `tasknotes-timer-pane`, command `open-timer-pane`, minimum Obsidian 1.12.2. Product source commits: `f66824c` (assets) and `bc988d0` (display/legacy tests). Follow-up documentation and evidence commits do not change the built application.

## Verified local checks

- Final `npm run check`: build, lint at zero warnings, **725 tests in 28 files passed**.
- Plan 07-03: 163 focused model/store/view/startup tests passed, including timezone/DST rules, hidden/no-pane rollover, failed reads, changed hours, late read rejection, quiet completion, title disposal and external completion/reopen.
- Plan 07-04: 46 focused card/list/view tests passed. Mobile host simulation covers stacked arrows, boundaries, current-key/disposal guards, independent persisted order, focus and position announcements. This is not physical mobile evidence.
- Package/manifest/root lock/versions agree on 0.3.0. Dependency pins are unchanged. Exact product capitalization is registered as a brand in the existing sentence-case lint rule. A stale settings description was corrected to match occurrence completion.

## Native observations

The guarded launcher ran this checkout only in the hidden dev-vault sandbox. TaskNotes 4.18.2, Runtime API v1; Obsidian window reported 1.15.1. An initial cold launch reported TaskNotes not ready and prepare timed out. A fresh guarded launch became ready; no alternate launch method or personal vault was used.

| Evidence | Observation | Limit |
|---|---|---|
| `07-acceptance-candidate-desktop.json` | Eight native desktop checks passed: staged card, desktop arrow absence, independent order, position feedback, ordinary completion, title-only Done today, external completion and reopen. Original data bytes were restored on this first exercise. | This run used the earlier mutable driver, subsequently withdrawn after the later upgrade incident. No physical-mobile claim. |
| `07-contract-native.json` | Run `P7-contract-1794725038353`: 16 native cases, no runner errors; ordinary/virtual/materialized/automatic/existing-next completion, replay refusal, plugin restart and Pomodoro protection. | Observed `autoStopTimeTrackingOnComplete=true`. |
| `07-contract-native-repeat.json` | Run `P7-contract-1794725143104`: repeat of the 16-case matrix, no runner errors. | Also auto-stop **true**. It was initially mislabelled by the output-only CLI flag; corrected here. |
| `07-contract-native-autostop-off.json` | Preserved earlier 13-case native evidence with observed auto-stop false. | Historical Plan 07-02 evidence, not a final-candidate off-setting pass. The probe now rejects `--auto-stop-off` unless the public settings snapshot confirms false before any fixture mutation. |
| `07-acceptance-upgrade-rehearsal.json` | First asset-swap rehearsal retained a real 1,621 ms accumulated pause, both order arrays, completion status/hour and an extra-key sentinel through save/reload; copying assets did not change data bytes. | Obsidian cached the candidate manifest label during the old-code load. Full old-version identity acceptance is **not** established. Later stronger rehearsal failed as described below. |
| `07-acceptance-recovered-checkpoint.json` | Candidate assets match installed SHA256 hashes; TaskNotes ready, correct product name/version, known settings/orders recovered. Read-only driver left plugin data bytes unchanged and saved a disk backup under the reported Temp path. | Completion history remains quarantined. |

Native fixture notes remain in dev-vault for inspection, as the contract probe documents. The failed upgrade fixture was archived through the public TaskNotes API. UAT was stopped at closeout.

## Upgrade-rehearsal incident and recovery

The second upgrade rehearsal attempted to refresh Obsidian's cached manifests while swapping actual downloaded 0.2.0 release assets into the same installed folder. CDP stopped responding during that operation; the underlying stall cause is not established. The cleanup then failed before restoring its in-memory copy of the original plugin data. Restarting the guarded sandbox restored responsiveness but could not recover those exact original bytes.

Only `dev-vault/.obsidian/plugins/tasknotes-timer-pane/` was involved. Personal Vault and application source were not modified by the rehearsal. The failed fixture file is retained as `07-upgrade-failed-fixture-data.json`.

Recovery restored the recorded pre-rehearsal completion preference (`null`), rollover hour (`6`), two Timers order slots and 31 known Staged slots, plus 15 recorded completion attempts recovered from current and prior native evidence. Later successful task reads appended externally staged fixture paths, producing 44 Staged slots in the recovery snapshot. The pre-rehearsal pane snapshot showed no timed cards; the reconstructed pause list is empty. Unknown original raw-data fields and unrecorded completion observations cannot be claimed recovered.

`07-dev-data-recovery.json` preserves the recovered state and its basis. The dev-vault uses `completionRecordsVersion: "recovery-required"`, so the existing defensive loader quarantines it and refuses new completion writes rather than treating incomplete history as permission to replay. Native verification confirmed `completions.available() === false`. **Review this recovery before any reset or new mutation rehearsal.** A backup of this recovered state now exists at the Temp path recorded by the read-only snapshot.

The mutable exercise/upgrade modes were removed from the new acceptance driver. Its delivered interface is read-only snapshots and disk backups only; it never installs assets, changes settings, mutates tasks or replaces plugin data. Any renewed upgrade rehearsal needs a durable, hash-checked disk backup before its first mutation and restoration that runs even if every CDP call fails. Do not retry the withdrawn in-memory-only protocol.

## Internal review dispositions

- **Fixed:** incomplete TaskTitle extraction lost card metadata; existing card tests and new title-only row tests now pass.
- **Fixed:** cached rollover could restore a successfully unstaged/renamed card; the cache now follows these actions and has regression coverage.
- **Fixed:** stale reads could interpret newly saved completion evidence as reopened; day/config and completion revision checks reject them.
- **Fixed:** a materialized occurrence completed externally could be missed without parent history; complete snapshot identity matching covers it.
- **Fixed:** observation retention must not evict live fingerprints and rediscover yesterday's completions; capacity refuses excess new observations and retains mutation safety state.
- **Fixed/withdrawn:** native upgrade driver lacked a durable backup and robust restoration. Mutable modes were removed; known dev-vault history is quarantined. Exact raw-data loss remains an acceptance incident, not a successful restoration claim.
- **Fixed:** the contract probe's off-setting filename flag did not verify the setting. It now fails before fixture mutations when false is not observed.
- **Open:** native acceptance and recovery gates below. Automated source checks are not substituted for them. No release approval has been requested.

## Remaining acceptance gates

**Recovery gate update (2026-11-15):** User authorized resetting only dev-vault completion history. With UAT stopped, a byte-exact backup was saved and SHA256 verified (`07-completion-reset-before.json`). Only the completion version/records were reset; all other fields were preserved. Guarded native startup verified version 1, zero prior attempts and completion availability. Existing fixture tasks generated 69 new observations on refresh. These do not restore unknown lost history. See `07-completion-reset.json` for hashes and runtime results. Gate 1 is resolved by this explicit disposition.

### Resumed native acceptance — 2026-11-15 08:19–08:24 UTC

- **Gate 2 passed:** `07-contract-native-autostop-off.json`, run `P7-contract-1794730767443`, records 16 cases with no runner errors or skipped cases. TaskNotes' Features settings checkbox was clicked; its public settings snapshot confirmed `autoStopTimeTrackingOnComplete=false` before fixture mutation and again after the run. Ordinary completion and all four coordinator branches returned completed; repeat/restart and Pomodoro checks returned unavailable as expected. The runner invokes production controllers/public APIs; it does not establish every branch through physical pointer input. Historical 13-case evidence was preserved as `07-contract-native-autostop-off-historical.json`.
- The initial attempt selected TaskNotes' separate Settings window and failed with `app is not defined` before the contract created any fixture. Closing that window restored the correct vault target. The setting had saved as false. After testing, there were no active timers or Pomodoro session. UAT was stopped and original TaskNotes data was restored byte-for-byte from a hash-verified disk backup without CDP. New pane safety records from the matrix were retained.
- **Gate 6 passed:** Published 0.2.0 assets were downloaded with `gh release download 0.2.0 --repo judealnas/obsidian-tasknotes-timer-pane`. Guarded cold startup verified runtime name TaskNotes Timer Pane/version 0.2.0. A fresh task was started and paused through the old controller, retaining 1,344 ms. A second old-version startup confirmed the populated fixture loaded and displayed. Only main.js/manifest.json/styles.css were then replaced; data.json's SHA256 remained identical through the swap. Candidate cold startup verified TaskNotes Task Control/version 0.3.0 and passed 15 checks: ids/minimum, full pause record, both order arrays, completion status/hour, unknown Unicode extra data, original leaf ids/view type, Timers legacy default, visible paused card and no active timers. See `07-upgrade-old-fixture.json`, `07-upgrade-old-loaded.json`, `07-upgrade-populated-before.json`, `07-upgrade-immediate-before.json`, `07-upgrade-asset-swap.json`, `07-upgrade-candidate-loaded.json` and `07-upgrade-cold-restart-result.json`. Initial harness assertion used activeTab instead of production's tab; captured states were correct and the assertion was corrected, not the product.
- Upgrade cleanup archived only the new fixture. The disk-only restore script stopped UAT and restored candidate assets, pane data and workspace to their pre-upgrade hashes, including new matrix safety records. It succeeded without CDP. Verified baseline backups and restoration inventories remain local in `07-resume-backup/` and `07-upgrade-backup/`; these may contain settings and are excluded from git. Personal Vault was not used.
- Production code/dependencies did not change. The guarded candidate build passed; the prior full regression result remains 725 tests, not a newly rerun suite. Actual published BRAT upgrade still belongs to Plan 07-06. No overnight, physical sleep or mobile observation was made.

1. RESOLVED: explicit reset disposition above.
2. PASSED: final-candidate disabled-auto-stop matrix above.
3. Real overnight open-Obsidian rollover, with before/after wall-clock, timezone, setting, frontmatter hashes, order, age and Done today observations.
4. Physical sleep/wake across the rollover boundary. Clock simulation and renderer suspension do not satisfy it.
5. Physical mobile/touch validation, or an explicit user disposition of that limitation.
6. PASSED: actual-0.2.0-to-candidate cold-restart rehearsal above supersedes the partial first rehearsal.
7. After all prior gates, prepare a fixed-SHA release packet and obtain explicit Plan 07-06 publication approval. Actual BRAT upgrade proof follows publication.

The A2 limit remains visible in README: date-only external history cannot establish exact completion time or reliably assign early-morning history to a staging day. First-observed ordering is best effort; dateModified is not treated as completion time.

Plan 07-05 has no SUMMARY because its native acceptance task remains incomplete. No tag was created or pushed; no release was published.
