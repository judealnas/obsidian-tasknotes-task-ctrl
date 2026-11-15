import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { CardList } from "../src/ui/CardList";
import { orderTimers } from "../src/model/cardOrder";
import { Element, dom, event, hostDocument, resetViewHost, transfer } from "./fakes/viewHost";

type Model = { sessionKey: string; title: string; state?: string };
type Card = { card: HTMLElement; handle: HTMLButtonElement; model: Model; dispose: () => void };
const a = { sessionKey: "a", title: "Same title" };
const b = { sessionKey: "b", title: "Same title" };
function setup() {
	const root = new Element();
	const created: Card[] = [];
	const commit = vi.fn((keys: string[]) => { list.reconcile(keys.map(key => created.find(card => card.model.sessionKey === key)!.model)); });
	const list = new CardList<Model, Card>(dom(root), {
		key: model => model.sessionKey,
		create: (parent, model) => {
			const card = parent.createDiv({ cls: "tntp-card" });
			const handle = card.createEl("button", { attr: { draggable: "true" } });
			const item = { card, handle, model, dispose: vi.fn(() => card.detach()) }; created.push(item); return item;
		},
		update: (card, model) => { card.model = model; },
		dispose: card => card.dispose(),
		commitOrder: commit,
	});
	return { root, list, created, commit };
}
beforeEach(resetViewHost);
afterEach(() => vi.unstubAllGlobals());
test("keys distinguish equal titles, deduplicate repeats and support empty/single input", () => {
	const s = setup(); s.list.reconcile([]); expect(s.created).toHaveLength(0);
	s.list.reconcile([a]); expect(s.root.children).toHaveLength(1);
	s.list.reconcile([a, a, b]); expect(s.root.children).toHaveLength(2); expect(s.created).toHaveLength(2);
	expect([...s.list.values()].map(card => card.model.sessionKey)).toEqual(["a", "b"]);
	s.list.dispose();
});
test("unchanged order does not move nodes; pause/resume preserves identity and removal disposes once", () => {
	const s = setup(); s.list.reconcile([a, b]);
	const first = s.root.children[0]; const before = s.root.movements;
	s.list.reconcile([{ ...a, state: "paused" }, b]); s.list.reconcile([{ ...a, state: "running" }, b]);
	expect(s.root.children[0]).toBe(first); expect(s.root.movements).toBe(before);
	s.list.reconcile([b, a]); expect(s.root.movements - before).toBe(1);
	s.list.reconcile([b]); expect(s.created[0]!.dispose).toHaveBeenCalledTimes(1);
	s.list.dispose(); s.list.dispose(); expect(s.created[1]!.dispose).toHaveBeenCalledTimes(1);
	s.list.reconcile([a]); expect(s.root.children).toHaveLength(0);
});
test("caller keeps unseen-first order and equal-rank stability", () => {
	const s = setup(); const duplicate = { ...a, title: "Second instance" };
	const sorted = orderTimers([a, duplicate, b, { sessionKey: "c", title: "new" }], ["b", "a"]);
	expect(sorted.map(model => model.title)).toEqual(["new", "Same title", "Same title", "Second instance"]);
	s.list.reconcile(sorted); expect([...s.list.values()].map(card => card.model.sessionKey)).toEqual(["c", "b", "a"]); s.list.dispose();
});
test("keyboard reorders the mounted list and retains handle focus", () => {
	const s = setup(); s.list.reconcile([a, b]);
	const handle = s.created[0]!.handle as unknown as Element;
	event(handle, "keydown", { key: "ArrowDown" });
	expect(s.commit).toHaveBeenLastCalledWith(["b", "a"]); expect(hostDocument.activeElement).toBe(handle);
	expect(s.root.children[1]).toBe(s.created[0]!.card);
	event(handle, "keydown", { key: "ArrowUp" }); expect(s.commit).toHaveBeenLastCalledWith(["a", "b"]); s.list.dispose();
});
test("moveBy uses live keys and rejects missing, removed, boundary and disposed moves", () => {
 const s = setup(); s.list.reconcile([]);
 expect(s.list.moveBy("a", 1)).toBe(false);
 s.list.reconcile([a]); expect(s.list.moveBy("a", -1)).toBe(false); expect(s.list.moveBy("a", 1)).toBe(false);
 s.list.reconcile([a, b]); expect(s.list.moveBy("a", 1)).toBe(true);
 expect(s.commit).toHaveBeenCalledExactlyOnceWith(["b", "a"]);
 expect(s.list.moveBy("a", -1)).toBe(true);
 s.list.reconcile([b]); expect(s.list.moveBy("a", 1)).toBe(false);
 s.list.dispose(); expect(s.list.moveBy("b", -1)).toBe(false);
});
test("only a local handle drag authorizes reorder, independent across two lists", () => {
	const one = setup(); const two = setup(); one.list.reconcile([a, b]); two.list.reconcile([a, b]);
	const dataTransfer = transfer(); dataTransfer.setData("application/x-tntp-card", "a");
	event(two.root.children[1]!, "drop", { dataTransfer, clientY: 90 }); expect(two.commit).not.toHaveBeenCalled();
	event(one.root.children[0]!, "dragstart", { dataTransfer });
	event(one.root.children[1]!, "drop", { dataTransfer, clientY: 90 }); expect(one.commit).not.toHaveBeenCalled();
	event(one.created[0]!.handle as unknown as Element, "dragstart", { dataTransfer });
	event(two.root.children[1]!, "drop", { dataTransfer, clientY: 90 }); expect(two.commit).not.toHaveBeenCalled();
	const target = one.root.children[1]!;
	expect(event(target, "dragover", { dataTransfer, clientY: 90 }).defaultPrevented).toBe(true);
	expect(target.classes.has("tntp-card--drop-after")).toBe(true);
	event(target, "drop", { dataTransfer, clientY: 90 }); expect(one.commit).toHaveBeenLastCalledWith(["b", "a"]);
	expect(target.classes.has("tntp-card--drop-after")).toBe(false);
	expect(one.root.children[0]).not.toBe(two.root.children[0]); one.list.dispose(); two.list.dispose();
});
test("drag end/removal cancels authority and detached handles cannot commit", () => {
	const s = setup(); s.list.reconcile([a, b]); const handle = s.created[0]!.handle as unknown as Element;
	event(handle, "dragstart"); event(handle, "dragend"); event(s.root.children[1]!, "drop"); expect(s.commit).not.toHaveBeenCalled();
	event(handle, "dragstart"); s.list.reconcile([b]);
	event(s.root.children[0]!, "drop"); event(handle, "keydown", { key: "ArrowDown" }); expect(s.commit).not.toHaveBeenCalled(); s.list.dispose();
});
