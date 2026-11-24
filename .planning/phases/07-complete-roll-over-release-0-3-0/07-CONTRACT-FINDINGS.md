# Phase 7 native completion contract findings

## Environment and evidence

Observed TaskNotes **4.18.2**, Runtime API **1**, in the guarded dev-vault UAT sandbox. Ready provenance: checkout `e0e29e3+dirty`, deployed main.js hash `cd5beaa1eefe`. The later bridge changes were unit-tested separately; they were not silently claimed deployed for these observations.

Reproducible runner: `node scripts/uat/phase7-contract.mjs` after `npm run uat:start`. Stop with `npm run uat:stop`. Latest raw evidence: `07-contract-native.json`, run **P7-contract-1794715327261**, captured **2026-11-15T04:02:07.261Z** (local November 14, 23:02 EST), **16 cases, zero runner failures**. Final deployment provenance: `cf75215+dirty`, main.js **01a83d61ab55**. The runner uses public TaskNotes operations and public Obsidian vault reads. It creates uniquely named disposable fixture notes and leaves them for inspection. A fixture Pomodoro starts only after verifying no current Pomodoro; the fixture-owned Pomodoro and residual fixture time entry are stopped in finally.

## Public contract (documentation/source, distinct from native observations)

- [Runtime API documentation](https://tasknotes.dev/javascript-api/): `recurring.toggleCompleteInstance(path, date?, context?)`; `recurring.materializeOccurrence(path, date, context?)`; capabilities `recurring.write` / `recurring.materialize`.
- [Tagged 4.13.8 runtime contract](https://raw.githubusercontent.com/callumalpass/tasknotes/4.13.8/src/api/runtime-api.ts): mutations return TaskInfo. Production wrappers now retain and validate returned path/status identity and reject evidence returned from a retired/replaced API.
- [Public property definitions](https://tasknotes.dev/settings/property-types-reference/): recurrence, recurrence_anchor, complete_instances, completedDate, recurrence_parent, occurrence_date, occurrence_materialization. Materialized occurrence notes own status, completed date and timing; their parent owns the recurrence rule. Custom properties are inherited; timeEntries are not.

Exact live namespace keys: `toggleCompleteInstance`, `toggleSkippedInstance`, `materializeOccurrence`. There is no public read-only occurrence-resolution method in that namespace. This is a namespace observation, not proof that no other future API could provide one.

## Observed native branches

All observations below have exact task paths, request dates, returned TaskInfo and before/after raw Markdown in `07-contract-native.json`.

| Case | Observed result |
|---|---|
| Virtual weekly, exact Monday November 9 | First request records `2026-11-09`; second identical request removes it. Parent stays open. |
| Virtual weekly, off-schedule Saturday November 14 | First request records Monday `2026-11-09`; second identical request additionally records Monday `2026-11-16` and advances scheduled to November 23. |
| Completion-anchored recurrence | Explicit November 14 request records November 14 and advances schedule to November 16. |
| Existing materialized undone occurrence | Parent toggle returns the occurrence path, sets occurrence done and parent history November 9. Repeating reopens the occurrence. |
| Automatic on_completion policy, off-schedule request | Returns a separate occurrence dated **November 14**, with status done and inherited staged November 14. Parent history records November 14, unlike the virtual weekly case's November 9. |
| Existing future occurrence explicitly staged November 17 | Its staged value remains November 17 after completing the parent's November 14 request. |
| Explicit public off-schedule materialization | `materializeOccurrence(parent, "2026-11-14", context)` creates an occurrence dated November 14 even though the parent is Monday-only. |
| Regular timing plus direct recurring completion | With the existing auto-stop setting true, the fixture time entry closes. The runner stops any residual fixture timing. |
| Active Pomodoro plus direct recurring completion | The Pomodoro-owned entry starts at `2026-11-15T03:41:05.673Z` and closes at `2026-11-15T03:41:05.971Z`; the Pomodoro countdown still reports running. Omitting an explicit pane stop does not protect Pomodoro timing. |
| New ordinary coordinator through the controller callback used by cards | Outcome `completed`, configured status done, staged null, regular timer closed, busy false. This is actual native execution of the production callback, not a fake-only result. |

The date basis is demonstrably local: native `completedDate` is November 14 while the capture's UTC calendar date is November 15. Crossing the configured rollover boundary during an in-flight completion remains untested.

Final coordinator observations establish automatic creation of current November 14 and next November 16 occurrence notes, with inherited staging cleared on both and on the source. A separate final coordinator case preserves a pre-existing next occurrence's explicit November 17 staging. Ordinary and all four recurring coordinator cases complete successfully, while a repeated request returns unavailable without changing recurrence history. A fresh plugin instance after actual disable/enable loads the persisted guard and refuses replay. The active-Pomodoro coordinator case returns unavailable and preserves the exact open time entry and countdown; this contrasts with the direct upstream API side effect above.

Auto-stop **off** was also exercised: `07-contract-native-autostop-off.json`, run **P7-contract-1794714653876**, thirteen successful cases. Only the guarded **dev-vault** setting was temporarily changed while Obsidian was stopped. The exact original settings bytes were backed up to the temporary directory and restored in finally after the sandbox stopped; SHA-256 equality was verified (`True`) before restarting with the original true setting. No Personal Vault or ordinary Obsidian instance was involved. Only installed 4.18.2 was exercised; no minimum-version claim is made.

Two repeated stress runs exceeded the runner's 90-second limit. Step diagnostics showed slow progress with accumulated staged fixture notes, not a confirmed product deadlock. Unchanged TaskCard renders were found to repeat availability reads, so they now reuse results until task/state/busy/readiness changes. A focused regression asserts this. 118 generated fixture files were reversibly moved to `dev-vault/.phase7-fixture-backup` while the sandbox was stopped. The final 16-case run succeeded after both changes; their individual timing contributions were not isolated. Reload checks use bounded observation of a genuinely fresh plugin instance and require a live connected restored pane.

Local rollover-spanning completion is covered by an injected-clock integration test that keeps the original requestDay/requestedAt after 4 AM. This is simulated clock evidence; physical overnight/sleep observation remains Plan 07-05.

## Decision checkpoint before 07-02 task 2

The public date argument does not mean one uniform off-schedule occurrence across virtual and materialized tasks. The user has been asked to choose:

1. Follow TaskNotes' resolved occurrence, retaining separate request/resolved/actual identity and durable replay protection.
2. Disable completion when the staging day is outside the recurrence schedule. This narrows supported behavior and requires a documented requirement/plan decision; no partial RRULE resolver or forced materialization will be invented.

**Resolved by the user in this execution session:** follow TaskNotes' resolved occurrence with protection against repeated completion. Virtual recurrence keeps the explicit captured staging-day request; an on_completion policy uses the public materialization path with authoritative returned occurrence identity. Request/resolved dates may differ. Do not force ordinary virtual series into materialized notes. This resolves the targeting-policy checkpoint; remaining native evidence and failure checks are still required before closing 07-02.

## Bridge validation

Focused typecheck and 116 bridge/contract tests passed, including returned materialized identity, method receivers, impossible calendar dates, missing materialization capability, malformed identity, and rejection after API retirement. The native runner's actual upstream behavior is kept separate from these local seam tests.
