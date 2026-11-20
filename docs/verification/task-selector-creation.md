# Task selector and inline creation verification

2026-11-18. Guarded repository dev-vault only; no Personal Vault writes, reset, release, commit or push.

## Implementation

Rich rows contain safe text only: status, priority, contexts, tags, projects, local date strings,
optional bounded subtask summaries and Pomodoro marker. Existing ranking is preserved.
Public NLP preview supports edited/confirmed titles and explicit parsed fields; omitted values use TaskNotes defaults.
Creation and destination routing are separate. Destination failures retain the returned identity for Retry add/stage.
Unknown creation results block the plugin-wide controller until the user confirms inspecting their notes.
Closing/reconnecting/unloading suppresses later routing and reports that a created note remains available.
Staged batches retain query, focus and insertion anchor; successful paths disappear immediately.

## Automated evidence

Full `npm run check`: 668 Vitest tests in 30 files, 13 vault-switch tests, typecheck, build and lint passed.
Native fixes subsequently moved the footer to public `modalEl` (SuggestModal detaches `contentEl`), removed
legacy row flex styling, set 44px create/retry controls and reparsed queries changed during creation.
After those changes, typecheck and 32 targeted creation/modal/idle tests passed. Final full check also passed
all 668 Vitest tests, 13 vault-switch tests, build/typecheck and lint on the final source.

Tests cover one-shot/shared-queue retry, uncertain creation, close/reconnect/unload races, queued cancellation,
stale parse/relationship results, bounded concurrency, title confirmation, defaults/custom mapping, saved-membership
retry, batch insertion anchor retention, eligibility changes, missing optional APIs and neutral color fallback.

## Native observations

Loaded TaskNotes 4.18.2, public API v1; final launcher `6420cb9+dirty`, main.js hash prefix `7ccd2fe20fd0`.
Public nlp.parse/tasks.write/relationships.read/catalog.read capabilities and parse/create/priorities/subtasks methods
were present. Metadata-only `due tomorrow` returned `Untitled Task`; normal input omitted status and priority.

- Timers creation saved `TaskNotes/Tasks/UAT Inline Add 20261118.md`, used default open/normal and task tag,
  persisted idle membership and closed after success. Membership remained after restarting the sandbox.
- Staged creation saved explicit high priority, due date, context/tag and today's staging date. Modal stayed open,
  retained query/focus, disabled the unchanged draft and hid the path.
- Clicking the visible create button at its center created/staged once. Existing result row click retained
  query/focus and excluded that path from subsequent suggestions.
- Native CDP Shift+Enter created/staged `UAT keyboard creation 20261118` once, retained query/focus and disabled creation.
- Created task records had no timeEntries. Neither route requested timer start.
- Empty input disabled creation with “Enter a task title”; no-match input retained an editable preview and create action.
- Dark desktop and light 390x844 viewport inspected. Narrow modal had no horizontal overflow; create button
  was visible, connected and 44px high. Long titles and metadata wrapped.

Screenshots: [dark preview](task-selector-creation-dark.png), [light narrow results](task-selector-creation-light-narrow.png).
Fixtures remain in the disposable dev-vault; existing files were not deleted. Sandbox stopped after screenshots.

## Limits

Native full Tab/Up/Down/Escape/IME matrix, physical mobile/touch, native failure injection, custom-field/default-completed
creation, reconnect during an actual vault write and relationship-cache pressure were not all exercised in the sandbox.
Automated tests cover key failures/races but cannot establish physical-device behavior. Compatibility observed on 4.18.2 only.
The public `api` creation context is intentionally retained; native-modal folder rules are not promised.
No private TaskNotes parser, renderer, settings or creation helpers are imported.


## Review correction: destination lifetime

The independent review reproduced a close during a destination's deferred validation read. The initial guard
was outside that destination and therefore too early. The correction passes an optional lifetime predicate
into `StagingController.stage` and `IdleCardStore.add`, checking after deferred reads and immediately before
mutation. Staging checks again after its synchronous invalidation notification. Existing callers default to live.
Created-route retries receive the same generation-aware lifetime check; cancellation keeps the note and emits
an explicit notice. A write already dispatched still reports its real outcome rather than claiming cancellation.

Added deferred tests use the real destination controllers: first and final staging reads, idle active reads,
both initial created routing and retry, plus closure after persistence dispatch. Targeted suite: 72 passing tests.
No further native deployment was needed for this model/controller correction.

## Final selector behavior note (2026-11-19)

The native observations and screenshots above are historical evidence from the earlier preview-and-button implementation. They do not verify the final selector interaction. The final source uses Enter to select an existing task and Shift+Enter to create directly from the current search query after pending parsing completes. There is no parsed preview, editable title field, or create button. Metadata-only queries that parse to `Untitled Task` are blocked with a request to add a task title. A failed destination write retains the known created task identity so retry does not create a duplicate. Uncertain creation failures can be retried from the current query; there is no inspection acknowledgement gate. The automated checks listed above predate later source changes; current automated results are recorded with the corresponding commit/turn report, and no new native UAT is claimed here.
