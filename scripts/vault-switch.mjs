import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const PLUGIN_ID = "tasknotes-task-ctrl";
export const ASSETS = ["main.js", "manifest.json", "styles.css"];
const REPOSITORY = "judealnas/obsidian-tasknotes-task-ctrl";
const DEFAULT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const hashesOf = files => Object.fromEntries(ASSETS.map(name => [name, files[name] === null ? null : hash(files[name])]));
const sameHashes = (a, b) => ASSETS.every(name => a?.[name] === b?.[name]);

async function optionalFile(file) {
  try {
    if (!(await fs.lstat(file)).isFile()) throw new Error(`Expected a regular file: ${file}`);
    return await fs.readFile(file);
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function readJson(file, fallback) {
  const bytes = await optionalFile(file);
  return bytes === null ? fallback : JSON.parse(bytes.toString("utf8"));
}
async function writeJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }); }
}
async function directory(dir) {
  const actual = await fs.realpath(dir);
  const normalize = value => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalize(actual) !== normalize(path.resolve(dir)) || !(await fs.stat(actual)).isDirectory()) {
    throw new Error(`Linked or redirected directories are not supported: ${dir}`);
  }
  return actual;
}
async function readAssets(dir) {
  return Object.fromEntries(await Promise.all(ASSETS.map(async name => [name, await optionalFile(path.join(dir, name))])));
}
function manifestOf(files, expectedVersion) {
  if (!files["main.js"]?.length || !files["manifest.json"]?.length) throw new Error("Plugin main.js or manifest.json is missing or empty.");
  const manifest = JSON.parse(files["manifest.json"].toString("utf8"));
  if (manifest.id !== PLUGIN_ID || typeof manifest.version !== "string" || !manifest.version) throw new Error("Unexpected plugin ID or missing version in manifest.json.");
  if (expectedVersion && manifest.version !== expectedVersion) throw new Error(`Release tag ${expectedVersion} does not match manifest version ${manifest.version}.`);
  return manifest;
}

export function createSwitcher({ root = DEFAULT_ROOT, fetchImpl = globalThis.fetch, build, git, output = console.log, replace } = {}) {
  const storage = path.join(root, ".vault-switch");
  const configPath = path.join(root, ".vault-switch.local.json");
  const log = output;

  async function target(vault) {
    if (typeof vault !== "string" || !path.isAbsolute(vault)) throw new Error("Configure an absolute vault path with npm run vault:setup -- \"<vault path>\".");
    const base = await directory(vault);
    const configDir = await directory(path.join(base, ".obsidian"));
    await directory(path.join(configDir, "plugins"));
    const pluginDir = await directory(path.join(configDir, "plugins", PLUGIN_ID));
    manifestOf(await readAssets(pluginDir));
    const stateDir = path.join(storage, hash(Buffer.from(process.platform === "win32" ? base.toLowerCase() : base)));
    return { vault: base, configDir, pluginDir, stateDir };
  }
  async function configured() {
    const config = await readJson(configPath, null);
    if (!config) throw new Error('No vault configured. Run npm run vault:setup -- "<vault path>" first.');
    return target(config.vault);
  }
  async function disabled(t) {
    const enabled = await readJson(path.join(t.configDir, "community-plugins.json"), null);
    if (!Array.isArray(enabled) || !enabled.every(id => typeof id === "string")) throw new Error("Cannot read the enabled-plugin list. Disable TaskNotes Task Control in Obsidian before switching.");
    if (enabled.includes(PLUGIN_ID)) throw new Error("Disable TaskNotes Task Control in Obsidian before switching, then run this command again.");
  }
  async function withLock(t, action) {
    await fs.mkdir(storage, { recursive: true }); await directory(storage);
    await fs.mkdir(t.stateDir, { recursive: true }); await directory(t.stateDir);
    const lockPath = path.join(t.stateDir, "switch.lock");
    let lock;
    try { lock = await fs.open(lockPath, "wx"); }
    catch (error) {
      if (error.code === "EEXIST") throw new Error(`Another switch may be running. If it crashed, check no switch is active, then remove ${lockPath}.`);
      throw error;
    }
    try { return await action(); }
    finally { await lock.close(); await fs.rm(lockPath); }
  }
  async function snapshot(t, identity) {
    const id = randomUUID();
    const dir = path.join(t.stateDir, id);
    await fs.mkdir(dir);
    const files = await readAssets(t.pluginDir);
    manifestOf(files);
    for (const name of ASSETS) if (files[name] !== null) await fs.writeFile(path.join(dir, name), files[name], { flag: "wx" });
    const data = await optionalFile(path.join(t.pluginDir, "data.json"));
    if (data !== null) await fs.writeFile(path.join(dir, "data.json"), data, { flag: "wx" });
    const hashes = hashesOf(files);
    await writeJson(path.join(dir, "snapshot.json"), { hashes, identity: sameHashes(hashes, identity?.hashes) ? identity : null, createdAt: new Date().toISOString() });
    return { id, dir, files, hashes };
  }
  async function loadSnapshot(t, id) {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid backup identifier.");
    const dir = await directory(path.join(t.stateDir, id));
    const info = await readJson(path.join(dir, "snapshot.json"), null);
    const files = await readAssets(dir);
    manifestOf(files);
    if (!sameHashes(hashesOf(files), info?.hashes)) throw new Error(`Backup files have changed: ${dir}`);
    return { files, identity: info.identity, dir };
  }
  async function replaceFiles(t, files) {
    // Recheck immediately before writes. Each file uses rename; pending.json covers
    // interruption between files. data.json is never a replacement target.
    await target(t.vault); await disabled(t);
    if (replace) return replace(t.pluginDir, files);
    for (const name of ASSETS) {
      const dest = path.join(t.pluginDir, name);
      await optionalFile(dest); // Refuse symlinks and non-files.
      if (files[name] === null) { await fs.rm(dest, { force: true }); continue; }
      const temp = path.join(t.pluginDir, `.${name}.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temp, files[name], { flag: "wx" });
        await fs.rename(temp, dest);
      } finally { await fs.rm(temp, { force: true }); }
    }
    if (!sameHashes(hashesOf(await readAssets(t.pluginDir)), hashesOf(files))) throw new Error("Installed files failed verification.");
  }
  async function transact(t, files, identity, state) {
    const before = await snapshot(t, state?.installed);
    const pendingPath = path.join(t.stateDir, "pending.json");
    await writeJson(pendingPath, { backup: before.id, previousState: state });
    try {
      await replaceFiles(t, files);
      await writeJson(path.join(t.stateDir, "state.json"), { installed: identity, undo: before.id });
      await fs.rm(pendingPath);
    } catch (error) {
      try {
        await replaceFiles(t, before.files);
        await writeJson(path.join(t.stateDir, "state.json"), state);
        await fs.rm(pendingPath);
      } catch (rollback) {
        throw new Error(`${error.message}\nAutomatic restore failed: ${rollback.message}\nKeep the plugin disabled. Run vault:undo to retry recovery. Backup: ${before.dir}`);
      }
      throw new Error(`${error.message}\nPrevious plugin files restored. Backup: ${before.dir}`);
    }
    log(`Backup: ${before.dir}\nPlugin files verified. Re-enable TaskNotes Task Control in Obsidian.\nSaved plugin data and task notes were not restored or replaced.`);
  }
  async function fetchBytes(url, accept) {
    const response = await fetchImpl(url, { headers: { Accept: accept, "User-Agent": "tasknotes-vault-switch" }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status}): ${url}`);
    return Buffer.from(await response.arrayBuffer());
  }
  async function releaseFiles(tag) {
    if (typeof tag !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) throw new Error("Provide an exact release tag, for example: npm run vault:release -- 0.4.0");
    const url = `https://api.github.com/repos/${REPOSITORY}/releases/tags/${encodeURIComponent(tag)}`;
    const release = JSON.parse((await fetchBytes(url, "application/vnd.github+json")).toString("utf8"));
    if (release.draft || release.tag_name !== tag || !Array.isArray(release.assets)) throw new Error("The requested published release was not found.");
    const files = {};
    for (const name of ASSETS) {
      const matches = release.assets.filter(asset => asset.name === name);
      if (matches.length !== 1) throw new Error(`Release must contain exactly one ${name} asset.`);
      const asset = matches[0];
      const download = new URL(asset.browser_download_url);
      if (download.protocol !== "https:" || download.hostname !== "github.com" || !download.pathname.startsWith(`/${REPOSITORY}/releases/download/`)) throw new Error("Unexpected release asset URL.");
      files[name] = await fetchBytes(download.href, "application/octet-stream");
      if (!files[name].length || files[name].length !== asset.size) throw new Error(`Release asset size mismatch: ${name}`);
      if (asset.digest && asset.digest !== `sha256:${hash(files[name])}`) throw new Error(`Release asset digest mismatch: ${name}`);
    }
    manifestOf(files, tag);
    return files;
  }
  async function localFiles() {
    const runGit = git ?? (async args => (await exec("git", args, { cwd: root })).stdout.trim());
    const commit = await runGit(["rev-parse", "HEAD"]);
    const dirty = Boolean(await runGit(["status", "--porcelain", "--untracked-files=normal", "--", ".", ":(exclude)main.js"]));
    if (build) await build();
    else {
      const child = await import("node:child_process");
      // Execute Node directly: no cmd.exe quoting or interpolated shell commands.
      await new Promise((resolve, reject) => {
        const process = child.spawn(globalThis.process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: root, stdio: "inherit" });
        process.once("error", reject); process.once("exit", code => code === 0 ? resolve() : reject(new Error("TypeScript check failed; nothing installed.")));
      });
      await new Promise((resolve, reject) => {
        const process = child.spawn(globalThis.process.execPath, [path.join(root, "esbuild.config.mjs"), "production"], { cwd: root, stdio: "inherit" });
        process.once("error", reject); process.once("exit", code => code === 0 ? resolve() : reject(new Error("Production build failed; nothing installed.")));
      });
    }
    const files = await readAssets(root);
    manifestOf(files);
    if (!files["styles.css"]?.length) throw new Error("Local styles.css is missing or empty.");
    return { files, provenance: { kind: "local", commit, dirty } };
  }
  return {
    async setup(vault) {
      const t = await target(path.resolve(vault));
      await writeJson(configPath, { vault: t.vault });
      log(`Configured vault: ${t.vault}\nPlugin: ${t.pluginDir}\nNo vault files changed.`);
    },
    async status() {
      const t = await configured();
      const files = await readAssets(t.pluginDir);
      const manifest = manifestOf(files);
      const state = await readJson(path.join(t.stateDir, "state.json"), null);
      const pending = await readJson(path.join(t.stateDir, "pending.json"), null);
      const matches = !!state?.installed && sameHashes(hashesOf(files), state.installed.hashes);
      const result = { vault: t.vault, pluginDir: t.pluginDir, version: manifest.version, matches, installed: matches ? state.installed : null, pending: !!pending, undoAvailable: !!(pending?.backup || state?.undo) };
      log(`Vault: ${t.vault}\nPlugin: ${t.pluginDir}\nVersion: ${manifest.version}\nInstalled: ${matches ? state.installed.kind : "unknown or changed since last switch"}`);
      if (matches) {
        const i = state.installed;
        if (i.commit) log(`Commit: ${i.commit}${i.dirty ? " + uncommitted changes" : ""}`);
        if (i.tag) log(`Release: ${i.tag}`);
        log(`Installed at: ${i.installedAt}\nFiles match last installation.`);
      }
      if (pending) log("Interrupted switch detected. Keep the plugin disabled and run npm run vault:undo.");
      log(`Undo available: ${result.undoAvailable ? "yes" : "no"}\nStatus describes files on disk, not the build currently running in Obsidian.`);
      return result;
    },
    async switch(kind, tag) {
      if (kind !== "local" && kind !== "release") throw new Error("Unknown build source.");
      const t = await configured(); log(`Target vault: ${t.vault}\nPlugin: ${t.pluginDir}`);
      return withLock(t, async () => {
        await disabled(t);
        if (await readJson(path.join(t.stateDir, "pending.json"), null)) throw new Error("An interrupted switch needs recovery. Run npm run vault:undo first.");
        log("Keep the plugin disabled until this command finishes. Disable BRAT automatic updates while using local builds.");
        const prepared = kind === "local" ? await localFiles() : { files: await releaseFiles(tag), provenance: { kind, tag, repository: REPOSITORY } };
        const identity = { ...prepared.provenance, version: manifestOf(prepared.files).version, installedAt: new Date().toISOString(), hashes: hashesOf(prepared.files) };
        await transact(t, prepared.files, identity, await readJson(path.join(t.stateDir, "state.json"), null));
        log(`Installed ${kind} build ${identity.version}${identity.dirty ? " (includes uncommitted changes)" : ""}.`);
        return identity;
      });
    },
    async undo() {
      const t = await configured(); log(`Target vault: ${t.vault}\nPlugin: ${t.pluginDir}`);
      return withLock(t, async () => {
        await disabled(t);
        const statePath = path.join(t.stateDir, "state.json");
        const pendingPath = path.join(t.stateDir, "pending.json");
        const state = await readJson(statePath, null);
        const pending = await readJson(pendingPath, null);
        const id = pending?.backup ?? state?.undo;
        if (!id) throw new Error("No previous switch is available to undo.");
        const backup = await loadSnapshot(t, id);
        if (pending) {
          await replaceFiles(t, backup.files);
          await writeJson(statePath, pending.previousState);
          await fs.rm(pendingPath);
          log("Interrupted switch recovered. Plugin files verified. Re-enable the plugin in Obsidian. Saved data was not restored.");
        } else {
          await transact(t, backup.files, backup.identity, state);
        }
      });
    },
  };
}

export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  const expected = { setup: 1, local: 0, release: 1, status: 0, undo: 0 };
  if (!(command in expected) || rest.length !== expected[command]) throw new Error("Usage: vault:setup -- <vault path> | vault:local | vault:release -- <exact tag> | vault:status | vault:undo");
  const switcher = createSwitcher();
  if (command === "setup") return switcher.setup(rest[0]);
  if (command === "local" || command === "release") return switcher.switch(command, rest[0]);
  return switcher[command]();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
