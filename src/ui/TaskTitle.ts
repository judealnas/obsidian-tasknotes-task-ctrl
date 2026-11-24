import { Component, Keymap, MarkdownRenderer, setTooltip, type App, type PaneType } from 'obsidian';
import { taskLinkpath, taskWikilink } from '../model/taskLink';
import type { TaskNotesGateway } from '../tasknotes/TaskNotesBridge';
export interface TaskTitleModel { taskPath: string; title: string; displayKey: string; }
interface TitleElements { timer: TaskTitleModel; title: HTMLElement; titleLabel: HTMLElement; titleKey: string | null; titleSeq: number; titleMode: 'text' | 'markdown'; titleLink: HTMLAnchorElement | null; titleComponent: Component | null; }
let titleLabelSeq = 0;
function titleRenderKey(timer: TaskTitleModel): string { return [timer.taskPath, timer.title, timer.displayKey].join('\0'); }

/** Safe task title owner shared by both card lists. */
export class TaskTitle extends Component {
 private elements: TitleElements;
 private disposed = false;
 private titleOwners = new Set<Component>();
 private get app(): App { return this.options.app; }
 constructor(parent: HTMLElement, timer: TaskTitleModel, private readonly options: { app: App; gateway: Pick<TaskNotesGateway, 'showTaskMenu'> }) {
  super(); this.load(); const card = parent; const key = timer.taskPath;
		const titleLabelId = `tntp-title-label-${++titleLabelSeq}`;
		const title = card.createDiv({
			cls: "tntp-title",
			attr: { role: "link", tabindex: "0", "aria-labelledby": titleLabelId },
		});
		setTooltip(title, "Open task note");
		const titleLabel = card.createSpan({ cls: "tntp-visually-hidden", attr: { id: titleLabelId } });
		title.addEventListener("click", (evt) => this.onTitleClick(key, evt));
		title.addEventListener("auxclick", (evt) => this.onTitleAuxClick(key, evt));
		title.addEventListener("keydown", (evt) => {
			if (evt.key !== "Enter" && evt.key !== " ") return;
			evt.preventDefault();
			this.openTask(key, false);
		});
		title.addEventListener("contextmenu", (evt) => this.openTaskMenu(key, evt));

  this.elements = { timer, title, titleLabel, titleKey: null, titleSeq: 0, titleMode: 'text', titleLink: null, titleComponent: null };
  this.update(timer);
 }
 get title(): HTMLElement { return this.elements.title; }
 get titleLabel(): HTMLElement { return this.elements.titleLabel; }
 update(timer: TaskTitleModel): void { if (this.disposed) return; this.elements.timer = timer; this.elements.titleLabel.setText('Open ' + timer.title); this.updateTitle(timer.taskPath, this.elements); }
 dispose(): void { if (this.disposed) return; this.disposed = true; this.elements.titleSeq++; for (const owner of [...this.titleOwners]) this.releaseTitle(owner); this.elements.title.detach(); this.elements.titleLabel.detach(); this.unload(); }
 private releaseTitle(component: Component): void { if (this.titleOwners.delete(component)) this.removeChild(component); }
	/**
	 * Brings a card's title up to date. Synchronous: a text title updates at once, and a
	 * card already showing a chip or link keeps it until the new render is ready.
	 */
	private updateTitle(key: string, card: TitleElements): void {
		const next = titleRenderKey(card.timer);
		if (next === card.titleKey) return;
		card.titleKey = next;
		const seq = ++card.titleSeq;
		for (const owner of this.titleOwners) if (owner !== card.titleComponent) this.releaseTitle(owner);
		// A new card is never blank, and a text-mode rename shows immediately.
		if (card.titleMode === "text") this.showTitleText(card);
		const markdown = taskWikilink(card.timer.taskPath);
		const linkpath = taskLinkpath(card.timer.taskPath);
		if (markdown === null || linkpath === null) {
			this.showTitleText(card);
			return;
		}
		void this.renderTitleLink(key, card, seq, markdown, linkpath);
	}

	/**
	 * Renders "[[linkpath]]" through Obsidian's renderer so TaskNotes' post-processor can
	 * turn it into its chip (when TaskNotes' overlay setting is on). The task title never
	 * passes through the Markdown parser.
	 */
	private async renderTitleLink(
		key: string,
		card: TitleElements,
		seq: number,
		markdown: string,
		linkpath: string,
	): Promise<void> {
		const component = this.addChild(new Component());
		this.titleOwners.add(component);
		const wrapper = createDiv({ cls: "tntp-title__md" });
		const isCurrent = () => (this.disposed ? undefined : this.elements) === card && card.titleSeq === seq;
		try {
			await MarkdownRenderer.render(this.app, markdown, wrapper, "", component);
		} catch (error) {
			console.error(
				"[tasknotes-timer-pane] Rendering the task link failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
			this.releaseTitle(component);
			if (isCurrent()) this.showTitleText(card);
			return;
		}
		// The card was removed or re-rendered meanwhile: this render lost the race.
		if (!isCurrent()) {
			this.releaseTitle(component);
			return;
		}
		let link: HTMLAnchorElement | null = null;
		for (const candidate of Array.from(wrapper.querySelectorAll<HTMLAnchorElement>("a.internal-link"))) {
			if (candidate.getAttribute("data-href") === linkpath) {
				link = candidate;
				break;
			}
		}
		if (link) {
			// The plain link shows the pane's title, not the path. The container stays the
			// single tab stop, and dragging the title does not drop an app:// URL.
			link.setText(card.timer.title);
			link.setAttribute("tabindex", "-1");
			link.setAttribute("draggable", "false");
		} else if (wrapper.childElementCount === 0) {
			this.releaseTitle(component);
			this.showTitleText(card);
			return;
		}
		card.title.empty();
		card.title.appendChild(wrapper);
		if (card.titleComponent) this.releaseTitle(card.titleComponent);
		card.titleComponent = component;
		card.titleLink = link;
		card.titleMode = "markdown";
		this.applyTitleOwnership(card);
	}

	/** Plain title text (textContent only), releasing any rendered link. */
	private showTitleText(card: TitleElements): void {
		if (card.titleComponent) {
			this.releaseTitle(card.titleComponent);
			card.titleComponent = null;
		}
		card.titleLink = null;
		card.titleMode = "text";
		card.title.setText(card.timer.title);
		this.applyTitleOwnership(card);
	}

	/**
	 * True when clicks on the title are the pane's to handle: plain text, or the pane's
	 * own link is still in place. Evaluated at event time, so a chip that replaced the
	 * link at any moment is respected.
	 */
	private paneOwnsTitle(card: TitleElements): boolean {
		return card.titleMode === "text" || (card.titleLink !== null && card.title.contains(card.titleLink));
	}

	/**
	 * Over a chip the "Open task note" tooltip would mislead, since a chip click runs
	 * TaskNotes' single-click action. The accessible name still comes from aria-labelledby.
	 */
	private applyTitleOwnership(card: TitleElements): void {
		const owned = this.paneOwnsTitle(card);
		card.title.toggleClass("tntp-title--chip", !owned);
		if (owned) setTooltip(card.title, "Open task note");
		else card.title.removeAttribute("aria-label");
	}

	/** A click TaskNotes' chip handled (or one bubbling from its dots) never also opens the note. */
	private onTitleClick(key: string, evt: MouseEvent): void {
		const card = (this.disposed ? undefined : this.elements);
		if (!card || evt.defaultPrevented || !this.paneOwnsTitle(card)) return;
		// Stops the anchor's own navigation.
		evt.preventDefault();
		this.openTask(key, Keymap.isModEvent(evt));
	}

	/** Middle click opens a new tab, like a link in a note. */
	private onTitleAuxClick(key: string, evt: MouseEvent): void {
		if (evt.button !== 1) return;
		const card = (this.disposed ? undefined : this.elements);
		if (!card || evt.defaultPrevented || !this.paneOwnsTitle(card)) return;
		evt.preventDefault();
		this.openTask(key, Keymap.isModEvent(evt));
	}

	/** Opens a card's task note; a modifier click opens it in a new tab (DISP-01). */
	private openTask(key: string, newLeaf: PaneType | boolean): void {
		const card = (this.disposed ? undefined : this.elements);
		if (!card) return;
		this.app.workspace.openLinkText(card.timer.taskPath, "", newLeaf).catch((error: unknown) => {
			console.error(
				"[tasknotes-timer-pane] Opening the task note failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
		});
	}

	/**
	 * Right-click on a title: TaskNotes' native task menu. A chip TaskNotes rendered
	 * prevents the default itself, so an already-handled event is left alone (no
	 * TaskNotes class names involved). The target is read from the card at event time.
	 */
	private openTaskMenu(key: string, evt: MouseEvent): void {
		if (evt.defaultPrevented) return;
		const card = (this.disposed ? undefined : this.elements);
		if (!card) return;
		if (this.options.gateway.showTaskMenu(card.timer.taskPath, evt)) evt.preventDefault();
	}


}
