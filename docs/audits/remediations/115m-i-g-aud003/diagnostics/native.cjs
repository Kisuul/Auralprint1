// Opt-in native Chromium. Serves built HTML without writing production source.
// Observed route exposes existing objects/functions; controlled AnalysisFrames
// use actual BandBank arrays and dispatch the real VisualizerRuntime lifecycle.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../../..'), args = process.argv.slice(2);
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : null;
const baseline = args.includes('--baseline'), version = fs.readFileSync(path.join(root, 'version'), 'utf8').trim();
const html = fs.readFileSync(option('--html') || path.join(root, `dist/auralprint_${version.slice(1)}.html`), 'utf8');
const marker = '  main();\n})();'; assert.equal(html.split(marker).length, 2);
const observed = html.replace(marker, '  window.__g2 = {preferences, runtime, state, UI, BandBank, VisualizerRuntime, createAnalysisFrame, updateAnalysisFrame, selectOrbAnalysis, ColorPolicy};\n' + marker);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const colorClose = (actual, expected) => { for (const key of ['r', 'g', 'b']) close(actual[key], expected[key]); };
async function main() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost').pathname;
    if (url === '/observed.html' || url === '/plain.html') { res.setHeader('Content-Type', 'text/html'); res.end(url === '/plain.html' ? html : observed); return; }
    const file = path.join(root, 'dist/hosted', url);
    if (file.startsWith(path.join(root, 'dist/hosted')) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.end(fs.readFileSync(file)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const evidence = { phase: 'G.2', baseline, version, browser: await browser.version(), htmlSha256: crypto.createHash('sha256').update(html).digest('hex'), cases: [] };
  let current;
  async function app(plain = false) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); current = p; p.setDefaultTimeout(12000); p.errors = []; p.consoleErrors = [];
    p.on('pageerror', e => p.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.consoleErrors.push(m.text()); });
    await p.goto(base + (plain ? '/plain.html' : '/observed.html'));
    await p.evaluate(() => document.getElementById('btnOpenVisualizers').click()); return p;
  }
  function scene(count, ids, extra = false) { return { schema: 10, prefs: { bands: { count, particleColorSource: 'dominant' }, orbs: [{ id: 'A', chanId: 'L', bandIds: ids, hueOffsetDeg: 17, particles: { emitPerSecond: 0 } }, ...(extra ? [{ id: 'B', chanId: 'R', bandIds: [2, 255], particles: { emitPerSecond: 0 } }] : [])] } }; }
  async function apply(p, preset) {
    await p.evaluate(preset => {
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(preset)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      history.replaceState(null, '', '#p=' + encoded); document.getElementById('btnApplyUrl').click();
    }, preset); await p.waitForTimeout(50);
  }
  async function open(p) {
    await p.evaluate(() => { const root = document.querySelector('#orbEditorList [data-orb-id="A"]'); root.open = true; root.querySelector('.band-chooser').open = true; });
    await p.waitForTimeout(30);
  }
  async function share(p) {
    return p.evaluate(() => {
      document.getElementById('btnShare').click(); const raw = location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0))));
    });
  }
  async function snapshot(p) {
    return p.evaluate(() => {
      const root = document.querySelector('#orbEditorList [data-orb-id="A"]'), picker = root.querySelector('.orb-band-picker');
      const rows = [...picker.querySelectorAll('.picker-band')];
      return { summary: picker.querySelector('.band-selection-summary').textContent, bank: picker.querySelector('.band-chooser .panel-description').textContent,
        activeChoices: rows.filter(row => !row.querySelector('input').disabled).map(row => Number(/band (\d+)/.exec(row.querySelector('input').getAttribute('aria-label'))[1])),
        shown: rows.filter(row => !row.hidden).length, rangeMax: picker.querySelector('input[type="number"]').max,
        exactHelp: root.querySelector('[id$="-bands"]').getAttribute('aria-description'), band255: rows[255]?.querySelector('.picker-frequency').textContent || null };
    });
  }
  async function check(name, p, fn) {
    let data, passed = true, failure;
    try { data = await fn(); assert.deepEqual(p.errors, []); assert.deepEqual(p.consoleErrors, []); }
    catch (e) { passed = false; failure = e.message; }
    evidence.cases.push({ name, passed, failure, data, pageErrors: [...p.errors], consoleErrors: [...p.consoleErrors] });
  }
  async function response(p, chanId) {
    await p.evaluate(chanId => { const c = document.querySelector('[data-orb-id="A"] [id$="-channel"]'); c.value = chanId; c.dispatchEvent(new Event('change', { bubbles: true })); }, chanId);
    return p.evaluate(() => {
      const a = __g2, bank = a.state.bands, count = a.runtime.settings.bands.count, ids = a.preferences.orbs[0].bandIds;
      const first = ids.includes(5) ? 5 : 0;
      for (const [id, energy] of [['L', .9], ['R', .1], ['C', .5]]) {
        const energies = bank.channels[id].energies01; energies.fill(.2);
        if (first < count) energies[first] = energy;
        if (ids.includes(2) && count > 2) energies[2] = id === 'L' ? .7 : id === 'R' ? .3 : .4;
        if (count > 255) energies[255] = .3;
      }
      const sample = { ready: true, monoLike: false, bands: Object.fromEntries([['L', .8, .75], ['R', .2, -.5], ['C', .6, .25]].map(([id, energy01, wave]) => [id, { energy01, timeDomain: Float32Array.of(wave) }])) };
      const frame = a.updateAnalysisFrame(a.createAnalysisFrame(), sample, bank); frame.spectrum.dominantIndex = 2;
      const orb = a.state.orbs.find(o => o.id === 'A'), selection = a.selectOrbAnalysis(orb, frame);
      a.VisualizerRuntime.update({ dtSec: 0, motionDtSec: 0, nowSec: performance.now() / 1000, simPaused: false, analysisFrame: frame });
      const fallback = selection.selectedDominantBandIndex ?? 2;
      return { count, chanId: orb.chanId, bandIds: [...orb.bandIds], lengths: Object.fromEntries(['L', 'R', 'C'].map(id => [id, frame.channels[id].bandEnergies01.length])),
        energy: selection.energyOverride01, dominant: selection.selectedDominantBandIndex, radius: orb.baseRadiusPx, displacement: orb.radialDispPx,
        minDim: Math.min(a.state.widthPx, a.state.heightPx), response: { ...orb.response }, full: frame.channels[orb.chanId].energy01, waveform: frame.channels[orb.chanId].waveform[0],
        inheritedColor: a.ColorPolicy.pickParticleColorRgb01(0, orb, 2, selection.selectedDominantBandIndex), expectedInherited: a.ColorPolicy.bandRgb01(fallback, 17),
        explicitColor: a.ColorPolicy.pickParticleColorRgb01(0, { ...orb, colorSource: 'dominant' }, 2, selection.selectedDominantBandIndex), expectedExplicit: a.ColorPolicy.bandRgb01(2, 17) };
    });
  }
  try {
    const fixtures = baseline ? [[3, [255]], [3, [0, 255]]] : [[3, [255]], [3, [0, 255]], [3, [0, 2]], [32, [5, 100, 255]], [256, [5, 100, 255]], [3, []]];
    for (const [count, ids] of fixtures) {
      const p = await app(); await apply(p, scene(count, ids)); await open(p);
      await check(`count ${count}, targets [${ids}]: production picker and persistence`, p, async () => {
        const ui = await snapshot(p), preset = await share(p); assert.deepEqual(preset.prefs.orbs[0].bandIds, ids);
        if (baseline) { assert.deepEqual(ui.activeChoices, Array.from({ length: 256 }, (_, i) => i)); assert.equal(ui.band255, 'n/a'); assert.doesNotMatch(ui.summary, /inactive/); }
        else { assert.deepEqual(ui.activeChoices, Array.from({ length: count }, (_, i) => i)); assert.equal(ui.rangeMax, String(count - 1));
          const active = ids.filter(index => index < count).length;
          if (ids.length) { assert.match(ui.summary, new RegExp(`${active} active target`)); assert.match(ui.summary, new RegExp(`${ids.length - active} inactive target`)); }
          else assert.match(ui.summary, /Full spectrum/);
          assert.match(ui.exactHelp, new RegExp(`active indices 0–${count - 1}`));
        } return { ui, persisted: preset.prefs.orbs[0].bandIds };
      });
      for (const chanId of baseline ? ['C'] : ['L', 'R', 'C']) await check(`count ${count}, [${ids}], ${chanId}: real runtime energy/radius/color`, p, async () => {
        const r = await response(p, chanId), firstEnergy = { L: .9, R: .1, C: .5 }[chanId];
        let expected = ids.length ? (ids.some(index => index < count) ? firstEnergy : 0) : null;
        let dominant = ids.length ? (ids.some(index => index < count) ? (ids.includes(5) ? 5 : 0) : null) : null;
        if (ids.includes(2)) { expected = { L: .8, R: .2, C: .45 }[chanId]; dominant = chanId === 'R' ? 2 : 0; }
        if (count === 256 && ids.includes(100)) { expected = (firstEnergy + .2 + .3) / 3; dominant = chanId === 'R' ? 255 : 5; }
        if (baseline) { expected = ids.length === 1 ? 0 : .25; dominant = ids.length === 1 ? 255 : 0; }
        if (expected === null) assert.equal(r.energy, null); else close(r.energy, expected);
        assert.equal(r.dominant, dominant); assert.deepEqual(r.lengths, { L: count, R: count, C: count });
        const energy = expected ?? r.full, radius = r.minDim * (r.response.minRadiusFrac + (r.response.maxRadiusFrac - r.response.minRadiusFrac) * energy);
        close(r.radius, radius); close(r.displacement, radius * r.response.waveformRadialDisplaceFrac * r.waveform);
        colorClose(r.inheritedColor, r.expectedInherited); colorClose(r.explicitColor, r.expectedExplicit); return r;
      }); await p.close(); current = null;
    }
    if (!baseline) {
      const p = await app(); await apply(p, scene(256, [5, 100, 255], true)); await open(p);
      await check('256 → 32 → 3 → 256 preserves targets, native editor focus/roots/drafts and reactivates', p, async () => {
        await p.locator('[data-orb-id="A"] input[type="search"]').fill('255');
        await p.locator('[data-orb-id="A"] .picker-range input').nth(0).fill('7');
        await p.locator('[data-orb-id="A"] .picker-range input').nth(1).fill('12');
        await p.locator('[data-orb-id="A"] .picker-range input').nth(0).focus();
        await p.evaluate(() => { window.__focus = document.activeElement; window.__root = __focus.closest('.orb-editor-card'); window.__picker = __focus.closest('.orb-band-picker'); __root.scrollTop = 123; });
        const result = [];
        for (const count of [32, 3, 256]) {
          await apply(p, scene(count, [5, 100, 255], true)); await open(p);
          assert.equal(await p.evaluate(() => document.activeElement === __focus && __focus.isConnected && __focus.closest('.orb-editor-card') === __root && __focus.closest('.orb-band-picker') === __picker), true);
          assert.equal(await p.locator('[data-orb-id="A"] input[type="search"]').inputValue(), '255');
          assert.equal(await p.locator('[data-orb-id="A"] .picker-range input').nth(0).inputValue(), '7');
          assert.equal(await p.locator('[data-orb-id="A"] .picker-range input').nth(1).inputValue(), '12');
          const preset = await share(p); assert.deepEqual(preset.prefs.orbs[0].bandIds, [5, 100, 255]);
          const ui = await snapshot(p); assert.deepEqual(ui.activeChoices, Array.from({ length: count }, (_, i) => i)); result.push(ui);
        }
        const shared = await share(p), hash = await p.evaluate(() => location.hash); await p.goto(base + '/observed.html' + hash); await open(p);
        const reloaded = await share(p); assert.deepEqual(reloaded.prefs.orbs, shared.prefs.orbs);
        const r = await response(p, 'L'); close(r.energy, (.9 + .2 + .3) / 3); assert.equal(r.dominant, 5); return { transitions: result, reloadedTargets: r.bandIds };
      }); await p.close(); current = null;
      for (const action of ['edit', 'duplicate', 'remove', 'edit-ring']) {
        const p = await app(); await apply(p, scene(256, [5, 100, 255], true));
        await check(`G.1 ${action} exact native focus survives bank changes`, p, async () => {
          await p.evaluate(action => { window.__focus = [...document.querySelectorAll(`#visualizerList [data-action="${action}"]`)].find(b => action === 'edit-ring' || b.dataset.orbId === 'A'); window.__row = __focus.closest('.visualizer-item'); __focus.focus(); }, action);
          for (const count of [32, 3, 256]) {
            await apply(p, scene(count, [5, 100, 255], true));
            assert.equal(await p.evaluate(() => document.activeElement === __focus && __focus.isConnected && __focus.closest('.visualizer-item') === __row), true);
          } return { action, exactNodeRetained: true, connected: true };
        }); await p.close(); current = null;
      }
      {
        const p = await app(true); await apply(p, scene(3, [0, 255], true)); await open(p);
        await check('unmodified portable: checkbox/range edits keep inactive targets; Full spectrum clears all', p, async () => {
          const root = p.locator('#orbEditorList [data-orb-id="A"]');
          await root.locator('.picker-band input').nth(1).check(); assert.deepEqual((await share(p)).prefs.orbs[0].bandIds, [0, 255, 1]);
          await root.locator('.picker-range input').nth(0).fill('0'); await root.locator('.picker-range input').nth(1).fill('255');
          await root.getByRole('button', { name: 'Use range', exact: true }).click(); assert.deepEqual((await share(p)).prefs.orbs[0].bandIds, [0, 255, 1]);
          assert.match(await root.locator('.band-chooser .picker-error').textContent(), /0 to 2/);
          await root.locator('.picker-range input').nth(0).fill('1'); await root.locator('.picker-range input').nth(1).fill('2');
          await root.getByRole('button', { name: 'Use range', exact: true }).click(); assert.deepEqual((await share(p)).prefs.orbs[0].bandIds, [1, 2, 255]);
          assert.deepEqual((await share(p)).prefs.orbs[1].bandIds, [2, 255]);
          await root.getByRole('button', { name: 'Orb A: use full spectrum', exact: true }).click();
          const exported = await share(p); assert.deepEqual(exported.prefs.orbs[0].bandIds, []); assert.deepEqual(exported.prefs.orbs[1].bandIds, [2, 255]); return exported.prefs.orbs.map(o => ({ id: o.id, bandIds: o.bandIds }));
        }); await p.close(); current = null;
      }
      {
        const p = await app(); await apply(p, scene(3, [255], true)); await open(p);
        await check('native exact authored inactive entry and invalid draft remain truthful and independent', p, async () => {
          await p.evaluate(() => document.querySelector('[data-orb-id="A"] .advanced-control').open = true);
          const input = p.locator('[data-orb-id="A"] [id$="-bands"]'); await input.fill('0,255'); await input.dispatchEvent('change');
          assert.deepEqual((await share(p)).prefs.orbs[0].bandIds, [0, 255]); assert.equal(await input.getAttribute('aria-invalid'), 'false');
          assert.match((await snapshot(p)).summary, /1 active target · 1 inactive target \(255\)/);
          await input.fill('0, 256, nope'); await input.dispatchEvent('change'); assert.equal(await input.getAttribute('aria-invalid'), 'true');
          await apply(p, scene(32, [0, 255], true)); assert.equal(await input.inputValue(), '0, 256, nope'); assert.equal(await input.getAttribute('aria-invalid'), 'true');
          assert.deepEqual((await share(p)).prefs.orbs[0].bandIds, [0, 255]);
          await input.fill('0,2'); await input.dispatchEvent('change'); const exported = await share(p);
          assert.deepEqual(exported.prefs.orbs[0].bandIds, [0, 2]); assert.deepEqual(exported.prefs.orbs[1].bandIds, [2, 255]); return exported.prefs.orbs.map(o => ({ id: o.id, bandIds: o.bandIds }));
        }); await p.close(); current = null;
      }
    }
  } catch (e) { evidence.infrastructureFailure = { message: e.message, stack: e.stack, pageErrors: current?.errors }; }
  finally {
    // Exact domain equality is asserted above; compact the repetitive index lists.
    for (const c of evidence.cases) for (const ui of [c.data?.ui, ...(c.data?.transitions || [])]) {
      if (Array.isArray(ui?.activeChoices)) {
        const ids = ui.activeChoices; ui.activeChoices = { count: ids.length, first: ids[0] ?? null, last: ids.at(-1) ?? null };
      }
    }
    evidence.summary = { total: evidence.cases.length, passed: evidence.cases.filter(c => c.passed).length, failed: evidence.cases.filter(c => !c.passed).length, infrastructureFailure: !!evidence.infrastructureFailure };
    fs.writeFileSync(option('--output') || path.join(root, 'work/g2-native.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence.summary)); await browser.close(); await new Promise(r => server.close(r)); process.exitCode = evidence.summary.failed || evidence.infrastructureFailure ? 1 : 0;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
