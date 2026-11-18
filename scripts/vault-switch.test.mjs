import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { ASSETS, PLUGIN_ID, createSwitcher } from "./vault-switch.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const bundle = (version, suffix = "") => ({
  "main.js": Buffer.from(`module.exports = ${JSON.stringify(version + suffix)};`),
  "manifest.json": Buffer.from(JSON.stringify({ id: PLUGIN_ID, version })),
  "styles.css": Buffer.from(`/* ${version + suffix} */`),
});
async function writeBundle(dir, files) {
  for (const name of ASSETS) if (files[name] !== null) await fs.writeFile(path.join(dir, name), files[name]);
}
async function readBundle(dir) {
  return Object.fromEntries(await Promise.all(ASSETS.map(async name => {
    try { return [name, await fs.readFile(path.join(dir, name))]; }
    catch (error) { if (error.code === "ENOENT") return [name, null]; throw error; }
  })));
}
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tasknotes-switch-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vault = path.join(root, "Test Vault");
  const plugin = path.join(vault, ".obsidian", "plugins", PLUGIN_ID);
  await fs.mkdir(plugin, { recursive: true });
  const old = bundle("0.3.0-beta.3", "old");
  await writeBundle(plugin, old);
  await fs.writeFile(path.join(vault, ".obsidian/community-plugins.json"), "[]");
  const data = Buffer.from('{ "unknown": 42, "stagedOrder": ["A.md"] }\n');
  await fs.writeFile(path.join(plugin, "data.json"), data);
  await fs.writeFile(path.join(vault, "Task.md"), "---\nstaged: 2026-11-18\n---\nTask\n");
  const local = bundle("0.3.0-beta.3", "local uncommitted");
  const release = bundle("0.3.0-beta.3", "released");
  const log = [];
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    if (url.includes("api.github.com")) return new Response(JSON.stringify({ tag_name: "0.3.0-beta.3", draft: false, assets: ASSETS.map(name => ({
      name, size: release[name].length, digest: `sha256:${digest(release[name])}`,
      browser_download_url: `https://github.com/judealnas/obsidian-tasknotes-timer-pane/releases/download/0.3.0-beta.3/${name}`,
    })) }));
    return new Response(release[new URL(url).pathname.split("/").pop()]);
  };
  const switcher = createSwitcher({ root, output: line => log.push(line), build: () => writeBundle(root, local), git: async args => args[0] === "rev-parse" ? "abc123" : " M src/main.ts", fetchImpl, ...options });
  await switcher.setup(vault);
  return { root, vault, plugin, old, local, release, data, log, urls, switcher };
}

test("local → release → undo retains data and records actual files, including a dirty build", async t => {
  const f = await fixture(t);
  assert.equal((await f.switcher.status()).matches, false);
  const identity = await f.switcher.switch("local");
  assert.equal(identity.dirty, true);
  assert.equal(identity.commit, "abc123");
  assert.deepEqual(await readBundle(f.plugin), f.local);
  assert.equal((await f.switcher.status()).installed.kind, "local");
  await f.switcher.switch("release", "0.3.0-beta.3");
  assert.deepEqual(await readBundle(f.plugin), f.release);
  assert.equal((await f.switcher.status()).installed.tag, "0.3.0-beta.3");
  assert.equal(f.urls.length, 4);
  // Undo must retain newer user data, not restore the backup's older bytes.
  const newerData = Buffer.from('{"newUserChanges":true}');
  await fs.writeFile(path.join(f.plugin, "data.json"), newerData);
  await f.switcher.undo();
  assert.deepEqual(await readBundle(f.plugin), f.local);
  assert.equal((await f.switcher.status()).installed.kind, "local");
  assert.deepEqual(await fs.readFile(path.join(f.plugin, "data.json")), newerData);
  assert.match(await fs.readFile(path.join(f.vault, "Task.md"), "utf8"), /staged: 2026-11-18/);
  const state = JSON.parse(await fs.readFile(path.join(f.root, ".vault-switch.local.json"), "utf8"));
  assert.equal(state.vault, await fs.realpath(f.vault));
});

test("first undo restores an existing install and the absence of an optional stylesheet", async t => {
  const f = await fixture(t);
  await fs.rm(path.join(f.plugin, "styles.css"));
  await f.switcher.switch("local");
  await f.switcher.undo();
  assert.deepEqual(await readBundle(f.plugin), { ...f.old, "styles.css": null });
  assert.deepEqual(await fs.readFile(path.join(f.plugin, "data.json")), f.data);
});

test("status detects external replacement even when the manifest version is unchanged", async t => {
  const f = await fixture(t);
  await f.switcher.switch("local");
  await fs.writeFile(path.join(f.plugin, "main.js"), "BRAT replacement, same version");
  const status = await f.switcher.status();
  assert.equal(status.matches, false);
  assert.equal(status.installed, null);
  assert.equal(status.undoAvailable, true);
});

test("an enabled plugin blocks switching before building, downloading or backing up data", async t => {
  let built = false;
  const f = await fixture(t, { build: () => { built = true; } });
  await fs.writeFile(path.join(f.vault, ".obsidian/community-plugins.json"), JSON.stringify([PLUGIN_ID]));
  await assert.rejects(f.switcher.switch("local"), /Disable TaskNotes/);
  await assert.rejects(f.switcher.switch("release", "0.3.0-beta.3"), /Disable TaskNotes/);
  assert.equal(built, false);
  assert.equal(f.urls.length, 0);
  assert.deepEqual(await readBundle(f.plugin), f.old);
});

test("a failed local build leaves the installed assets and undo history untouched", async t => {
  const f = await fixture(t, { build: () => { throw new Error("Build failed"); } });
  await assert.rejects(f.switcher.switch("local"), /Build failed/);
  assert.deepEqual(await readBundle(f.plugin), f.old);
  assert.equal((await f.switcher.status()).undoAvailable, false);
});

test("missing, corrupt and failed release downloads never modify the installed files", async t => {
  for (const mode of ["missing", "digest", "version", "http", "url"]) {
    const f = await fixture(t, { fetchImpl: async url => {
      if (!url.includes("api.github.com")) return mode === "http" ? new Response("failure", { status: 503 }) : new Response(bundle("9.9.9")[new URL(url).pathname.split("/").pop()]);
      return new Response(JSON.stringify({ tag_name: "0.3.0-beta.3", assets: (mode === "missing" ? ASSETS.slice(1) : ASSETS).map(name => ({
        name, size: bundle("9.9.9")[name].length, digest: mode === "digest" ? "sha256:bad" : undefined,
        browser_download_url: `${mode === "url" ? "https://example.org" : "https://github.com"}/judealnas/obsidian-tasknotes-timer-pane/releases/download/0.3.0-beta.3/${name}`,
      })) }));
    } });
    await assert.rejects(f.switcher.switch("release", "0.3.0-beta.3"));
    assert.deepEqual(await readBundle(f.plugin), f.old, mode);
    assert.equal((await f.switcher.status()).undoAvailable, false);
  }
});

test("a partial replacement rolls back assets, retains data and removes the pending journal", async t => {
  let replacements = 0;
  const f = await fixture(t, { replace: async (dir, files) => {
    if (++replacements === 1) { await fs.writeFile(path.join(dir, "main.js"), files["main.js"]); throw new Error("Simulated write failure"); }
    await writeBundle(dir, files);
  } });
  await assert.rejects(f.switcher.switch("local"), /Previous plugin files restored/);
  assert.deepEqual(await readBundle(f.plugin), f.old);
  assert.deepEqual(await fs.readFile(path.join(f.plugin, "data.json")), f.data);
  assert.equal((await f.switcher.status()).pending, false);
});

test("failed rollback keeps a recoverable journal; undo recovers the pre-switch files", async t => {
  let fail = true;
  const f = await fixture(t, { replace: async (dir, files) => {
    if (fail) { await fs.writeFile(path.join(dir, "main.js"), files["main.js"]); throw new Error("Disk unavailable"); }
    await writeBundle(dir, files);
  } });
  await assert.rejects(f.switcher.switch("local"), /Automatic restore failed/);
  assert.equal((await f.switcher.status()).pending, true);
  await assert.rejects(f.switcher.switch("local"), /needs recovery/);
  fail = false;
  await f.switcher.undo();
  assert.deepEqual(await readBundle(f.plugin), f.old);
  assert.equal((await f.switcher.status()).pending, false);
});

test("undo rejects a tampered backup before altering the current install", async t => {
  const f = await fixture(t);
  await f.switcher.switch("local");
  const base = path.join(f.root, ".vault-switch");
  const stateDir = path.join(base, (await fs.readdir(base))[0]);
  const state = JSON.parse(await fs.readFile(path.join(stateDir, "state.json"), "utf8"));
  const backup = path.join(stateDir, state.undo);
  assert.deepEqual(await fs.readFile(path.join(backup, "data.json")), f.data);
  await fs.writeFile(path.join(backup, "main.js"), "modified backup");
  await assert.rejects(f.switcher.undo(), /Backup files have changed/);
  assert.deepEqual(await readBundle(f.plugin), f.local);
});

test("an existing lock blocks concurrent switches without modifying installed files", async t => {
  const f = await fixture(t);
  await f.switcher.switch("local");
  const base = path.join(f.root, ".vault-switch");
  const stateDir = path.join(base, (await fs.readdir(base))[0]);
  await fs.writeFile(path.join(stateDir, "switch.lock"), "test");
  await assert.rejects(f.switcher.undo(), /Another switch may be running/);
  assert.deepEqual(await readBundle(f.plugin), f.local);
});

test("unconfigured use, unknown sources and non-explicit tags are rejected", async t => {
  const f = await fixture(t);
  await assert.rejects(f.switcher.switch("something"), /Unknown build/);
  await assert.rejects(f.switcher.switch("release", "latest"), /exact release tag/);
  await fs.rm(path.join(f.root, ".vault-switch.local.json"));
  await assert.rejects(f.switcher.status(), /No vault configured/);
  assert.deepEqual(await readBundle(f.plugin), f.old);
});

test("setup rejects the wrong plugin ID and switching refuses an unreadable enabled-plugin list", async t => {
  const f = await fixture(t);
  const config = await fs.readFile(path.join(f.root, ".vault-switch.local.json"));
  await fs.writeFile(path.join(f.plugin, "manifest.json"), JSON.stringify({ id: "other-plugin", version: "1.0.0" }));
  await assert.rejects(f.switcher.setup(f.vault), /Unexpected plugin ID/);
  assert.deepEqual(await fs.readFile(path.join(f.root, ".vault-switch.local.json")), config);
  await fs.writeFile(path.join(f.plugin, "manifest.json"), f.old["manifest.json"]);
  await fs.rm(path.join(f.vault, ".obsidian/community-plugins.json"));
  await assert.rejects(f.switcher.switch("local"), /Cannot read the enabled-plugin list/);
  assert.deepEqual(await readBundle(f.plugin), f.old);
});

test("switching rejects a linked plugin directory instead of writing through it", async t => {
  const f = await fixture(t);
  const elsewhere = path.join(f.root, "elsewhere");
  await fs.rename(f.plugin, elsewhere);
  try { await fs.symlink(elsewhere, f.plugin, process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (error.code === "EPERM") { t.skip("Host cannot create directory links"); return; } throw error; }
  await assert.rejects(f.switcher.switch("local"), /Linked or redirected/);
  assert.deepEqual(await readBundle(elsewhere), f.old);
});
