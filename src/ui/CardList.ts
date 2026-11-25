import { moveKey, moveKeyBy } from "../model/cardOrder";

export interface CardListCard {
	card: HTMLElement;
	handle: HTMLButtonElement;
	setPosition?: (index: number, count: number, move: (delta: -1 | 1) => void) => void;
	setGroup?: (followingSiblings: readonly boolean[], expanded: boolean | null, toggle: () => void) => void;
}
export interface CardListOptions<K, C extends CardListCard> {
	key: (model: K) => string;
	create: (parent: HTMLElement, model: K) => C;
	update: (card: C, model: K) => void;
	dispose: (card: C) => void;
	commitOrder: (keys: string[]) => void;
	onMove?: (card: C, position: number, count: number) => void;
	insert?: (beforeKey: string | null) => void;
	canInsert?: () => boolean;
	scrollContainer?: HTMLElement;
}

/** Independent keyed instances and local drag authority. Sorting belongs to the caller. */
export class CardList<K, C extends CardListCard = CardListCard> {
	private cards = new Map<string, C>();
	private parents = new Map<string, string>();
	private siblings = new Map<string | undefined, string[]>();
	private collapsed = new Set<string>();
	private dragKey: string | null = null;
	private disposed = false;
	private insertions = new Map<string | null, HTMLButtonElement>();
	private scrollTimer: number | null = null;
	private scrollY = 0;
	private lastDragOver = 0;
	constructor(private readonly parent: HTMLElement, private readonly options: CardListOptions<K, C>) {
		options.scrollContainer?.addEventListener("dragover", this.scrollDragOver);
		options.scrollContainer?.addEventListener("drop", this.stopScrolling);
		options.scrollContainer?.addEventListener("dragleave", this.scrollDragLeave);
	}
	private scrollDragOver = (event: DragEvent): void => {
		if (this.disposed || this.dragKey === null) return;
		event.preventDefault();
		this.scrollY = event.clientY; this.lastDragOver = Date.now();
		if (this.scrollTimer === null) this.scrollTimer = window.setInterval(() => {
			const container = this.options.scrollContainer;
			if (!container || this.dragKey === null || Date.now() - this.lastDragOver > 500) { this.stopScrolling(); return; }
			const rect = container.getBoundingClientRect();
			const edge = Math.min(48, rect.height / 3);
			const distance = this.scrollY < rect.top + edge ? this.scrollY - rect.top - edge
				: this.scrollY > rect.bottom - edge ? this.scrollY - rect.bottom + edge : 0;
			container.scrollTop += Math.max(-18, Math.min(18, distance / 3));
		}, 16);
	};
	private scrollDragLeave = (event: DragEvent): void => {
		if (!event.relatedTarget || !this.options.scrollContainer?.contains(event.relatedTarget as Node)) this.stopScrolling();
	};
	private stopScrolling = (): void => {
		if (this.scrollTimer !== null) window.clearInterval(this.scrollTimer);
		this.scrollTimer = null;
	};
	values(): IterableIterator<C> { return this.cards.values(); }
	moveBy(key: string, delta: -1 | 1): boolean {
		if (this.disposed || !this.cards.has(key)) return false;
		return this.commitMove(moveKeyBy(this.siblingKeys(key), key, delta), key);
	}
	private siblingKeys(key: string): readonly string[] { return this.siblings.get(this.parents.get(key)) ?? []; }
	private commitMove(keys: string[], key: string): boolean {
		const before = this.siblingKeys(key);
		if (keys.every((value, index) => value === before[index])) return false;
		const card = this.cards.get(key);
		if (!card) return false;
		const parent = this.parents.get(key);
		let index = 0;
		const order = [...this.cards.keys()].map(candidate => this.parents.get(candidate) === parent ? keys[index++]! : candidate);
		this.options.commitOrder(order);
		this.options.onMove?.(card, keys.indexOf(key) + 1, keys.length);
		return true;
	}
	reconcile(models: readonly K[], parents?: ReadonlyMap<string, string>): void {
		if (this.disposed) return;
		const next = new Map<string, C>();
		for (const model of models) {
			const key = this.options.key(model);
			if (next.has(key)) continue;
			let card = this.cards.get(key);
			if (!card) {
				card = this.options.create(this.parent, model);
				this.wireHandle(card, key);
			}
			next.set(key, card);
			this.options.update(card, model);
		}
		for (const [key, card] of this.cards) if (!next.has(key)) {
			this.options.dispose(card);
			this.collapsed.delete(key);
		}
		this.cards = next;
		if (this.dragKey !== null && !next.has(this.dragKey)) { this.dragKey = null; this.stopScrolling(); this.clearDragMarks(); }
		this.parents = new Map(parents);
		this.siblings.clear();
		for (const key of next.keys()) {
			const parent = this.parents.get(key);
			let keys = this.siblings.get(parent);
			if (!keys) this.siblings.set(parent, keys = []);
			keys.push(key);
		}
		this.placeCards(parents !== undefined);
	}
	private placeCards(grouped: boolean): void {
		const nodes: HTMLElement[] = [];
		const positions = new Set<string | null>([...this.cards.keys(), null]);
		for (const [key, button] of this.insertions) if (!positions.has(key)) { button.detach(); this.insertions.delete(key); }
		const insertion = (beforeKey: string | null) => {
			if (!this.options.insert) return;
			let button = this.insertions.get(beforeKey);
			if (!button) {
				button = this.parent.createEl("button", { cls: "tntp-insert", text: "+", attr: { "aria-label": beforeKey === null ? "Stage tasks at the end" : "Stage tasks here" } });
				this.insertions.set(beforeKey, button);
				const current = button;
				button.addEventListener("click", () => {
					if (!this.disposed && this.insertions.get(beforeKey) === current && !current.disabled) this.options.insert?.(beforeKey);
				});
			}
			button.disabled = !(this.options.canInsert?.() ?? true);
			nodes.push(button);
		};
		const visit = (parent: string | undefined, ancestorGuides: readonly boolean[], hidden: boolean) => {
			const keys = this.siblings.get(parent) ?? [];
			keys.forEach((key, index) => {
				const card = this.cards.get(key)!;
				const hasChildren = this.siblings.has(key);
				const expanded = hasChildren && !this.collapsed.has(key);
				const guides = parent === undefined ? ancestorGuides : [...ancestorGuides, index < keys.length - 1];
				if (grouped) {
					card.card.hidden = hidden;
					card.setGroup?.(guides, hasChildren ? expanded : null, () => {
						if (this.disposed || this.cards.get(key) !== card || !this.siblings.has(key)) return;
						if (!this.collapsed.delete(key)) this.collapsed.add(key);
						this.placeCards(true);
					});
				}
				insertion(key);
				nodes.push(card.card);
				card.setPosition?.(index, keys.length, delta => {
					if (!this.disposed && this.cards.get(key) === card) this.moveBy(key, delta);
				});
				if (hasChildren) visit(key, guides, hidden || !expanded);
			});
		};
		visit(undefined, [], false);
		insertion(null);
		let i = 0;
		for (const node of nodes) {
			if (this.parent.children[i] !== node) this.parent.insertBefore(node, this.parent.children[i] ?? null);
			i++;
		}
	}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.dragKey = null;
		this.stopScrolling();
		this.options.scrollContainer?.removeEventListener("dragover", this.scrollDragOver);
		this.options.scrollContainer?.removeEventListener("drop", this.stopScrolling);
		this.options.scrollContainer?.removeEventListener("dragleave", this.scrollDragLeave);
		for (const button of this.insertions.values()) button.detach();
		this.insertions.clear();
		this.clearDragMarks();
		for (const card of this.cards.values()) this.options.dispose(card);
		this.cards.clear();
		this.parents.clear();
		this.siblings.clear();
		this.collapsed.clear();
	}
	private clearDropMarks(): void {
		for (const { card } of this.cards.values()) { card.removeClass("tntp-card--drop-before"); card.removeClass("tntp-card--drop-after"); }
	}
	private clearDragMarks(): void {
		this.clearDropMarks();
		for (const { card } of this.cards.values()) card.removeClass("tntp-card--dragging");
	}
	private wireHandle(item: C, key: string): void {
		const { card, handle } = item;
		// Identity checks also neutralize retained listeners after removal/replacement.
		const current = () => !this.disposed && this.cards.get(key) === item;
		handle.addEventListener("keydown", evt => {
			if (!current() || (evt.key !== "ArrowUp" && evt.key !== "ArrowDown")) return;
			evt.preventDefault();
			this.moveBy(key, evt.key === "ArrowUp" ? -1 : 1);
			if (handle.ownerDocument.activeElement !== handle) handle.focus();
		});
		handle.addEventListener("dragstart", evt => {
			if (!current()) return;
			this.dragKey = key;
			if (evt.dataTransfer) {
				evt.dataTransfer.effectAllowed = "move";
				evt.dataTransfer.setData("application/x-tntp-card", key);
				evt.dataTransfer.setDragImage(card, 0, 0);
			}
			card.addClass("tntp-card--dragging");
		});
		handle.addEventListener("dragend", () => { if (current()) { this.dragKey = null; this.stopScrolling(); this.clearDragMarks(); } });
		card.addEventListener("dragover", evt => {
			if (!current() || this.dragKey === null || this.dragKey === key) return;
			if (this.parents.get(this.dragKey) !== this.parents.get(key)) { this.clearDropMarks(); return; }
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
			const rect = card.getBoundingClientRect();
			const after = evt.clientY > rect.top + rect.height / 2;
			this.clearDropMarks();
			card.toggleClass("tntp-card--drop-before", !after);
			card.toggleClass("tntp-card--drop-after", after);
		});
		card.addEventListener("drop", evt => {
			const dragKey = this.dragKey;
			if (!current() || dragKey === null || dragKey === key) return;
			if (this.parents.get(dragKey) !== this.parents.get(key)) return;
			evt.preventDefault();
			const rect = card.getBoundingClientRect();
			const after = evt.clientY > rect.top + rect.height / 2;
			this.dragKey = null;
			this.stopScrolling();
			this.clearDragMarks();
			this.commitMove(moveKey(this.siblingKeys(key), dragKey, key, after), dragKey);
		});
	}
}
