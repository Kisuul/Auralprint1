// Replay accepted scripts/version in a disposable copy; never downgrade the checkout.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { artifactPaths, discard, inventory, outputs, projectCopy, root, startWatch, until } from "../../../../../scripts/test-support/watch-harness.mjs";

const report = { baseline: "a2f484b845df69e717ebd3998cabb7db640eb6c6", platform: process.platform, node: process.version, cases: [] };
for (const kind of ["template", "version"]) {
  const dir = projectCopy();
  for (const file of ["scripts/build.mjs", "scripts/watch.mjs", "version", "src/js/core/constants.js"]) {
    writeFileSync(`${dir}/${file}`, execFileSync("git", ["show", `${report.baseline}:${file}`], { cwd: root }));
  }
  const watch = startWatch(dir);
  const version = readFileSync(`${dir}/version`, "utf8").trim();
  const next = "v0.1.15-aud011-diagnostic";
  try {
    await watch.wait(() => watch.successes > 0 && outputs(dir, version).every(Boolean), "initial assembly");
    const initial = inventory(dir, version);
    const before = watch.successes;
    const marker = 'data-aud011="template-diagnostic"';
    if (kind === "template") {
      const file = `${dir}/src/index.template.html`;
      writeFileSync(file, readFileSync(file, "utf8").replace("<body>", `<body ${marker}>`));
    } else writeFileSync(`${dir}/version`, `${next}\n`);
    // Observe hashes AND completion events throughout a bounded window. Then use a
    // positive JS control in this same live process to distinguish a dead harness.
    let samples = 0;
    const end = Date.now() + 3_000;
    await until(() => {
      assert.equal(watch.successes, before, "Original watcher unexpectedly assembled");
      assert.deepEqual(inventory(dir, version), initial);
      assert.equal(outputs(dir, next)[0], "");
      samples++;
      return Date.now() >= end;
    }, "bounded unchanged-output observation", 5_000);
    const afterEdit = inventory(dir, version);
    appendFileSync(`${dir}/src/js/main.js`, '\nconsole.info("AUD011-positive-control");\n');
    await watch.wait(() => watch.successes > before && outputs(dir, version).every(text => text.includes("AUD011-positive-control")), "positive JS rebuild control");
    const final = outputs(dir, version);
    assert.ok(final.every(text => text.includes(version)));
    if (kind === "template") assert.ok(final.every(text => text.includes(marker)));
    assert.equal(outputs(dir, next)[0], "");
    report.cases.push({ kind, version, attemptedVersion: kind === "version" ? next : version, initial, afterEdit,
      afterJsControl: inventory(dir, version), newVersionPath: artifactPaths(dir, next)[0].split("/dist/")[1],
      newVersionExists: false, samples, successesBefore: before, successesAfterControl: watch.successes,
      templateUsedAfterJs: kind === "template" ? final.every(text => text.includes(marker)) : null,
      oldVersionRetained: true, events: watch.events });
  } finally { await watch.stop(); discard(dir); }
}
writeFileSync(new URL("./baseline-reproduction.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
