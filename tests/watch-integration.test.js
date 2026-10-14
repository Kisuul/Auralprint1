import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { artifactPaths, discard, inventory, outputs, projectCopy, startWatch, until } from "../scripts/test-support/watch-harness.mjs";

const quietWindowMs = 600; // More than the save-coalescing window; observe every sample.

function verify(dir) {
  const candidates = [process.env.PYTHON, "python", "python3", ...(process.platform === "win32" ? ["py"] : [])].filter(Boolean);
  for (const command of candidates) {
    const result = spawnSync(command, [...(command === "py" ? ["-3"] : []), "scripts/verify_distribution.py"], { cwd: dir, encoding: "utf8" });
    if (result.error?.code === "ENOENT") continue;
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  }
  assert.fail("No Python interpreter for distribution verification");
}

// Instrument only the disposable Python entry point. Real assembler/validation still run.
function instrumentAssembler(dir) {
  renameSync(`${dir}/scripts/assemble_single_file.py`, `${dir}/scripts/assemble_real.py`);
  writeFileSync(`${dir}/scripts/assemble_single_file.py`, `from assemble_real import *
if __name__ == '__main__':
    import os, runpy, time
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    def trace(event):
        with (root / 'assembler-trace').open('a') as log:
            log.write(f'{event} {os.getpid()}\\n')
    trace('start')
    try:
        if (root / 'assembly-gate').exists():
            (root / 'assembly-started').write_text(str(os.getpid()))
            deadline = time.monotonic() + 20
            while (root / 'assembly-gate').exists():
                if time.monotonic() > deadline:
                    raise RuntimeError('Test assembly gate deadline')
                time.sleep(0.02)
        if (root / 'assembly-fail').exists():
            # Partial assembler output is deliberately confined to the stage.
            import sys
            Path(sys.argv[5]).write_text('partial failed attempt')
            raise SystemExit(23)
        runpy.run_path(str(root / 'scripts/assemble_real.py'), run_name='__main__')
    finally:
        trace('end')
`);
}

test("AUD-011 actual watcher: current inputs, coherent packaging, failure recovery and lifecycle", { timeout: 180_000 }, async t => {
  const dir = projectCopy();
  instrumentAssembler(dir);
  writeFileSync(`${dir}/scripts/trace-children.mjs`, `import cp from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const spawn = cp.spawn;
cp.spawn = (...args) => {
  const child = spawn(...args);
  if (child.pid) appendFileSync('owned-children', JSON.stringify({ pid: child.pid, command: args[0] }) + '\\n');
  return child;
};
syncBuiltinESMExports();
`);
  const watch = startWatch(dir, {}, ["--import", "./scripts/trace-children.mjs"]);
  let version = readFileSync(`${dir}/version`, "utf8").trim();
  const templateFile = `${dir}/src/index.template.html`;
  const template = readFileSync(templateFile, "utf8");
  const versionFile = `${dir}/version`;
  let finalArtifacts;
  const check = async (marker, after) => {
    await watch.wait(() => watch.successes > after && outputs(dir, version).every(html =>
      html.includes(marker) && html.includes(`Auralprint - Waveform Analysis Tool - ${version}</title>`)), marker);
    verify(dir);
  };
  const preserved = async action => {
    const before = inventory(dir, version);
    const bundles = ["auralprint.js", "auralprint.css"].map(name => readFileSync(`${dir}/.build/${name}`));
    const count = watch.successes;
    const offset = watch.log.length;
    action();
    await watch.wait(() => /failed|Version file|Missing version/.test(watch.log.slice(offset)), "observable failure");
    assert.equal(watch.successes, count, "Failed transaction reported success");
    assert.deepEqual(inventory(dir, version), before, "Failure changed valid editions");
    assert.deepEqual(["auralprint.js", "auralprint.css"].map(name => readFileSync(`${dir}/.build/${name}`)), bundles);
  };
  try {
    await t.test("initial startup builds both editions", async () => { await check("<body>", 0); });
    await t.test("JS dependency-only edit", async () => {
      const count = watch.successes;
      appendFileSync(`${dir}/src/js/core/constants.js`, '\nconsole.info("aud011-js-dependency");\n');
      await check("aud011-js-dependency", count);
    });
    await t.test("CSS dependency-only edit", async () => {
      const count = watch.successes;
      appendFileSync(`${dir}/src/css/panels.css`, "\n.aud011-css { --aud011: 1; }\n");
      await check(".aud011-css", count);
    });
    await t.test("template-only edit updates both distributions", async () => {
      const count = watch.successes;
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="template">'));
      await check('data-aud011="template"', count);
    });
    await t.test("version-only save replaces filename/title while retaining older portable", async () => {
      const oldFile = artifactPaths(dir, version)[0];
      const old = readFileSync(oldFile);
      const count = watch.successes;
      version = "v0.1.15-aud011-B";
      writeFileSync(versionFile, `${version}\n`);
      await check('data-aud011="template"', count);
      assert.deepEqual(readFileSync(oldFile), old);
    });
    await t.test("rapid template/version/JS/CSS edits and A to B to C converge", async () => {
      const count = watch.successes;
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="latest">'));
      for (const value of ["A", "B", "C"]) writeFileSync(versionFile, `v0.1.15-aud011-${value}\n`);
      appendFileSync(`${dir}/src/js/main.js`, '\nconsole.info("aud011-latest-js");\n');
      appendFileSync(`${dir}/src/css/base.css`, "\n.aud011-latest-css { --aud011: 2; }\n");
      version = "v0.1.15-aud011-C";
      await check('data-aud011="latest"', count);
      await watch.wait(() => outputs(dir, version).every(html => html.includes("aud011-latest-js") && html.includes(".aud011-latest-css")), "latest source pair");
      verify(dir);
    });
    for (const invalid of ["", "not/a/version", "v1<script>"]) {
      await t.test(`refuses invalid version ${JSON.stringify(invalid)} and recovers`, async () => {
        await preserved(() => writeFileSync(versionFile, invalid));
        const count = watch.successes;
        version += "-restored";
        writeFileSync(versionFile, `${version}\n`);
        await check('data-aud011="latest"', count);
      });
    }
    await t.test("temporarily unreadable version and atomic restore", async () => {
      await preserved(() => renameSync(versionFile, `${versionFile}.saved`));
      const count = watch.successes;
      renameSync(`${versionFile}.saved`, versionFile);
      // Same content after an error need not reassemble; an actual new version must.
      version += "-replacement";
      writeFileSync(`${versionFile}.tmp`, version);
      renameSync(`${versionFile}.tmp`, versionFile);
      await check('data-aud011="latest"', count);
    });
    await t.test("version path temporarily cannot be read as a file", async () => {
      await preserved(() => {
        renameSync(versionFile, `${versionFile}.saved`);
        mkdirSync(versionFile);
      });
      rmSync(versionFile, { recursive: true });
      renameSync(`${versionFile}.saved`, versionFile);
      const count = watch.successes;
      version += "-readable";
      writeFileSync(versionFile, version);
      await check('data-aud011="latest"', count);
    });
    for (const [relative, invalid, marker] of [
      ["src/js/core/constants.js", "\nconst = ;", 'console.info("aud011-js-recovered");'],
      ["src/css/panels.css", "\n.aud011-invalid { color: \"unterminated", ".aud011-css-recovered { --restored: 1; }"],
    ]) {
      await t.test(`${relative} build error and atomic source replacement recovery`, async () => {
        const file = `${dir}/${relative}`;
        const content = readFileSync(file, "utf8");
        await preserved(() => writeFileSync(file, content + invalid));
        const count = watch.successes;
        writeFileSync(`${file}.tmp`, content + "\n" + marker);
        renameSync(`${file}.tmp`, file);
        await check(marker.startsWith(".") ? ".aud011-css-recovered" : marker, count);
      });
    }
    await t.test("invalid template retains valid outputs and recovers via replacement", async () => {
      await preserved(() => writeFileSync(templateFile, template.replace("<!-- AURALPRINT_INLINE_JS -->", "")));
      const count = watch.successes;
      writeFileSync(`${templateFile}.tmp`, template.replace("<body>", '<body data-aud011="replaced">'));
      renameSync(`${templateFile}.tmp`, templateFile);
      await check('data-aud011="replaced"', count);
    });
    await t.test("branding-only save updates portable favicon and hosted bytes", async () => {
      const count = watch.successes;
      const svg = `${dir}/src/assets/branding/favicon.svg`;
      appendFileSync(svg, "\n<!-- aud011-branding -->\n");
      const expected = Buffer.from(readFileSync(svg)).toString("base64");
      await watch.wait(() => watch.successes > count && outputs(dir, version)[0].includes(expected), "branding assembly");
      assert.deepEqual(readFileSync(`${dir}/dist/hosted/favicon.svg`), readFileSync(svg));
      verify(dir);
    });
    await t.test("branding removal fails without damaging output and replacement recovers", async () => {
      const svg = `${dir}/src/assets/branding/favicon.svg`;
      await preserved(() => renameSync(svg, `${dir}/favicon.saved`));
      const count = watch.successes;
      appendFileSync(`${dir}/favicon.saved`, "\n<!-- replacement -->\n");
      renameSync(`${dir}/favicon.saved`, svg);
      await watch.wait(() => watch.successes > count, "branding replacement recovery");
      verify(dir);
    });
    await t.test("manifest-only edit retains package-relative hosted metadata", async () => {
      const count = watch.successes;
      const file = `${dir}/src/assets/branding/site.webmanifest`;
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      manifest.theme_color = "#123456";
      writeFileSync(file, JSON.stringify(manifest));
      await watch.wait(() => watch.successes > count && readFileSync(`${dir}/dist/hosted/site.webmanifest`, "utf8").includes("#123456"), "manifest assembly");
      verify(dir);
    });
    await t.test("assembler process failure preserves output and a later save recovers", async () => {
      writeFileSync(`${dir}/assembly-fail`, "fail");
      await preserved(() => writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="assembler-recovery">')));
      rmSync(`${dir}/assembly-fail`);
      const count = watch.successes;
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="after-failure">'));
      await check('data-aud011="after-failure"', count);
    });
    await t.test("edits during active assembly are retained and obsolete transaction is discarded", async () => {
      writeFileSync(`${dir}/assembly-gate`, "hold");
      const count = watch.successes;
      const before = inventory(dir, version);
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="obsolete">'));
      await watch.wait(() => existsSync(`${dir}/assembly-started`), "real Python assembler started");
      version = "v0.1.15-aud011-final";
      writeFileSync(versionFile, version);
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="during-assembly">'));
      appendFileSync(`${dir}/src/js/main.js`, '\nconsole.info("aud011-during-js");\n');
      appendFileSync(`${dir}/src/css/base.css`, "\n.aud011-during-css { --aud011: 3; }\n");
      // Publication cannot occur while the actual assembler is blocked.
      assert.equal(watch.successes, count);
      assert.deepEqual(inventory(dir, readFileSync(`${dir}/version`, "utf8").trim())[1], before[1]);
      rmSync(`${dir}/assembly-gate`);
      await check('data-aud011="during-assembly"', count);
      await watch.wait(() => outputs(dir, version).every(html => html.includes("aud011-during-js") && html.includes(".aud011-during-css")), "sources changed during assembly");
      verify(dir);
      assert.ok(!outputs(dir, version).some(html => html.includes('data-aud011="obsolete"')));
      assert.match(watch.log, /\[watch\] superseded/);
    });
    await t.test("duplicate saves do not assemble again and Python assemblers never overlap", async () => {
      const count = watch.successes;
      const content = readFileSync(templateFile);
      const traceBefore = readFileSync(`${dir}/assembler-trace`, "utf8");
      for (let i = 0; i < 10; i++) writeFileSync(templateFile, content);
      const end = Date.now() + quietWindowMs;
      await until(() => {
        assert.equal(watch.successes, count);
        return Date.now() >= end;
      }, "duplicate-event observation");
      assert.equal(readFileSync(`${dir}/assembler-trace`, "utf8"), traceBefore, "Duplicate saves launched an assembler");
      let active = 0;
      for (const line of readFileSync(`${dir}/assembler-trace`, "utf8").trim().split(/\r?\n/)) {
        active += line.startsWith("start") ? 1 : -1;
        assert.ok(active >= 0 && active <= 1, "Concurrent Python assemblers");
      }
      assert.equal(active, 0);
      finalArtifacts = verify(dir);
    });
    await t.test("repeated atomic template and version saves keep producing current editions", async () => {
      for (let i = 0; i < 4; i++) {
        const count = watch.successes;
        version = `v0.1.15-aud011-repeat-${i}`;
        const marker = `data-aud011="repeat-${i}"`;
        writeFileSync(`${templateFile}.tmp`, template.replace("<body>", `<body ${marker}>`));
        renameSync(`${templateFile}.tmp`, templateFile);
        writeFileSync(`${versionFile}.tmp`, version);
        renameSync(`${versionFile}.tmp`, versionFile);
        await check(marker, count);
      }
      finalArtifacts = verify(dir);
    });
    await t.test("termination joins active Python work and releases watcher resources", async () => {
      rmSync(`${dir}/assembly-started`, { force: true });
      writeFileSync(`${dir}/assembly-gate`, "hold");
      writeFileSync(templateFile, template.replace("<body>", '<body data-aud011="shutdown">'));
      await watch.wait(() => existsSync(`${dir}/assembly-started`), "active child before termination");
      const pid = Number(readFileSync(`${dir}/assembly-started`, "utf8"));
      const result = await watch.stop(true);
      assert.equal(result.code, 0, JSON.stringify(result) + watch.log);
      assert.match(watch.log, /\[watch\] stopped/);
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "Python child survived watcher");
      const children = readFileSync(`${dir}/owned-children`, "utf8").trim().split(/\r?\n/).map(JSON.parse);
      assert.ok(children.some(child => /esbuild/.test(child.command)), "Failed to observe esbuild service");
      for (const child of children) assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" }, `Owned child survived: ${child.command}`);
      assert.ok(!readdirSync(`${dir}/.build`).some(name => name.startsWith("watch-")), "Leaked transaction stage");
      assert.ok(!readdirSync(`${dir}/dist/hosted`).some(name => name.endsWith(".watch-tmp")), "Leaked publication file");
    });
  } finally {
    await watch.stop();
    t.diagnostic(`Watcher completion events: ${watch.successes}; native platform: ${process.platform}`);
    if (process.env.AUD011_REPORT) writeFileSync(process.env.AUD011_REPORT, JSON.stringify({
      platform: process.platform, node: process.version, version, finalArtifacts,
      successes: watch.successes, events: watch.events,
      assemblerTrace: existsSync(`${dir}/assembler-trace`) ? readFileSync(`${dir}/assembler-trace`, "utf8") : "",
    }, null, 2) + "\n");
    discard(dir);
  }
});

test("AUD-011 watcher starts with an invalid version and recovers without restart", { timeout: 40_000 }, async () => {
  const dir = projectCopy();
  writeFileSync(`${dir}/version`, "");
  const watch = startWatch(dir);
  try {
    await watch.wait(() => watch.log.includes("Version file is empty"), "startup version error");
    assert.equal(watch.successes, 0);
    const version = "v0.1.15-aud011-startup-recovery";
    writeFileSync(`${dir}/version`, version);
    await watch.wait(() => watch.successes > 0 && outputs(dir, version).every(html => html.includes(version)), "startup recovery");
    verify(dir);
    // Also exercise the other supported POSIX termination signal. Windows CI
    // uses IPC for graceful delivery because child.kill emulates forced exit.
    const result = await watch.stop(true, "SIGINT");
    assert.equal(result.code, 0);
    assert.match(watch.log, /\[watch\] stopped/);
  } finally { await watch.stop(); discard(dir); }
});
