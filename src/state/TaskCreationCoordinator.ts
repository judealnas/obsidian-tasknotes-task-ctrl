import type { App } from "obsidian";
import type { TaskNotesBridge } from "../tasknotes/TaskNotesBridge";
import type { TaskInfo } from "../tasknotes/runtime-api.types";

export const CREATE_TASK_COMMAND_ID = "tasknotes:create-new-task";
const MODAL_OPEN_TIMEOUT_MS = 1000;

interface CommandManagerLike {
	findCommand(id: string): unknown;
	executeCommandById(id: string): boolean;
}

interface TaskCreationCoordinatorDeps {
	app: App;
	gateway: Pick<TaskNotesBridge, "taskCreationAvailability" | "onTaskCreated" | "onState">;
	notify: (message: string) => void;
	log: (message: string) => void;
}

interface PendingRequest {
	token: symbol;
	document: Document;
	existingModals: Set<HTMLElement>;
	modal: HTMLElement | null;
	offTask: () => void;
	offState: () => void;
	observer: MutationObserver;
	timeout: number;
}

/** Owns the one native TaskNotes creation request shared by every pane leaf. */
export class TaskCreationCoordinator {
	private pending: PendingRequest | null = null;
	private disposed = false;
	private readonly listeners = new Set<() => void>();

	constructor(private readonly deps: TaskCreationCoordinatorDeps) {}

	isBusy(): boolean { return this.pending !== null; }

	availability(): { available: boolean; reason: string } {
		if (this.disposed) return { available: false, reason: "Task creation is unavailable" };
		if (this.pending) return { available: false, reason: "Another task creation dialog is open" };
		return this.baseAvailability();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	start(document: Document, onCreated: (task: TaskInfo) => void | Promise<void>): boolean {
		if (this.pending) this.cancel(this.pending.token);
		const gate = this.baseAvailability();
		if (!gate.available) {
			this.safeNotify(gate.reason);
			return false;
		}

		const commands = this.commands();
		if (!commands) return false;
		const token = Symbol("task-creation-request");
		const existingModals = new Set(document.querySelectorAll<HTMLElement>(".modal-container"));
		const Observer = document.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.observeModal(token));
		const offState = this.deps.gateway.onState(state => {
			if (state.kind !== "ready") this.cancel(token);
		});
		const offTask = this.deps.gateway.onTaskCreated(task => {
			const request = this.pending;
			if (!request || request.token !== token || !request.modal?.isConnected) return;
			this.clear(request);
			void Promise.resolve(onCreated(task)).catch(error => {
				this.deps.log("Routing a newly created task failed: " + this.describe(error));
				this.safeNotify("The task was created, but it couldn't be added to this pane.");
			});
		});
		const timeout = document.defaultView?.setTimeout(() => {
			if (this.pending?.token !== token || this.pending.modal) return;
			this.cancel(token);
			this.safeNotify("TaskNotes did not open its task creation dialog.");
		}, MODAL_OPEN_TIMEOUT_MS) ?? window.setTimeout(() => this.cancel(token), MODAL_OPEN_TIMEOUT_MS);
		this.pending = { token, document, existingModals, modal: null, offTask, offState, observer, timeout };
		observer.observe(document.body, { childList: true, subtree: true });
		this.changed();

		try {
			if (!commands.executeCommandById(CREATE_TASK_COMMAND_ID)) {
				this.cancel(token);
				this.safeNotify("TaskNotes could not open its task creation dialog.");
				return false;
			}
			this.observeModal(token);
			return true;
		} catch (error) {
			this.cancel(token);
			this.deps.log("Opening TaskNotes task creation failed: " + this.describe(error));
			this.safeNotify("TaskNotes could not open its task creation dialog.");
			return false;
		}
	}

	dispose(): void {
		this.disposed = true;
		if (this.pending) this.clear(this.pending);
		this.listeners.clear();
	}

	private baseAvailability(): { available: boolean; reason: string } {
		const runtime = this.deps.gateway.taskCreationAvailability();
		if (!runtime.available) return runtime;
		const commands = this.commands();
		if (!commands || !commands.findCommand(CREATE_TASK_COMMAND_ID)) {
			return { available: false, reason: "TaskNotes' Create new task command is unavailable" };
		}
		return { available: true, reason: "Create a new TaskNotes task" };
	}

	private commands(): CommandManagerLike | null {
		const commands = (this.deps.app as App & { commands?: Partial<CommandManagerLike> }).commands;
		return commands && typeof commands.findCommand === "function" && typeof commands.executeCommandById === "function"
			? commands as CommandManagerLike
			: null;
	}

	private observeModal(token: symbol): void {
		const request = this.pending;
		if (!request || request.token !== token) return;
		if (!request.modal) {
			request.modal = Array.from(request.document.querySelectorAll<HTMLElement>(".modal-container"))
				.find(modal => !request.existingModals.has(modal) &&
					(modal.classList.contains("tasknotes-plugin") || modal.querySelector(".mod-tasknotes") !== null)) ?? null;
		}
		if (request.modal && !request.modal.isConnected) this.cancel(token);
	}

	private cancel(token: symbol): void {
		if (this.pending?.token === token) this.clear(this.pending);
	}

	private clear(request: PendingRequest): void {
		if (this.pending !== request) return;
		this.pending = null;
		request.observer.disconnect();
		request.document.defaultView?.clearTimeout(request.timeout);
		request.offTask();
		request.offState();
		this.changed();
	}

	private changed(): void {
		for (const listener of [...this.listeners]) {
			try { listener(); }
			catch { this.deps.log("A task creation listener failed."); }
		}
	}

	private safeNotify(message: string): void {
		try { this.deps.notify(message); }
		catch { this.deps.log("Showing a task creation result failed."); }
	}

	private describe(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
