import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const deadlineMs = 20_000;
const observationIntervalMs = 40;

// Poll observable state with a deadline; a delay alone never establishes completion.
export async function until(predicate, label, timeout = deadlineMs) {
  const end = Date.now() + timeout;
  while (true) {
    if (await predicate()) return;
    if (Date.now() >= end) throw new Error(`Deadline waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, observationIntervalMs));
  }
}

export function projectCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "auralprint-watch-"));
  for (const name of ["src", "scripts", "version", "package.json"]) {
    cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  }
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
  return dir;
}

export function startWatch(dir, env = {}) {
  const child = spawn(process.execPath, ["scripts/watch.mjs"], {
    cwd: dir, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  let log = "";
  const events = [];
  for (const stream of [child.stdout, child.stderr]) stream.on("data", data => {
    const text = data.toString();
    log += text;
    events.push({ at: new Date().toISOString(), text });
  });
  const closed = new Promise(resolve => child.on("close", (code, signal) => resolve({ code, signal })));
  return {
    child, events, get log() { return log; },
    get successes() { return (log.match(/\[watch\] assembled /g) || []).length; },
    async wait(predicate, label, timeout) {
      try {
        await until(() => {
          assert.equal(child.exitCode, null, `Watcher exited: ${log}`);
          return predicate();
        }, label, timeout);
      } catch (error) { throw new Error(`${error.message}\n${log}`, { cause: error }); }
    },
    async stop(graceful = false) {
      if (child.exitCode === null && child.signalCode === null) {
        // Native Windows does not deliver POSIX SIGTERM handlers via child.kill.
        if (graceful && process.platform === "win32") child.send({ type: "shutdown" });
        else child.kill("SIGTERM");
      }
      let timer;
      try {
        return await Promise.race([closed, new Promise((_, reject) => {
          timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Watcher failed to exit\n${log}`)); }, deadlineMs);
        })]);
      } finally { clearTimeout(timer); }
    },
  };
}

export function artifactPaths(dir, version) {
  return [path.join(dir, `dist/auralprint_${version.slice(1)}.html`), path.join(dir, "dist/hosted/index.html")];
}

export function outputs(dir, version) {
  return artifactPaths(dir, version).map(file => existsSync(file) ? readFileSync(file, "utf8") : "");
}

export function inventory(dir, version) {
  return artifactPaths(dir, version).map(file => ({
    path: path.relative(dir, file).replaceAll("\\", "/"), exists: existsSync(file),
    ...(existsSync(file) ? { bytes: readFileSync(file).length, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") } : {}),
  }));
}

export function discard(dir) { rmSync(dir, { recursive: true, force: true }); }
