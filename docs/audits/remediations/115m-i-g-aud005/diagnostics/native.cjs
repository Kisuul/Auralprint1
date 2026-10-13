// Opt-in native Chromium verification; run after build, never writes app source.
// --baseline uses accepted HTML captured before editing. See README for probes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../../..');
const args = process.argv.slice(2);
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : null;
const baseline = args.includes('--baseline');
const version = fs.readFileSync(path.join(root, 'version'), 'utf8').trim();
const html = fs.readFileSync(option('--html') || path.join(root, baseline ? 'work/baseline.html' : `dist/auralprint_${version.slice(1)}.html`), 'utf8');
function wav() {
  const n = 44100 * 12, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(176400, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) b.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * (c + 1) * i / 44100)), 44 + i * 4 + c * 2);
  return b;
}
function delayResume() {
  const Native = window.AudioContext;
  window.__fileProbe = { held: null, completed: false };
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); this.suspend(); }
    resume() {
      if (!__fileProbe.held && !__fileProbe.completed) return new Promise((resolve, reject) => {
        __fileProbe.held = () => { __fileProbe.completed = true; return Native.prototype.resume.call(this).then(resolve, reject); };
      });
      return Native.prototype.resume.call(this);
    }
  };
}
async function main() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost').pathname;
    if (url === '/app.html') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    const file = path.join(root, 'dist/hosted', url);
    if (file.startsWith(path.join(root, 'dist/hosted')) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.end(fs.readFileSync(file)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const results = { baseline, version, browser: await browser.version(), htmlSha256: crypto.createHash('sha256').update(html).digest('hex'), cases: [] };
  const url = `http://127.0.0.1:${server.address().port}/app.html`;
  async function app(delay = false) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    p.setDefaultTimeout(12000); p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    if (delay) await p.addInitScript(delayResume);
    await p.goto(url);
    await p.evaluate(() => document.getElementById('btnOpenVisualizers').click());
    await p.waitForFunction(() => document.querySelectorAll('#visualizerList [data-action="edit"]').length >= 2);
    return p;
  }
  async function focus(p, action = 'edit', index = 0) {
    return p.evaluate(({ action, index }) => {
      window.__focused = document.querySelectorAll(`#visualizerList [data-action="${action}"]`)[index];
      window.__row = __focused.closest('.visualizer-item'); __focused.focus();
      return { tag: document.activeElement.tagName, action: __focused.dataset.action, id: __focused.dataset.orbId || 'spectral-ring' };
    }, { action, index });
  }
  async function snapshot(p) {
    return p.evaluate(() => {
      const old = __focused, current = document.activeElement;
      const replacement = Array.from(document.querySelectorAll('#visualizerList [data-action]')).find(b => b.dataset.action === old.dataset.action && b.dataset.orbId === old.dataset.orbId);
      return { active: { tag: current.tagName, action: current.dataset.action || null, id: current.dataset.orbId || null }, sameFocus: current === old, connected: old.isConnected, sameRow: replacement?.closest('.visualizer-item') === __row, sameNode: replacement === old, stableId: old.dataset.orbId || 'spectral-ring', actionAvailable: !!replacement };
    });
  }
  async function record(name, p, before, expectedSurvival = true) {
    const after = await snapshot(p); let passed = true, failure;
    try {
      if (expectedSurvival) { assert.equal(after.sameFocus, true); assert.equal(after.connected, true); assert.equal(after.sameRow, true); assert.equal(after.sameNode, true); }
      else { assert.equal(after.sameFocus, false); assert.equal(after.connected, false); assert.equal(after.active.tag, 'BODY'); assert.equal(after.actionAvailable, true); }
      assert.deepEqual(p.errors, []);
    } catch (e) { passed = false; failure = e.message; }
    results.cases.push({ name, before, after, passed, failure, pageErrors: p.errors });
  }
  async function check(name, p, fn) {
    let passed = true, failure, evidence;
    try { evidence = await fn(); assert.deepEqual(p.errors, []); }
    catch (e) { passed = false; failure = e.message; }
    results.cases.push({ name, passed, failure, evidence, pageErrors: [...p.errors] });
  }
  async function readPreset(p) {
    return p.evaluate(() => {
      document.getElementById('btnShare').click();
      const raw = location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0))));
    });
  }
  async function applyPreset(p, preset) {
    await p.evaluate(preset => {
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(preset)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      history.replaceState(null, '', '#p=' + encoded);
      document.getElementById('btnApplyUrl').click();
    }, preset);
    await p.waitForTimeout(80);
  }
  try {
    for (const action of baseline ? ['edit'] : ['edit', 'duplicate', 'remove', 'edit-ring']) {
      const p = await app(); const before = await focus(p, action);
      await p.evaluate(() => { const volume = document.getElementById('rngVol'); volume.value = '0.37'; volume.dispatchEvent(new Event('input', { bubbles: true })); });
      await p.waitForTimeout(80);
      await record(`${action}: unrelated volume via production input handler`, p, before, !baseline);
      if (!baseline) {
        await p.evaluate(() => { const mute = document.getElementById('chkMute'); mute.checked = true; mute.dispatchEvent(new Event('change', { bubbles: true })); });
        await p.waitForTimeout(80); await record(`${action}: unrelated mute via production change handler`, p, before);
      }
      // H is a real native key: lost focus exposes global panel shortcut.
      const visibleBefore = await p.locator('#visualizersPanel').isVisible();
      await p.keyboard.press('h');
      const visibleAfter = await p.locator('#visualizersPanel').isVisible();
      const keyboardPassed = baseline ? visibleBefore !== visibleAfter : visibleBefore === visibleAfter;
      results.cases.push({ name: `${action}: native H shortcut suppression`, passed: keyboardPassed, visibleBefore, visibleAfter });
      await p.close();
    }
    for (const action of baseline ? ['edit'] : ['edit', 'duplicate', 'remove', 'edit-ring']) {
      const p = await app(true);
      await p.locator('#fileInput').setInputFiles([
        { name: 'delayed-real.wav', mimeType: 'audio/wav', buffer: wav() },
        { name: 'next-real.wav', mimeType: 'audio/wav', buffer: wav() },
      ]);
      await p.waitForFunction(() => !!__fileProbe.held);
      const before = await focus(p, action);
      await p.evaluate(() => __fileProbe.held());
      await p.waitForFunction(() => document.getElementById('audioStatus').textContent.includes('delayed-real.wav') && !document.getElementById('btnPlay').disabled);
      await p.waitForTimeout(80);
      await record(`${action}: delayed real File activation completion`, p, before, !baseline);
      if (!baseline) await check(`${action}: native transport/launcher keys suppressed after File completion`, p, async () => {
        for (const key of ['n', 'p', 'h', 'ArrowRight']) await p.keyboard.press(key);
        await p.waitForTimeout(80);
        const after = await snapshot(p); assert.equal(after.sameFocus, true);
        assert.equal(await p.locator('#visualizersPanel').isVisible(), true);
        assert.match(await p.locator('#audioStatus').textContent(), /delayed-real.wav/); return after;
      });
      await p.close();
    }
    if (!baseline) {
      for (const action of ['edit', 'duplicate', 'remove']) {
        const p = await app(), preset = await readPreset(p);
        const before = await focus(p, action, 1); preset.prefs.orbs.reverse();
        await applyPreset(p, preset); await record(`${action}: native focused Orb reorder via schema-10 preset`, p, before);
        await check(`${action}: reordered numbering and accessible name`, p, async () => {
          const info = await p.evaluate(() => ({ rowIndex: Array.from(__row.parentNode.children).indexOf(__row), name: __row.querySelector('strong').textContent, label: __focused.getAttribute('aria-label') }));
          assert.equal(info.rowIndex, 1); assert.equal(info.name, 'Orb 1'); assert.match(info.label, /Orb 1/); return info;
        });
        preset.prefs.orbs[0].chanId = 'R'; preset.prefs.orbs[0].bandIds = [2, 7];
        await applyPreset(p, preset); await record(`${action}: summary-only update retains native node/focus`, p, before);
        assert.match(await p.evaluate(() => __row.textContent), /R · 2 bands/);
        await p.close();
      }
      {
        const p = await app(), before = await focus(p, 'edit-ring');
        await p.evaluate(() => { const c = document.getElementById('chkBandOverlay'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
        await p.waitForTimeout(80); await record('Ring visibility updates without native focus loss', p, before);
        await check('Ring truthful hidden status and Enter edit activation', p, async () => {
          assert.match(await p.evaluate(() => __row.textContent), /Hidden/); await p.keyboard.press('Enter');
          assert.equal(await p.locator('#spectralRingEditor').evaluate(e => e.open), true);
          assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('#spectralRingEditor summary')), true);
        }); await p.close();
      }
      {
        const p = await app();
        await check('native Enter Add then Space Duplicate focus the new Edit actions', p, async () => {
          await p.locator('#btnVisualizersAddOrb').focus(); await p.keyboard.press('Enter');
          const added = await p.evaluate(() => ({ ...document.activeElement.dataset })); assert.equal(added.action, 'edit'); assert.equal(added.orbId, 'ORB2');
          await focus(p, 'duplicate', 2); await p.keyboard.press('Space');
          const copy = await p.evaluate(() => ({ ...document.activeElement.dataset })); assert.equal(copy.action, 'edit'); assert.equal(copy.orbId, 'ORB3');
          await p.keyboard.press('Enter');
          const edited = await p.evaluate(() => ({ id: document.activeElement.closest('[data-orb-id]')?.dataset.orbId, tag: document.activeElement.tagName }));
          assert.equal(edited.id, 'ORB3'); return { added, copy, edited };
        }); await p.close();
      }
      {
        const p = await app(); await focus(p, 'remove');
        await check('cancelled native Remove leaves exact focus and collection', p, async () => {
          p.once('dialog', d => d.dismiss()); await p.keyboard.press('Enter');
          const after = await snapshot(p); assert.equal(after.sameFocus, true); assert.equal(after.connected, true);
          assert.equal(await p.locator('#visualizerList [data-action="edit"]').count(), 2); return after;
        });
        await check('native focused Remove uses nearest Orb Edit then final removal Add fallback', p, async () => {
          p.once('dialog', d => d.accept()); await p.keyboard.press('Enter');
          const nearest = await p.evaluate(() => ({ ...document.activeElement.dataset })); assert.deepEqual(nearest, { action: 'edit', orbId: 'ORB1' });
          await focus(p, 'remove'); p.once('dialog', d => d.accept()); await p.keyboard.press('Enter');
          assert.equal(await p.evaluate(() => document.activeElement.id), 'btnVisualizersAddOrb');
          assert.equal(await p.locator('#visualizerList [data-action="edit"]').count(), 0); return { nearest, finalFocus: 'btnVisualizersAddOrb' };
        }); await p.close();
      }
      {
        const p = await app(), before = await focus(p, 'duplicate', 1);
        p.once('dialog', d => d.accept()); await p.evaluate(() => document.querySelector('#visualizerList [data-action="remove"]').click());
        await record('removing another Orb preserves native focused survivor Duplicate', p, before); await p.close();
      }
      {
        const p = await app(); await p.locator('#rngVol').focus();
        await check('native external focus stays external during inventory updates', p, async () => {
          await p.evaluate(() => { window.__outside = document.activeElement; const c = document.getElementById('chkBandOverlay'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
          await p.waitForTimeout(80); assert.equal(await p.evaluate(() => document.activeElement === __outside && __outside.isConnected), true);
          return { activeId: await p.evaluate(() => document.activeElement.id) };
        }); await p.close();
      }
      {
        const p = await app(), preset = await readPreset(p); preset.prefs.orbs[0].id = 'spectral-ring'; await applyPreset(p, preset);
        const before = await focus(p, 'edit'); await applyPreset(p, preset); await record('native Orb ID spectral-ring survives independently', p, before);
        await check('type-safe native collision Edit/Remove dispatch leaves Ring', p, async () => {
          await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.closest('[data-orb-id]')?.dataset.orbId), 'spectral-ring');
          await focus(p, 'remove'); p.once('dialog', d => { assert.match(d.message(), /Remove Orb 1 \(spectral-ring\)/); d.accept(); }); await p.keyboard.press('Enter');
          assert.equal(await p.locator('#visualizerList [data-action="edit-ring"]').count(), 1);
          await focus(p, 'edit-ring'); await p.keyboard.press('Enter');
          assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('#spectralRingEditor summary')), true);
        }); await p.close();
      }
    }
  } catch (e) {
    results.infrastructureFailure = { message: e.message, stack: e.stack };
  } finally {
    results.summary = { total: results.cases.length, passed: results.cases.filter(c => c.passed).length, failed: results.cases.filter(c => !c.passed).length };
    fs.writeFileSync(option('--output') || path.join(root, 'work/native.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results.summary)); await browser.close(); await new Promise(r => server.close(r));
    process.exitCode = results.summary.failed || results.infrastructureFailure ? 1 : 0;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
