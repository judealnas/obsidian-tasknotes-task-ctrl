/** Minimal public-host seams for settings and startup tests; no native Obsidian process. */
export const host = {
	order: [] as string[], data: undefined as unknown, saved: [] as unknown[], notices: [] as string[],
	settings: [] as Setting[], tabs: [] as PluginSettingTab[], failSave: false,
	/** vault.on handlers by event name, in registration order. */
	vaultHandlers: {} as Record<string, Array<(...args: unknown[]) => unknown>>,
	workspaceHandlers: {} as Record<string, Array<(...args: unknown[]) => unknown>>,
	/** Callbacks passed to workspace.onLayoutReady; a test fires them. */
	layoutReady: [] as Array<() => void>,
	/** Paths vault.getFileByPath finds. */
	files: new Set<string>(),
	viewTypes: [] as string[], commands: [] as Array<{ id: string; name: string }>, ribbonLabels: [] as string[],
};
export function resetHost(): void {
	host.order = []; host.data = undefined; host.saved = []; host.notices = [];
	host.settings = []; host.tabs = []; host.failSave = false;
	host.vaultHandlers = {}; host.workspaceHandlers = {}; host.layoutReady = []; host.files = new Set();
	host.viewTypes = []; host.commands = []; host.ribbonLabels = [];
}
/** Fires every vault handler registered for `name`. */
export function emitVault(name: string, ...args: unknown[]): void {
	for (const handler of host.vaultHandlers[name] ?? []) handler(...args);
}
/** Runs every onLayoutReady callback, as Obsidian does once the layout is ready. */
export function fireLayoutReady(): void {
	for (const callback of host.layoutReady) callback();
}
export class Element {
	empty(): void { host.settings = []; }
}
export class Dropdown {
	options: Array<{ value: string; label: string }> = [];
	value = "";
	disabled = false;
	change: (value: string) => void = () => undefined;
	addOption(value: string, label: string): this { this.options.push({ value, label }); return this; }
	setValue(value: string): this { this.value = value; return this; }
	setDisabled(value: boolean): this { this.disabled = value; return this; }
	onChange(callback: (value: string) => void): this { this.change = callback; return this; }
}
class SettingsButton {
	setCta(): this { return this; }
	setButtonText(_text: string): this { return this; }
	setDisabled(_disabled: boolean): this { return this; }
	onClick(_callback: () => Promise<void>): this { return this; }
}
export class Setting {
	descEl = { createDiv: (_options: unknown) => undefined };
	addButton(callback: (button: SettingsButton) => void): this { callback(new SettingsButton()); return this; }
	name = "";
	description = "";
	dropdown = new Dropdown();
	constructor(_container: Element) { host.settings.push(this); }
	setName(name: string): this { this.name = name; return this; }
	setDesc(description: string): this { this.description = description; return this; }
	addDropdown(callback: (dropdown: Dropdown) => void): this { callback(this.dropdown); return this; }
}
export class Component {}
export class ItemView extends Component {}
export class SuggestModal {}
export const Keymap = {};
export const Platform = { isMobile: false };
export const MarkdownRenderer = {};
export function setIcon(): void {}
export function setTooltip(): void {}
export class Notice { constructor(message: string) { host.notices.push(message); } }
export class TFile {
	constructor(public path: string) {}
	get basename(): string { return this.path.split("/").pop()!.replace(/\.[^.]+$/, ""); }
}
export class Plugin {
	app = {
		workspace: {
			onLayoutReady: (callback: () => void) => { host.layoutReady.push(callback); },
			on: (name: string, handler: (...args: unknown[]) => unknown) => {
				(host.workspaceHandlers[name] ??= []).push(handler);
				return {};
			},
		},
		vault: {
			on: (name: string, handler: (...args: unknown[]) => unknown) => {
				(host.vaultHandlers[name] ??= []).push(handler);
				return {};
			},
			getFileByPath: (path: string) => (host.files.has(path) ? { path } : null),
		},
	};
	register(): void {}
	registerView(type: string): void { host.order.push("view"); host.viewTypes.push(type); }
	addSettingTab(tab: PluginSettingTab): void { host.order.push("settings"); host.tabs.push(tab); }
	loadData(): Promise<unknown> { host.order.push("load"); return Promise.resolve(host.data); }
	saveData(data: unknown): Promise<void> {
		if (host.failSave) return Promise.reject(new Error("private/path"));
		host.saved.push(data); return Promise.resolve();
	}
	addRibbonIcon(_icon: string, label: string): void { host.ribbonLabels.push(label); }
	addCommand(command: { id: string; name: string }): void { host.commands.push({ id: command.id, name: command.name }); }
	registerInterval(): void {}
	registerEvent(): void {}
}
export class PluginSettingTab {
	containerEl = new Element();
	constructor(_app: unknown, _plugin: unknown) {}
}
