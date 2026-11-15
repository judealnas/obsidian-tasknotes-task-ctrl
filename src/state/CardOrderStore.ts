/*
 * Plugin-scoped card order, so it outlives the pane and is shared by every open pane.
 * main.ts creates exactly one. Runtime Obsidian-free so Vitest can load it.
 */
import { normalizeTimerPath } from "../model/pomodoroOwnership";

export interface CardOrderStoreDeps {
	log: (message: string) => void;
	/** Writes the order (main.ts merges it into data.json). Default: nothing to write. */
	persist?: (order: readonly string[]) => Promise<void>;
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((key, i) => key === b[i]);
}

export class CardOrderStore {
	private readonly log: (message: string) => void;
	private readonly persist: (order: readonly string[]) => Promise<void>;
	private order: string[] = [];
	private loaded = false;
	/** True when set() ran before load(): load then writes the in-memory order. */
	private changedBeforeLoad = false;
	private readonly listeners = new Set<() => void>();

	constructor(deps: CardOrderStoreDeps) {
		this.log = deps.log;
		this.persist = deps.persist ?? (() => Promise.resolve());
	}

	get(): readonly string[] {
		return [...this.order];
	}

	/** Membership transitions share IdleCardStore's awaited save. */
	prepend(key: string, visible: readonly string[] = []): void {
		const known = new Set(this.order);
		this.order = [...new Set([key, ...visible.filter(item => !known.has(item)), ...this.order.filter(item => item !== key)])]; this.notify();
	}
	replaceIdentity(from: string, to?: string): void {
		if (!this.order.includes(from)) return;
		this.order = [...new Set(this.order.flatMap(key => key === from ? to ? [to] : [] : key === to ? [] : [key]))]; this.notify();
	}
	changeIdlePath(from: string, to?: string): void {
		this.order = [...new Set(this.order.flatMap(key => {
			if (!key.startsWith("idle-task:")) return [key];
			const path = normalizeTimerPath(key.slice("idle-task:".length));
			if (path !== from && !path.startsWith(from + "/")) return [key];
			return to === undefined ? [] : ["idle-task:" + to + path.slice(from.length)];
		}))]; this.notify();
	}

	/** The stored order, once. An order set in memory before this call wins. */
	load(order: readonly string[]): void {
		if (this.loaded) return;
		this.loaded = true;
		if (!this.changedBeforeLoad) this.order = [...order];
		this.notify();
		if (this.changedBeforeLoad) this.save();
	}

	set(order: readonly string[]): void {
		if (sameOrder(order, this.order)) return;
		this.order = [...order];
		this.notify();
		if (this.loaded) this.save();
		else this.changedBeforeLoad = true;
	}
	/** Reorder visible identities while keeping temporarily hidden pending slots. */
	reorder(visible: readonly string[]): void {
		const remaining = [...visible]; const shown = new Set(remaining);
		const next = this.order.flatMap(key => shown.has(key) ? [remaining.shift()!] : key.startsWith("idle-task:") ? [key] : []);
		this.set([...next, ...remaining]);
	}

	/** A plain copy for data.json. */
	serialize(): string[] {
		return [...this.order];
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private save(): void {
		let result: Promise<void>;
		try {
			result = this.persist(this.serialize());
		} catch {
			result = Promise.reject(new Error("persist threw"));
		}
		// The message never carries a path or the underlying error text.
		result.catch(() => this.log("Saving card order failed."));
	}

	private notify(): void {
		for (const listener of [...this.listeners]) {
			try {
				listener();
			} catch {
				this.log("A card order listener failed.");
			}
		}
	}
}
