import { moveKey, moveKeyBy } from "../model/cardOrder";

export interface CardListCard {
	card: HTMLElement;
	handle: HTMLButtonElement;
	setPosition?: (index: number, count: number, move: (delta: -1 | 1) => void) => void;
}
export interface CardListOptions<K, C extends CardListCard> {
	key: (model: K) => string;
	create: (parent: HTMLElement, model: K) => C;
	update: (card: C, model: K) => void;
	dispose: (card: C) => void;
	commitOrder: (keys: string[]) => void;
	onMove?: (card: C, position: number, count: number) => void;
}

/** Independent keyed instances and local drag authority. Sorting belongs to the caller. */
export class CardList<K, C extends CardListCard = CardListCard> {
	private cards = new Map<string, C>();
	private dragKey: string | null = null;
	private disposed = false;
	constructor(private readonly parent: HTMLElement, private readonly options: CardListOptions<K, C>) {}
	values(): IterableIterator<C> { return this.cards.values(); }
	moveBy(key: string, delta: -1 | 1): boolean {
		if (this.disposed || !this.cards.has(key)) return false;
		return this.commitMove(moveKeyBy([...this.cards.keys()], key, delta), key);
	}
	private commitMove(keys: string[], key: string): boolean {
		const before = [...this.cards.keys()];
		if (keys.every((value, index) => value === before[index])) return false;
		const card = this.cards.get(key);
		if (!card) return false;
		this.options.commitOrder(keys);
		this.options.onMove?.(card, keys.indexOf(key) + 1, keys.length);
		return true;
	}
	reconcile(models: readonly K[]): void {
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
		for (const [key, card] of this.cards) if (!next.has(key)) this.options.dispose(card);
		this.cards = next;
		if (this.dragKey !== null && !next.has(this.dragKey)) { this.dragKey = null; this.clearDragMarks(); }
		let i = 0;
		for (const card of next.values()) {
			if (this.parent.children[i] !== card.card) this.parent.insertBefore(card.card, this.parent.children[i] ?? null);
			i++;
		}
		i = 0;
		for (const [key, card] of next) card.setPosition?.(i++, next.size, delta => {
			if (!this.disposed && this.cards.get(key) === card) this.moveBy(key, delta);
		});
	}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.dragKey = null;
		this.clearDragMarks();
		for (const card of this.cards.values()) this.options.dispose(card);
		this.cards.clear();
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
		handle.addEventListener("dragend", () => { if (current()) { this.dragKey = null; this.clearDragMarks(); } });
		card.addEventListener("dragover", evt => {
			if (!current() || this.dragKey === null || this.dragKey === key) return;
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
			evt.preventDefault();
			const rect = card.getBoundingClientRect();
			const after = evt.clientY > rect.top + rect.height / 2;
			this.dragKey = null;
			this.clearDragMarks();
			this.commitMove(moveKey([...this.cards.keys()], dragKey, key, after), dragKey);
		});
	}
}
