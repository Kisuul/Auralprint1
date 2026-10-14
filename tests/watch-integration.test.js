import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
            raise SystemExit(23)
        runpy.run_path(str(root / 'scripts/assemble_real.py'), run_name='__main__')
    finally:
        trace('end')
`);
}

test("AUD-011 actual watcher: current inputs, coherent packaging, failure recovery and lifecycle", { timeout: 180_000 }, async t => {
  const dir = projectCopy();
  instrumentAssembler(dir);
  const watch = startWatch(dir);
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
    const count = watch.successes;
    const offset = watch.log.length;
    action();
    await watch.wait(() => /failed|Version file|Missing version/.test(watch.log.slice(offset)), "observable failure");
    assert.equal(watch.successes, count, "Failed transaction reported success");
    assert.deepEqual(inventory(dir, version), before, "Failure changed valid editions");
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
      for (let i = 0; i < 10; i++) writeFileSync(templateFile, content);
      const end = Date.now() + quietWindowMs;
      await until(() => {
        assert.equal(watch.successes, count);
        return Date.now() >= end;
      }, "duplicate-event observation");
      let active = 0;
      for (const line of readFileSync(`${dir}/assembler-trace`, "utf8").trim().split(/\r?\n/)) {
        active += line.startsWith("start") ? 1 : -1;
        assert.ok(active >= 0 && active <= 1, "Concurrent Python assemblers");
      }
      assert.equal(active, 0);
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
