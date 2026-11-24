import { fieldStatus, STAGED_FIELD_KEY } from "../model/stagedField";

interface TaskNotesSettingsHost {
	settings?: { userFields?: unknown; fieldMapping?: Record<string, unknown> };
	saveSettings?: () => Promise<void>;
}

/** TaskNotes has no public field registration API. Keep the internal write isolated here. */
export async function configureStagedField(plugin: unknown): Promise<string> {
	const host = plugin as TaskNotesSettingsHost | null;
	const fields = host?.settings?.userFields;
	if (!Array.isArray(fields) || typeof host?.saveSettings !== "function") {
		return "TaskNotes field setup is unavailable. Enable TaskNotes or use its Custom User Fields settings.";
	}
	const status = fieldStatus(fields);
	if (status.kind === "ok" && !status.hasDefault) return "The staged Date field is already configured.";
	if (status.kind !== "missing" || fields.some((field: unknown) => typeof field === "object" && field !== null && "key" in field && typeof field.key === "string" && field.key.trim() === STAGED_FIELD_KEY)
		|| Object.values(host.settings?.fieldMapping ?? {}).includes(STAGED_FIELD_KEY)) {
		return "TaskNotes already uses the staged key. Review its field settings and use type Date with no default.";
	}

	const field = { id: "field_" + crypto.randomUUID(), key: STAGED_FIELD_KEY, displayName: "Staged", type: "date" };
	fields.push(field);
	try {
		await host.saveSettings();
	} catch {
		const index = fields.indexOf(field);
		if (index >= 0) fields.splice(index, 1);
		throw new Error("TaskNotes could not save the staged field.");
	}
	return "Registered the staged Date field in TaskNotes.";
}
