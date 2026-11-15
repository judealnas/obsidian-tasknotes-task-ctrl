import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Capture the real hidden-sandbox renderer with an empty read-only UI projection.
// Existing task metadata and staging membership are never changed.
const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const target = targets.find(item => item.type === "page" && item.title.includes("Obsidian"));
if (!target) throw new Error("No guarded Obsidian target");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = event => {
	const message = JSON.parse(event.data);
	const callback = pending.get(message.id);
	if (!callback) return;
	pending.delete(message.id);
	clearTimeout(callback.timeout);
	if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
	else callback.resolve(message.result);
};
function call(method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = ++sequence;
		const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + " timed out")); }, 15000);
		pending.set(id, { resolve, reject, timeout });
		socket.send(JSON.stringify({ id, method, params }));
	});
}
async function evaluate(expression) {
	const response = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
	if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
	return response.result.value;
}
try {
	const result = await evaluate(`(async () => {
		const leaves = app.workspace.getLeavesOfType('tasknotes-timer-pane');
		const view = leaves.slice().sort((a,b)=>b.view.contentEl.clientWidth-a.view.contentEl.clientWidth)[0].view;
		await view.services.staging.refreshNow();
		const staging = view.services.staging, getter = staging.getSnapshot;
		const original = getter.call(staging);
		if (!original.canStage) throw new Error('Staging setup is not ready');
		globalThis.__emptyStagedPreview = {view, staging, getter, tab:view.tab};
		staging.getSnapshot = () => ({...getter.call(staging),items:[],loaded:true});
		view.selectTab('staged'); view.render();
		await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
		const panel=view.contentEl.querySelector('.tntp-panel--staged');
		const plus=panel.querySelector('.tntp-insert');
		const bounds=view.contentEl.getBoundingClientRect();
		const checks={stageHeaderRemoved:!panel.querySelector('.tntp-header'),emptyHeading:panel.querySelector('.tntp-message__heading').textContent,emptyBody:panel.querySelector('.tntp-message__body').textContent,plusCount:panel.querySelectorAll('.tntp-insert').length,plusEnabled:!plus.disabled,stagedCount:view.contentEl.querySelector('.tntp-tabs__count').textContent.trim(),originalStagedTasks:original.items.length};
		if(!checks.stageHeaderRemoved||checks.emptyHeading||checks.emptyBody||checks.plusCount!==1||!checks.plusEnabled||checks.stagedCount!=='0')throw new Error(JSON.stringify(checks));
		plus.click();
		if(!view.picker||view.picker.options.mode!=='stage')throw new Error('Plus failed to open the staging picker');
		view.picker.close();
		await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
		return {checks,clip:{x:bounds.x,y:bounds.y,width:Math.min(480,bounds.width),height:Math.min(440,bounds.height),scale:1}};
	})()`);
	const screenshot = await call("Page.captureScreenshot", { format: "png", clip: result.clip, captureBeyondViewport: true });
	writeFileSync(new URL("empty-staged.png", import.meta.url), Buffer.from(screenshot.data, "base64"));
	const evidence = { timestamp: new Date().toISOString(), ...result, mainjsSha256: createHash("sha256").update(readFileSync("main.js")).digest("hex"), fixture: "Temporary read-only empty snapshot; no tasks unstaged" };
	writeFileSync(new URL("native-empty.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
	console.log(JSON.stringify(evidence));
} finally {
	try {
		await evaluate(`(() => { const p=globalThis.__emptyStagedPreview;if(p){p.view.picker?.close();p.staging.getSnapshot=p.getter;p.view.selectTab(p.tab);for(const leaf of app.workspace.getLeavesOfType('tasknotes-timer-pane'))leaf.view.render();delete globalThis.__emptyStagedPreview;}return true;})()`);
	} finally { socket.close(); }
}
