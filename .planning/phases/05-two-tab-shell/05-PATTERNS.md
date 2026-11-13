# Phase 05: Two-Tab Shell - Pattern Map

**Mapped:** 2026-11-13
**Files classified:** 9 proposed implementation/test files; exact test filenames remain planner choices.
**Analog coverage:** 9 / 9 have extraction sources or partial test/setup analogs. View-state persistence and ARIA tabs have no existing implementation to copy.

## Scope and precedence

Read the Phase 05 context and its canonical references: ROADMAP, REQUIREMENTS, research SUMMARY and STAGING-DECISIONS, and Phase 04 CONTEXT. This is source mapping, with no new research or runtime verification.

Phase 05 CONTEXT and the current ROADMAP override the older SUMMARY build-order bullets: counts/running cue/markers belong to Phase 06; external-settings merge scaffolding is out of scope. This phase adds no staging writes, staging store/controller, data.json keys, rename, completion changes, or mobile reorder controls. Preserve existing view type and display/command names.

No root AGENTS.md or project-local skills directories were found in this worktree; the supplied user instructions apply. No knowledge graph was built. All existing analogs named below were verified as tracked with `git ls-files -- <path>`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/ui/TaskCard.ts` (new, implied extraction) | component | event-driven, transform | `src/ui/TimerPaneView.ts:304-572,644-658,694-700` | exact extraction source |
| `src/ui/CardList.ts` (new, implied extraction) | component | event-driven, transform | `src/ui/TimerPaneView.ts:234-302,611-642` | exact extraction source |
| `src/ui/TimerPaneView.ts` (modify) | component/controller | event-driven | existing lifecycle/header/message/tick sections of same file | exact; tabs and layout state are new |
| `src/ui/TaskPickerModal.ts` (modify) | component | request-response, event-driven | same file, constructor and lifecycle | exact; options interface is new |
| `styles.css` (modify) | config | transform | same file, visibility/message/header/card rules | exact; tab rules are new |
| `tests/taskCard.test.ts` (new, proposed) | test | event-driven, request-response | `tests/taskPickerModal.test.ts` deferred Markdown renderer and disposal assertions | role-match |
| `tests/cardList.test.ts` (new, proposed) | test | event-driven, transform | `tests/taskPickerModal.test.ts` element fake and lifecycle setup | role-match; fake needs expansion |
| `tests/timerPaneView.test.ts` (new, proposed) | test | event-driven | `tests/taskPickerModal.test.ts` host mocking; `tests/fakes/fakeObsidian.ts` host-reset concept | role-match; no existing view test |
| `tests/taskPickerModal.test.ts` (modify) | test | event-driven, request-response | same file | exact; update every constructor call |

`src/main.ts`, `src/model/cardOrder.ts`, `src/model/timeMath.ts`, `tests/fakes/fakeGateway.ts`, `tests/fakes/fakeObsidian.ts`, `package.json` and `eslint.config.mts` are integration/reference files, not mandatory modifications. If the planner chooses a reusable view-host fake or installs a DOM test environment, explicitly add its fake/config/package/lockfile changes to plan scope. The current checkout has no node_modules directory available for checking Obsidian declarations.

## Pattern Assignments

### `src/ui/TaskCard.ts` — component, event-driven/transform

**Analog:** `src/ui/TimerPaneView.ts`.

**Imports pattern** (lines 8-18,28-33): named Obsidian runtime imports plus `type` imports; relative imports, no alias/barrel system. Keep runtime host code under `src/ui/`; pure math stays in `src/model/`.

```typescript
import {
	Component,
	ItemView,
	Keymap,
	MarkdownRenderer,
	setIcon,
	setTooltip,
	type PaneType,
	type WorkspaceLeaf,
} from "obsidian";
import { taskLinkpath, taskWikilink } from "../model/taskLink";
```

Copy only the imports each extracted class needs. `ItemView` and `WorkspaceLeaf` remain shell concerns.

**Core action pattern** (lines 343-349): resolve the latest card data at click time; capture the write target before awaiting. The controller owns writes and busy state.

```typescript
pauseResume.addEventListener("click", () => {
	const current = this.cards.get(key);
	if (!current || pauseResume.disabled || this.services.controller.isBusy()) return;
	const { taskPath, startTime, title, state } = current.timer;
	if (state === "paused") void this.services.controller.resume({ taskPath, title });
	else void this.services.controller.pause({ taskPath, startTime, title });
});
```

With a TaskCard class, use its current model or a list-supplied lookup; do not retain an initial timer closure forever. Preserve Stop's `try/finally`, stopping-label protection and post-await existence check (552-571), Complete's availability/busy guard (354-360,626-631), and Pause/Resume style updates (644-658).

**Title lifetime/error pattern** (lines 417-435): Markdown rendering has an owned Component and a generation guard.

```typescript
const component = this.addChild(new Component());
const wrapper = createDiv({ cls: "tntp-title__md" });
const isCurrent = () => this.cards.get(key) === card && card.titleSeq === seq;
try {
	await MarkdownRenderer.render(this.app, markdown, wrapper, "", component);
} catch (error) {
	console.error(
		"[tasknotes-timer-pane] Rendering the task link failed: " +
			(error instanceof Error ? error.message : String(error)),
	);
	this.removeChild(component);
	if (isCurrent()) this.showTitleText(card);
	return;
}
// The card was removed or re-rendered meanwhile: this render lost the race.
if (!isCurrent()) {
	this.removeChild(component);
	return;
}
```

**Disposal pattern** (lines 513-520):

```typescript
private discardCard(card: CardElements): void {
	card.titleSeq++;
	if (card.titleComponent) {
		this.removeChild(card.titleComponent);
		card.titleComponent = null;
	}
	card.card.detach();
}
```

The extracted owner must invalidate pending renders and unload both current and late render Components on removal/close. Detaching an element alone is insufficient. If TaskCard extends Component, attach/remove it through its owning Component; if it does not, pass an explicit owner/dispose seam. Keep title IDs unique across panes/cards (110-111,312-318).

**TaskNotes title interaction ownership:** retain `titleRenderKey` using path/title/displayKey (101-103), `updateTitle` (389-403), plain-link normalization (436-460), `paneOwnsTitle` (480-482), tooltip ownership (488-493), click/middle-click guards (496-511), and context-menu `defaultPrevented` handling (540-545). Markdown receives `taskWikilink(taskPath)`, never the title. A chip replacing the plain link owns its mouse interaction; keyboard Enter/Space and note navigation retain existing behavior. Do not simplify all titles into unconditional open-note handlers.

**Time rendering** (695-698):

```typescript
for (const { timer, clock, total } of this.cards.values()) {
	// From stored timestamps: frozen while paused, continuing after a resume (D-07, D-08).
	setTextIfChanged(clock, formatHms(timerSessionMs(timer, nowMs)));
	setTextIfChanged(total, timer.totalKnown ? formatHms(totalMs(timer.entries, nowMs)) : UNKNOWN_TOTAL);
}
```

Move the per-card body into TaskCard, called with the shell's wall clock. Preserve the em dash for unknown paused totals. Never create a separate interval per card.

### `src/ui/CardList.ts` — component, event-driven/transform

**Analog:** `src/ui/TimerPaneView.ts:611-642` for keyed reconciliation; 247-302 for drag/keyboard behavior.

**Core identity pattern** (lines 616-623):

```typescript
const next = new Map<string, CardElements>();
for (const timer of timers) {
	const key = timer.sessionKey;
	if (next.has(key)) continue;
	const card = this.cards.get(key) ?? this.buildCard(els.cards, key, timer);
	card.timer = timer;
	next.set(key, card);
	this.updateTitle(key, card);
```

**Removal and minimal movement** (lines 634-641):

```typescript
for (const [key, card] of this.cards) if (!next.has(key)) this.discardCard(card);
// Move a card only when it is out of place, so focus and hover survive a refresh.
let i = 0;
for (const card of next.values()) {
	if (els.cards.children[i] !== card.card) els.cards.insertBefore(card.card, els.cards.children[i] ?? null);
	i++;
}
this.cards = next;
```

`CardList<K>` should accept identity/data/update/action/order seams instead of importing staging services. Timers keeps sessionKey identity across pause/resume. Phase 06 Staged will use task paths, independent maps and a render-time join with TimerStore. Never share card DOM/instances between lists, even when they refer to the same task. The Staged placeholder requires no real task read or persisted staged order in Phase 05.

**Keyboard reorder** (lines 261-266):

```typescript
handle.addEventListener("keydown", (evt) => {
	if (evt.key !== "ArrowUp" && evt.key !== "ArrowDown") return;
	evt.preventDefault();
	this.commitOrder(moveKeyBy([...this.cards.keys()], key, evt.key === "ArrowUp" ? -1 : 1));
	if (handle.ownerDocument.activeElement !== handle) handle.focus();
});
```

Each list owns its dragKey and drop markers. Only the handle is draggable; foreign drags are ignored using the local dragKey (267-301). Keep that locality when two lists/panes exist; the transfer MIME type alone is not authority to reorder. Preserve `moveKey`/`moveKeyBy` and the Timers commit callback to `CardOrderStore.set` (243-245).

**Ordering reference:** `src/model/cardOrder.ts:14-23` prepends unseen timers, then applies the saved order. Staged's future append-new rule must not change Timers ordering. No changes to the existing cardOrder persistence key are needed.

### `src/ui/TimerPaneView.ts` — shell, event-driven

**Analog:** existing same-file lifecycle (148-222), messages (660-692), refresh completion (601-609) and tick (707-720).

**Subscription and interval pattern** (lines 187-192):

```typescript
this.register(store.subscribe(() => { this.render(); void this.refreshCompletion(); }));
this.register(gateway.onState(() => { this.render(); void this.refreshCompletion(); }));
this.register(this.services.controller.subscribeBusy(() => this.render()));
// Keeps two open panes in the same order.
this.register(this.services.cardOrder.subscribe(() => this.render()));
this.registerInterval(window.setInterval(() => this.tick(), 1000));
```

Keep these subscriptions, one interval, visibility/focus refresh and wake detection at shell level, independent of selected tab. Preserve use of the pane's `containerEl.doc`/`.win` for pop-outs (196-204). `onClose` invalidates completion generation, closes picker, clears drag and disposes every list/card. A tab switch is not a view close.

**Tick pattern** (lines 707-719):

```typescript
private tick(): void {
	const now = Date.now();
	const { store } = this.services;
	// A wake or throttle gap: data may have changed while timers were suspended.
	if (detectWakeGap(this.lastTickMs, now)) store.requestRefresh();
	this.lastTickMs = now;
	const shown = this.contentEl.isShown();
	// Revealed (sidebar tab switched back, pane expanded): re-read TaskNotes.
	if (shown && !this.wasShown) store.requestRefresh();
	this.wasShown = shown;
	// Hidden: no DOM writes.
	if (!shown) return;
	this.writeTimes(now);
```

Keep refresh checks before any hidden-panel DOM-write optimization. `isShown()` here checks pane visibility; do not replace it with “Timers selected” or refresh will stop while Staged is active.

**State separation:** `src/model/timeMath.ts:297-308` derives `running` when any timer card exists, including paused-only snapshots, and `loading` when bridge is ready but the snapshot is null. Preserve that Timers behavior. Shell connection state must take precedence over the active body's normal content, including Staged's placeholder. Both tabs remain switchable while missing/incompatible/loading; active header actions are disabled; the shared connection message retains heading/body/version/retry. The Pomodoro unreadable note is Timers-only. Preserve retry `gateway.probe()` (182-183) and completion's closed/generation guard (601-609).

**Active tab:** no tracked getState/setState implementation exists to copy. Add per-instance state, validate to `staged`/`timers`, default to Timers for absent/malformed/unknown state, and support restoration before DOM construction. Use public ItemView getState/setState and the workspace layout-save mechanism after explicit selection; verify exact signatures against installed Obsidian declarations during implementation. No data.json changes. Tests must show that clicking/keyboard changes the serialized leaf state and a new instance restores it, including setState before onOpen and after opening. Two panes may differ in active tab while sharing Timers order.

**ARIA tabs:** also new. Implement Staged then Timers, role tablist/tab/tabpanel, linked IDs unique per pane, aria-selected/controls, one tab with tabindex 0, others -1, automatic activation on Left/Right and one-click activation. Home/End are allowed. Keep focus on the selected tab for arrow navigation, and make Tab lead into the active panel. If the active panel has no enabled focusable child (disabled Stage, or connecting), ensure the panel itself can receive keyboard focus. Inactive panels must be absent from keyboard/accessibility navigation. Store/bridge events never select a tab.

**Integration reference:** `src/main.ts:117` synchronously registers the view. `activateView`, lines 169-174, reveals an existing leaf without setting its state, or creates a right leaf without specifying a tab. Preserve that behavior. `getDisplayText()` at TimerPaneView 140-142 stays `TaskNotes timer`.

### `src/ui/TaskPickerModal.ts` — component, request-response/event-driven

**Analog:** same file. Convert constructor dependencies and close callback (22-28) to an options object with start mode only; update TimerPaneView's sole production creation site (224-232) and test creation sites (taskPickerModal.test.ts:49,87,105). No Stage selection mode or Stage-button picker call in this phase.

**Public selection/guard pattern** (lines 104-114):

```typescript
selectSuggestion(task: TaskInfo, event: MouseEvent | KeyboardEvent): void {
 if (!this.opened || this.chosen || this.controller.isBusy() || !this.gateway.startAvailability().available) return;
 super.selectSuggestion(task, event);
}

onChooseSuggestion(task: TaskInfo): void {
 // SuggestModal may close before invoking this callback, so closed is not a veto.
 if (this.chosen || this.controller.isBusy() || !this.gateway.startAvailability().available) return;
 this.chosen = true;
 void this.controller.start({ taskPath: task.path, title: task.title });
}
```

Preserve read-on-open (41-61), generation validation after reads, close on unavailable bridge (35-37), fail-safe Notice plus finally-close (54-60), and row Component release (127-135). Picker chip capture handling intentionally differs from pane title handling: picker rows own selection, whereas pane chips keep TaskNotes interactions.

### `styles.css` — config, transform

**Analog:** existing styles, especially lines 10-29 and 224-257.

```css
/* Existing lines 10-13: extraction input; do not retain this global scope unchanged. */
.tntp-pane--running .tntp-message,
.tntp-pane:not(.tntp-pane--running) .tntp-cards {
	display: none;
}
```

Scope list/message visibility to each tab body, with a separate connection modifier/message, so Timers running cannot hide the Staged placeholder or shared bridge message. Also scope loading heading, retry visibility and Pomodoro note rules (15-29). Check any `display:flex` panel rule against `[hidden]`: inactive panels must stay hidden after CSS application.

**Header pattern** (line 251):

```css
.tntp-header { display: flex; gap: var(--size-4-2); margin-bottom: var(--size-4-4); flex-wrap: wrap; }
```

Retain that wrapping action row under the strip; add underlined text tabs using Obsidian variables and tntp- BEM classes. Existing message typography (225-241) supplies the Staged empty state. Preserve card layout, paused styling, focus rings and chip rules. Avoid inline styles and arbitrary color values.

### View/card/list test files and `tests/taskPickerModal.test.ts` — tests

**Analog:** `tests/taskPickerModal.test.ts`, especially the `vi.hoisted` counters (4), explicit Obsidian mock (24-38), global createDiv reset (43), setup (44-50) and delayed renderer cleanup test (52-60).

```typescript
test("unloads row renderers and discards slow results on query change and close", async () => {
 const { modal } = setup(); modal.onOpen(); await flush();
 const el = new Element(); modal.renderSuggestion(task, el as unknown as HTMLElement);
 expect(host.loaded).toBe(1);
 modal.getSuggestions("next"); expect(host.unloaded).toBe(1);
 host.renders[0]!(); await flush(); expect(el.children[0]!.children).toHaveLength(0);
 modal.renderSuggestion(task, new Element() as unknown as HTMLElement);
 modal.onClose(); host.renders[1]!(); await flush(); expect(host.unloaded).toBe(2);
});
```

Apply this deferred-Promise pattern to TaskCard title renders that finish after update/removal/close, including rejected renders and chip ownership. Assert Components unload exactly once and late output cannot reattach.

**Host limitations:** current picker Element fake (5-23) lacks real focus, classList, DOM insertion/movement, event bubbling/capture and geometry. `tests/fakes/fakeObsidian.ts:47-53` exports empty Component/ItemView and renderer stubs; it cannot instantiate/render the real pane. Extending that fake globally may affect settings/startup tests. Prefer a dedicated view-host mock with explicit lifecycle registration/disposal and a DOM implementation capable of focus/events, or carefully scoped enhanced fakes with honest limits. There is no existing jsdom/vitest config or DOM dependency in package.json (22-33); choosing jsdom/obsidian-test-mocks requires explicit dependency/setup work, not an assumption that it already works.

**Meaningful coverage for the planner:**

- Shell: default/invalid/restored tab, two independent panes, serialized state after click/keys, selection before/after onOpen, reveal preserves selection, no implicit selection from timer events, ARIA roles/IDs/roving focus, disabled Stage and placeholder.
- Both tabs under missing/incompatible/loading/ready: visible switchable strip, shared version/retry message, disabled relevant actions, reconnection, focus/visibility refresh and wake-gap refresh while Staged is active. Verify no writes from open/render/switch/tick.
- CardList: duplicate keys, identity retention through pause/resume, removal/disposal, unchanged-order nodes not moved, drag isolation per instance, ArrowUp/Down and handle focus, existing saved Timers order.
- TaskCard: current target on action, pause/resume/stop/complete dispatch, busy gating and stop settlement after removal, timestamp-derived clocks and frozen pause, title renderer races and TaskNotes interaction ownership.
- Keep existing picker regression tests (once-only selection after host close, late read disposal, bridge loss, Notice throwing, Pomodoro row tag). Changing constructor shape should not change their assertions.

Use `npm run check` for build/typecheck, lint and all existing tests (package.json:11-15); targeted new tests are useful while implementing. This source-mapping task ran no tests and makes no runtime claims. Existing model/controller tests do not prove view behavior. Native/UAT verification should cover real TaskNotes chips, HTML drag/focus and layout restoration across restart; the tracked scripts are exposed through `npm run uat:start`, `uat:stop`, `uat:smoke` (17-19).

## Shared Patterns

### Lifecycle and event ownership

Shell owns gateway/store/busy/order subscriptions, interval, visibility/focus listeners, completion generation, active tab and picker. CardList owns keyed cards and drag state. TaskCard owns card-local DOM/action state/title render Components. Native host listeners use registerDomEvent/register/registerInterval; existing card-local listeners use addEventListener and disappear with detached cards (TimerPaneView:336-337). Preserve this distinction rather than making the inaccurate claim that every existing listener uses registerDomEvent. Do not leave detached card listeners retained by a long-lived owner.

### Writes, guards and errors

There is no authentication layer. Guards are controller busy state, gateway availability, current-card identity and async generations. Shared controller/queue services are created once in `src/main.ts:102-110`; do not instantiate a queue/controller per tab. UI actions dispatch to that controller; render only derives/displays data. Existing CardOrderStore persistence remains plugin-scoped and shared across panes. Active tab state does not enter `OWNED_KEYS` or `persistAll`.

UI navigation/render failures log with `[tasknotes-timer-pane]` and Error-or-String messages (TimerPaneView:422-429,527-531). Preserve plain-title fallback and resource release, not merely a catch that hides an error.

### Minimal DOM writes

**Source:** TimerPaneView:105-108. **Apply to:** messages, clocks, labels and placeholders.

```typescript
function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}
```

Build stable frame once; update in place to preserve focus and polite live regions. A small shared helper may be placed within the extracted modules; a new utility file is optional and should only be added if needed.

## No Analog Found

| Capability / possible file responsibility | Role | Data Flow | Reason / planner direction |
|---|---|---|---|
| Active-tab getState/setState in TimerPaneView | component | event-driven | No existing view-state persistence override; verify public Obsidian declarations and layout-save hook during implementation. |
| ARIA tab strip in TimerPaneView | component | event-driven | No existing tab widget; implement Phase 05 D-01–D-08 directly and test focus/navigation. |
| Full view DOM/lifecycle test setup | test | event-driven | Existing fakes cover picker/settings/startup only; select and provision an adequate host/DOM setup explicitly. |

## Metadata

**Analog search scope:** tracked `src/`, `tests/`, root CSS/package/lint config; canonical planning references.
**Primary analogs:** 5 (`TimerPaneView.ts`, `TaskPickerModal.ts`, `styles.css`, `taskPickerModal.test.ts`, `fakeObsidian.ts`). Additional tracked model/main references document integration constraints.
**Complete source/config files read:** 10. No source files were changed.
**Pattern extraction date:** 2026-11-13.
