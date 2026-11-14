import { expect, test, vi } from "vitest";
import { StagedOrderStore, loadStagedOrder } from "../src/state/StagedOrderStore";
import { MAX_STORED_ORDER } from "../src/model/cardOrder";
import { deriveStaged, orderStaged } from "../src/model/staging";

test("untrusted order loading is normalized, deduplicated and bounded", () => {
	for (const data of [undefined, null, "text", [], { stagedOrder: false }, { stagedOrder: {} }]) expect(loadStagedOrder(data)).toEqual([]);
	expect(loadStagedOrder({ stagedOrder: [null, 42, "", "./Folder\\A.md", "Folder/A.md", "B.md"] })).toEqual(["Folder/A.md", "B.md"]);
	expect(loadStagedOrder({ stagedOrder: Array.from({ length: 2000 }, (_, i) => `${i}.md`) })).toHaveLength(MAX_STORED_ORDER);
});
test("copies are defensive, load is once-only, and explicit changes before load win", async () => {
	const persist = vi.fn(() => Promise.resolve()); const store = new StagedOrderStore({ persist, log: vi.fn() });
	store.set(["B.md", "A.md"]); expect(persist).not.toHaveBeenCalled(); store.load(["old.md"]); await Promise.resolve(); expect(store.get()).toEqual(["B.md", "A.md"]); expect(persist).toHaveBeenCalledTimes(1);
	const copy = store.serialize(); copy.pop(); expect(store.get()).toHaveLength(2); store.load([]); expect(store.get()).toHaveLength(2);
	store.set(["B.md", "A.md"]); expect(persist).toHaveBeenCalledTimes(1);
});
test("explicit reorder preserves hidden slots and changes only private order", () => {
	const persist = vi.fn(() => Promise.resolve()); const store = new StagedOrderStore({ persist, log: vi.fn() }); store.load(["A.md", "future.md", "B.md"]);
	store.reorder(["B.md", "A.md"]); expect(store.get()).toEqual(["B.md", "future.md", "A.md"]); expect(persist).toHaveBeenCalledTimes(1);
	store.set([]); expect(store.serialize()).toEqual([]);
});
test("exact and slash-bounded folder renames preserve relative priority and dedupe collisions", () => {
	const store = new StagedOrderStore({ log: vi.fn() }); store.load(["Folder/A.md", "Folder2/C.md", "Dest/B.md", "Folder/B.md"]);
	store.renamePath("Folder", "Dest"); expect(store.get()).toEqual(["Dest/A.md", "Folder2/C.md", "Dest/B.md"]);
	store.renamePath("Dest/A.md", "First.md"); expect(store.get()).toEqual(["First.md", "Folder2/C.md", "Dest/B.md"]);
	store.removePath("Dest"); expect(store.get()).toEqual(["First.md", "Folder2/C.md"]);
});
test("read observation appends deterministic arrivals and prunes only full absence plus missing file without saving", () => {
	const persist = vi.fn(() => Promise.resolve()); const store = new StagedOrderStore({ persist, log: vi.fn() }); store.load(["kept.md", "future.md", "gone.md"]);
	const items = deriveStaged(["Z", "B", "A"].map((name, i) => ({ title: name, path: `${name}.md`, status: "open", archived: false, staged: i === 0 ? "2026-11-13" : "2026-11-12" })), new Set(), "2026-11-14");
	const paths = new Set(["future.md", ...items.map(item => item.taskPath)]);
	store.observe(items, paths, path => path === "kept.md");
	expect(store.get()).toEqual(["kept.md", "future.md", "A.md", "B.md", "Z.md"]); store.observe(items, paths, path => path === "kept.md");
	expect(store.get()).toHaveLength(5); expect(persist).not.toHaveBeenCalled(); expect(orderStaged(items, store.get()).map(item => item.taskPath)).toEqual(["A.md", "B.md", "Z.md"]);
	store.observe([], new Set(), null); expect(store.get()).toHaveLength(5); store.observe([], new Set(), () => false); expect(store.get()).toEqual([]); expect(persist).not.toHaveBeenCalled();
});
test("persistence errors are caught for UI actions and remain visible to awaited command commits", async () => {
	const log = vi.fn(); const store = new StagedOrderStore({ log, persist: () => { throw new Error("private/path"); } }); store.load([]); store.set(["A.md"]); await Promise.resolve(); await Promise.resolve();
	expect(log).toHaveBeenCalledWith("Saving staged order failed."); await expect(store.commit()).rejects.toThrow();
});
