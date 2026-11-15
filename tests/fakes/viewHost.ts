/** Deterministic DOM/lifecycle simulation; does not model native layout or TaskNotes chips. */
import { vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";

type Listener = { fn: (event: HostEvent) => void; capture: boolean };
// Resolve timers at call time so Vitest's clock controls the simulated host.
const schedule = {
	setInterval: (fn: () => void, ms: number) => { const timers = { setInterval }; return timers.setInterval(fn, ms); },
	clearInterval: (id: number) => { const timers = { clearInterval }; timers.clearInterval(id); },
};
export class HostEvent {
	defaultPrevented = false;
	stopped = false;
	target: Element | null = null;
	key = "";
	button = 0;
	ctrlKey = false;
	metaKey = false;
	clientY = 0;
	dataTransfer: ReturnType<typeof transfer> | null = null;
	constructor(public type: string, options: Partial<HostEvent> = {}) { Object.assign(this, options); }
	preventDefault(): void { this.defaultPrevented = true; }
	stopPropagation(): void { this.stopped = true; }
}
export function transfer() {
	const data = new Map<string, string>();
	return { effectAllowed: "", dropEffect: "", setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key) ?? "", setDragImage: vi.fn() };
}
class EventTarget {
	listeners = new Map<string, Listener[]>();
	addEventListener(type: string, fn: Listener["fn"], options?: boolean | { capture?: boolean }): void {
		const capture = typeof options === "boolean" ? options : options?.capture ?? false;
		this.listeners.set(type, [...this.listeners.get(type) ?? [], { fn, capture }]);
	}
	removeEventListener(type: string, fn: Listener["fn"]): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.fn !== fn)); }
	dispatchEvent(event: HostEvent): boolean { this.fire(event, true); this.fire(event, false); return !event.defaultPrevented; }
	fire(event: HostEvent, capture: boolean): void { for (const item of this.listeners.get(event.type) ?? []) if (item.capture === capture && !event.stopped) item.fn(event); }
}
export const viewHost = {
	components: [] as Component[],
	renders: [] as Array<{ wrapper: Element; component: Component; markdown: string; resolve: (mode?: "link" | "chip" | "empty") => void; reject: (error: Error) => void }>,
};
export const hostWindow = new EventTarget();
export const hostDocument = Object.assign(new EventTarget(), { activeElement: null as Element | null, visibilityState: "visible", win: hostWindow });
export class Element extends EventTarget {
	children: Element[] = [];
	parentElement: Element | null = null;
	attrs = new Map<string, string>();
	classes = new Set<string>();
	private text = "";
	disabled = false;
	shown = true;
	movements = 0;
	ownerDocument = hostDocument;
	doc = hostDocument;
	win = hostWindow;
	constructor(public tagName = "div", options?: { cls?: string | string[]; text?: string; attr?: Record<string, string> }) {
		super();
		for (const cls of typeof options?.cls === "string" ? options.cls.split(" ") : options?.cls ?? []) this.classes.add(cls);
		this.text = options?.text ?? "";
		for (const [key, value] of Object.entries(options?.attr ?? {})) this.setAttribute(key, value);
	}
	get textContent(): string { return this.text + this.children.map(child => child.textContent).join(""); }
	set textContent(text: string) { this.empty(); this.text = text; }
	get childElementCount(): number { return this.children.length; }
	get firstElementChild(): Element | null { return this.children[0] ?? null; }
	get classList() { return { contains: (cls: string) => this.classes.has(cls) }; }
	createEl(tag: string, options?: ConstructorParameters<typeof Element>[1]): Element { const child = new Element(tag, options); this.appendChild(child); return child; }
	createDiv(options?: ConstructorParameters<typeof Element>[1]): Element { const child = new Element("div", options); this.appendChild(child); return child; }
	createSpan(options?: ConstructorParameters<typeof Element>[1]): Element { const child = new Element("span", options); this.appendChild(child); return child; }
	setText(text: string): void { this.textContent = text; }
	empty(): void { for (const child of this.children) child.parentElement = null; this.children = []; this.text = ""; }
	appendChild(child: Element): Element { child.detach(); this.children.push(child); child.parentElement = this; return child; }
	insertBefore(child: Element, before: Element | null): Element { this.movements++; child.detach(); const i = before ? this.children.indexOf(before) : this.children.length; this.children.splice(i, 0, child); child.parentElement = this; return child; }
	detach(): void { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
	contains(other: Element): boolean { return other === this || this.children.some(child => child.contains(other)); }
	addClass(...classes: string[]): void { classes.forEach(cls => this.classes.add(cls)); }
	removeClass(...classes: string[]): void { classes.forEach(cls => this.classes.delete(cls)); }
	toggleClass(cls: string, value: boolean): void { if (value) this.addClass(cls); else this.removeClass(cls); }
	setAttribute(key: string, value: string): void { this.attrs.set(key, value); }
	getAttribute(key: string): string | null { return this.attrs.get(key) ?? null; }
	removeAttribute(key: string): void { this.attrs.delete(key); }
	focus(): void { hostDocument.activeElement = this; }
	isShown(): boolean { return this.shown; }
	getBoundingClientRect(): { top: number; height: number } { return { top: 0, height: 100 }; }
	querySelectorAll<T = Element>(selector: string): T[] {
		const matches = (el: Element) => selector.startsWith(".") ? el.classes.has(selector.slice(1)) : selector.includes(".") ? el.tagName === selector.split(".")[0] && el.classes.has(selector.split(".")[1]!) : el.tagName === selector;
		return this.children.flatMap(child => [...matches(child) ? [child as T] : [], ...child.querySelectorAll<T>(selector)]);
	}
	querySelector<T = Element>(selector: string): T | null { return this.querySelectorAll<T>(selector)[0] ?? null; }
	override dispatchEvent(event: HostEvent): boolean {
		event.target ??= this;
		const path: Element[] = [];
		path.push(this);
		for (let el = this.parentElement; el; el = el.parentElement) path.push(el);
		for (const el of [...path].reverse()) el.fire(event, true);
		for (const el of path) el.fire(event, false);
		return !event.defaultPrevented;
	}
}
export class Component {
	children = new Set<Component>();
	cleanups: Array<() => void> = [];
	loads = 0;
	unloads = 0;
	constructor() { viewHost.components.push(this); }
	load(): void { this.loads++; }
	unload(): void { this.unloads++; for (const child of this.children) child.unload(); this.children.clear(); for (const cleanup of this.cleanups.splice(0)) cleanup(); }
	addChild<T extends Component>(child: T): T { this.children.add(child); child.load(); return child; }
	removeChild<T extends Component>(child: T): T { if (this.children.delete(child)) child.unload(); return child; }
	register(cleanup: () => void): void { this.cleanups.push(cleanup); }
	registerInterval(id: number): void { this.register(() => schedule.clearInterval(id)); }
	registerDomEvent(target: EventTarget, type: string, fn: Listener["fn"]): void { target.addEventListener(type, fn); this.register(() => target.removeEventListener(type, fn)); }
}
export const workspace = { openLinkText: vi.fn(() => Promise.resolve()), requestSaveLayout: vi.fn() };
export class ItemView extends Component {
	containerEl = new Element();
	contentEl = this.containerEl.createDiv();
	app = { workspace };
	constructor(public leaf: WorkspaceLeaf) { super(); }
	getState(): Record<string, unknown> { return {}; }
	setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
}
export class SuggestModal {}
export const Keymap = { isModEvent: (event: HostEvent) => event.button === 1 ? "tab" : event.ctrlKey || event.metaKey };
export const Platform = { isMobile: false };
export const MarkdownRenderer = {
	render: (_app: unknown, markdown: string, wrapper: Element, _source: string, component: Component) => new Promise<void>((resolve, reject) => {
		viewHost.renders.push({ wrapper, component, markdown, reject, resolve: (mode = "link") => {
			if (mode === "link") wrapper.createEl("a", { cls: "internal-link", attr: { "data-href": markdown.slice(2, -2) } });
			if (mode === "chip") wrapper.createSpan({ text: "Simulated chip" });
			resolve();
		} });
	}),
};
export function setIcon(el: Element, name: string): void { el.setAttribute("data-icon", name); }
export function setTooltip(el: Element, text: string): void { el.setAttribute("aria-label", text); }
export class Notice {}
export function resetViewHost(): void {
	Platform.isMobile = false;
	viewHost.components = []; viewHost.renders = []; workspace.openLinkText.mockClear(); workspace.requestSaveLayout.mockReset();
	hostDocument.activeElement = null; hostDocument.visibilityState = "visible"; hostDocument.listeners.clear(); hostWindow.listeners.clear();
	vi.stubGlobal("createDiv", (options?: ConstructorParameters<typeof Element>[1]) => new Element("div", options));
	vi.stubGlobal("window", Object.assign(hostWindow, { setInterval: schedule.setInterval }));
}
export function dom(el: Element): HTMLElement { return el as unknown as HTMLElement; }
export function event(el: Element, type: string, options?: Partial<HostEvent>): HostEvent { const evt = new HostEvent(type, options); el.dispatchEvent(evt); return evt; }
export async function flush(): Promise<void> { for (let i = 0; i < 8; i++) await Promise.resolve(); }
