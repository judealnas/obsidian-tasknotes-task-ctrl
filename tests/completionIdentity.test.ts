import { expect, test } from "vitest";
import { completedIdentity } from "../src/model/completionIdentity";
const parent = { path: "series.md", title: "Series", status: "open", archived: false, recurrence: "FREQ=DAILY", complete_instances: ["2026-11-14"] };
const child = { path: "instance.md", title: "Instance", status: "done", archived: false, recurrence_parent: "[[series]]", occurrence_date: "2026-11-14" };
test("materialized occurrence status takes precedence over parent history", () => {
	expect(completedIdentity(parent.path, "2026-11-14", [parent, child], new Set(["done"]))?.path).toBe(child.path);
	expect(completedIdentity(parent.path, "2026-11-14", [parent, { ...child, status: "open" }], new Set(["done"]))).toBeNull();
	expect(completedIdentity(parent.path, "2026-11-15", [parent, child], new Set(["done"]))).toBeNull();
});
