// Read-only native acceptance snapshots. Start only through npm run uat:start.
// --label overnight-before/after or sleep-before/after records observations.
// Labels do not certify a real overnight interval or physical sleep.
// Mutation/upgrade automation was withdrawn after a failed restoration.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = fileURLToPath(new URL("../../", import.meta.url));
const outputDir = path.join(root, ".planning/phases/07-complete-roll-over-release-0-3-0");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--label")) throw new Error("Usage: node scripts/uat/phase7-acceptance.mjs [--label name]");
const label = args[1] ?? "desktop";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid evidence label");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const evaluate = expression => {
 const result = spawnSync(process.execPath, [path.join(root, "scripts/uat/cdp.mjs"), "eval", "--timeout-ms", "30000", "--expr", expression], { encoding: "utf8", timeout: 35_000, maxBuffer: 8 * 1024 * 1024 });
 if (result.status !== 0) throw new Error(result.stderr || "CDP evaluation failed");
 return JSON.parse(result.stdout);
};
const expectedVault = path.join(root, "dev-vault");
const inspect = evaluate(`(async()=>{
 const vaultPath=app.vault.adapter.getBasePath();
 if(vaultPath.replaceAll('\\\\','/').toLowerCase()!==${JSON.stringify(expectedVault.replaceAll("\\", "/").toLowerCase())})throw new Error('Refusing non-dev-vault');
 const p=app.plugins.getPlugin('tasknotes-task-ctrl'),tn=app.plugins.getPlugin('tasknotes'),api=tn?.api;
 const ready=api?.lifecycle.isReady()===true;
 const leaves=app.workspace.getLeavesOfType('tasknotes-timer-pane');
 const tasks=ready?await api.tasks.list():[];
 const staged=tasks.filter(t=>t.staged||t.customProperties?.staged),files=[];
 for(const t of staged){const f=app.vault.getFileByPath(t.path);if(f)files.push({path:t.path,raw:await app.vault.read(f)});}
 return {at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,vaultPath,
  product:p?.manifest,tasknotesVersion:tn?.manifest.version,apiVersion:api?.apiVersion,ready,
  settings:p?.paneSettings,stagedOrder:p?.stagedOrder?.get(),cardOrder:p?.cardOrder?.get(),
  leaves:leaves.map(l=>({state:l.view.getState(),name:l.view.getDisplayText(),bridge:l.view.services?.gateway.getState(),text:l.view.contentEl.textContent})),files};
})()`);
inspect.files = inspect.files.map(({ path, raw }) => ({ path, sha256: hash(raw) }));
const installedDir = path.join(expectedVault, ".obsidian/plugins/tasknotes-task-ctrl");
const data = readFileSync(path.join(installedDir, "data.json"));
const backupPath = path.join(os.tmpdir(), `tasknotes-phase7-readonly-snapshot-${Date.now()}.json`);
writeFileSync(backupPath, data, { flag: "wx" });
const evidence = { label, observedAt: new Date().toISOString(), realOvernightVerified: false, physicalSleepVerified: false,
 sourceCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
 sourceDirty: Boolean(spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" }).stdout.trim()),
 dataBackup: { path: backupPath, sha256: hash(data) },
 assets: Object.fromEntries(["main.js", "manifest.json", "styles.css"].map(name => [name, { source: hash(readFileSync(path.join(root, name))), installed: hash(readFileSync(path.join(installedDir, name))) }])), inspect };
const output = path.join(outputDir, `07-acceptance-${label}.json`);
writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
if (!Object.values(evidence.assets).every(a => a.source === a.installed)) throw new Error("Installed assets differ from candidate");
console.log(JSON.stringify({ output, ready: inspect.ready, dataBackup: backupPath, realOvernightVerified: false, physicalSleepVerified: false }));
