import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(testDir, "..", "src", "index.template.html");
const templateHtml = readFileSync(templatePath, "utf8");

function extractDivBlock(html, panelId) {
  const idToken = `id="${panelId}"`;
  const idIndex = html.indexOf(idToken);
  assert.notEqual(idIndex, -1, `Expected template to include ${panelId}.`);

  const start = html.lastIndexOf("<div", idIndex);
  assert.notEqual(start, -1, `Expected ${panelId} to be inside a div block.`);

  const tagPattern = /<\/?div\b[^>]*>/g;
  tagPattern.lastIndex = start;
  let depth = 0;

  while (true) {
    const match = tagPattern.exec(html);
    assert.ok(match, `Could not find the closing div for ${panelId}.`);
    depth += match[0].startsWith("</div") ? -1 : 1;
    if (depth === 0) return html.slice(start, tagPattern.lastIndex);
  }
}

function assertIncludesAll(block, ids) {
  for (const id of ids) {
    assert.match(block, new RegExp(`id="${id}"`), `Expected block to include ${id}.`);
  }
}

function assertExcludesAll(block, ids) {
  for (const id of ids) {
    assert.doesNotMatch(block, new RegExp(`id="${id}"`), `Did not expect block to include ${id}.`);
  }
}

test("template assigns Audio Source ownership to source and transport controls", () => {
  const audioSourceBlock = extractDivBlock(templateHtml, "audioPanel");

  assertIncludesAll(audioSourceBlock, [
    "btnSourceFile",
    "btnSourceMic",
    "btnSourceStream",
    "btnLoad",
    "btnPrev",
    "btnNext",
    "btnPlay",
    "btnStop",
    "btnRepeat",
    "btnShuffle",
    "chkMute",
    "rngVol",
    "btnToggleQueue",
    "btnHideAudio",
  ]);
  assertExcludesAll(audioSourceBlock, ["btnRecordStart", "btnShare", "rngRmsGain"]);
});

test("template assigns Recording ownership to recording/export controls only", () => {
  const recordingBlock = extractDivBlock(templateHtml, "recordPanel");

  assertIncludesAll(recordingBlock, [
    "btnRecordStart",
    "btnRecordStop",
    "btnRecordDownloadLast",
    "chkRecordIncludeAudio",
    "selRecordMime",
    "selRecordTargetFps",
    "btnHideRecord",
  ]);
  assertExcludesAll(recordingBlock, ["btnSourceFile", "btnShare", "selDistMode"]);
});

test("template assigns Workspace / Presets ownership to preset and sharing actions", () => {
  const workspaceBlock = extractDivBlock(templateHtml, "workspacePanel");

  assertIncludesAll(workspaceBlock, ["btnShare", "btnApplyUrl", "btnResetPrefs", "btnHideWorkspace"]);
  assertExcludesAll(workspaceBlock, ["btnResetVisuals", "btnRecordStart", "btnSourceFile"]);
});

test("template assigns Analysis ownership to analyzer-core controls", () => {
  const analysisBlock = extractDivBlock(templateHtml, "analysisPanel");

  assertIncludesAll(analysisBlock, ["rngRmsGain", "rngSmooth", "selFFT", "btnHideAnalysis"]);
  assertExcludesAll(analysisBlock, ["selDistMode", "btnShare", "btnRecordStart"]);
});

test("template assigns Banking ownership to spectral banking and HUD controls", () => {
  const bankingBlock = extractDivBlock(templateHtml, "bankingPanel");

  assertIncludesAll(bankingBlock, [
    "selParticleColorSrc",
    "selDistMode",
    "chkBandOverlay",
    "selRingPhaseMode",
    "rngHueOff",
    "bandDebug",
    "bandMeta",
    "bandTable",
    "btnHideBanking",
  ]);
  assertExcludesAll(bankingBlock, ["btnSourceFile", "btnRecordStart", "btnShare"]);
});

test("template assigns Scene ownership to current render-facing controls", () => {
  const sceneBlock = extractDivBlock(templateHtml, "scenePanel");

  assertIncludesAll(sceneBlock, [
    "btnResetVisuals",
    "clrBg",
    "clrParticle",
    "selLineColorMode",
    "chkLines",
    "rngEmit",
    "rngOmega",
    "rngMinRad",
    "rngMaxRad",
    "btnHideScene",
  ]);
  assertExcludesAll(sceneBlock, ["btnShare", "btnRecordStart", "selDistMode"]);
});
