/* eslint-disable @typescript-eslint/unbound-method -- Assertions inspect mock methods without invoking them. */
import { expect, test, vi } from "vitest";
import { CardRelationships, type CardRelationshipSnapshot } from "../src/state/CardRelationships";
import type { TaskInfo } from "../src/tasknotes/runtime-api.types";
import { createFakeGateway } from "./fakes/fakeGateway";

const task = (path: string, status = "open"): TaskInfo => ({ path, title: path, status, archived: false });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() {
 let resolve!: (value: T) => void;
 const promise = new Promise<T>(done => { resolve = done; });
 return { promise, resolve };
}

test("cards share reads, honor custom completed statuses, and remove duplicate/self links", async () => {
 const gateway = createFakeGateway();
 gateway.parents = vi.fn(async () => [task("Parent.md"), task("Parent.md"), task("A.md")]);
 gateway.subtasks = vi.fn(async () => [task("Child.md", "finished"), task("Child.md")]);
 gateway.statuses = vi.fn(async () => [{ value: "finished", label: "Finished", isCompleted: true }]);
 const store = new CardRelationships(gateway);
 const first = vi.fn(); const second = vi.fn();
 store.subscribe("./A.md", first); store.subscribe("A.md", second);
 await settle();
 expect(gateway.parents).toHaveBeenCalledTimes(1);
 expect(gateway.subtasks).toHaveBeenCalledTimes(1);
 expect(second).toHaveBeenLastCalledWith({ parents: [task("Parent.md")], subtasks: [task("Child.md")], completedStatuses: ["finished"] });
 store.subscribe("B.md", vi.fn()); await settle();
 expect(gateway.statuses).toHaveBeenCalledTimes(1);
 store.dispose();
});

test("failed optional reads preserve the other relationship and unknown statuses remain unknown", async () => {
 const gateway = createFakeGateway();
 gateway.parents = async () => { throw new Error("unsupported"); };
 gateway.subtasks = async () => [task("Child.md")];
 gateway.statuses = async () => { throw new Error("offline"); };
 const store = new CardRelationships(gateway); const show = vi.fn();
 store.subscribe("A.md", show); await settle();
 expect(show).toHaveBeenLastCalledWith({ parents: [], subtasks: [task("Child.md")], completedStatuses: null });
 store.dispose();
});

test("task changes coalesce and stale async results cannot overwrite fresh relationships", async () => {
 const gateway = createFakeGateway(); const old = deferred<TaskInfo[]>();
 gateway.subtasks = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue([task("New.md")]);
 const store = new CardRelationships(gateway); const seen: Array<CardRelationshipSnapshot | null> = [];
 store.subscribe("A.md", value => seen.push(value)); await settle();
 gateway.emitData(); gateway.emitData(); await settle();
 expect(gateway.subtasks).toHaveBeenCalledTimes(2);
 expect(seen[seen.length - 1]?.subtasks).toEqual([task("New.md")]);
 old.resolve([task("Old.md")]); await settle();
 expect(seen[seen.length - 1]?.subtasks).toEqual([task("New.md")]);
 store.dispose();
});

test("disconnect clears data and reconnect refetches; disposed service ignores later events", async () => {
 const gateway = createFakeGateway(); gateway.subtasks = vi.fn(async () => [task("Child.md")]);
 const store = new CardRelationships(gateway); const show = vi.fn();
 store.subscribe("A.md", show); await settle();
 gateway.setState({ kind: "missing" }); await settle(); expect(show).toHaveBeenLastCalledWith(null);
 gateway.setState({ kind: "ready" }); await settle(); expect(gateway.subtasks).toHaveBeenCalledTimes(2);
 store.dispose(); show.mockClear(); gateway.emitData(); await settle();
 expect(show).not.toHaveBeenCalled(); expect(gateway.subtasks).toHaveBeenCalledTimes(2);
});

test("at most four cards read concurrently and unsubscribed queued cards are skipped", async () => {
 const gateway = createFakeGateway(); const pending: Array<ReturnType<typeof deferred<TaskInfo[]>>> = [];
 gateway.subtasks = vi.fn(() => { const read = deferred<TaskInfo[]>(); pending.push(read); return read.promise; });
 const store = new CardRelationships(gateway);
 for (let i = 0; i < 4; i++) store.subscribe(`${i}.md`, vi.fn());
 const remove = store.subscribe("Queued.md", vi.fn());
 store.subscribe("Last.md", vi.fn()); await settle();
 expect(gateway.subtasks).toHaveBeenCalledTimes(4);
 remove(); pending[0]!.resolve([]); await settle();
 expect(gateway.subtasks).toHaveBeenCalledTimes(5);
 expect(gateway.subtasks).toHaveBeenLastCalledWith("Last.md");
 store.dispose(); for (const read of pending) read.resolve([]); await settle();
});

test("unsubscribing and disposal prevent late delivery", async () => {
 const gateway = createFakeGateway(); const pending = deferred<TaskInfo[]>();
 gateway.subtasks = () => pending.promise;
 const store = new CardRelationships(gateway); const show = vi.fn();
 const off = store.subscribe("A.md", show); await settle(); off(); show.mockClear();
 pending.resolve([task("Child.md")]); await settle(); expect(show).not.toHaveBeenCalled();
 store.dispose();
});



/* eslint-enable @typescript-eslint/unbound-method -- End of mock assertions. */

