import { expect, test, vi } from "vitest";
import { configureStagedField } from "../src/tasknotes/configureStagedField";

test("setup registers once and preserves existing fields", async () => {
	const fields = [{ key: "owner", type: "text" }];
	const plugin = { settings: { userFields: fields }, saveSettings: vi.fn() };
	await configureStagedField(plugin);
	await configureStagedField(plugin);
	expect(fields).toHaveLength(2);
	expect(fields).toMatchObject([{ key: "owner", type: "text" }, { key: "staged", displayName: "Staged", type: "date" }]);
	expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
});

test("setup preserves a conflicting field and removes an unsaved addition on failure", async () => {
	const fields = [{ key: "staged", type: "text" }];
	const plugin = { settings: { userFields: fields }, saveSettings: vi.fn().mockRejectedValue(new Error()) };
	await configureStagedField(plugin);
	expect(plugin.saveSettings).not.toHaveBeenCalled();
	fields.pop();
	await expect(configureStagedField(plugin)).rejects.toThrow();
	expect(fields).toEqual([]);
});
