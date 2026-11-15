import { MAX_STORED_ORDER } from "../model/cardOrder";
import { normalizeTimerPath } from "../model/pomodoroOwnership";
import type { StagedItem } from "../model/staging";

function clean(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const result = new Set<string>();
	for (const value of (raw as unknown[]).slice(0, MAX_STORED_ORDER)) {
		if (typeof value !== "string") continue;
		const path = normalizeTimerPath(value); if (path) result.add(path);
	}
	return [...result];
}
export function loadStagedOrder(data: unknown): string[] {
	return typeof data === "object" && data !== null && !Array.isArray(data) ? clean((data as { stagedOrder?: unknown }).stagedOrder) : [];
}
function under(path: string, target: string): boolean { return path === target || path.startsWith(target + "/"); }
export interface StagedOrderStoreDeps { log: (message: string) => void; persist?: () => Promise<void>; }

/** Private ordering cache. Observation never saves; explicit user actions do. */
export class StagedOrderStore {
	private order: string[] = [];
	private loaded = false;
	private changedBeforeLoad = false;
	private readonly listeners = new Set<() => void>();
	constructor(private readonly deps: StagedOrderStoreDeps) {}
	get(): readonly string[] { return [...this.order]; }
	serialize(): string[] { return [...this.order]; }
	load(order: readonly string[]): void {
		if (this.loaded) return;
		this.loaded = true;
		if (!this.changedBeforeLoad) this.order = clean(order);
		this.notify(); if (this.changedBeforeLoad) this.save();
	}
	subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
	set(order: readonly string[]): void { if (this.replace(order)) this.save(); }
	/** Replace visible slots, keeping temporarily hidden paths at their saved positions. */
	reorder(visible: readonly string[]): void {
		const remaining = clean(visible); const visibleSet = new Set(remaining);
		const next = this.order.map(path => visibleSet.has(path) ? remaining.shift()! : path);
		this.set([...next, ...remaining]);
	}
	append(path: string): void { if (this.replace([...this.order, path]) && !this.loaded) this.changedBeforeLoad = true; }
	insertBefore(path: string, beforePath?: string | null): void {
		const next = this.order.filter(item => item !== path);
		const index = beforePath ? next.indexOf(beforePath) : -1;
		next.splice(index < 0 ? next.length : index, 0, path);
		if (this.replace(next) && !this.loaded) this.changedBeforeLoad = true;
	}
	removePath(path: string, persist = true): void {
		const target = normalizeTimerPath(path); if (!target) return;
		if (this.replace(this.order.filter(item => !under(item, target))) && persist) this.save();
	}
	renamePath(oldPath: string, newPath: string): void {
		const from = normalizeTimerPath(oldPath); const to = normalizeTimerPath(newPath);
		if (!from || !to || from === to) return;
		if (this.replace(this.order.map(path => under(path, from) ? to + path.slice(from.length) : path))) this.save();
	}
	/** Full task paths establish existence; eligible membership alone never proves deletion. */
	observe(items: readonly StagedItem[], authoritativePaths: ReadonlySet<string>, exists: ((path: string) => boolean) | null): void {
		if (!this.loaded) return;
		const kept = this.order.filter(path => authoritativePaths.has(path) || !exists || exists(path));
		const known = new Set(kept);
		const arrivals = items.filter(item => !known.has(item.taskPath)).slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.taskPath < b.taskPath ? -1 : a.taskPath > b.taskPath ? 1 : 0);
		this.replace([...kept, ...arrivals.map(item => item.taskPath)]);
	}
	/** Awaited by explicit Stage/Unstage to report order-save failure separately. */
	async commit(): Promise<void> { if (this.loaded) await this.deps.persist?.(); }
	private replace(order: readonly string[]): boolean {
		const next = clean(order);
		if (next.length === this.order.length && next.every((path, i) => path === this.order[i])) return false;
		this.order = next; this.notify(); return true;
	}
	private save(): void {
		if (!this.loaded) { this.changedBeforeLoad = true; return; }
		void this.commit().catch(() => this.deps.log("Saving staged order failed."));
	}
	private notify(): void { for (const listener of [...this.listeners]) { try { listener(); } catch { this.deps.log("A staged order listener failed."); } } }
}
