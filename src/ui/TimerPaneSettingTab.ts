import { fieldStatus } from "../model/stagedField";
import { Notice, PluginSettingTab, Setting, type App, type Plugin, type DropdownComponent } from "obsidian";
import { resolveCompletionStatus, type TimerPaneSettings } from "../settings";
import type { TaskNotesGateway } from "../tasknotes/TaskNotesBridge";
import type { TaskStatus } from "../tasknotes/runtime-api.types";

export interface TimerPaneSettingDeps {
	gateway: Pick<TaskNotesGateway, "statuses" | "userFields">;
	getSettings: () => TimerPaneSettings;
	saveSettings: (settings: TimerPaneSettings) => Promise<void>;
	configureStaged: () => Promise<string>;
	ready: () => Promise<void>;
}

export class TimerPaneSettingTab extends PluginSettingTab {
	private generation = 0;
	private configuring = false;
	constructor(app: App, plugin: Plugin, private readonly deps: TimerPaneSettingDeps) { super(app, plugin); }

	display(): void { void this.render(++this.generation); }
	hide(): void { this.generation++; }

	private async render(generation: number): Promise<void> {
		this.containerEl.empty();
		let statuses: TaskStatus[] = [];
		let unavailable = false;
		try { await this.deps.ready(); statuses = await this.deps.gateway.statuses(); }
		catch { unavailable = true; }
		let configured = false;
		try {
			const field = fieldStatus(await this.deps.gateway.userFields());
			configured = field.kind === "ok" && !field.hasDefault;
		} catch { /* Keep setup available when the catalog cannot be read. */ }
		if (generation !== this.generation) return;
		const setup = new Setting(this.containerEl)
			.setName("Staged field in TaskNotes")
			.setDesc("Adds a custom date field with the key staged and no default to the TaskNotes settings for this vault. Only the field registration is saved. Existing notes, field definitions, and task form layouts are preserved.")
			.addButton(button => {
				if (!configured) button.setCta();
				button.setButtonText("Configure staged field").setDisabled(configured || this.configuring).onClick(async () => {
					if (configured || this.configuring) return;
					this.configuring = true;
					button.setDisabled(true);
					try { new Notice(await this.deps.configureStaged()); }
					catch { new Notice("Couldn't finish staged field setup. Check TaskNotes settings and try again."); }
					finally { this.configuring = false; if (generation === this.generation) this.display(); }
				});
			});
		if (configured) {
			setup.descEl.createDiv({ cls: "tntp-settings-success", text: "TaskNotes is appropriately configured for staging." });
		}
		const completed = statuses.filter(status => status.isCompleted === true);
		const preference = this.deps.getSettings().completionStatus;
		const validExplicit = preference !== null && completed.some(status => status.value === preference);
		const resolved = resolveCompletionStatus(statuses, preference);
		const description = unavailable ? "TaskNotes statuses are unavailable. Try opening these settings again when TaskNotes is ready."
			: !resolved ? "TaskNotes has no completed statuses. Complete is disabled until one is available."
			: preference !== null && !validExplicit ? "The saved status is unavailable. Same as TaskNotes uses the first completed status."
			: "Same as TaskNotes uses the first completed status. Recurring tasks complete an occurrence instead of closing the series.";
		new Setting(this.containerEl)
			.setName("Completion status")
			.setDesc(description)
			.addDropdown(dropdown => {
				dropdown.addOption("default", "Same as TaskNotes");
				completed.forEach((status, index) => { dropdown.addOption(String(index), status.label ?? status.value); });
				dropdown.setValue(validExplicit ? String(completed.findIndex(status => status.value === preference)) : "default");
				dropdown.onChange(value => {
					const choice = value === "default" ? null : completed[Number(value)]?.value;
					if (choice !== undefined && generation === this.generation) {
						void this.savePatch(dropdown, generation, { completionStatus: choice }, "Couldn't save the completion status. Try again.");
					}
				});
			});
	}

	/** Saves one changed setting over the current ones, so no other setting is lost (D-07). */
	private async savePatch(dropdown: DropdownComponent, generation: number, patch: Partial<TimerPaneSettings>, failureMessage: string): Promise<void> {
		dropdown.setDisabled(true);
		try { await this.deps.saveSettings({ ...this.deps.getSettings(), ...patch }); }
		catch {
			try { new Notice(failureMessage); }
			catch { console.error("[tasknotes-timer-pane] Showing the settings Notice failed."); }
		}
		finally { if (generation === this.generation) this.display(); }
	}
}
